export type ServiceStatus = 'online' | 'degraded' | 'offline' | 'unknown';
export type CheckerType = 'ping' | 'http' | 'command' | 'log';
export type LogSeverity = 'warning' | 'critical';

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
  configJson: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CheckerResult {
  id: string;
  serviceId: string;
  checkerId: string;
  status: 'online' | 'offline' | 'degraded' | 'unknown' | 'error';
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
  checkerSummaryJson: string;
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
  sourceType: 'file' | 'command' | 'http';
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

// For TV specific lightweight payload
export interface NexusService {
  serviceId: string;
  serviceName: string;
  groupName: string;
  environment: string;
  overallStatus: ServiceStatus;
  lastCheckedAt: string | null;
  lastOkAt: string | null;
  lastFailureAt: string | null;
  logWarningCount: number;
  logCriticalCount: number;
  lastLogIssueAt?: string | null;
  lastLogAlertAt?: string | null;
  checkerSummary: Record<string, any>;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  message: string | null;
}

export interface StatusUpdatePayload {
  type: 'status_update' | 'initial_state' | 'server_update' | 'initial_server_state';
  data: any;
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

export interface NexusServer {
  serverId: string;
  serverName: string;
  host: string;
  status: ServerStatus;
  cpuPercent: number | null;
  ramPercent: number | null;
  diskPercent: number | null;
  uptimeSeconds: number | null;
  lastCheckedAt: string | null;
}
