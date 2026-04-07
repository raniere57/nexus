import { Elysia } from 'elysia';
import { randomUUID } from 'crypto';
import * as repo from './repository.js';
import type { Server } from '../../shared/types.js';

export const serversRoutes = new Elysia({ prefix: '/api/servers' })
  .get('/', () => repo.getAllServers())
  .get('/status', () => {
    const servers = repo.getAllServers();
    const snapshots = repo.getAllServerSnapshots();
    return servers.map(srv => {
      const snap = snapshots.find(s => s.serverId === srv.id);
      return {
        serverId: srv.id,
        serverName: srv.name,
        host: srv.host,
        status: snap?.status || 'unknown',
        cpuPercent: snap?.cpuPercent ?? null,
        ramPercent: snap?.ramPercent ?? null,
        diskPercent: snap?.diskPercent ?? null,
        uptimeSeconds: snap?.uptimeSeconds ?? null,
        lastCheckedAt: snap?.lastCheckedAt ?? null
      };
    });
  })
  .get('/:id', ({ params: { id }, set }) => {
    const server = repo.getServerById(id);
    if (!server) {
      set.status = 404;
      return { success: false, data: null, error: 'NOT_FOUND', message: 'Server not found' };
    }
    return server;
  })
  .post('/', ({ body, set }) => {
    const b = body as any;
    if (!b.name || typeof b.name !== 'string' || b.name.trim().length === 0) {
      set.status = 400;
      return { success: false, data: null, error: 'BAD_REQUEST', message: 'Name cannot be empty' };
    }
    if (!b.host || typeof b.host !== 'string' || b.host.trim().length === 0) {
      set.status = 400;
      return { success: false, data: null, error: 'BAD_REQUEST', message: 'Host cannot be empty' };
    }

    const newServer: Omit<Server, 'createdAt' | 'updatedAt'> = {
      id: randomUUID(),
      name: b.name,
      host: b.host,
      sshPort: b.sshPort || 22,
      sshUser: b.sshUser || 'root',
      sshPassword: b.sshPassword || '',
      checkIntervalSeconds: b.checkIntervalSeconds || 60,
      isActive: b.isActive !== false
    };
    return repo.createServer(newServer);
  })
  .put('/:id', ({ params: { id }, body, set }) => {
    const existing = repo.getServerById(id);
    if (!existing) {
      set.status = 404;
      return { success: false, data: null, error: 'NOT_FOUND', message: 'Server not found' };
    }
    const updated = repo.updateServer(id, body as any);
    return updated;
  })
  .delete('/:id', ({ params: { id }, set }) => {
    const deleted = repo.deleteServer(id);
    if (!deleted) {
      set.status = 404;
      return { success: false, data: null, error: 'NOT_FOUND', message: 'Server not found' };
    }
    return { success: true };
  });
