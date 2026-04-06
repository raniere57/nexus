export type ServiceStatus = 'online' | 'degraded' | 'offline' | 'unknown';
export type CheckerType = 'ping' | 'http';

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
  checkerSummary: Record<string, any>;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  message: string | null;
}

export interface StatusUpdatePayload {
  type: 'status_update' | 'initial_state';
  data: any;
}
