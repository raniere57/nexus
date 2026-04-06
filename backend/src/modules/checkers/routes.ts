import { Elysia, t } from 'elysia';
import { randomUUID } from 'crypto';
import * as repo from './repository.js';
import { getServiceById } from '../services/repository.js';
import type { Checker, CheckerType } from '../../shared/types.js';

function validateConfig(checkerType: string, configJson?: string): string | null {
  if (!configJson) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(configJson);
  } catch(e) {
    return 'Invalid JSON in configJson';
  }

  if (checkerType === 'http') {
    if (!parsed.url || typeof parsed.url !== 'string' || !parsed.url.startsWith('http')) return 'HTTP checker requires a valid url starting with http/https';
    if (parsed.expectedStatus && typeof parsed.expectedStatus !== 'number') return 'expectedStatus must be number';
    if (parsed.method && !['GET','POST','PUT','DELETE','PATCH','HEAD','OPTIONS'].includes(parsed.method.toUpperCase())) return 'Invalid HTTP method';
    if (parsed.timeoutSeconds && (typeof parsed.timeoutSeconds !== 'number' || parsed.timeoutSeconds <= 0)) return 'timeoutSeconds must be > 0';
    if (parsed.headers && (typeof parsed.headers !== 'object' || Array.isArray(parsed.headers))) return 'headers must be a valid JSON object';
  } else if (checkerType === 'ping') {
    if (!parsed.host || typeof parsed.host !== 'string') return 'Ping checker requires a valid host string';
    if (parsed.timeoutSeconds && (typeof parsed.timeoutSeconds !== 'number' || parsed.timeoutSeconds <= 0)) return 'timeoutSeconds must be > 0';
  }
  return null;
}

export const checkersRoutes = new Elysia()
  .group('/api/services/:id/checkers', app => app
    .get('/', ({ params: { id } }) => repo.getCheckersByServiceId(id))
    .post('/', ({ params: { id }, body, set }) => {
      const service = getServiceById(id);
      if (!service) {
        set.status = 404;
        return { success: false, message: 'Service not found' };
      }

      const checkerBody = body as any;
      const validationError = validateConfig(checkerBody.type, checkerBody.configJson);
      if (validationError) {
        set.status = 400;
        return { success: false, message: validationError };
      }

      const newChecker: Omit<Checker, 'createdAt' | 'updatedAt'> = {
        id: randomUUID(),
        serviceId: id,
        type: checkerBody.type as CheckerType,
        name: checkerBody.name,
        configJson: checkerBody.configJson || '{}',
        isActive: checkerBody.isActive !== false
      };
      
      const created = repo.createChecker(newChecker);
      return { success: true, data: created };
    }, {
      body: t.Object({
        type: t.Union([t.Literal('ping'), t.Literal('http')]),
        name: t.String({ minLength: 1, error: 'Name cannot be empty' }),
        configJson: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean())
      })
    })
  )
  .group('/api/checkers', app => app
    .put('/:id', ({ params: { id }, body, set }) => {
      const bodyData = body as any;
      if (bodyData.type) {
         if (bodyData.type !== 'ping' && bodyData.type !== 'http') {
           set.status = 400;
           return { success: false, message: 'type must be ping or http' };
         }
         const validationError = validateConfig(bodyData.type, bodyData.configJson);
         if (validationError) {
           set.status = 400;
           return { success: false, message: validationError };
         }
      }

      const updated = repo.updateChecker(id, bodyData);
      if (!updated) {
        set.status = 404;
        return { success: false, message: 'Checker not found' };
      }
      return updated;
    }, {
      body: t.Object({
        type: t.Optional(t.String()),
        name: t.Optional(t.String({ minLength: 1, error: 'Name cannot be empty' })),
        configJson: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean())
      })
    })
    .delete('/:id', ({ params: { id }, set }) => {
      const deleted = repo.deleteChecker(id);
      if (!deleted) {
        set.status = 404;
        return { success: false, message: 'Checker not found' };
      }
      return { success: true };
    })
  );
