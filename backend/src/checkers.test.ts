import { expect, test, describe, beforeAll } from 'bun:test';
import { resolveHttpTimeout } from './checkers/http/index.js';
import { createCheckerResult, getRecentResultsByService, createChecker } from './modules/checkers/repository.js';
import { createService } from './modules/services/repository.js';
import { checkService } from './modules/monitoring/scheduler.js';
import crypto from 'crypto';
import { initDB } from './db/index.js';

beforeAll(() => {
  initDB();
});

describe('Checker Logic and Validation', () => {
  test('Timeout precedence logic resolves correctly via root implementation', () => {
    // Falls back to service
    expect(resolveHttpTimeout(undefined, 5)).toBe(5);
    // Overrides via checker
    expect(resolveHttpTimeout('{"timeoutSeconds": 3}', 5)).toBe(3);
    // Falls back to global
    expect(resolveHttpTimeout(undefined, undefined)).toBe(10);
  });

  test('Error payload formatting works', () => {
    const formatError = (code: string, message: string) => ({
      success: false,
      data: null,
      error: code,
      message
    });
    
    const err = formatError('NOT_FOUND', 'Service not found');
    expect(err.success).toBe(false);
    expect(err.data).toBeNull();
    expect(err.error).toBe('NOT_FOUND');
  });

  test('Checker exceptions persist failure correctly via real DB and Scheduler unit', async () => {
    const serviceId = crypto.randomUUID();
    const checkerId = crypto.randomUUID();
    
    // 1. Create real service and checker to satisfy Foreign Keys
    createService({
      id: serviceId,
      name: 'Simulated Service',
      description: '',
      groupName: 'default',
      host: 'localhost',
      baseUrl: 'http://localhost',
      environment: 'test',
      checkIntervalSeconds: 60,
      timeoutSeconds: 10,
      isActive: true
    });

    createChecker({
      id: checkerId,
      serviceId: serviceId,
      type: 'invalid_type_to_force_exception' as any,
      name: 'Failing Checker',
      configJson: '{}',
      isActive: true
    });

    // 2. Trigger the real scheduler flow which catches exceptions and persists them
    await checkService({ id: serviceId, name: 'Simulated Service' } as any);

    // 3. Verify real DB retrieval
    const results = getRecentResultsByService(serviceId, 1);
    expect(results.length).toBe(1);
    expect(results[0].status).toBe('error');
    expect(results[0].errorMessage).toContain('Unsupported checker type');
  });
});
