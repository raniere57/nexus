<template>
  <div class="nexus-app tv-mode">
    <BackgroundCanvas />
    
    <header class="nexus-header">
      <div class="header-content">
        <div class="logo-area">
          <h1>NEXUS <span class="dim">CORE</span></h1>
          <router-link to="/config" class="config-link">CONFIG</router-link>
        </div>
        <div class="system-time">{{ currentTime }}</div>
      </div>
      <div class="header-status">
        <span class="status-indicator"></span>
        <span>SYSTEM {{ systemStatusText }}</span>
      </div>
    </header>

    <main class="nexus-main">
      <NodeNetwork :services="services" />
    </main>
    
    <aside class="nexus-sidebar">
      <StatusSummary :services="services" />
    </aside>

    <ServerDock :servers="servers" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import BackgroundCanvas from '../components/BackgroundCanvas.vue';
import NodeNetwork from '../components/NodeNetwork.vue';
import StatusSummary from '../components/StatusSummary.vue';
import ServerDock from '../components/ServerDock.vue';
import { useNexus } from '../composables/useNexus';

const { services, servers } = useNexus();
const currentTime = ref('');
let timeInterval: any = null;

const systemStatusText = computed(() => {
  if (!services.value || services.value.length === 0) return 'INITIALIZING...';
  if (services.value.some(s => s.overallStatus === 'offline')) return 'CRITICAL';
  if (services.value.some(s => s.overallStatus === 'degraded')) return 'DEGRADED';
  return 'ONLINE';
});

const updateTime = () => {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' UTC';
};

onMounted(() => {
  updateTime();
  timeInterval = setInterval(updateTime, 1000);
});

onUnmounted(() => {
  clearInterval(timeInterval);
});
</script>

<style scoped>
.nexus-app.tv-mode {
  width: 100vw;
  height: 100vh;
  display: flex;
  position: relative;
  background-color: var(--bg-core);
  overflow: hidden;
}

.nexus-header {
  position: absolute;
  top: 0;
  left: 0;
  width: calc(100% - 400px);
  padding: 2rem 4rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  z-index: 10;
}

.logo-area {
  display: flex;
  align-items: baseline;
  gap: 1.5rem;
}

.config-link {
  color: var(--text-tertiary);
  text-decoration: none;
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  padding: 4px 8px;
  border: 1px solid var(--border-subtle);
  transition: all 0.3s;
  opacity: 0;
}

.logo-area:hover .config-link {
  opacity: 1;
}

.config-link:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
  background: var(--color-accent-glow);
}

.header-content h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
  text-shadow: 0 0 20px rgba(14, 165, 233, 0.4);
}

.header-content h1 .dim {
  color: var(--text-tertiary);
  font-weight: 300;
}

.system-time {
  font-family: var(--font-mono);
  font-size: 1.2rem;
  color: var(--color-accent);
  opacity: 0.8;
}

.header-status {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 1.2rem;
  letter-spacing: 0.2em;
  color: var(--text-secondary);
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 10px var(--color-accent-glow);
  animation: pulseGlow 2s infinite ease-in-out;
}

.nexus-main {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  z-index: 5;
}

.nexus-sidebar {
  width: 400px;
  height: 100vh;
  position: relative;
  z-index: 10;
  border-left: 1px solid var(--border-subtle);
  background: linear-gradient(to right, transparent, rgba(12, 16, 24, 0.9) 20%);
  display: flex;
  flex-direction: column;
}
</style>
