import type { Checker, CheckerResult } from '../../shared/types.ts';
import { randomUUID } from 'crypto';
import ping from 'ping';

export async function executePingChecker(checker: Checker, hostToPing?: string, serviceTimeoutSeconds: number = 10): Promise<Omit<CheckerResult, 'checkedAt'>> {
  const t0 = performance.now();
  let status: CheckerResult['status'] = 'error';
  let errorMessage: string | null = null;
  
  // Note: For container environments, if ICMP fails, we could fallback to TCP ping (is-port-reachable)
  // For now we use standard ping module which tries to use system ping.
  // The 'host' or 'hostToPing' would be defined in config or service.
  
  try {
    const config = JSON.parse(checker.configJson || '{}');
    const targetHost = config.host || hostToPing;
    const timeoutSecs = config.timeoutSeconds || serviceTimeoutSeconds || 10;
    
    if (!targetHost) {
      throw new Error('Ping target host is missing in checker config or service definition');
    }

    const res = await ping.promise.probe(targetHost, {
      timeout: timeoutSecs,
    });

    if (res.alive) {
      status = 'success';
    } else {
      status = 'failure';
      errorMessage = res.output || 'Ping failed';
    }
  } catch (error: any) {
    status = 'error';
    errorMessage = error.message;
  }

  const t1 = performance.now();
  
  return {
    id: randomUUID(),
    serviceId: checker.serviceId,
    checkerId: checker.id,
    status,
    responseTimeMs: Math.round(t1 - t0),
    statusCode: null,
    errorMessage
  };
}
