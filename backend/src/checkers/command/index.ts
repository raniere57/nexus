import type { Checker, CheckerResult } from '../../shared/types';
import crypto from 'crypto';
import { getServerById } from '../../modules/servers/repository';

// =====================================================================
// Preset Checker Types
// The user picks a preset, fills simple fields, and the backend
// builds and executes the correct command automatically.
// =====================================================================

export type PresetType = 
  | 'curl'        // curl -sSf <url>
  | 'systemctl'   // systemctl is-active <service>
  | 'tcp_port'    // nc -zw3 <host> <port>
  | 'dns'         // dig +short <domain>
  | 'process'     // pgrep -x <process>
  | 'custom';     // raw shell command (advanced)

export interface CommandCheckerConfig {
  // --- Common ---
  preset: PresetType;
  serverId?: string;       // If set, run via SSH on this server
  timeoutSeconds?: number;

  // --- Curl ---
  url?: string;

  // --- Systemctl ---
  serviceName?: string;

  // --- TCP Port ---
  host?: string;
  port?: number;

  // --- DNS ---
  domain?: string;
  dnsType?: string;       // A, AAAA, MX, CNAME, TXT

  // --- Process ---
  processName?: string;

  // --- Custom (raw) ---
  command?: string;
  successPattern?: string;
  stdoutOnly?: boolean;
  exactMatch?: boolean;
}

/**
 * Build the shell command string from a config preset.
 * This is the core abstraction — the user fills simple fields 
 * and the backend builds the actual shell command.
 */
export function buildCommandFromPreset(config: CommandCheckerConfig): { command: string; successPattern?: string } {
  switch (config.preset) {
    case 'curl':
      if (!config.url) throw new Error('curl preset requires a url');
      return {
        command: `curl -sSf --max-time 10 "${config.url}"`
      };

    case 'systemctl':
      if (!config.serviceName) throw new Error('systemctl preset requires a serviceName');
      return {
        command: `systemctl is-active "${config.serviceName}"`,
        successPattern: 'active'
      };

    case 'tcp_port':
      if (!config.host || !config.port) throw new Error('tcp_port preset requires host and port');
      return {
        command: `nc -zw3 "${config.host}" ${config.port}`
      };

    case 'dns': {
      if (!config.domain) throw new Error('dns preset requires a domain');
      const dnsType = config.dnsType || 'A';
      return {
        command: `dig +short "${config.domain}" ${dnsType}`,
        successPattern: undefined // Just check exit code 0
      };
    }

    case 'process':
      if (!config.processName) throw new Error('process preset requires a processName');
      return {
        command: `pgrep -x "${config.processName}"`
      };

    case 'custom':
      if (!config.command) throw new Error('custom preset requires a command');
      return {
        command: config.command,
        successPattern: config.successPattern
      };

    default:
      throw new Error(`Unknown preset: ${config.preset}`);
  }
}

/**
 * Main entry point: Execute a command checker.
 * Handles both local and SSH (remote server) execution.
 */
export async function executeCommandChecker(checker: Checker, timeoutSeconds: number): Promise<CheckerResult> {
  const startTime = Date.now();
  let config: CommandCheckerConfig = { preset: 'custom', command: '' };

  try {
    config = JSON.parse(checker.configJson);
  } catch (e) {
    return makeError(checker, startTime, 'Invalid JSON config for command checker');
  }

  // Backward compat: if no preset field but has 'command', treat as custom
  if (!config.preset && (config as any).command) {
    config.preset = 'custom';
  }

  if (!config.preset) {
    return makeError(checker, startTime, 'No preset specified in checker config');
  }

  let builtCommand: string;
  let successPattern: string | undefined;

  try {
    const built = buildCommandFromPreset(config);
    builtCommand = built.command;
    successPattern = config.successPattern || built.successPattern;
  } catch (e: any) {
    return makeError(checker, startTime, e.message);
  }

  const effectiveTimeout = config.timeoutSeconds || timeoutSeconds;

  if (config.serverId) {
    return executeViaSSH(checker, builtCommand, successPattern, config, effectiveTimeout, startTime);
  }
  return executeLocal(checker, builtCommand, successPattern, config, effectiveTimeout, startTime);
}

