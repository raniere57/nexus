import { Elysia, t } from 'elysia';
import { randomUUID } from 'crypto';
import * as repo from './repository.ts';
import type { Service } from '../../shared/types.ts';

function validateServiceData(data: any): string | null {
  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.trim().length === 0) return 'Name cannot be empty';
  }
  if (data.groupName !== undefined) {
    if (typeof data.groupName !== 'string' || data.groupName.trim().length === 0) return 'groupName cannot be empty';
  }
  if (data.host !== undefined) {
    if (typeof data.host !== 'string' || data.host.trim().length === 0) return 'host cannot be empty';
  }
  if (data.baseUrl !== undefined && data.baseUrl !== '') {
    if (typeof data.baseUrl !== 'string' || !/^https?:\/\//.test(data.baseUrl)) return 'baseUrl must start with http/https';
  }
  if (data.environment !== undefined) {
    if (typeof data.environment !== 'string' || data.environment.trim().length === 0) return 'environment cannot be empty';
  }
  if (data.checkIntervalSeconds !== undefined) {
    if (typeof data.checkIntervalSeconds !== 'number' || data.checkIntervalSeconds <= 0) return 'checkIntervalSeconds must be > 0';
  }
  if (data.timeoutSeconds !== undefined) {
    if (typeof data.timeoutSeconds !== 'number' || data.timeoutSeconds <= 0) return 'timeoutSeconds must be > 0';
  }
  return null;
}

const serviceDto = t.Object({
  name: t.Optional(t.String({ minLength: 1, error: 'Name cannot be empty' })),
  description: t.Optional(t.String()),
  groupName: t.Optional(t.String({ minLength: 1, error: 'groupName cannot be empty' })),
  host: t.Optional(t.String({ minLength: 1, error: 'host cannot be empty' })),
  baseUrl: t.Optional(t.String({ pattern: '^https?:\\/\\/' })),
  environment: t.Optional(t.String({ minLength: 1, error: 'environment cannot be empty' })),
  checkIntervalSeconds: t.Optional(t.Number({ minimum: 1, error: 'checkIntervalSeconds must be > 0' })),
  timeoutSeconds: t.Optional(t.Number({ minimum: 1, error: 'timeoutSeconds must be > 0' })),
  isActive: t.Optional(t.Boolean())
});

export const servicesRoutes = new Elysia({ prefix: '/api/services' })
  .get('/', () => repo.getAllServices())
  .get('/:id', ({ params: { id }, set }) => {
    const service = repo.getServiceById(id);
    if (!service) {
      set.status = 404;
      return { success: false, data: null, error: 'NOT_FOUND', message: 'Service not found' };
    }
    return service;
  })
  .post('/', ({ body, set }) => {
    const serviceBody = body as any;
    if (!serviceBody.name || typeof serviceBody.name !== 'string' || serviceBody.name.trim().length === 0) {
      set.status = 400;
      return { success: false, data: null, error: 'BAD_REQUEST', message: 'Name cannot be empty' };
    }
    
    const validationError = validateServiceData(serviceBody);
    if (validationError) {
      set.status = 400;
      return { success: false, data: null, error: 'BAD_REQUEST', message: validationError };
    }

    const newService: Omit<Service, 'createdAt' | 'updatedAt'> = {
      id: randomUUID(),
      name: serviceBody.name,
      description: serviceBody.description || '',
      groupName: serviceBody.groupName || 'default',
      host: serviceBody.host || '',
      baseUrl: serviceBody.baseUrl || '',
      environment: serviceBody.environment || 'production',
      checkIntervalSeconds: serviceBody.checkIntervalSeconds || 60,
      timeoutSeconds: serviceBody.timeoutSeconds || 10,
      isActive: serviceBody.isActive !== false
    };
    return repo.createService(newService);
  }, { body: serviceDto })
  .put('/:id', ({ params: { id }, body, set }) => {
    const existing = repo.getServiceById(id);
    if (!existing) {
      set.status = 404;
      return { success: false, data: null, error: 'NOT_FOUND', message: 'Service not found' };
    }

    const bodyData = body as any;
    const validationError = validateServiceData(bodyData);
    if (validationError) {
      set.status = 400;
      return { success: false, data: null, error: 'BAD_REQUEST', message: validationError };
    }

    const updated = repo.updateService(id, bodyData);
    return updated;
  }, { body: serviceDto })
  .delete('/:id', ({ params: { id }, set }) => {
    const deleted = repo.deleteService(id);
    if (!deleted) {
      set.status = 404;
      return { success: false, data: null, error: 'NOT_FOUND', message: 'Service not found' };
    }
    return { success: true };
  });
