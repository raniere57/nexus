import { Elysia, t } from 'elysia';
import { getLogClusters, getRecentMonitoringAlerts } from './repository.ts';

export const logsRoutes = new Elysia({ prefix: '/api' })
  .get('/logs/clusters', ({ query }) => {
    const limit = query.limit ? parseInt(query.limit) : 100;
    return getLogClusters({
      serviceId: query.serviceId,
      checkerId: query.checkerId,
      severity: query.severity as 'warning' | 'critical' | undefined,
      limit
    });
  }, {
    query: t.Object({
      serviceId: t.Optional(t.String()),
      checkerId: t.Optional(t.String()),
      severity: t.Optional(t.Union([t.Literal('warning'), t.Literal('critical')])),
      limit: t.Optional(t.String())
    })
  })
  .get('/alerts', ({ query }) => {
    const limit = query.limit ? parseInt(query.limit) : 50;
    return getRecentMonitoringAlerts({
      serviceId: query.serviceId,
      limit
    });
  }, {
    query: t.Object({
      serviceId: t.Optional(t.String()),
      limit: t.Optional(t.String())
    })
  });