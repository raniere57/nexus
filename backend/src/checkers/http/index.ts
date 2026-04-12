import type { Checker, CheckerResult } from '../../shared/types.ts';
import { randomUUID } from 'crypto';

interface HttpCheckerConfig {
  method?: string;
  url?: string; // If not provided, it should use the service baseUrl
  headers?: Record<string, string>;
  expectedStatus?: number;
  expectedBodyContains?: string;
  followRedirects?: boolean;
  timeoutSeconds?: number;
}

export function resolveHttpTimeout(checkerConfigJson: string | undefined, serviceTimeoutSeconds: number = 10): number {
  const config = JSON.parse(checkerConfigJson || '{}');
  return config.timeoutSeconds || serviceTimeoutSeconds || 10;
}

export async function executeHttpChecker(checker: Checker, serviceBaseUrl?: string, serviceTimeoutSeconds: number = 10): Promise<Omit<CheckerResult, 'checkedAt'>> {
  const t0 = performance.now();
  let status: CheckerResult['status'] = 'error';
  let errorMessage: string | null = null;
  let finalStatusCode: number | null = null;
  
  try {
    const config: HttpCheckerConfig = JSON.parse(checker.configJson || '{}');
    const targetUrl = config.url || serviceBaseUrl;
    
    if (!targetUrl) {
      throw new Error('HTTP target url is missing in checker config or service definition');
    }

    const abortController = new AbortController();
    const timeoutSecs = resolveHttpTimeout(checker.configJson, serviceTimeoutSeconds);
    const timeoutId = setTimeout(() => abortController.abort(), timeoutSecs * 1000);

    const response = await fetch(targetUrl, {
      method: config.method || 'GET',
      headers: config.headers || {},
      redirect: config.followRedirects === false ? 'manual' : 'follow',
      signal: abortController.signal
    });

    clearTimeout(timeoutId);
    
    finalStatusCode = response.status;
    const expected = config.expectedStatus || 200;
    
    if (finalStatusCode === expected) {
      status = 'success';
      
      if (config.expectedBodyContains) {
        const bodyText = await response.text();
        if (!bodyText.includes(config.expectedBodyContains)) {
          status = 'failure';
          errorMessage = `Body does not contain expected text: ${config.expectedBodyContains}`;
        }
      }
    } else {
      status = 'failure';
      errorMessage = `Expected status ${expected}, got ${finalStatusCode}`;
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      status = 'timeout';
      errorMessage = 'Request timed out';
    } else {
      status = 'error';
      errorMessage = error.message;
    }
  }

  const t1 = performance.now();
  
  return {
    id: randomUUID(),
    serviceId: checker.serviceId,
    checkerId: checker.id,
    status,
    responseTimeMs: Math.round(t1 - t0),
    statusCode: finalStatusCode,
    errorMessage
  };
}
