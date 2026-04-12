import { ref, onMounted, onUnmounted } from 'vue';
import type { NexusService, NexusServer, StatusUpdatePayload } from '../types';

const services = ref<NexusService[]>([]);
const servers = ref<NexusServer[]>([]);

export function useNexus() {
  let ws: WebSocket | null = null;
  let pollInterval: number | null = null;
  const isConnected = ref(false);
  let lastUpdate = Date.now();

  const fetchInitialState = async () => {
    try {
      const res = await fetch('/api/status/tv');
      if (res.ok) {
        const payload = await res.json();
        services.value = payload && payload.success && Array.isArray(payload.data) ? payload.data : payload;
      }
    } catch (e) {
      console.error('Failed to fetch initial state', e);
    }
  };

  const extractLogSummary = (checkerSummary: Record<string, any>) => {
    const logSummary = checkerSummary?.__log;
    if (!logSummary) {
      return {
        logWarningCount: 0,
        logCriticalCount: 0,
        lastLogIssueAt: null,
        lastLogAlertAt: null
      };
    }

    let parsed = logSummary;
    if (typeof logSummary === 'string') {
      try {
        parsed = JSON.parse(logSummary);
      } catch {
        parsed = {};
      }
    }

    return {
      logWarningCount: parsed.warningCount || 0,
      logCriticalCount: parsed.criticalCount || 0,
      lastLogIssueAt: parsed.lastIssueAt || null,
      lastLogAlertAt: parsed.lastAlertAt || null
    };
  };

  const fetchInitialServers = async () => {
    try {
      const res = await fetch('/api/servers/status');
      if (res.ok) {
        const payload = await res.json();
        servers.value = payload && payload.success && Array.isArray(payload.data) ? payload.data : payload;
      }
    } catch (e) {
      console.error('Failed to fetch initial server state', e);
    }
  };

  const initWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    ws = new WebSocket(`${protocol}//${host}/ws/status`);

    ws.onopen = () => {
      isConnected.value = true;
      lastUpdate = Date.now();
      console.log('NEXUS Core WebSocket Connected');
    };

    ws.onmessage = (event) => {
      try {
        const payload: StatusUpdatePayload = JSON.parse(event.data);
        if (payload.type === 'status_update') {
          const index = services.value.findIndex(s => s.serviceId === payload.data.serviceId);
          const checkerSummary = typeof payload.data.checkerSummaryJson === 'string'
            ? JSON.parse(payload.data.checkerSummaryJson)
            : payload.data.checkerSummaryJson;
          const logSummary = extractLogSummary(checkerSummary);

          if (index !== -1) {
            services.value[index] = {
              ...services.value[index],
              overallStatus: payload.data.overallStatus,
              lastCheckedAt: payload.data.lastCheckedAt,
              lastOkAt: payload.data.lastOkAt,
              lastFailureAt: payload.data.lastFailureAt,
              logWarningCount: logSummary.logWarningCount,
              logCriticalCount: logSummary.logCriticalCount,
              lastLogIssueAt: logSummary.lastLogIssueAt,
              lastLogAlertAt: logSummary.lastLogAlertAt,
              checkerSummary
            };
            lastUpdate = Date.now();
          } else {
            fetchInitialState();
          }
        } else if (payload.type === 'server_update') {
          const index = servers.value.findIndex(s => s.serverId === payload.data.serverId);
          if (index !== -1) {
            servers.value[index] = {
              ...servers.value[index],
              status: payload.data.status,
              cpuPercent: payload.data.cpuPercent,
              ramPercent: payload.data.ramPercent,
              diskPercent: payload.data.diskPercent,
              uptimeSeconds: payload.data.uptimeSeconds,
              lastCheckedAt: payload.data.lastCheckedAt
            };
            lastUpdate = Date.now();
          } else {
            fetchInitialServers();
          }
        } else if (payload.type === 'initial_server_state') {
          // Merge server snapshot data with names
          if (Array.isArray(payload.data)) {
            fetchInitialServers();
          }
        }
      } catch (e) {
        console.error('Error parsing NS update', e);
      }
    };

    ws.onclose = () => {
      isConnected.value = false;
      console.log('NEXUS Core connection lost. Reconnecting in 5s...');
      setTimeout(initWebSocket, 5000);
    };
  };

  const startPolling = () => {
    // Poll a cada 30 segundos como fallback
    pollInterval = window.setInterval(() => {
      const timeSinceUpdate = Date.now() - lastUpdate;
      // Só faz polling se não houver atualização há mais de 15 segundos
      // Isso evita sobrecarregar o servidor quando o WebSocket está funcionando
      if (timeSinceUpdate > 15000) {
        fetchInitialState();
        fetchInitialServers();
        lastUpdate = Date.now();
        console.log('NEXUS Polling data refresh (WebSocket inactive)');
      }
    }, 30000);
  };

  onMounted(() => {
    fetchInitialState();
    fetchInitialServers();
    if (!ws) {
      initWebSocket();
    }
    // Inicia o polling como fallback
    startPolling();
  });

  onUnmounted(() => {
    if (ws) {
      ws.close();
      ws = null;
    }
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  });

  return {
    services,
    servers,
    isConnected
  };
}
