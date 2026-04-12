import crypto from 'crypto';
import {
  consumeLogSource,
  createLogFingerprint,
  deriveLogTitle,
  getLogSpikeThreshold,
  normalizeLogMessage,
  resolveLogSeverity,
  shouldProcessLogLine,
  validateLogCheckerConfig
} from '../../checkers/log/index.ts';
import { createCheckerResult, getAllActiveCheckers } from '../checkers/repository.ts';
import {
  createMonitoringAlert,
  deleteOldLogBuckets,
  getActiveLogSummaryByService,
  getRecentBucketsByCheckerId,
  incrementLogBucket,
  insertLogCluster,
  rehydrateClusterRecords,
  updateLogCluster
} from './repository.ts';
import { getServiceById } from '../services/repository.ts';
import { updateServiceSnapshot } from '../monitoring/snapshots.ts';
import type { Checker, LogCheckerConfig, LogSeverity, LogSourceType } from '../../shared/types.ts';

interface StoredRuntimeCluster {
  id: string;
  serviceId: string;
  checkerId: string;
  fingerprint: string;
  normalizedMessage: string;
  title: string;
  sampleLog: string;
  totalCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  severity: LogSeverity;
  sourceType: LogSourceType;
  metadataJson: string;
}

interface RuntimeClusterState {
  cluster: StoredRuntimeCluster;
  minuteBuckets: Map<string, number>;
  lastSpikeAlertBucket: string | null;
}

interface CheckerRuntime {
  checker: Checker;
  configHash: string;
  controller: AbortController;
  clusters: Map<string, RuntimeClusterState>;
}

const activeRuntimes = new Map<string, CheckerRuntime>();

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function bucketIso(dateMs: number): string {
  return new Date(Math.floor(dateMs / 60000) * 60000).toISOString();
}

function trimBuckets(runtimeCluster: RuntimeClusterState, nowMs: number): number {
  const cutoffIso = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
  for (const bucketStart of runtimeCluster.minuteBuckets.keys()) {
    if (bucketStart < cutoffIso) runtimeCluster.minuteBuckets.delete(bucketStart);
  }

  let count24h = 0;
  for (const value of runtimeCluster.minuteBuckets.values()) count24h += value;
  return count24h;
}

function mapSeverityToCheckerStatus(severity: LogSeverity): 'failure' | 'error' {
  return severity === 'critical' ? 'error' : 'failure';
}

function syncServiceLogSummary(serviceId: string, lastAlertAt?: string | null): void {
  const summary = getActiveLogSummaryByService(serviceId);
  updateServiceSnapshot(serviceId, {
    log: {
      warningCount: summary.warningCount,
      criticalCount: summary.criticalCount,
      lastIssueAt: summary.lastIssueAt,
      lastAlertAt: lastAlertAt ?? undefined
    },
    touchCheckTimestamps: false
  });
}

function persistRuntimeCluster(runtimeCluster: RuntimeClusterState): void {
  updateLogCluster(runtimeCluster.cluster);
}

function createAlert(
  runtimeCluster: RuntimeClusterState,
  checker: Checker,
  eventType: 'cluster_created' | 'spike' | 'severity_changed',
  message: string
): void {
  const createdAt = new Date().toISOString();

  createMonitoringAlert({
    id: crypto.randomUUID(),
    serviceId: checker.serviceId,
    checkerId: checker.id,
    clusterId: runtimeCluster.cluster.id,
    category: 'log',
    severity: runtimeCluster.cluster.severity,
    eventType,
    title: runtimeCluster.cluster.title,
    message,
    fingerprint: runtimeCluster.cluster.fingerprint,
    metadataJson: JSON.stringify({
      sampleLog: runtimeCluster.cluster.sampleLog,
      normalizedMessage: runtimeCluster.cluster.normalizedMessage,
      countLastMinute: runtimeCluster.minuteBuckets.get(bucketIso(Date.now())) || 0
    })
  });

  createCheckerResult({
    id: crypto.randomUUID(),
    serviceId: checker.serviceId,
    checkerId: checker.id,
    status: mapSeverityToCheckerStatus(runtimeCluster.cluster.severity),
    responseTimeMs: 0,
    statusCode: null,
    errorMessage: `${eventType}: ${message}`
  });

  syncServiceLogSummary(checker.serviceId, createdAt);
}

