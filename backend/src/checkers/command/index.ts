import type { Checker, CheckerResult, Server } from '../../shared/types.js';
import crypto from 'crypto';
import { checkServerViaSSH } from '../ssh/index.js';
import { getServerById } from '../../servers/repository.js';

interface CommandCheckerConfig {
  command: string;
  /**
   * String to search in stdout/stderr to determine success.
   * If not provided, only exit code is checked (0 = success).
   */
  successPattern?: string;
  /**
   * Whether to check stdout only (true) or both stdout + stderr (false).
   * Default: false (checks both)
   */
  stdoutOnly?: boolean;
  /**
   * Whether the successPattern should match exactly (true) or contain (false).
   * Default: false (contains)
   */
  exactMatch?: boolean;
  /**
   * Optional server ID to execute this command remotely via SSH.
   * If provided, the command will run on the remote server instead of locally.
   */
  serverId?: string;
}

/**
 * Execute a local shell command to check service availability.
 * The exit code 0 means success by default.
 * You can also specify a successPattern to check in the output.
 * If serverId is provided in config, the command will run on the remote server via SSH.
 */
export async function executeCommandChecker(checker: Checker, timeoutSeconds: number): Promise<CheckerResult> {
  const startTime = Date.now();
  let config: CommandCheckerConfig = { command: '' };

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

  // If serverId is provided, execute command via SSH on remote server
  if (config.serverId) {
    return await executeCommandViaSSH(checker, config, timeoutSeconds, startTime);
  }

  // Otherwise, execute locally
  return await executeCommandLocal(checker, config, timeoutSeconds, startTime);
}

/**
 * Execute command locally via shell spawn
 */
async function executeCommandLocal(
  checker: Checker,
  config: CommandCheckerConfig,
  timeoutSeconds: number,
  startTime: number
): Promise<CheckerResult> {

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
        // If no successPattern is defined, exit code 0 is enough
        if (!config.successPattern) {
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
        }

        // If successPattern is defined, check the output
        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();
        const output = config.stdoutOnly ? stdout : stdout + stderr;

        const matches = config.exactMatch
          ? output.trim() === config.successPattern
          : output.includes(config.successPattern);

        if (matches) {
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
          return {
            id: crypto.randomUUID(),
            serviceId: checker.serviceId,
            checkerId: checker.id,
            status: 'failure',
            responseTimeMs,
            statusCode: exitCode,
            errorMessage: `Output does not contain expected pattern: "${config.successPattern}"`,
            checkedAt: new Date().toISOString()
          };
        }
      } else {
        // Non-zero exit code - check if we should consider it a failure anyway
        const stderr = await new Response(proc.stderr).text();
        const stdout = await new Response(proc.stdout).text();

        // If successPattern is defined and we got a non-zero exit,
        // we still check if the output matches (some commands return non-zero but succeed)
        if (config.successPattern) {
          const output = config.stdoutOnly ? stdout : stdout + stderr;
          const matches = config.exactMatch
            ? output.trim() === config.successPattern
            : output.includes(config.successPattern);

          if (matches) {
            return {
              id: crypto.randomUUID(),
              serviceId: checker.serviceId,
              checkerId: checker.id,
              status: 'success',
              responseTimeMs,
              statusCode: exitCode,
              errorMessage: null,
              checkedAt: new Date().toISOString()
            };
          }
        }

        // It's a failure
        return {
          id: crypto.randomUUID(),
          serviceId: checker.serviceId,
          checkerId: checker.id,
          status: 'failure',
          responseTimeMs,
          statusCode: exitCode,
          errorMessage: stderr.trim() || stdout.trim() || `Exit code: ${exitCode}`,
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

/**
 * Execute command via SSH on remote server
 */
async function executeCommandViaSSH(
  checker: Checker,
  config: CommandCheckerConfig,
  timeoutSeconds: number,
  startTime: number
): Promise<CheckerResult> {
  const server = getServerById(config.serverId!);

  if (!server) {
    return {
      id: crypto.randomUUID(),
      serviceId: checker.serviceId,
      checkerId: checker.id,
      status: 'error',
      responseTimeMs: Date.now() - startTime,
      statusCode: null,
      errorMessage: `Server not found: ${config.serverId}`,
      checkedAt: new Date().toISOString()
    };
  }

  // Escape the command for shell execution
  const escapedCommand = config.command.replace(/'/g, "'\"'\"'");
  const remoteScript = `cd /tmp && ${escapedCommand}`;

  const sshArgs = [
    'sshpass', '-e',
    'ssh',
    '-o', `ConnectTimeout=${timeoutSeconds}`,
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'PubkeyAuthentication=no',
    '-o', 'PreferredAuthentications=password',
    '-p', String(server.sshPort),
    `${server.sshUser}@${server.host}`,
    remoteScript
  ];

  try {
    const proc = Bun.spawn(sshArgs, {
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        SSHPASS: server.sshPassword
      }
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
        // If no successPattern is defined, exit code 0 is enough
        if (!config.successPattern) {
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
        }

        // If successPattern is defined, check the output
        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();
        const output = config.stdoutOnly ? stdout : stdout + stderr;

        const matches = config.exactMatch
          ? output.trim() === config.successPattern
          : output.includes(config.successPattern);

        if (matches) {
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
          return {
            id: crypto.randomUUID(),
            serviceId: checker.serviceId,
            checkerId: checker.id,
            status: 'failure',
            responseTimeMs,
            statusCode: exitCode,
            errorMessage: `Output does not contain expected pattern: "${config.successPattern}"`,
            checkedAt: new Date().toISOString()
          };
        }
      } else {
        // Non-zero exit code
        const stderr = await new Response(proc.stderr).text();
        const stdout = await new Response(proc.stdout).text();

        if (config.successPattern) {
          const output = config.stdoutOnly ? stdout : stdout + stderr;
          const matches = config.exactMatch
            ? output.trim() === config.successPattern
            : output.includes(config.successPattern);

          if (matches) {
            return {
              id: crypto.randomUUID(),
              serviceId: checker.serviceId,
              checkerId: checker.id,
              status: 'success',
              responseTimeMs,
              statusCode: exitCode,
              errorMessage: null,
              checkedAt: new Date().toISOString()
            };
          }
        }

        return {
          id: crypto.randomUUID(),
          serviceId: checker.serviceId,
          checkerId: checker.id,
          status: 'failure',
          responseTimeMs,
          statusCode: exitCode,
          errorMessage: stderr.trim() || stdout.trim() || `Exit code: ${exitCode}`,
          checkedAt: new Date().toISOString()
        };
      }
    } catch (err: any) {
      proc.kill();
      return {
        id: crypto.randomUUID(),
        serviceId: checker.serviceId,
        checkerId: checker.id,
        status: 'timeout',
        responseTimeMs: Date.now() - startTime,
        statusCode: null,
        errorMessage: 'SSH execution timeout',
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
      errorMessage: err.message || 'SSH spawn failure',
      checkedAt: new Date().toISOString()
    };
  }
}
