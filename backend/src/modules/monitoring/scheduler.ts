import { getAllServices, getServiceSnapshotById } from '../services/repository.ts';
import { getCheckersByServiceId, createCheckerResult, getRecentResultsByService } from '../checkers/repository.ts';
import { executePingChecker } from '../../checkers/ping/index.ts';
import { executeHttpChecker } from '../../checkers/http/index.ts';
import { executeCommandChecker } from '../../checkers/command/index.ts';
import type { Service } from '../../shared/types.ts';
import { aggregateStatus } from './aggregator.ts';
import { updateServiceSnapshot } from './snapshots.ts';
import crypto from 'crypto';

const runningTasks = new Set<string>();

export function isStatusStale(lastCheckMs: number, nowMs: number, intervalMs: number, currentStatus: string | undefined): boolean {
  return lastCheckMs > 0 && (nowMs - lastCheckMs > intervalMs * 2.5) && currentStatus !== 'unknown';
}

export function startScheduler() {
  console.log('[Scheduler] Starting scheduler engine');
  
  // Basic loop: run every X seconds to check if services need to be checked
  setInterval(async () => {
    const services = getAllServices().filter(s => s.isActive);
    
    for (const service of services) {
      if (runningTasks.has(service.id)) continue;
      
      const snapshot = getServiceSnapshotById(service.id);
      const now = new Date().getTime();
      const lastCheck = snapshot?.lastCheckedAt ? new Date(snapshot.lastCheckedAt).getTime() : 0;
      
      const intervalMs = (service.checkIntervalSeconds || 60) * 1000;
      
      // Expiração/Staleness logic: if it's been more than 2.5x the expected interval, mark as unknown
      // and pass isRealCheck = false so we don't fake the check time!
      if (isStatusStale(lastCheck, now, intervalMs, snapshot?.overallStatus)) {
        console.log(`[Scheduler] Service ${service.id} is stale. Marking as unknown.`);
        updateServiceSnapshot(service.id, {
          overallStatus: 'unknown',
          meta: { staleReason: 'Check interval exceeded. Service hasn\'t replied recently.' },
          touchCheckTimestamps: false
        });
      }

      if (now - lastCheck >= intervalMs) {
        checkService(service).catch(err => {
          console.error(`[Scheduler] Error checking service ${service.id}:`, err);
        });
      }
    }
  }, 5000); // Poll every 5s

  cleanupOldResults();
  setInterval(cleanupOldResults, 1000 * 60 * 60); // Run cleanup every hour
}

export async function checkService(service: Service) {
  runningTasks.add(service.id);
  console.log(`[Scheduler] Checking service: ${service.name} (${service.id})`);
  
  try {
    const checkers = getCheckersByServiceId(service.id).filter(c => c.isActive && c.type !== 'log');
    
    if (checkers.length === 0) {
      updateServiceSnapshot(service.id, {
        overallStatus: 'unknown',
        checkerStatuses: {},
        replaceCheckerStatuses: true,
        meta: { averageResponseTimeMs: 0, staleReason: null }
      });
      return;
    }

    const checkerSummary: Record<string, string> = {};
    let allPassed = true;
    let allFailed = true;

    let totalTime = 0;

    for (const checker of checkers) {
      try {
        let result;
        if (checker.type === 'ping') {
          result = await executePingChecker(checker, service.host, service.timeoutSeconds);
        } else if (checker.type === 'http') {
          result = await executeHttpChecker(checker, service.baseUrl, service.timeoutSeconds);
        } else if (checker.type === 'command') {
          result = await executeCommandChecker(checker, service.timeoutSeconds);
        } else {
          throw new Error(`Unsupported checker type: ${checker.type}`);
        }
        
        createCheckerResult(result);
        checkerSummary[checker.id] = result.status;
        totalTime += result.responseTimeMs;
      } catch (e: any) {
        console.error(`[Scheduler] Checker ${checker.id} failed to run:`, e);
        checkerSummary[checker.id] = 'error';
        // MUST PERSIST ERROR
        createCheckerResult({
          id: crypto.randomUUID(),
          serviceId: checker.serviceId,
          checkerId: checker.id,
          status: 'error',
          responseTimeMs: 0,
          statusCode: null,
          errorMessage: e.message || 'Internal failure'
        });
      }
    }

    const overallStatus = aggregateStatus(Object.values(checkerSummary));

    const avgResponseTimeMs = checkers.length > 0 ? Math.round(totalTime / checkers.length) : 0;

    updateServiceSnapshot(service.id, {
      overallStatus,
      checkerStatuses: checkerSummary,
      replaceCheckerStatuses: true,
      meta: { averageResponseTimeMs: avgResponseTimeMs, staleReason: null }
    });
  } finally {
    runningTasks.delete(service.id);
  }
}

function cleanupOldResults() {
  import('../../db/index.ts').then(({ db }) => {
    try {
      console.log('[Scheduler] Cleaning up old results');
      // Keep last 7 days roughly, simple approach
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      db.query(`DELETE FROM checker_results WHERE checkedAt < ?`).run(sevenDaysAgo);
    } catch (e) {
      console.error('[Scheduler] Error cleaning up:', e);
    }
  });
}

