<template>
  <div class="status-summary">
    <div class="summary-header">
      <h2>SYSTEM METRICS</h2>
      <div class="pulse-line"></div>
    </div>

    <div class="stat-blocks">
      <div class="stat-block">
        <div class="stat-value">{{ services.length }}</div>
        <div class="stat-label">TOTAL NODES</div>
      </div>
      <div class="stat-block" :class="{'highlight-online': onlineCount === services.length && services.length > 0}">
        <div class="stat-value">{{ onlineCount }}</div>
        <div class="stat-label">ONLINE</div>
      </div>
      <div class="stat-block" :class="{'highlight-offline': servicesOfflineCount > 0 || serversOfflineCount > 0, 'alert-pulse': isAlertPulsing}">
        <div class="stat-value">{{ servicesOfflineCount + serversOfflineCount }}</div>
        <div class="stat-label">OFFLINE</div>
      </div>
    </div>

    <div v-if="criticalServices.length > 0" class="critical-section" :class="{ 'alert-pulse': isAlertPulsing }">
      <h3 class="section-title text-offline">CRITICAL ALERTS</h3>
      <div class="alert-list">
        <div v-for="srv in criticalServices" :key="srv.serviceId" class="alert-item" :class="{ 'alert-pulse': isAlertPulsing }">
          <div class="alert-indicator"></div>
          <div class="alert-info">
            <div class="alert-name">{{ srv.serviceName }}</div>
            <div class="alert-time">Failed: {{ formatTime(srv.lastFailureAt) }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="offlineServers.length > 0" class="critical-section" :class="{ 'alert-pulse': isAlertPulsing }">
      <h3 class="section-title text-offline">INFRASTRUCTURE OFFLINE</h3>
      <div class="alert-list">
        <div v-for="srv in offlineServers" :key="srv.serverId" class="alert-item" :class="{ 'alert-pulse': isAlertPulsing }">
          <div class="alert-indicator"></div>
          <div class="alert-info">
            <div class="alert-name">{{ srv.serverName }}</div>
            <div class="alert-time">Host: {{ srv.host }} — Unreachable</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="degradedServices.length > 0" class="degraded-section" :class="{ 'alert-pulse': isAlertPulsing }">
      <h3 class="section-title text-degraded">DEGRADED NODES</h3>
      <div class="alert-list">
        <div v-for="srv in degradedServices" :key="srv.serviceId" class="alert-item degraded" :class="{ 'alert-pulse': isAlertPulsing }">
          <div class="alert-indicator"></div>
          <div class="alert-info">
            <div class="alert-name">{{ srv.serviceName }}</div>
            <div class="alert-time">Issues in checkers</div>
          </div>
        </div>
      </div>
    </div>

    <div class="activity-log">
      <h3 class="section-title">ACTIVE NODES (RECENTLY CHECKED)</h3>
      <div class="log-list">
        <div v-for="srv in recentServices" :key="srv.serviceId" class="log-item">
          <span class="log-status" :class="`text-${srv.overallStatus}`">[{{ srv.overallStatus.toUpperCase() }}]</span>
          <span class="log-name">{{ srv.serviceName }}</span>
          <span class="log-time">{{ formatTimeOnly(srv.lastCheckedAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import type { NexusService, NexusServer } from '../types';
import { useAlerts } from '../composables/useAlerts';

const props = defineProps<{
  services: NexusService[]
  servers: NexusServer[]
}>();

const { setServicesOfflineCount, setServersOfflineCount, isAlertPulsing } = useAlerts();

const onlineCount = computed(() => props.services.filter(s => s.overallStatus === 'online').length);
const servicesOfflineCount = computed(() => props.services.filter(s => s.overallStatus === 'offline').length);
const serversOfflineCount = computed(() => (props.servers || []).filter(s => s.status === 'offline').length);

// Usar watch para notificar o composável sempre que os contadores mudam
watch([servicesOfflineCount, serversOfflineCount], ([newServiceOff, newServerOff]) => {
  setServicesOfflineCount(newServiceOff);
  setServersOfflineCount(newServerOff);
}, { immediate: true });

const criticalServices = computed(() => props.services.filter(s => s.overallStatus === 'offline'));
const degradedServices = computed(() => props.services.filter(s => s.overallStatus === 'degraded'));
const offlineServers = computed(() => (props.servers || []).filter(s => s.status === 'offline'));

const recentServices = computed(() => {
  return [...props.services]
    .filter(s => s.lastCheckedAt)
    .sort((a, b) => new Date(b.lastCheckedAt!).getTime() - new Date(a.lastCheckedAt!).getTime())
    .slice(0, 8);
});

const formatTime = (isoString: string | null) => {
  if (!isoString) return 'Unknown';
  const d = new Date(isoString);
  return d.toLocaleTimeString() + ' (' + d.toLocaleDateString() + ')';
};

const formatTimeOnly = (isoString: string | null) => {
  if (!isoString) return '--:--:--';
  return new Date(isoString).toLocaleTimeString('en-US', { hour12: false });
};
</script>

<style scoped>
.status-summary {
  flex: 1;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  overflow-y: auto;
}

.summary-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.summary-header h2 {
  font-size: 1.2rem;
  color: var(--text-primary);
  opacity: 0.9;
}

.pulse-line {
  height: 2px;
  width: 100%;
  background: linear-gradient(90deg, var(--color-accent) 0%, transparent 100%);
  opacity: 0.5;
  position: relative;
}

.pulse-line::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 20px;
  background: #fff;
  box-shadow: 0 0 10px #fff;
  animation: scan 4s infinite linear;
}

@keyframes scan {
  0% { left: 0; opacity: 1; }
  100% { left: 100%; opacity: 0; }
}

@keyframes blinkText {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.stat-blocks {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;
}

.stat-block {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 1rem;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 2rem;
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  letter-spacing: 0.1em;
  margin-top: 0.25rem;
}

.highlight-online .stat-value { color: var(--color-online); text-shadow: 0 0 10px var(--color-online-glow); }
.highlight-offline .stat-value { color: var(--color-offline); text-shadow: 0 0 10px var(--color-offline-glow); }

/* Fazer o contador de offline piscar quando há alertas ativos */
.stat-block.highlight-offline.alert-pulse {
  animation: alertPulse 5s infinite ease-in-out;
}
.stat-block.highlight-offline.alert-pulse .stat-value {
  color: var(--color-offline);
  animation: blinkText 5s infinite ease-in-out;
}

.section-title {
  font-size: 0.9rem;
  letter-spacing: 0.15em;
  margin-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 0.5rem;
  color: var(--text-secondary);
}

.text-offline { color: var(--color-offline); }
.text-degraded { color: var(--color-degraded); }
.text-online { color: var(--color-online); }

.alert-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(239, 68, 68, 0.05);
  border-left: 3px solid var(--color-offline);
  padding: 0.75rem;
  border-radius: 0 4px 4px 0;
}

.alert-item.degraded {
  background: rgba(245, 158, 11, 0.05);
  border-left-color: var(--color-degraded);
}

.alert-indicator {
  width: 8px;
  height: 8px;
  background: var(--color-offline);
  border-radius: 50%;
}

.alert-item.degraded .alert-indicator {
  background: var(--color-degraded);
  border-radius: 2px;
}

/* Alert Pulse Effect - pisca a cada 5s */
@keyframes alertPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.98);
  }
}

.alert-pulse {
  animation: alertPulse 5s infinite ease-in-out;
}

.alert-pulse .alert-name {
  color: var(--color-offline);
  font-weight: 700;
}

.alert-pulse .alert-indicator {
  animation: none;
  background: var(--color-offline);
  box-shadow: 0 0 15px var(--color-offline);
}

.critical-section.alert-pulse .section-title {
  color: var(--color-offline);
  animation: none;
}

.alert-name {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-primary);
}

.alert-time {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.2rem;
  font-family: var(--font-mono);
}

.activity-log {
  margin-top: auto;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.log-item {
  display: flex;
  gap: 0.75rem;
  font-size: 0.8rem;
  font-family: var(--font-mono);
  padding: 0.4rem;
  background: rgba(255,255,255,0.01);
  border-radius: 4px;
}

.log-name {
  flex: 1;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.log-time {
  color: var(--text-tertiary);
}
</style>
