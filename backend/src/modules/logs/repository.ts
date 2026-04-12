import { db } from '../../db/index.ts';
import type { LogIssueCluster, LogSeverity, MonitoringAlert } from '../../shared/types.ts';

export interface LogBucketRow {
  clusterId: string;
  bucketStart: string;
  count: number;
}

export interface StoredLogCluster {
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
  sourceType: string;
  metadataJson: string;
}

export function getLogClustersByCheckerId(checkerId: string): LogIssueCluster[] {
  return db.query(`
    SELECT c.*, COALESCE((
      SELECT SUM(b.count)
      FROM log_issue_buckets b
      WHERE b.clusterId = c.id AND b.bucketStart >= $since24h
    ), 0) as count24h
    FROM log_issue_clusters c
    WHERE c.checkerId = $checkerId
    ORDER BY c.lastSeenAt DESC
  `).all({
    $checkerId: checkerId,
    $since24h: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  }) as LogIssueCluster[];
}

export function getRecentBucketsByCheckerId(checkerId: string, sinceIso: string): LogBucketRow[] {
  return db.query(`
    SELECT b.clusterId, b.bucketStart, b.count
    FROM log_issue_buckets b
    INNER JOIN log_issue_clusters c ON c.id = b.clusterId
    WHERE c.checkerId = $checkerId
      AND b.bucketStart >= $sinceIso
    ORDER BY b.bucketStart ASC
  `).all({ $checkerId: checkerId, $sinceIso: sinceIso }) as LogBucketRow[];
}

export function insertLogCluster(cluster: Omit<StoredLogCluster, 'sourceType'> & { sourceType: string }): void {
  db.query(`
    INSERT INTO log_issue_clusters (
      id, serviceId, checkerId, fingerprint, normalizedMessage, title, sampleLog,
      totalCount, firstSeenAt, lastSeenAt, severity, sourceType, metadataJson
    ) VALUES (
      $id, $serviceId, $checkerId, $fingerprint, $normalizedMessage, $title, $sampleLog,
      $totalCount, $firstSeenAt, $lastSeenAt, $severity, $sourceType, $metadataJson
    )
  `).run({
    $id: cluster.id,
    $serviceId: cluster.serviceId,
    $checkerId: cluster.checkerId,
    $fingerprint: cluster.fingerprint,
    $normalizedMessage: cluster.normalizedMessage,
    $title: cluster.title,
    $sampleLog: cluster.sampleLog,
    $totalCount: cluster.totalCount,
    $firstSeenAt: cluster.firstSeenAt,
    $lastSeenAt: cluster.lastSeenAt,
    $severity: cluster.severity,
    $sourceType: cluster.sourceType,
    $metadataJson: cluster.metadataJson
  });
}

export function updateLogCluster(cluster: Omit<StoredLogCluster, 'sourceType'> & { sourceType: string }): void {
  db.query(`
    UPDATE log_issue_clusters SET
      sampleLog = $sampleLog,
      totalCount = $totalCount,
      lastSeenAt = $lastSeenAt,
      severity = $severity,
      metadataJson = $metadataJson,
      updatedAt = CURRENT_TIMESTAMP
    WHERE id = $id
  `).run({
    $id: cluster.id,
    $sampleLog: cluster.sampleLog,
    $totalCount: cluster.totalCount,
    $lastSeenAt: cluster.lastSeenAt,
    $severity: cluster.severity,
    $metadataJson: cluster.metadataJson
  });
}

export function incrementLogBucket(clusterId: string, bucketStart: string, increment = 1): void {
  db.query(`
    INSERT INTO log_issue_buckets (clusterId, bucketStart, count)
    VALUES ($clusterId, $bucketStart, $count)
    ON CONFLICT(clusterId, bucketStart) DO UPDATE SET
      count = count + excluded.count
  `).run({
    $clusterId: clusterId,
    $bucketStart: bucketStart,
    $count: increment
  });
}

export function deleteOldLogBuckets(beforeIso: string): void {
  db.query(`DELETE FROM log_issue_buckets WHERE bucketStart < $beforeIso`).run({ $beforeIso: beforeIso });
}