function restoreRuntimeClusters(checker: Checker): Map<string, RuntimeClusterState> {
  const clusters = new Map<string, RuntimeClusterState>();
  const clusterRecords = rehydrateClusterRecords(checker.id);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const bucketRows = getRecentBucketsByCheckerId(checker.id, since24h);
  const bucketsByCluster = new Map<string, Map<string, number>>();

  for (const bucketRow of bucketRows) {
    if (!bucketsByCluster.has(bucketRow.clusterId)) {
      bucketsByCluster.set(bucketRow.clusterId, new Map<string, number>());
    }
    bucketsByCluster.get(bucketRow.clusterId)!.set(bucketRow.bucketStart, bucketRow.count);
  }

  for (const cluster of clusterRecords) {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(cluster.metadataJson || '{}');
    } catch {
      metadata = {};
    }

    clusters.set(cluster.fingerprint, {
      cluster: {
        ...cluster,
        sourceType: cluster.sourceType as LogSourceType
      },
      minuteBuckets: bucketsByCluster.get(cluster.id) || new Map<string, number>(),
      lastSpikeAlertBucket: typeof metadata.lastSpikeAlertBucket === 'string' ? metadata.lastSpikeAlertBucket : null
    });
  }

  return clusters;
}

async function handleLogLine(runtime: CheckerRuntime, checker: Checker, config: LogCheckerConfig, line: string): Promise<void> {
  if (!shouldProcessLogLine(line, config)) return;

  const normalizedMessage = normalizeLogMessage(line);
  if (!normalizedMessage) return;

  const fingerprint = createLogFingerprint(normalizedMessage);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const currentBucket = bucketIso(nowMs);
  let runtimeCluster = runtime.clusters.get(fingerprint);

  if (!runtimeCluster) {
    runtimeCluster = {
      cluster: {
        id: crypto.randomUUID(),
        serviceId: checker.serviceId,
        checkerId: checker.id,
        fingerprint,
        normalizedMessage,
        title: deriveLogTitle(normalizedMessage),
        sampleLog: line.slice(0, 500),
        totalCount: 0,
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
        severity: 'warning',
        sourceType: config.sourceType,
        metadataJson: '{}'
      },
      minuteBuckets: new Map<string, number>(),
      lastSpikeAlertBucket: null
    };
    runtime.clusters.set(fingerprint, runtimeCluster);
  }

  runtimeCluster.cluster.totalCount += 1;
  runtimeCluster.cluster.lastSeenAt = nowIso;
  const nextBucketCount = (runtimeCluster.minuteBuckets.get(currentBucket) || 0) + 1;
  runtimeCluster.minuteBuckets.set(currentBucket, nextBucketCount);
  const count24h = trimBuckets(runtimeCluster, nowMs);
  const nextSeverity = resolveLogSeverity(line, normalizedMessage, {
    countLastMinute: nextBucketCount,
    count24h
  }, config);

  const isNewCluster = runtimeCluster.cluster.totalCount === 1;
  const severityChanged = runtimeCluster.cluster.severity !== nextSeverity;
  runtimeCluster.cluster.severity = nextSeverity;

  const spikeThreshold = getLogSpikeThreshold(config);
  const spikeDetected = nextBucketCount >= spikeThreshold && runtimeCluster.lastSpikeAlertBucket !== currentBucket;
  if (spikeDetected) runtimeCluster.lastSpikeAlertBucket = currentBucket;

  runtimeCluster.cluster.metadataJson = JSON.stringify({
    lastSpikeAlertBucket: runtimeCluster.lastSpikeAlertBucket,
    count24h,
    countLastMinute: nextBucketCount
  });

  if (isNewCluster) {
    insertLogCluster(runtimeCluster.cluster);
  } else {
    persistRuntimeCluster(runtimeCluster);
  }

  incrementLogBucket(runtimeCluster.cluster.id, currentBucket, 1);

  if (isNewCluster) {
    createAlert(runtimeCluster, checker, 'cluster_created', `New ${runtimeCluster.cluster.severity} log cluster detected`);
  }
  if (severityChanged && !isNewCluster) {
    createAlert(runtimeCluster, checker, 'severity_changed', `Log cluster promoted to ${runtimeCluster.cluster.severity}`);
  }
  if (spikeDetected) {
    createAlert(runtimeCluster, checker, 'spike', `Log cluster spiked to ${nextBucketCount} hits in the current minute`);
  }
}

