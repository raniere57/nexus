import { ref, onMounted, onUnmounted } from 'vue';
import type { NexusService, NexusServer, StatusUpdatePayload } from '../types';

const services = ref<NexusService[]>([]);
const servers = ref<NexusServer[]>([]);

export function useNexus() {
  let ws: WebSocket | null = null;
  const isConnected = ref(false);

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

          if (index !== -1) {
            services.value[index] = {
              ...services.value[index],
              overallStatus: payload.data.overallStatus,
              lastCheckedAt: payload.data.lastCheckedAt,
              lastOkAt: payload.data.lastOkAt,
              lastFailureAt: payload.data.lastFailureAt,
              checkerSummary
            };
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

  onMounted(() => {
    fetchInitialState();
    fetchInitialServers();
    if (!ws) {
      initWebSocket();
    }
  });

  onUnmounted(() => {
    if (ws) {
      ws.close();
      ws = null;
    }
  });

  return {
    services,
    servers,
    isConnected
  };
}