export function getLogClusters(options: {
  serviceId?: string;
  checkerId?: string;
  severity?: LogSeverity;
  limit?: number;
}): LogIssueCluster[] {
  let query = `
    SELECT c.*, COALESCE((
      SELECT SUM(b.count)
      FROM log_issue_buckets b
      WHERE b.clusterId = c.id AND b.bucketStart >= $since24h
    ), 0) as count24h
    FROM log_issue_clusters c
    WHERE 1 = 1
  `;

  const params: Record<string, string | number> = {
    $since24h: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    $limit: options.limit || 100
  };

  if (options.serviceId) {
    query += ' AND c.serviceId = $serviceId';
    params.$serviceId = options.serviceId;
  }
  if (options.checkerId) {
    query += ' AND c.checkerId = $checkerId';
    params.$checkerId = options.checkerId;
  }
  if (options.severity) {
    query += ' AND c.severity = $severity';
    params.$severity = options.severity;
  }

  query += ' ORDER BY c.lastSeenAt DESC LIMIT $limit';
  return db.query(query).all(params) as LogIssueCluster[];
}

export function getActiveLogSummaryByService(serviceId: string): { warningCount: number; criticalCount: number; lastIssueAt: string | null } {
  const row = db.query(`
    SELECT
      SUM(CASE WHEN severity = 'warning' AND lastSeenAt >= $since24h THEN 1 ELSE 0 END) as warningCount,
      SUM(CASE WHEN severity = 'critical' AND lastSeenAt >= $since24h THEN 1 ELSE 0 END) as criticalCount,
      MAX(CASE WHEN lastSeenAt >= $since24h THEN lastSeenAt ELSE NULL END) as lastIssueAt
    FROM log_issue_clusters
    WHERE serviceId = $serviceId
  `).get({
    $serviceId: serviceId,
    $since24h: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  }) as { warningCount: number | null; criticalCount: number | null; lastIssueAt: string | null };

  return {
    warningCount: row?.warningCount || 0,
    criticalCount: row?.criticalCount || 0,
    lastIssueAt: row?.lastIssueAt || null
  };
}

export function createMonitoringAlert(alert: Omit<MonitoringAlert, 'createdAt' | 'acknowledgedAt'>): MonitoringAlert {
  db.query(`
    INSERT INTO monitoring_alerts (
      id, serviceId, checkerId, clusterId, category, severity, eventType,
      title, message, fingerprint, metadataJson
    ) VALUES (
      $id, $serviceId, $checkerId, $clusterId, $category, $severity, $eventType,
      $title, $message, $fingerprint, $metadataJson
    )
  `).run({
    $id: alert.id,
    $serviceId: alert.serviceId,
    $checkerId: alert.checkerId,
    $clusterId: alert.clusterId,
    $category: alert.category,
    $severity: alert.severity,
    $eventType: alert.eventType,
    $title: alert.title,
    $message: alert.message,
    $fingerprint: alert.fingerprint,
    $metadataJson: alert.metadataJson
  });

  return db.query(`SELECT * FROM monitoring_alerts WHERE id = ?`).get(alert.id) as MonitoringAlert;
}

export function getRecentMonitoringAlerts(options: { serviceId?: string; limit?: number } = {}): MonitoringAlert[] {
  let query = 'SELECT * FROM monitoring_alerts WHERE 1 = 1';
  const params: Record<string, string | number> = { $limit: options.limit || 50 };

  if (options.serviceId) {
    query += ' AND serviceId = $serviceId';
    params.$serviceId = options.serviceId;
  }

  query += ' ORDER BY createdAt DESC LIMIT $limit';
  return db.query(query).all(params) as MonitoringAlert[];
}

export function rehydrateClusterRecords(checkerId: string): StoredLogCluster[] {
  return db.query(`
    SELECT *
    FROM log_issue_clusters
    WHERE checkerId = $checkerId
    ORDER BY lastSeenAt DESC
  `).all({ $checkerId: checkerId }) as StoredLogCluster[];
}