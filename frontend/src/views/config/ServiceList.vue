<template>
  <div class="service-list">
    <div class="list-header">
      <div class="header-info">
        <h1>Monitoring <span class="dim">Services</span></h1>
        <p class="description">Overview of all active monitoring targets.</p>
      </div>
      <router-link to="/config/services/new" class="btn btn-primary">
        + New Service
      </router-link>
    </div>

    <div class="list-filters">
      <input 
        v-model="searchQuery" 
        type="text" 
        placeholder="Filter by name..." 
        class="search-input"
      />
      <div class="filters-group">
        <select v-model="filterGroup" class="filter-select">
          <option value="">All Groups</option>
          <option v-for="g in groups" :key="g" :value="g">{{ g }}</option>
        </select>
        <select v-model="filterEnv" class="filter-select">
          <option value="">All Environments</option>
          <option v-for="e in environments" :key="e" :value="e">{{ e }}</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="empty-state">
      <div class="spinner"></div>
      <p>Fetching services...</p>
    </div>

    <div v-else-if="filteredServices.length === 0" class="empty-state">
      <p>No services found matching filters.</p>
    </div>

    <div v-else class="services-grid">
      <div 
        v-for="service in filteredServices" 
        :key="service.id" 
        class="service-card"
        @click="goToDetail(service.id)"
      >
        <div class="card-status" :class="'card-status-' + getLiveStatus(service.id)"></div>
        <div class="card-body">
          <div class="card-meta">
            <span class="badge">{{ service.environment }}</span>
            <span class="badge badge-dim">{{ service.groupName }}</span>
          </div>
          <h3 class="card-title">{{ service.name }}</h3>
          <p class="card-description">{{ service.description || 'No description provided.' }}</p>
          <div class="card-footer">
            <div class="checkers-count">
              <span class="label">Checkers:</span>
              <span class="value">{{ getCheckersCount(service.id) }}</span>
            </div>
            <div v-if="service.isActive" class="active-badge">Active</div>
            <div v-else class="inactive-badge">Paused</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Servers Section -->
    <div class="list-header" style="margin-top: 4rem;">
      <div class="header-info">
        <h1>Infrastructure <span class="dim">Servers</span></h1>
        <p class="description">Monitored servers via SSH.</p>
      </div>
      <router-link to="/config/servers/new" class="btn btn-primary">
        + New Server
      </router-link>
    </div>

    <div v-if="serversList.length === 0" class="empty-state">
      <p>No servers configured yet.</p>
    </div>

    <div v-else class="services-grid">
      <div 
        v-for="srv in serversList" 
        :key="srv.id" 
        class="service-card"
        @click="goToServerEdit(srv.id)"
      >
        <div class="card-status" :class="'card-status-' + getServerLiveStatus(srv.id)"></div>
        <div class="card-body">
          <div class="card-meta">
            <span class="badge badge-dim">SSH</span>
            <span class="badge">{{ srv.host }}</span>
          </div>
          <h3 class="card-title">{{ srv.name }}</h3>
          <p class="card-description">{{ srv.sshUser }}@{{ srv.host }}:{{ srv.sshPort }}</p>
          <div class="card-footer">
            <div class="checkers-count">
              <span class="label">Interval:</span>
              <span class="value">{{ srv.checkIntervalSeconds }}s</span>
            </div>
            <div v-if="srv.isActive" class="active-badge">Active</div>
            <div v-else class="inactive-badge">Paused</div>
            <button class="btn-delete" @click.stop="deleteServerById(srv.id)">Delete</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { servicesApi, checkersApi, monitoringApi, serversApi } from '../../services/api';
import { useNexus } from '../../composables/useNexus';
import type { Service, Server, ServiceSnapshot } from '../../types';

const router = useRouter();
const { services: liveServices, servers: liveServers } = useNexus();

const services = ref<Service[]>([]);
const serversList = ref<Server[]>([]);
const checkersMap = ref<Record<string, number>>({});
const snapshots = ref<ServiceSnapshot[]>([]);
const loading = ref(true);

const searchQuery = ref('');
const filterGroup = ref('');
const filterEnv = ref('');

const groups = computed(() => [...new Set(services.value.map(s => s.groupName))]);
const environments = computed(() => [...new Set(services.value.map(s => s.environment))]);

const filteredServices = computed(() => {
  return services.value.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.value.toLowerCase());
    const matchesGroup = !filterGroup.value || s.groupName === filterGroup.value;
    const matchesEnv = !filterEnv.value || s.environment === filterEnv.value;
    return matchesSearch && matchesGroup && matchesEnv;
  });
});

