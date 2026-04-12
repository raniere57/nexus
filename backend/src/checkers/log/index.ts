import crypto from 'crypto';
import { getServerById } from '../../modules/servers/repository.ts';
import type { Checker, CheckerResult, LogCheckerConfig, LogSeverity } from '../../shared/types.ts';

const DEFAULT_RELEVANT_PATTERNS = [
  /\berror\b/i,
  /\bexception\b/i,
  /\bfail(?:ed|ure)?\b/i,
  /\bfatal\b/i,
  /\bpanic\b/i,
  /\bunhandled\b/i,
  /\btraceback\b/i
];

const DEFAULT_CRITICAL_PATTERNS = [
  /connection refused/i,
  /database down/i,
  /db down/i,
  /cannot connect to database/i,
  /out of memory/i,
  /segmentation fault/i,
  /fatal/i,
  /panic/i
];

const ANSI_REGEX = /\u001b\[[0-9;]*m/g;
const ISO_TIMESTAMP_REGEX = /\b\d{4}-\d{2}-\d{2}[ t]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:z|[+-]\d{2}:?\d{2})?\b/gi;
const CLOCK_TIMESTAMP_REGEX = /\b\d{2}:\d{2}:\d{2}(?:[.,]\d+)?\b/g;
const UUID_REGEX = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const IPV4_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const IPV6_REGEX = /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/gi;
const HEX_ID_REGEX = /\b0x[0-9a-f]+\b/gi;
const LONG_HEX_REGEX = /\b[0-9a-f]{12,}\b/gi;
const KEY_VALUE_ID_REGEX = /\b(request|trace|span|correlation|session|message|job|task|user|order|payment|execution)[-_ ]?id[=:][a-z0-9-]+\b/gi;
const PATH_LINE_REGEX = /:(\d+)(?::\d+)?\b/g;

export interface LogSourceConsumerOptions {
  signal: AbortSignal;
  onLine: (line: string) => void | Promise<void>;
}

function arrayOfRegex(patterns?: string[]): RegExp[] {
  return (patterns || []).filter(Boolean).map(pattern => new RegExp(pattern, 'i'));
}

function sanitizeLine(line: string): string {
  return line.replace(ANSI_REGEX, '').replace(/\r/g, '').trim();
}

export function validateLogCheckerConfig(config: LogCheckerConfig): string | null {
  if (!config || typeof config !== 'object') return 'Log checker requires a valid config object';

  if (!['file', 'command', 'http'].includes(config.sourceType)) {
    return 'Log checker sourceType must be file, command or http';
  }

  if (config.sourceType === 'file' && (!config.path || typeof config.path !== 'string')) {
    return 'File log source requires a valid path';
  }

  if (config.sourceType === 'command' && (!config.command || typeof config.command !== 'string')) {
    return 'Command log source requires a valid command';
  }

  if (config.sourceType === 'http' && (!config.url || typeof config.url !== 'string' || !/^https?:\/\//i.test(config.url))) {
    return 'HTTP log source requires a valid http/https url';
  }

  if (config.serverId && !getServerById(config.serverId)) {
    return 'Server not found';
  }

  const numberKeys: Array<keyof LogCheckerConfig> = [
    'spikeThresholdPerMinute',
    'promotionThresholdPerMinute',
    'promotionThreshold24h',
    'reconnectDelayMs',
    'previewWindowSeconds'
  ];

  for (const key of numberKeys) {
    const value = config[key];
    if (value !== undefined && (typeof value !== 'number' || Number.isNaN(value) || value <= 0)) {
      return `${key} must be a positive number`;
    }
  }

  const arrayKeys: Array<keyof LogCheckerConfig> = ['includePatterns', 'excludePatterns', 'criticalPatterns'];
  for (const key of arrayKeys) {
    const value = config[key];
    if (value !== undefined && (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item.trim().length === 0))) {
      return `${key} must be an array of non-empty strings`;
    }
  }

  return null;
}

