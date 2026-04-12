import { describe, expect, test } from 'bun:test';
import {
  createLogFingerprint,
  normalizeLogMessage,
  resolveLogSeverity,
  shouldProcessLogLine
} from './index.ts';

describe('Log Checker Rules Engine', () => {
  test('normalizes dynamic values into a stable fingerprint basis', () => {
    const first = normalizeLogMessage('2026-04-10T12:00:00Z Timeout after 5000ms for requestId=abc-123');
    const second = normalizeLogMessage('2026-04-10T12:00:01Z Timeout after 3000ms for requestId=def-999');

    expect(first).toBe('timeout after xms for requestid=x');
    expect(second).toBe('timeout after xms for requestid=x');
    expect(createLogFingerprint(first)).toBe(createLogFingerprint(second));
  });

  test('filters only relevant error-like lines by default', () => {
    expect(shouldProcessLogLine('INFO server started', { sourceType: 'command' })).toBe(false);
    expect(shouldProcessLogLine('Unhandled Exception: boom', { sourceType: 'command' })).toBe(true);
  });

  test('classifies explicit critical patterns immediately', () => {
    expect(resolveLogSeverity('connection refused by database', 'connection refused by database', {
      countLastMinute: 1,
      count24h: 1
    }, { sourceType: 'command' })).toBe('critical');
  });

  test('promotes repeated warnings to critical based on thresholds', () => {
    expect(resolveLogSeverity('timeout after 5000ms', 'timeout after xms', {
      countLastMinute: 12,
      count24h: 12
    }, {
      sourceType: 'command',
      promotionThresholdPerMinute: 10,
      promotionThreshold24h: 100
    })).toBe('critical');
  });
});