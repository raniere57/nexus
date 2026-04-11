import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { servicesRoutes } from './modules/services/routes.js';
import { checkersRoutes } from './modules/checkers/routes.js';
import { monitoringRoutes } from './modules/monitoring/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { serversRoutes } from './modules/servers/routes.js';
import { logsRoutes } from './modules/logs/routes.js';
import { addSubscriber, removeSubscriber } from './modules/realtime/websocket.js';
import { getServiceSnapshots } from './modules/services/repository.js';
import { getAllServerSnapshots } from './modules/servers/repository.js';

export const app = new Elysia()
  .use(cors())
  .use(swagger({
    path: '/docs',
    documentation: {
      info: {
        title: 'Nexus Monitoring API',
        version: '1.0.0'
      }
    }
  }))
  .onError(({ code, error, set }) => {
    let statusCode = 500;
    if (code === 'NOT_FOUND') statusCode = 404;
    else if (code === 'VALIDATION') statusCode = 400;
    else if (set.status !== 200) statusCode = set.status as number;

    set.status = statusCode;
    return {
      success: false,
      data: null,
      error: code.toString(),
      message: error.message
    };
  })
  .onAfterHandle(({ response, set }) => {
    if (response instanceof Response) return response;
    
    // Se is already an error payload from onError, mantem e retorna
    if (response && typeof response === 'object' && (response as any).success === false) {
      return response;
    }

    return {
      success: true,
      data: response,
      error: null,
      message: null
    };
  })
  .get('/health', () => ({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }))
  .ws('/ws/status', {
    open(ws) {
      console.log('[WebSocket] Client connected');
      addSubscriber(ws);
      try {
        const snapshots = getServiceSnapshots();
        ws.send(JSON.stringify({
          type: 'initial_state',
          data: snapshots
        }));
        // Also send initial server states
        const serverSnaps = getAllServerSnapshots();
        ws.send(JSON.stringify({
          type: 'initial_server_state',
          data: serverSnaps
        }));
      } catch (e) {
        console.error('[WebSocket] Failed to send initial state', e);
      }
    },
    close(ws) {
      console.log('[WebSocket] Client disconnected');
      removeSubscriber(ws);
    }
  })
  .use(servicesRoutes)
  .use(checkersRoutes)
  .use(monitoringRoutes)
  .use(authRoutes)
  .use(serversRoutes)
  .use(logsRoutes);