export function shouldProcessLogLine(line: string, config: LogCheckerConfig): boolean {
  const sanitized = sanitizeLine(line);
  if (!sanitized) return false;

  const excludes = arrayOfRegex(config.excludePatterns);
  if (excludes.some(pattern => pattern.test(sanitized))) return false;

  const includes = arrayOfRegex(config.includePatterns);
  const relevantPatterns = includes.length > 0 ? includes : DEFAULT_RELEVANT_PATTERNS;
  return relevantPatterns.some(pattern => pattern.test(sanitized));
}

export function normalizeLogMessage(line: string): string {
  let normalized = sanitizeLine(line).toLowerCase();
  normalized = normalized.replace(ISO_TIMESTAMP_REGEX, ' ');
  normalized = normalized.replace(CLOCK_TIMESTAMP_REGEX, ' ');
  normalized = normalized.replace(UUID_REGEX, 'x');
  normalized = normalized.replace(IPV4_REGEX, 'x.x.x.x');
  normalized = normalized.replace(IPV6_REGEX, 'x:x:x:x');
  normalized = normalized.replace(HEX_ID_REGEX, 'x');
  normalized = normalized.replace(LONG_HEX_REGEX, 'x');
  normalized = normalized.replace(KEY_VALUE_ID_REGEX, '$1id=x');
  normalized = normalized.replace(PATH_LINE_REGEX, ':x');
  normalized = normalized.replace(/\b\d+(?:\.\d+)?(?=(ms|s|m|h|d|kb|mb|gb|tb|%))/g, 'x');
  normalized = normalized.replace(/\b\d+\b/g, 'x');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
}

export function createLogFingerprint(normalizedMessage: string): string {
  return crypto.createHash('sha1').update(normalizedMessage).digest('hex');
}

export function deriveLogTitle(normalizedMessage: string): string {
  return normalizedMessage.slice(0, 140) || 'log issue';
}

export function resolveLogSeverity(
  rawLine: string,
  normalizedMessage: string,
  counts: { countLastMinute: number; count24h: number },
  config: LogCheckerConfig
): LogSeverity {
  const criticalPatterns = arrayOfRegex(config.criticalPatterns);
  const effectiveCriticalPatterns = criticalPatterns.length > 0 ? criticalPatterns : DEFAULT_CRITICAL_PATTERNS;
  const explicitCritical = effectiveCriticalPatterns.some(pattern => pattern.test(rawLine) || pattern.test(normalizedMessage));
  if (explicitCritical) return 'critical';

  const promotionThresholdPerMinute = config.promotionThresholdPerMinute || 10;
  const promotionThreshold24h = config.promotionThreshold24h || 100;
  if (counts.countLastMinute >= promotionThresholdPerMinute || counts.count24h >= promotionThreshold24h) {
    return 'critical';
  }

  return 'warning';
}

export function getLogSpikeThreshold(config: LogCheckerConfig): number {
  return config.spikeThresholdPerMinute || 5;
}

function buildLocalCommand(config: LogCheckerConfig): string {
  if (config.sourceType === 'file') return `tail -n 0 -F "${config.path}"`;
  if (config.sourceType === 'command') return config.command!;
  throw new Error('Local command is not supported for this log source');
}

function buildRemoteCommand(config: LogCheckerConfig): string {
  if (config.sourceType === 'file') return `tail -n 0 -F \"${config.path}\"`;
  if (config.sourceType === 'command') return config.command!;
  throw new Error('Remote command is not supported for this log source');
}

async function consumeTextStream(stream: ReadableStream<Uint8Array> | null | undefined, options: LogSourceConsumerOptions): Promise<void> {
  if (!stream) return;

  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  try {
    while (!options.signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const parts = buffer.split(/\r?\n/);
      buffer = parts.pop() || '';
      for (const part of parts) {
        const line = sanitizeLine(part);
        if (line) await options.onLine(line);
      }
    }

    const lastLine = sanitizeLine(buffer);
    if (lastLine) await options.onLine(lastLine);
  } finally {
    reader.releaseLock();
  }
}

