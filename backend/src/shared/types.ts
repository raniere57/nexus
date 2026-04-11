export type ServiceStatus = 'online' | 'degraded' | 'offline' | 'unknown';
export type CheckerType = 'ping' | 'http' | 'command' | 'log';
export type CheckerStatus = 'success' | 'failure' | 'timeout' | 'error';
export type LogSeverity = 'warning' | 'critical';
export type LogSourceType = 'file' | 'command' | 'http';

export interface Service {
  id: string;
  name: string;
  description: string;
  groupName: string;
  host: string;
  baseUrl: string;
  environment: string;
  checkIntervalSeconds: number;
  timeoutSeconds: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Checker {
  id: string;
  serviceId: string;
  type: CheckerType;
  name: string;
  configJson: string; // JSON string of config
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CheckerResult {
  id: string;
  serviceId: string;
  checkerId: string;
  status: CheckerStatus;
  responseTimeMs: number;
  statusCode: number | null;
  errorMessage: string | null;
  checkedAt: string;
}

export interface ServiceSnapshot {
  serviceId: string;
  overallStatus: ServiceStatus;
  lastCheckedAt: string | null;
  lastOkAt: string | null;
  lastFailureAt: string | null;
  checkerSummaryJson: string; // JSON object representing { checkerId: status }
}

export interface SnapshotMeta {
  staleReason?: string | null;
  averageResponseTimeMs?: number | null;
}

export interface SnapshotLogSummary {
  warningCount: number;
  criticalCount: number;
  lastIssueAt: string | null;
  lastAlertAt: string | null;
}

export interface LogCheckerConfig {
  sourceType: LogSourceType;
  path?: string;
  command?: string;
  url?: string;
  serverId?: string;
  headers?: Record<string, string>;
  includePatterns?: string[];
  excludePatterns?: string[];
  criticalPatterns?: string[];
  spikeThresholdPerMinute?: number;
  promotionThresholdPerMinute?: number;
  promotionThreshold24h?: number;
  reconnectDelayMs?: number;
  previewWindowSeconds?: number;
}

export interface LogIssueCluster {
  id: string;
  serviceId: string;
  checkerId: string;
  fingerprint: string;
  normalizedMessage: string;
  title: string;
  sampleLog: string;
  totalCount: number;
  count24h: number;
  firstSeenAt: string;
  lastSeenAt: string;
  severity: LogSeverity;
  sourceType: LogSourceType;
  metadataJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonitoringAlert {
  id: string;
  serviceId: string;
  checkerId: string | null;
  clusterId: string | null;
  category: 'service' | 'server' | 'log';
  severity: LogSeverity;
  eventType: 'cluster_created' | 'spike' | 'severity_changed';
  title: string;
  message: string;
  fingerprint: string | null;
  metadataJson: string;
  createdAt: string;
  acknowledgedAt: string | null;
}

export type ServerStatus = 'online' | 'offline' | 'unknown';

export interface Server {
  id: string;
  name: string;
  host: string;
  sshPort: number;
  sshUser: string;
  sshPassword: string;
  checkIntervalSeconds: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServerSnapshot {
  serverId: string;
  status: ServerStatus;
  cpuPercent: number | null;
  ramPercent: number | null;
  diskPercent: number | null;
  uptimeSeconds: number | null;
  lastCheckedAt: string | null;
}
