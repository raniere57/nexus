import { expect, test, describe } from 'bun:test';
import { isStatusStale } from './modules/monitoring/scheduler.js';

describe('Staleness Logic from Real Engine', () => {
  test('Should return correct stale payload mapping', () => {
    const intervalMs = 60 * 1000;
    const nowMs = 1000000;

    // Checks 10x intervals ago
    expect(isStatusStale(1000000 - (intervalMs * 10), nowMs, intervalMs, 'online')).toBe(true);
    
    // Checked recently
    expect(isStatusStale(1000000 - intervalMs, nowMs, intervalMs, 'online')).toBe(false);

    // Never checked
    expect(isStatusStale(0, nowMs, intervalMs, 'online')).toBe(false);

    // Already unknown
    expect(isStatusStale(1000000 - (intervalMs * 10), nowMs, intervalMs, 'unknown')).toBe(false);
  });
});
