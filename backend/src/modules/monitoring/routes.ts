import { Elysia, t } from 'elysia';
import { getServiceSnapshots, getAllServices } from '../services/repository.ts';
import { getRecentResultsByService, getResults, getAllActiveCheckers } from '../checkers/repository.ts';
import { parseCheckerSummaryJson } from './snapshots.ts';

export const monitoringRoutes = new Elysia({ prefix: '/api' })
  .get('/status', () => {
    return getServiceSnapshots();
  })
  .get('/status/tv', () => {
    const services = getAllServices();
    const snapshots = getServiceSnapshots();
    const checkers = getAllActiveCheckers();
    
    // Merge snapshot and service data for optimized TV view
    return services.map(srv => {
      const snap = snapshots.find(s => s.serviceId === srv.id);
      let activeCheckersCount = 0;
      let okCheckersCount = 0;
      let problematicCheckersCount = 0;
      const problemCheckers: string[] = [];
      const problemCheckerNames: string[] = [];
      let staleReason = null;
      let averageResponseTimeMs = 0;
      let logWarningCount = 0;
      let logCriticalCount = 0;
      let lastLogIssueAt = null;
      let lastLogAlertAt = null;

      let sanitizedSummary = {};

      if (snap?.checkerSummaryJson) {
        const parsed = parseCheckerSummaryJson(snap.checkerSummaryJson);
        staleReason = parsed.meta.staleReason || null;
        averageResponseTimeMs = parsed.meta.averageResponseTimeMs || 0;
        logWarningCount = parsed.log.warningCount || 0;
        logCriticalCount = parsed.log.criticalCount || 0;
        lastLogIssueAt = parsed.log.lastIssueAt || null;
        lastLogAlertAt = parsed.log.lastAlertAt || null;

        sanitizedSummary = parsed.checkerStatuses;
        const checkerIds = Object.keys(parsed.checkerStatuses);
        activeCheckersCount = checkerIds.length;
        
        checkerIds.forEach(id => {
          if ((parsed.checkerStatuses as Record<string, string>)[id] === 'success') {
            okCheckersCount++;
          } else {
            problematicCheckersCount++;
            problemCheckers.push(id);
            const chk = checkers.find((c: any) => c.id === id);
            if (chk) problemCheckerNames.push(chk.name);
          }
        });
      }

      return {
        serviceId: srv.id,
        serviceName: srv.name,
        groupName: srv.groupName,
        environment: srv.environment,
        overallStatus: snap?.overallStatus || 'unknown',
        lastCheckedAt: snap?.lastCheckedAt || null,
        lastOkAt: snap?.lastOkAt || null,
        lastFailureAt: snap?.lastFailureAt || null,
        totalActiveCheckers: activeCheckersCount,
        okCheckers: okCheckersCount,
        problemCheckers: problematicCheckersCount,
        problemCheckerIds: problemCheckers,
        problemCheckerNames,
        averageResponseTimeMs,
        staleReason,
        logWarningCount,
        logCriticalCount,
        lastLogIssueAt,
        lastLogAlertAt,
        checkerSummary: sanitizedSummary
      };
    });
  })
  .get('/results', ({ query }) => {
    const limit = query.limit ? parseInt(query.limit) : 50;
    return getResults({
      serviceId: query.serviceId,
      checkerId: query.checkerId,
      limit
    });
  }, {
    query: t.Object({
      serviceId: t.Optional(t.String()),
      checkerId: t.Optional(t.String()),
      limit: t.Optional(t.String())
    })
  })
  .get('/results/:serviceId', ({ params: { serviceId } }) => {
    return getRecentResultsByService(serviceId, 50);
  });
