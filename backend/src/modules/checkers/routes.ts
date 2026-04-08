import { Elysia, t } from 'elysia';
import { randomUUID } from 'crypto';
import * as repo from './repository.js';
import { getServiceById } from '../services/repository.js';
import { getServerById } from '../../modules/servers/repository.js';
import { executeHttpChecker } from '../../checkers/http/index.js';
import { executePingChecker } from '../../checkers/ping/index.js';
import { executeCommandChecker, buildCommandFromPreset } from '../../checkers/command/index.js';
import type { Checker, CheckerType } from '../../shared/types.js';

const COMMAND_PRESETS = ['curl', 'systemctl', 'tcp_port', 'dns', 'process', 'custom'];

function validateConfig(checkerType: string, configJson?: string): string | null {
  if (!configJson) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(configJson);
  } catch(e) {
    return 'Invalid JSON in configJson';
  }

  if (checkerType === 'http') {
    if (!parsed.url || typeof parsed.url !== 'string' || !parsed.url.startsWith('http')) 
      return 'HTTP checker requires a valid url starting with http/https';
    if (parsed.expectedStatus && typeof parsed.expectedStatus !== 'number') 
      return 'expectedStatus must be number';
    if (parsed.method && !['GET','POST','PUT','DELETE','PATCH','HEAD','OPTIONS'].includes(parsed.method.toUpperCase())) 
      return 'Invalid HTTP method';

  } else if (checkerType === 'ping') {
    if (!parsed.host || typeof parsed.host !== 'string') 
      return 'Ping checker requires a valid host string';

  } else if (checkerType === 'command') {
    // For command checkers, we just validate the preset fields
    const preset = parsed.preset || 'custom';
    if (!COMMAND_PRESETS.includes(preset)) 
      return `Invalid preset. Must be one of: ${COMMAND_PRESETS.join(', ')}`;
    
    // Validate serverId if provided
    if (parsed.serverId && !getServerById(parsed.serverId)) 
      return 'Server not found';

    // Try building the command to validate required fields
    try {
      buildCommandFromPreset(parsed);
    } catch (e: any) {
      return e.message;
    }
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
        type: t.Union([t.Literal('ping'), t.Literal('http'), t.Literal('command')]),
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
        if (!['ping', 'http', 'command'].includes(bodyData.type)) {
          set.status = 400;
          return { success: false, message: 'type must be ping, http or command' };
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
    .post('/test', async ({ body, set }) => {
      const { type, configJson, serviceId } = body as any;
      const service = getServiceById(serviceId);
      const timeout = service?.timeoutSeconds || 10;
      
      const validationError = validateConfig(type, configJson);
      if (validationError) {
        set.status = 400;
        return { success: false, message: validationError };
      }

      const tempChecker: Checker = {
        id: 'test',
        serviceId: serviceId || 'test',
        type,
        configJson,
        name: 'Test',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        let result;
        if (type === 'http') {
          result = await executeHttpChecker(tempChecker, service?.baseUrl || '', timeout);
        } else if (type === 'ping') {
          result = await executePingChecker(tempChecker, service?.host || '127.0.0.1', timeout);
        } else if (type === 'command') {
          result = await executeCommandChecker(tempChecker, timeout);
        } else {
          return { success: false, message: 'Invalid type' };
        }
        return { success: true, result };
      } catch (e: any) {
        return { success: false, message: e.message };
      }
    }, {
      body: t.Object({
        type: t.String(),
        configJson: t.String(),
        serviceId: t.Optional(t.String())
      })
    })
  );
