import type { ServiceStatus } from '../../shared/types.js';

export function aggregateStatus(checkerStatuses: string[]): ServiceStatus {
  if (checkerStatuses.length === 0) return 'unknown';

  let allPassed = true;
  let allFailed = true;

  for (const status of checkerStatuses) {
    if (status === 'success') {
      allFailed = false;
    } else {
      allPassed = false;
    }
  }

  if (allPassed) return 'online';
  if (allFailed) return 'offline';
  return 'degraded';
}