async function consumeProcessSource(config: LogCheckerConfig, options: LogSourceConsumerOptions): Promise<void> {
  const server = config.serverId ? getServerById(config.serverId) : null;
  const env = server?.sshPassword ? ({ ...process.env, SSHPASS: server.sshPassword } as Record<string, string>) : undefined;

  const args = server
    ? [
        ...(server.sshPassword ? ['sshpass', '-e'] : []),
        'ssh',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'BatchMode=no',
        '-o', 'PubkeyAuthentication=no',
        '-o', 'PreferredAuthentications=password',
        '-p', String(server.sshPort || 22),
        `${server.sshUser || 'root'}@${server.host}`,
        buildRemoteCommand(config)
      ]
    : ['sh', '-c', buildLocalCommand(config)];

  const proc = Bun.spawn(args, {
    stdout: 'pipe',
    stderr: 'pipe',
    env
  });

  const stop = () => {
    try {
      proc.kill();
    } catch {
      // noop
    }
  };

  options.signal.addEventListener('abort', stop, { once: true });

  try {
    const exitWatcher = proc.exited.then(code => {
      if (!options.signal.aborted && code !== 0) {
        throw new Error(`Log source exited with code ${code}`);
      }
    });
    await Promise.all([
      consumeTextStream(proc.stdout, options),
      consumeTextStream(proc.stderr, options),
      exitWatcher
    ]);
  } finally {
    options.signal.removeEventListener('abort', stop);
    stop();
  }
}

async function consumeHttpSource(config: LogCheckerConfig, options: LogSourceConsumerOptions): Promise<void> {
  const response = await fetch(config.url!, {
    headers: config.headers || {},
    signal: options.signal
  });

  if (!response.ok) {
    throw new Error(`HTTP log source returned status ${response.status}`);
  }

  if (!response.body) {
    throw new Error('HTTP log source returned an empty body');
  }

  await consumeTextStream(response.body, options);
}

export async function consumeLogSource(config: LogCheckerConfig, options: LogSourceConsumerOptions): Promise<void> {
  if (config.sourceType === 'http') {
    await consumeHttpSource(config, options);
    return;
  }

  await consumeProcessSource(config, options);
}

export async function previewLogChecker(checker: Checker, timeoutSeconds: number): Promise<CheckerResult> {
  const startedAt = Date.now();
  let config: LogCheckerConfig;

  try {
    config = JSON.parse(checker.configJson || '{}');
  } catch {
    return {
      id: crypto.randomUUID(),
      serviceId: checker.serviceId,
      checkerId: checker.id,
      status: 'error',
      responseTimeMs: Date.now() - startedAt,
      statusCode: null,
      errorMessage: 'Invalid JSON config for log checker',
      checkedAt: new Date().toISOString()
    };
  }

  const validationError = validateLogCheckerConfig(config);
  if (validationError) {
    return {
      id: crypto.randomUUID(),
      serviceId: checker.serviceId,
      checkerId: checker.id,
      status: 'error',
      responseTimeMs: Date.now() - startedAt,
      statusCode: null,
      errorMessage: validationError,
      checkedAt: new Date().toISOString()
    };
  }

  const controller = new AbortController();
  const previewWindowMs = (config.previewWindowSeconds || Math.min(timeoutSeconds, 3)) * 1000;
  const lines: string[] = [];
  const timeoutId = setTimeout(() => controller.abort(), previewWindowMs);

  try {
    await consumeLogSource(config, {
      signal: controller.signal,
      onLine(line) {
        if (lines.length < 5) lines.push(line);
        if (lines.length >= 2) controller.abort();
      }
    });
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      clearTimeout(timeoutId);
      return {
        id: crypto.randomUUID(),
        serviceId: checker.serviceId,
        checkerId: checker.id,
        status: 'error',
        responseTimeMs: Date.now() - startedAt,
        statusCode: null,
        errorMessage: error.message || 'Failed to connect to log source',
        checkedAt: new Date().toISOString()
      };
    }
  } finally {
    clearTimeout(timeoutId);
  }

  return {
    id: crypto.randomUUID(),
    serviceId: checker.serviceId,
    checkerId: checker.id,
    status: 'success',
    responseTimeMs: Date.now() - startedAt,
    statusCode: lines.length,
    errorMessage: lines.length > 0
      ? `Connected to log source. Previewed ${lines.length} line(s): ${lines.join(' | ').slice(0, 200)}`
      : 'Connected to log source. No lines received during the preview window.',
    checkedAt: new Date().toISOString()
  };
}