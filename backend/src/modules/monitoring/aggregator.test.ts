import { expect, test, describe } from 'bun:test';
import { aggregateStatus } from './aggregator.js';

describe('Aggregator Engine', () => {
  test('returns unknown if no checkers', () => {
    expect(aggregateStatus([])).toBe('unknown');
  });

  test('returns online if all checkers pass', () => {
    expect(aggregateStatus(['success', 'success'])).toBe('online');
  });

  test('returns offline if all checkers fail or error', () => {
    expect(aggregateStatus(['error', 'failure'])).toBe('offline');
    expect(aggregateStatus(['failure', 'failure'])).toBe('offline');
  });

  test('returns degraded if mixed success and failure', () => {
    expect(aggregateStatus(['success', 'error'])).toBe('degraded');
    expect(aggregateStatus(['failure', 'success'])).toBe('degraded');
  });
});
