import { createOrUpdateSnapshot, getServiceSnapshotById } from '../services/repository.ts';
import { broadcastStatusUpdate } from '../realtime/websocket.ts';
import type { ServiceSnapshot, ServiceStatus, SnapshotLogSummary, SnapshotMeta } from '../../shared/types.ts';

interface ParsedSummary {
  checkerStatuses: Record<string, string>;
  meta: SnapshotMeta;
  log: SnapshotLogSummary;
}

interface UpdateSnapshotOptions {
  overallStatus?: ServiceStatus;
  checkerStatuses?: Record<string, string>;
  replaceCheckerStatuses?: boolean;
  meta?: Partial<SnapshotMeta>;
  log?: Partial<SnapshotLogSummary>;
  touchCheckTimestamps?: boolean;
}

const DEFAULT_LOG_SUMMARY: SnapshotLogSummary = {
  warningCount: 0,
  criticalCount: 0,
  lastIssueAt: null,
  lastAlertAt: null
};

function parseEmbeddedObject<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;

  if (typeof value === 'string') {
    try {
      return { ...fallback, ...JSON.parse(value) };
    } catch {
      return fallback;
    }
  }

  if (typeof value === 'object') {
    return { ...fallback, ...(value as Record<string, unknown>) } as T;
  }

  return fallback;
}

export function parseCheckerSummaryJson(checkerSummaryJson?: string | null): ParsedSummary {
  if (!checkerSummaryJson) {
    return {
      checkerStatuses: {},
      meta: {},
      log: { ...DEFAULT_LOG_SUMMARY }
    };
  }

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(checkerSummaryJson);
  } catch {
    parsed = {};
  }

  const { __meta, __log, ...checkerStatuses } = parsed;
  return {
    checkerStatuses: checkerStatuses as Record<string, string>,
    meta: parseEmbeddedObject(__meta, {}),
    log: parseEmbeddedObject(__log, { ...DEFAULT_LOG_SUMMARY })
  };
}

export function buildCheckerSummaryJson(
  checkerStatuses: Record<string, string>,
  meta: SnapshotMeta,
  log: SnapshotLogSummary
): string {
  const payload: Record<string, unknown> = { ...checkerStatuses };

  const compactMeta: SnapshotMeta = {};
  if (meta.staleReason) compactMeta.staleReason = meta.staleReason;
  if (typeof meta.averageResponseTimeMs === 'number') compactMeta.averageResponseTimeMs = meta.averageResponseTimeMs;
  if (Object.keys(compactMeta).length > 0) payload.__meta = compactMeta;

  if (log.warningCount > 0 || log.criticalCount > 0 || log.lastIssueAt || log.lastAlertAt) {
    payload.__log = {
      warningCount: log.warningCount,
      criticalCount: log.criticalCount,
      lastIssueAt: log.lastIssueAt,
      lastAlertAt: log.lastAlertAt
    };
  }

  return JSON.stringify(payload);
}

export function updateServiceSnapshot(serviceId: string, options: UpdateSnapshotOptions): ServiceSnapshot {
  const existing = getServiceSnapshotById(serviceId);
  const parsed = parseCheckerSummaryJson(existing?.checkerSummaryJson);
  const now = new Date().toISOString();
  const overallStatus = options.overallStatus ?? existing?.overallStatus ?? 'unknown';
  const touchCheckTimestamps = options.touchCheckTimestamps ?? true;

  const checkerStatuses = options.replaceCheckerStatuses
    ? { ...(options.checkerStatuses || {}) }
    : { ...parsed.checkerStatuses, ...(options.checkerStatuses || {}) };

  const meta: SnapshotMeta = {
    ...parsed.meta,
    ...(options.meta || {})
  };

  const log: SnapshotLogSummary = {
    ...DEFAULT_LOG_SUMMARY,
    ...parsed.log,
    ...(options.log || {})
  };

  const snapshot: ServiceSnapshot = {
    serviceId,
    overallStatus,
    lastCheckedAt: touchCheckTimestamps ? now : (existing?.lastCheckedAt || null),
    lastOkAt: touchCheckTimestamps
      ? (overallStatus === 'online' ? now : (existing?.lastOkAt || null))
      : (existing?.lastOkAt || null),
    lastFailureAt: touchCheckTimestamps
      ? ((overallStatus === 'offline' || overallStatus === 'degraded') ? now : (existing?.lastFailureAt || null))
      : (existing?.lastFailureAt || null),
    checkerSummaryJson: buildCheckerSummaryJson(checkerStatuses, meta, log)
  };

  createOrUpdateSnapshot(serviceId, snapshot);
  broadcastStatusUpdate(snapshot);
  return snapshot;
}