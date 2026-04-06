import { ref, onMounted, onUnmounted } from 'vue';
import type { NexusService, StatusUpdatePayload } from '../types';

const services = ref<NexusService[]>([]);

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

  const initWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // Vite proxy handles this in dev! Or use import.meta.env
    // In dev, vite proxy does not always proxy websockets well without setup, 
    // but assuming standard setup:
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
            // Update existing
            services.value[index] = {
              ...services.value[index],
              overallStatus: payload.data.overallStatus,
              lastCheckedAt: payload.data.lastCheckedAt,
              lastOkAt: payload.data.lastOkAt,
              lastFailureAt: payload.data.lastFailureAt,
              checkerSummary
            };
          } else {
            // If it's a new service we didn't have, we might need a full refresh 
            // since snapshot doesn't have names. Let's just trigger fetch.
            fetchInitialState();
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
    isConnected
  };
}
