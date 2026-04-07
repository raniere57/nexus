import type { Checker, CheckerResult } from '../../shared/types.js';
import crypto from 'crypto';

/**
 * Execute a local shell command to check service availability.
 * The exit code 0 means success.
 */
export async function executeCommandChecker(checker: Checker, timeoutSeconds: number): Promise<CheckerResult> {
  const startTime = Date.now();
  let config: { command: string } = { command: '' };
  
  try {
    config = JSON.parse(checker.configJson);
  } catch (e) {
    return {
      id: crypto.randomUUID(),
      serviceId: checker.serviceId,
      checkerId: checker.id,
      status: 'error',
      responseTimeMs: 0,
      statusCode: null,
      errorMessage: 'Invalid JSON config for command checker',
      checkedAt: new Date().toISOString()
    };
  }

  if (!config.command) {
    return {
      id: crypto.randomUUID(),
      serviceId: checker.serviceId,
      checkerId: checker.id,
      status: 'error',
      responseTimeMs: 0,
      statusCode: null,
      errorMessage: 'No command specified',
      checkedAt: new Date().toISOString()
    };
  }

  try {
    // We use a shell to wrap the command for convenience (pipes, etc)
    const proc = Bun.spawn(['sh', '-c', config.command], {
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const exitCodePromise = proc.exited;
    
    // Timeout logic
    const timeoutPromise = new Promise<number>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), timeoutSeconds * 1000);
    });

    try {
      const exitCode = await Promise.race([exitCodePromise, timeoutPromise]);
      const endTime = Date.now();
      const responseTimeMs = endTime - startTime;

      if (exitCode === 0) {
        return {
          id: crypto.randomUUID(),
          serviceId: checker.serviceId,
          checkerId: checker.id,
          status: 'success',
          responseTimeMs,
          statusCode: 0,
          errorMessage: null,
          checkedAt: new Date().toISOString()
        };
      } else {
        const stderr = await new Response(proc.stderr).text();
        return {
          id: crypto.randomUUID(),
          serviceId: checker.serviceId,
          checkerId: checker.id,
          status: 'failure',
          responseTimeMs,
          statusCode: exitCode,
          errorMessage: stderr.trim() || `Exit code: ${exitCode}`,
          checkedAt: new Date().toISOString()
        };
      }
    } catch (err: any) {
      // Handle timeout
      proc.kill();
      return {
        id: crypto.randomUUID(),
        serviceId: checker.serviceId,
        checkerId: checker.id,
        status: 'timeout',
        responseTimeMs: Date.now() - startTime,
        statusCode: null,
        errorMessage: 'Execution timeout',
        checkedAt: new Date().toISOString()
      };
    }
  } catch (err: any) {
    return {
      id: crypto.randomUUID(),
      serviceId: checker.serviceId,
      checkerId: checker.id,
      status: 'error',
      responseTimeMs: Date.now() - startTime,
      statusCode: null,
      errorMessage: err.message || 'Spawn failure',
      checkedAt: new Date().toISOString()
    };
  }
}