const fetchAll = async () => {
  try {
    loading.value = true;
    const [svs, snps, srvs] = await Promise.all([
      servicesApi.getAll(),
      monitoringApi.getServiceStatus(),
      serversApi.getAll()
    ]);
    services.value = svs;
    snapshots.value = snps;
    serversList.value = srvs;

    for (const s of svs) {
      const chks = await checkersApi.getByServiceId(s.id);
      checkersMap.value[s.id] = chks.length;
    }
  } catch (e) {
    console.error('Failed to load services', e);
  } finally {
    loading.value = false;
  }
};

const getLiveStatus = (id: string) => {
  const live = liveServices.value.find(ls => ls.serviceId === id);
  if (live) return live.overallStatus;
  const snap = snapshots.value.find(sn => sn.serviceId === id);
  return snap?.overallStatus || 'unknown';
};

const getServerLiveStatus = (id: string) => {
  const live = liveServers.value.find(ls => ls.serverId === id);
  return live?.status || 'unknown';
};

const getCheckersCount = (id: string) => checkersMap.value[id] || 0;

const goToDetail = (id: string) => {
  router.push(`/config/services/${id}`);
};

const goToServerEdit = (id: string) => {
  router.push(`/config/servers/${id}`);
};

const deleteServerById = async (id: string) => {
  if (!confirm('Tem certeza que deseja remover este servidor?')) return;
  try {
    await serversApi.delete(id);
    serversList.value = serversList.value.filter(s => s.id !== id);
  } catch (e) {
    console.error('Failed to delete server', e);
  }
};

onMounted(fetchAll);
</script>

<style scoped>
.service-list h1 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.service-list h1 .dim {
  color: #475569;
  font-weight: 300;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 3rem;
}

.header-info .description {
  color: #94a3b8;
  font-size: 1.1rem;
}

.list-filters {
  display: flex;
  gap: 2rem;
  margin-bottom: 2.5rem;
  align-items: center;
}

.search-input {
  flex: 1;
  background: #0c1018;
  border: 1px solid rgba(56, 189, 248, 0.1);
  padding: 0.8rem 1.5rem;
  color: #fff;
  border-radius: 4px;
  font-family: inherit;
}

.search-input:focus {
  outline: none;
  border-color: #0ea5e9;
  box-shadow: 0 0 10px rgba(14, 165, 233, 0.1);
}

.filters-group {
  display: flex;
  gap: 1rem;
}

.filter-select {
  background: #0c1018;
  border: 1px solid rgba(56, 189, 248, 0.1);
  padding: 0.8rem 1rem;
  color: #94a3b8;
  border-radius: 4px;
  min-width: 160px;
}

.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
}

.service-card {
  background: rgba(12, 16, 24, 0.6);
  border: 1px solid rgba(56, 189, 248, 0.1);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.service-card:hover {
  transform: translateY(-4px);
  border-color: rgba(14, 165, 233, 0.4);
  background: rgba(12, 16, 24, 0.9);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.card-status {
  height: 4px;
  width: 100%;
}

.card-status-online { background: #10b981; }
.card-status-degraded { background: #f59e0b; }
.card-status-offline { background: #ef4444; }
.card-status-unknown { background: #4b5563; }

.card-body {
  padding: 1.5rem;
}

.card-meta {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.badge {
  font-size: 0.7rem;
  text-transform: uppercase;
  padding: 2px 8px;
  background: rgba(14, 165, 233, 0.1);
  color: #0ea5e9;
  border: 1px solid rgba(14, 165, 233, 0.2);
  border-radius: 4px;
}

.badge-dim {
  background: rgba(71, 85, 105, 0.1);
  color: #94a3b8;
  border-color: rgba(71, 85, 105, 0.2);
}

.card-title {
  font-size: 1.4rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: #f1f5f9;
}

.card-description {
  font-size: 0.9rem;
  color: #64748b;
  line-height: 1.5;
  margin-bottom: 1.5rem;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid rgba(56, 189, 248, 0.05);
  padding-top: 1rem;
}

.checkers-count {
  display: flex;
  gap: 0.5rem;
}

.checkers-count .label {
  color: #475569;
  font-size: 0.8rem;
  text-transform: uppercase;
}

.checkers-count .value {
  color: #0ea5e9;
  font-weight: 700;
  font-size: 0.8rem;
}

.active-badge, .inactive-badge {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.active-badge { color: #10b981; }
.inactive-badge { color: #ef4444; }

.btn {
  padding: 0.8rem 1.8rem;
  border-radius: 4px;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.2s;
  border: none;
  cursor: pointer;
  display: inline-block;
}

.btn-primary {
  background: #0ea5e9;
  color: #fff;
}

.btn-primary:hover {
  background: #0284c7;
  box-shadow: 0 0 15px rgba(14, 165, 233, 0.4);
}

.empty-state {
  padding: 4rem;
  text-align: center;
  color: #475569;
  border: 1px dashed rgba(56, 189, 248, 0.1);
  border-radius: 8px;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(14, 165, 233, 0.2);
  border-top-color: #0ea5e9;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn-delete {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-offline);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  padding: 2px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-delete:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
}
</style>
