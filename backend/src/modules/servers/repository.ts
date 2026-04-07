import { db } from '../../db/index.js';
import type { Server, ServerSnapshot } from '../../shared/types.js';

export function getAllServers(): Server[] {
  return db.query(`SELECT * FROM servers`).all() as Server[];
}

export function getServerById(id: string): Server | null {
  const s = db.query(`SELECT * FROM servers WHERE id = ?`).get(id) as Server;
  return s || null;
}

export function createServer(server: Omit<Server, 'createdAt' | 'updatedAt'>): Server {
  db.query(`
    INSERT INTO servers (id, name, host, sshPort, sshUser, sshPassword, checkIntervalSeconds, isActive)
    VALUES ($id, $name, $host, $sshPort, $sshUser, $sshPassword, $checkIntervalSeconds, $isActive)
  `).run({
    $id: server.id,
    $name: server.name,
    $host: server.host,
    $sshPort: server.sshPort,
    $sshUser: server.sshUser,
    $sshPassword: server.sshPassword,
    $checkIntervalSeconds: server.checkIntervalSeconds,
    $isActive: server.isActive ? 1 : 0
  });

  createOrUpdateServerSnapshot(server.id, {
    serverId: server.id,
    status: 'unknown',
    cpuPercent: null,
    ramPercent: null,
    diskPercent: null,
    uptimeSeconds: null,
    lastCheckedAt: null
  });

  return getServerById(server.id)!;
}

export function updateServer(id: string, updates: Partial<Omit<Server, 'id' | 'createdAt' | 'updatedAt'>>): Server | null {
  const existing = getServerById(id);
  if (!existing) return null;

  const toUpdate = { ...existing, ...updates, updatedAt: new Date().toISOString() };

  db.query(`
    UPDATE servers SET
      name = $name,
      host = $host,
      sshPort = $sshPort,
      sshUser = $sshUser,
      sshPassword = $sshPassword,
      checkIntervalSeconds = $checkIntervalSeconds,
      isActive = $isActive,
      updatedAt = $updatedAt
    WHERE id = $id
  `).run({
    $id: id,
    $name: toUpdate.name,
    $host: toUpdate.host,
    $sshPort: toUpdate.sshPort,
    $sshUser: toUpdate.sshUser,
    $sshPassword: toUpdate.sshPassword,
    $checkIntervalSeconds: toUpdate.checkIntervalSeconds,
    $isActive: toUpdate.isActive ? 1 : 0,
    $updatedAt: toUpdate.updatedAt
  });

  return getServerById(id);
}

export function deleteServer(id: string): boolean {
  const info = db.query(`DELETE FROM servers WHERE id = ?`).run(id);
  return info.changes > 0;
}

export function getAllServerSnapshots(): ServerSnapshot[] {
  return db.query(`SELECT * FROM server_snapshots`).all() as ServerSnapshot[];
}

export function getServerSnapshotById(serverId: string): ServerSnapshot | null {
  const r = db.query(`SELECT * FROM server_snapshots WHERE serverId = ?`).get(serverId) as ServerSnapshot;
  return r || null;
}

export function createOrUpdateServerSnapshot(serverId: string, snapshot: ServerSnapshot) {
  db.query(`
    INSERT INTO server_snapshots 
      (serverId, status, cpuPercent, ramPercent, diskPercent, uptimeSeconds, lastCheckedAt)
    VALUES ($serverId, $status, $cpuPercent, $ramPercent, $diskPercent, $uptimeSeconds, $lastCheckedAt)
    ON CONFLICT(serverId) DO UPDATE SET
      status = excluded.status,
      cpuPercent = excluded.cpuPercent,
      ramPercent = excluded.ramPercent,
      diskPercent = excluded.diskPercent,
      uptimeSeconds = excluded.uptimeSeconds,
      lastCheckedAt = excluded.lastCheckedAt
  `).run({
    $serverId: snapshot.serverId,
    $status: snapshot.status,
    $cpuPercent: snapshot.cpuPercent,
    $ramPercent: snapshot.ramPercent,
    $diskPercent: snapshot.diskPercent,
    $uptimeSeconds: snapshot.uptimeSeconds,
    $lastCheckedAt: snapshot.lastCheckedAt
  });
}
