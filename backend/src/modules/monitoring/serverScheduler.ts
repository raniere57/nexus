import { getAllServers, getServerSnapshotById, createOrUpdateServerSnapshot } from '../servers/repository.js';
import { checkServerViaSSH } from '../../checkers/ssh/index.js';
import { broadcastServerUpdate } from '../realtime/websocket.js';
import type { Server, ServerSnapshot } from '../../shared/types.js';

const runningServerTasks = new Set<string>();

export function startServerScheduler() {
  console.log('[ServerScheduler] Starting server monitoring engine');

  setInterval(async () => {
    const servers = getAllServers().filter(s => s.isActive);

    for (const server of servers) {
      if (runningServerTasks.has(server.id)) continue;

      const snapshot = getServerSnapshotById(server.id);
      const now = Date.now();
      const lastCheck = snapshot?.lastCheckedAt ? new Date(snapshot.lastCheckedAt).getTime() : 0;
      const intervalMs = (server.checkIntervalSeconds || 60) * 1000;

      if (now - lastCheck >= intervalMs) {
        checkServer(server).catch(err => {
          console.error(`[ServerScheduler] Error checking server ${server.id}:`, err);
        });
      }
    }
  }, 10000); // Poll every 10s
}

async function checkServer(server: Server) {
  runningServerTasks.add(server.id);
  console.log(`[ServerScheduler] Checking server: ${server.name} (${server.host})`);

  try {
    const result = await checkServerViaSSH(server);
    createOrUpdateServerSnapshot(server.id, result);
    broadcastServerUpdate(result);
  } catch (err: any) {
    console.error(`[ServerScheduler] Failed to check ${server.name}:`, err.message);
    const failedSnap: ServerSnapshot = {
      serverId: server.id,
      status: 'offline',
      cpuPercent: null,
      ramPercent: null,
      diskPercent: null,
      uptimeSeconds: null,
      lastCheckedAt: new Date().toISOString()
    };
    createOrUpdateServerSnapshot(server.id, failedSnap);
    broadcastServerUpdate(failedSnap);
  } finally {
    runningServerTasks.delete(server.id);
  }
}