// =====================================================================
// Local Execution
// =====================================================================
async function executeLocal(
  checker: Checker,
  command: string,
  successPattern: string | undefined,
  config: CommandCheckerConfig,
  timeoutSeconds: number,
  startTime: number
): Promise<CheckerResult> {
  try {
    const proc = Bun.spawn(['sh', '-c', command], {
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const exitCodePromise = proc.exited;
    const timeoutPromise = new Promise<number>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutSeconds * 1000)
    );

    try {
      const exitCode = await Promise.race([exitCodePromise, timeoutPromise]);
      const responseTimeMs = Date.now() - startTime;

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();

      return evaluateResult(checker, exitCode, stdout, stderr, successPattern, config, responseTimeMs);
    } catch (err: any) {
      proc.kill();
      return makeTimeout(checker, startTime);
    }
  } catch (err: any) {
    return makeError(checker, startTime, err.message || 'Spawn failure');
  }
}

// =====================================================================
// SSH Remote Execution
// =====================================================================
async function executeViaSSH(
  checker: Checker,
  command: string,
  successPattern: string | undefined,
  config: CommandCheckerConfig,
  timeoutSeconds: number,
  startTime: number
): Promise<CheckerResult> {
  const server = getServerById(config.serverId!);
  if (!server) {
    return makeError(checker, startTime, `Server not found: ${config.serverId}`);
  }

  const sshArgs = [
    'ssh',
    '-o', `ConnectTimeout=${timeoutSeconds}`,
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'BatchMode=no',
    '-o', 'PubkeyAuthentication=no',
    '-o', 'PreferredAuthentications=password',
    '-p', String(server.sshPort || 22),
    `${server.sshUser || 'root'}@${server.host}`,
    command
  ];

  // Use sshpass if available, else try direct (key-based)
  const usesSshpass = server.sshPassword && server.sshPassword.length > 0;
  const finalArgs = usesSshpass ? ['sshpass', '-e', ...sshArgs] : sshArgs;
  const env = usesSshpass ? { ...process.env, SSHPASS: server.sshPassword } : process.env;

  try {
    const proc = Bun.spawn(finalArgs, {
      stdout: 'pipe',
      stderr: 'pipe',
      env: env as Record<string, string>
    });

    const exitCodePromise = proc.exited;
    const timeoutPromise = new Promise<number>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutSeconds * 1000)
    );

    try {
      const exitCode = await Promise.race([exitCodePromise, timeoutPromise]);
      const responseTimeMs = Date.now() - startTime;

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();

      return evaluateResult(checker, exitCode, stdout, stderr, successPattern, config, responseTimeMs);
    } catch (err: any) {
      proc.kill();
      return makeTimeout(checker, startTime);
    }
  } catch (err: any) {
    return makeError(checker, startTime, err.message || 'SSH spawn failure');
  }
}

// =====================================================================
// Result Evaluation
// =====================================================================
function evaluateResult(
  checker: Checker,
  exitCode: number,
  stdout: string,
  stderr: string,
  successPattern: string | undefined,
  config: CommandCheckerConfig,
  responseTimeMs: number
): CheckerResult {
  const output = config.stdoutOnly ? stdout : stdout + stderr;

  // If there's a success pattern, output must match regardless of exit code
  if (successPattern) {
    const matches = config.exactMatch
      ? output.trim() === successPattern
      : output.includes(successPattern);
    
    return {
      id: crypto.randomUUID(),
      serviceId: checker.serviceId,
      checkerId: checker.id,
      status: matches ? 'success' : 'failure',
      responseTimeMs,
      statusCode: exitCode,
      errorMessage: matches ? null : `Output did not contain: "${successPattern}". Got: ${output.trim().slice(0, 200)}`,
      checkedAt: new Date().toISOString()
    };
  }

  // No pattern: just check exit code
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

// =====================================================================
// Helpers
// =====================================================================
function makeError(checker: Checker, startTime: number, message: string): CheckerResult {
  return {
    id: crypto.randomUUID(),
    serviceId: checker.serviceId,
    checkerId: checker.id,
    status: 'error',
    responseTimeMs: Date.now() - startTime,
    statusCode: null,
    errorMessage: message,
    checkedAt: new Date().toISOString()
  };
}

function makeTimeout(checker: Checker, startTime: number): CheckerResult {
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
