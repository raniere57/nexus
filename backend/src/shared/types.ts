export type ServiceStatus = 'online' | 'degraded' | 'offline' | 'unknown';
export type CheckerType = 'ping' | 'http';
export type CheckerStatus = 'success' | 'failure' | 'timeout' | 'error';

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