async function runRuntime(runtime: CheckerRuntime): Promise<void> {
  const checker = runtime.checker;
  let config: LogCheckerConfig;

  try {
    config = JSON.parse(checker.configJson || '{}');
  } catch {
    console.error(`[LogChecker] Invalid JSON config for checker ${checker.id}`);
    return;
  }

  const reconnectDelayMs = config.reconnectDelayMs || 2000;
  while (!runtime.controller.signal.aborted) {
    try {
      await consumeLogSource(config, {
        signal: runtime.controller.signal,
        onLine: line => handleLogLine(runtime, checker, config, line)
      });
    } catch (error: any) {
      if (runtime.controller.signal.aborted) break;
      console.error(`[LogChecker] Stream failure for checker ${checker.id}:`, error?.message || error);
    }

    if (runtime.controller.signal.aborted) break;
    await delay(reconnectDelayMs);
  }
}

function stopRuntime(checkerId: string): void {
  const runtime = activeRuntimes.get(checkerId);
  if (!runtime) return;
  runtime.controller.abort();
  activeRuntimes.delete(checkerId);
}

function startRuntime(checker: Checker): void {
  const configHash = crypto.createHash('sha1').update(checker.configJson || '{}').digest('hex');
  const runtime: CheckerRuntime = {
    checker,
    configHash,
    controller: new AbortController(),
    clusters: restoreRuntimeClusters(checker)
  };

  activeRuntimes.set(checker.id, runtime);
  runRuntime(runtime).catch(error => {
    console.error(`[LogChecker] Runtime terminated for checker ${checker.id}:`, error);
  });
}

function reconcileLogCheckers(): void {
  const desired = getAllActiveCheckers().filter(checker => checker.type === 'log');
  const desiredIds = new Set<string>();

  for (const checker of desired) {
    const service = getServiceById(checker.serviceId);
    if (!service?.isActive) continue;

    desiredIds.add(checker.id);

    let config: LogCheckerConfig;
    try {
      config = JSON.parse(checker.configJson || '{}');
    } catch {
      console.error(`[LogChecker] Skipping checker ${checker.id}: invalid JSON`);
      continue;
    }

    const validationError = validateLogCheckerConfig(config);
    if (validationError) {
      console.error(`[LogChecker] Skipping checker ${checker.id}: ${validationError}`);
      continue;
    }

    const configHash = crypto.createHash('sha1').update(checker.configJson || '{}').digest('hex');
    const existing = activeRuntimes.get(checker.id);
    if (!existing) {
      startRuntime(checker);
      continue;
    }

    if (existing.configHash !== configHash) {
      stopRuntime(checker.id);
      startRuntime(checker);
    }
  }

  for (const checkerId of Array.from(activeRuntimes.keys())) {
    if (!desiredIds.has(checkerId)) stopRuntime(checkerId);
  }
}

function refreshServiceLogSummaries(): void {
  const serviceIds = new Set<string>();
  for (const runtime of activeRuntimes.values()) {
    serviceIds.add(runtime.checker.serviceId);
  }

  for (const serviceId of serviceIds) {
    syncServiceLogSummary(serviceId);
  }
}

export function startLogCheckerEngine(): void {
  console.log('[LogChecker] Starting log intelligence engine');
  reconcileLogCheckers();
  refreshServiceLogSummaries();

  setInterval(reconcileLogCheckers, 5000);
  setInterval(() => {
    deleteOldLogBuckets(new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());
    refreshServiceLogSummaries();
  }, 60 * 1000);
}