<template>
  <div v-if="servers.length > 0" class="server-dock">
    <div class="dock-label">INFRASTRUCTURE</div>
    <div class="server-cards">
      <div 
        v-for="srv in servers" 
        :key="srv.serverId"
        class="server-card"
        :class="[`srv-${srv.status}`]"
      >
        <div class="srv-header">
          <div class="srv-status-dot"></div>
          <div class="srv-name">{{ srv.serverName }}</div>
          <div class="srv-host">{{ srv.host }}</div>
        </div>
        <div class="srv-metrics">
          <div class="metric" v-for="m in getMetrics(srv)" :key="m.label">
            <svg class="metric-ring" viewBox="0 0 36 36">
              <circle class="metric-bg" cx="18" cy="18" r="14" fill="none" stroke-width="2.8"/>
              <circle class="metric-fill" cx="18" cy="18" r="14" fill="none" stroke-width="2.8"
                :stroke-dasharray="`${m.dashValue} ${87.96 - m.dashValue}`"
                stroke-dashoffset="22"
                :class="m.colorClass" />
              <text x="18" y="16" class="ring-value" text-anchor="middle" dominant-baseline="middle">
                {{ m.display }}
              </text>
              <text x="18" y="24" class="ring-label" text-anchor="middle" dominant-baseline="middle">
                {{ m.label }}
              </text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NexusServer } from '../types';

defineProps<{
  servers: NexusServer[]
}>();

const getMetricClass = (value: number | null) => {
  if (value == null) return 'metric-unknown';
  if (value >= 90) return 'metric-critical';
  if (value >= 70) return 'metric-warning';
  return 'metric-ok';
};

const getMetrics = (srv: NexusServer) => {
  const circumference = 2 * Math.PI * 14; // ~87.96
  return [
    {
      label: 'CPU',
      display: srv.cpuPercent != null ? Math.round(srv.cpuPercent) + '%' : '--',
      dashValue: srv.cpuPercent != null ? (srv.cpuPercent / 100) * circumference : 0,
      colorClass: getMetricClass(srv.cpuPercent)
    },
    {
      label: 'RAM',
      display: srv.ramPercent != null ? Math.round(srv.ramPercent) + '%' : '--',
      dashValue: srv.ramPercent != null ? (srv.ramPercent / 100) * circumference : 0,
      colorClass: getMetricClass(srv.ramPercent)
    },
    {
      label: 'DISK',
      display: srv.diskPercent != null ? Math.round(srv.diskPercent) + '%' : '--',
      dashValue: srv.diskPercent != null ? (srv.diskPercent / 100) * circumference : 0,
      colorClass: getMetricClass(srv.diskPercent)
    }
  ];
};
</script>

<style scoped>
.server-dock {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 400px;
  z-index: 15;
  padding: 0.6rem 2rem 1rem;
  background: linear-gradient(to top, rgba(3, 5, 8, 0.9) 0%, rgba(3, 5, 8, 0.5) 60%, transparent 100%);
}

.dock-label {
  font-size: 0.6rem;
  letter-spacing: 0.2em;
  color: var(--text-tertiary);
  margin-bottom: 0.4rem;
  padding-left: 0.25rem;
}

.server-cards {
  display: flex;
  gap: 0.75rem;
}

.server-card {
  flex: 1;
  background: rgba(12, 16, 24, 0.55);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  backdrop-filter: blur(6px);
  transition: border-color 2s ease-out, box-shadow 2s ease-out;
}

.server-card.srv-online {
  border-color: rgba(16, 185, 129, 0.2);
}

.server-card.srv-offline {
  border-color: rgba(239, 68, 68, 0.3);
  box-shadow: 0 0 15px rgba(239, 68, 68, 0.1);
}

.server-card.srv-unknown {
  border-color: var(--border-subtle);
}

.srv-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}

.srv-status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.srv-online .srv-status-dot {
  background: var(--color-online);
  box-shadow: 0 0 8px var(--color-online-glow);
}

.srv-offline .srv-status-dot {
  background: var(--color-offline);
  box-shadow: 0 0 8px var(--color-offline-glow);
  animation: flicker 2s infinite;
}

.srv-unknown .srv-status-dot {
  background: var(--color-unknown);
}

.srv-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.srv-host {
  font-size: 0.55rem;
  font-family: var(--font-mono);
  color: var(--text-tertiary);
  margin-left: auto;
  white-space: nowrap;
}

.srv-metrics {
  display: flex;
  justify-content: space-around;
  gap: 0.25rem;
}

.metric {
  display: flex;
  align-items: center;
  justify-content: center;
}

.metric-ring {
  width: 52px;
  height: 52px;
  transform: rotate(-90deg);
}

.metric-bg {
  stroke: rgba(255, 255, 255, 0.06);
}

.metric-fill {
  transition: stroke-dasharray 1.5s ease-out;
  stroke-linecap: round;
}

.metric-ok { stroke: var(--color-online); }
.metric-warning { stroke: var(--color-degraded); }
.metric-critical { stroke: var(--color-offline); }
.metric-unknown { stroke: var(--color-unknown); }

.ring-value {
  font-size: 7px;
  font-family: var(--font-mono);
  font-weight: 700;
  fill: var(--text-primary);
  transform: rotate(90deg);
  transform-origin: 18px 18px;
}

.ring-label {
  font-size: 4.5px;
  letter-spacing: 0.5px;
  fill: var(--text-tertiary);
  transform: rotate(90deg);
  transform-origin: 18px 18px;
}
</style>
