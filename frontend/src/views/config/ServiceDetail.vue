<template>
  <div class="service-detail">
    <div class="header">
      <router-link to="/config" class="back-link">← Back to Services</router-link>
      <div class="header-main">
        <div class="title-area">
          <h1>{{ service?.name }} <span class="badge">{{ service?.environment }}</span></h1>
          <p class="service-meta">{{ service?.groupName }} • {{ service?.id }}</p>
        </div>
        <div class="header-actions">
          <button @click="isEditingService = true" class="btn btn-secondary btn-icon">Edit Service</button>
          <button @click="handleDeleteService" class="btn btn-danger btn-icon">Delete</button>
        </div>
      </div>
    </div>

    <!-- Status Bar -->
    <div class="status-banner" :class="'status-' + overallStatus">
      <div class="status-info">
        <span class="status-label">Overall Status</span>
        <span class="status-value">{{ overallStatus.toUpperCase() }}</span>
      </div>
      <div class="status-times">
        <div class="time-item">
          <span>Last Checked:</span>
          <strong>{{ formatTime(liveSnapshot?.lastCheckedAt) }}</strong>
        </div>
        <div class="time-item">
          <span>Last Failure:</span>
          <strong :class="{ 'text-danger': liveSnapshot?.lastFailureAt }">{{ formatTime(liveSnapshot?.lastFailureAt) || 'None' }}</strong>
        </div>
      </div>
    </div>

    <div class="detail-grid">
      <!-- Left: Checkers Management -->
      <div class="main-column">
        <section class="section">
          <div class="section-header">
            <h2 class="section-title">Checkers</h2>
            <button @click="openCheckerModal(null)" class="btn btn-primary btn-sm">+ Add Checker</button>
          </div>

          <div v-if="checkersLoading" class="checkers-loading">
            <div class="spinner"></div>
            <p>Loading checkers...</p>
          </div>
          
          <div v-else-if="checkers.length === 0" class="empty-checkers">
            <p>No checkers configured for this service.</p>
            <button @click="openCheckerModal(null)" class="btn btn-secondary btn-sm">Create your first checker</button>
          </div>

          <div v-else class="checkers-list">
            <div v-for="checker in checkers" :key="checker.id" class="checker-item">
              <div class="checker-indicator" :class="{ 'active': checker.isActive }"></div>
              <div class="checker-body">
                <div class="checker-info">
                  <h3 class="checker-name">{{ checker.name }}</h3>
                  <div class="checker-meta">
                    <span class="type-badge">{{ checker.type }}</span>
                    <span class="config-summary">{{ formatConfigSummary(checker) }}</span>
                  </div>
                </div>
                <div class="checker-actions">
                  <button @click="openCheckerModal(checker)" class="btn btn-ghost btn-sm">Edit</button>
                  <button @click="handleDeleteChecker(checker.id)" class="btn btn-ghost btn-sm text-danger">Delete</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Recent Results -->
        <section class="section">
          <div class="section-header">
            <h2 class="section-title">Recent Results</h2>
            <button @click="fetchResults" class="btn btn-ghost btn-sm">Refresh</button>
          </div>
          
          <div class="results-table-container">
            <table class="results-table">
              <thead>
                <tr>
                  <th>Checker</th>
                  <th>Status</th>
                  <th>Latency</th>
                  <th>Log/Error</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="res in recentResults" :key="res.id" :class="'row-status-' + res.status">
                  <td>{{ getCheckerName(res.checkerId) }}</td>
                  <td>
                    <span class="status-marker" :class="'marker-' + res.status">{{ res.status }}</span>
                    <span v-if="res.statusCode" class="status-code">{{ res.statusCode }}</span>
                  </td>
                  <td>{{ res.responseTimeMs }}ms</td>
                  <td class="error-cell">{{ res.errorMessage || '-' }}</td>
                  <td>{{ formatTimeShort(res.checkedAt) }}</td>
                </tr>
                <tr v-if="recentResults.length === 0">
                  <td colspan="5" style="text-align: center; padding: 3rem; color: #475569;">No recent execution data.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- Right: Service Data -->
      <div class="side-column">
        <section class="section side-section">
          <h2 class="section-title">Settings</h2>
          <div class="settings-list">
            <div class="setting-item">
              <span class="label">Host/Domain</span>
              <span class="value">{{ service?.host || '-' }}</span>
            </div>
            <div class="setting-item">
              <span class="label">Base URL</span>
              <span class="value">{{ service?.baseUrl || '-' }}</span>
            </div>
            <div class="setting-item">
              <span class="label">Check Interval</span>
              <span class="value">{{ service?.checkIntervalSeconds }}s</span>
            </div>
            <div class="setting-item">
              <span class="label">Timeout</span>
              <span class="value">{{ service?.timeoutSeconds }}s</span>
            </div>
            <div class="setting-item">
              <span class="label">Active</span>
              <span class="value active-text" v-if="service?.isActive">Monitoring Enabled</span>
              <span class="value inactive-text" v-else>Monitoring Paused</span>
            </div>
          </div>
        </section>

        <section class="section side-section">
          <h2 class="section-title">Description</h2>
          <p class="description-text">{{ service?.description || 'N/A' }}</p>
        </section>
      </div>
    </div>

    <!-- Modals -->
    <!-- Edit Service Modal (reuse ServiceForm logic via Modal? Just redirect if simple, but user wants config central) -->
    <div v-if="isEditingService" class="modal-backdrop">
      <div class="modal card">
        <h3>Edit Service Settings</h3>
        <p>You can also edit this service in the full form view.</p>
        <button @click="goToEditService" class="btn btn-primary">Go to Full Edit View</button>
        <button @click="isEditingService = false" class="btn btn-secondary">Close</button>
      </div>
    </div>

    <!-- Checker Modal -->
    <div v-if="checkerModal.show" class="modal-backdrop">
      <div class="modal card checker-modal">
        <div class="modal-header">
          <h2>{{ checkerModal.isEdit ? 'Edit' : 'Add' }} Checker</h2>
          <button @click="checkerModal.show = false" class="btn btn-ghost modal-close">×</button>
        </div>

        <form @submit.prevent="handleSaveChecker">
          <div class="form-group">
            <label>Checker Name</label>
            <input v-model="checkerModal.form.name" type="text" placeholder="e.g. Health Endpoint" required />
          </div>

          <div class="form-row">
            <div class="form-group half">
              <label>Type</label>
              <select v-model="checkerModal.form.type" required :disabled="checkerModal.isEdit">
                <option value="http">HTTP Fetch</option>
                <option value="ping">System Ping</option>
                <option value="command">Script / Command</option>
              </select>
            </div>
            <div class="form-group half">
              <label>Active</label>
              <select v-model="checkerModal.form.isActive">
                <option :value="true">Enabled</option>
                <option :value="false">Disabled</option>
              </select>
            </div>
          </div>

          <!-- Dynamic Config Fields -->
          <div class="config-fields">
            <div v-if="checkerModal.form.type === 'http'" class="config-section">
              <div class="form-group">
                <label>HTTP Method</label>
                <select v-model="checkerModal.config.method">
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="HEAD">HEAD</option>
                </select>
              </div>
              <div class="form-group">
                <label>URL (Full or Path)</label>
                <input v-model="checkerModal.config.url" type="text" placeholder="e.g. /health or https://api.svc.com" required />
                <small>If path starts with /, it appends to service Base URL.</small>
              </div>
              <div class="form-row">
                <div class="form-group half">
                  <label>Expected Status</label>
                  <input v-model.number="checkerModal.config.expectedStatus" type="number" placeholder="200" />
                </div>
                <div class="form-group half">
                  <label>Timeout Overwrite</label>
                  <input v-model.number="checkerModal.config.timeoutSeconds" type="number" placeholder="Default" />
                </div>
              </div>
            </div>

            <div v-if="checkerModal.form.type === 'ping'" class="config-section">
              <div class="form-group">
                <label>Ping Host</label>
                <input v-model="checkerModal.config.host" type="text" placeholder="e.g. 10.0.0.1 or service.local" />
                <small>If empty, uses service default host.</small>
              </div>
              <div class="form-group">
                <label>Timeout Overwrite</label>
                <input v-model.number="checkerModal.config.timeoutSeconds" type="number" placeholder="Default" />
              </div>
            </div>

            <div v-if="checkerModal.form.type === 'command'" class="config-section">
              <div class="form-group">
                <label>Shell Command</label>
                <input v-model="checkerModal.config.command" type="text" placeholder="e.g. curl -sSf http://127.0.0.1:9099" required />
                <small>Exit code 0 means SUCCESS. Other codes mean FAILURE. Running inside Docker container.</small>
              </div>
              <div class="form-group">
                <label>Timeout Overwrite</label>
                <input v-model.number="checkerModal.config.timeoutSeconds" type="number" placeholder="Default" />
              </div>
            </div>
          </div>

          <div v-if="checkerModal.error" class="modal-error">{{ checkerModal.error }}</div>

          <div class="modal-actions-container">
            <div class="test-action">
              <button type="button" @click="handleTestChecker" class="btn btn-test" :disabled="checkerModal.loading || checkerModal.testing">
                {{ checkerModal.testing ? 'Testing...' : 'Test Connection' }}
              </button>
            </div>
            <div class="main-actions">
              <button type="button" @click="checkerModal.show = false" class="btn btn-secondary">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="checkerModal.loading || checkerModal.testing">
                {{ checkerModal.loading ? 'Saving...' : 'Save Checker' }}
              </button>
            </div>
          </div>
          
          <!-- Test Result Display -->
          <div v-if="checkerModal.testResult" class="test-result-box" :class="'result-' + checkerModal.testResult.status">
            <div class="result-header">
              <span class="result-status">{{ checkerModal.testResult.status.toUpperCase() }}</span>
              <span v-if="checkerModal.testResult.responseTimeMs" class="result-time">{{ checkerModal.testResult.responseTimeMs }}ms</span>
            </div>
            <div v-if="checkerModal.testResult.errorMessage" class="result-error">
              {{ checkerModal.testResult.errorMessage }}
            </div>
            <div v-else class="result-success">
              Checker verified successfully.
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { servicesApi, checkersApi, monitoringApi } from '../../services/api';
import { useNexus } from '../../composables/useNexus';
import type { Checker, Service, CheckerResult, ServiceSnapshot } from '../../types';

const route = useRoute();
const router = useRouter();
const { services: liveServices } = useNexus();

const service = ref<Service | null>(null);
const checkers = ref<Checker[]>([]);
const recentResults = ref<CheckerResult[]>([]);
const snapshots = ref<ServiceSnapshot[]>([]);

const checkersLoading = ref(true);
const isEditingService = ref(false);

const checkerModal = reactive({
  show: false,
  isEdit: false,
  loading: false,
  error: null as string | null,
  checkerId: null as string | null,
  testing: false,
  testResult: null as any | null,
  form: {
    name: '',
    type: 'http' as 'http' | 'ping' | 'command',
    isActive: true
  },
  config: {} as any
});

const serviceId = computed(() => route.params.id as string);

const liveSnapshot = computed(() => {
  const live = liveServices.value.find(s => s.serviceId === serviceId.value);
  if (live) return live;
  return snapshots.value.find(s => s.serviceId === serviceId.value);
});

const overallStatus = computed(() => {
  return liveSnapshot.value?.overallStatus || 'unknown';
});

const fetchServiceData = async () => {
  try {
    const data = await servicesApi.getById(serviceId.value);
    service.value = data;
  } catch (e) {
    console.error('Failed to load service', e);
  }
};

const fetchCheckers = async () => {
  try {
    checkersLoading.value = true;
    checkers.value = await checkersApi.getByServiceId(serviceId.value);
  } finally {
    checkersLoading.value = false;
  }
};

const fetchResults = async () => {
  recentResults.value = await monitoringApi.getResults(serviceId.value, 15);
};

const fetchSnapshots = async () => {
  snapshots.value = await monitoringApi.getServiceStatus();
};

const openCheckerModal = (checker: Checker | null) => {
  checkerModal.show = true;
  checkerModal.isEdit = !!checker;
  checkerModal.checkerId = checker?.id || null;
  checkerModal.error = null;
  
  if (checker) {
    checkerModal.form = {
      name: checker.name,
      type: checker.type,
      isActive: checker.isActive
    };
    checkerModal.config = JSON.parse(checker.configJson || '{}');
  } else {
    checkerModal.form = {
      name: '',
      type: 'http',
      isActive: true
    };
    checkerModal.config = {
      method: 'GET',
      url: '',
      expectedStatus: 200,
      command: '' // For command type
    };
  }
};

const handleTestChecker = async () => {
  checkerModal.testing = true;
  checkerModal.testResult = null;
  checkerModal.error = null;
  try {
    const payload = {
      type: checkerModal.form.type,
      configJson: JSON.stringify(checkerModal.config),
      serviceId: serviceId.value
    };
    const response = await checkersApi.test(payload);
    if (response.success) {
      checkerModal.testResult = response.result;
    } else {
      checkerModal.error = response.message;
    }
  } catch (e: any) {
    checkerModal.error = e.message;
  } finally {
    checkerModal.testing = false;
  }
};

const handleSaveChecker = async () => {
  checkerModal.loading = true;
  checkerModal.error = null;
  try {
    const payload = {
      ...checkerModal.form,
      configJson: JSON.stringify(checkerModal.config)
    };

    if (checkerModal.isEdit) {
      await checkersApi.update(checkerModal.checkerId!, payload);
    } else {
      await checkersApi.create(serviceId.value, payload);
    }
    
    checkerModal.show = false;
    fetchCheckers();
  } catch (e: any) {
    checkerModal.error = e.message;
  } finally {
    checkerModal.loading = false;
  }
};

const handleDeleteChecker = async (id: string) => {
  if (confirm('Delete this checker?')) {
    await checkersApi.delete(id);
    fetchCheckers();
  }
};

const handleDeleteService = async () => {
  if (confirm('Permanently delete this service? All history and checkers will be removed.')) {
    await servicesApi.delete(serviceId.value);
    router.push('/config');
  }
};

const goToEditService = () => {
  router.push(`/config/services/${serviceId.value}/edit`); // though my router uses same component for edit if i want. 
  // Let's just use redirect for now.
};

const formatConfigSummary = (checker: Checker) => {
  const conf = JSON.parse(checker.configJson || '{}');
  if (checker.type === 'http') return `${conf.method} ${conf.url}`;
  if (checker.type === 'command') return `Cmd: ${conf.command || ''}`;
  return `Ping ${conf.host || service.value?.host || 'default'}`;
};

const getCheckerName = (id: string) => {
  return checkers.value.find(c => c.id === id)?.name || id.substring(0, 8);
};

const formatTime = (iso: string | null | undefined) => {
  if (!iso) return null;
  return new Date(iso).toLocaleString();
};

const formatTimeShort = (iso: string) => {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

onMounted(() => {
  fetchServiceData();
  fetchCheckers();
  fetchResults();
  fetchSnapshots();
});
</script>

<style scoped>
.service-detail {
  max-width: 1400px;
}

.header {
  margin-bottom: 2rem;
}

.back-link {
  color: #64748b;
  text-decoration: none;
  font-size: 0.9rem;
  margin-bottom: 1rem;
  display: inline-block;
}

.header-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.title-area h1 {
  font-size: 2.2rem;
  font-weight: 700;
}

.badge {
  font-size: 0.8rem;
  background: rgba(14, 165, 233, 0.1);
  color: #0ea5e9;
  border: 1px solid rgba(14, 165, 233, 0.2);
  padding: 4px 10px;
  border-radius: 4px;
  vertical-align: middle;
  margin-left: 1rem;
}

.service-meta {
  color: #475569;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

/* Status Banner */
.status-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 3rem;
  background: #0c1018;
  border-radius: 8px;
  margin-bottom: 3rem;
  border-left: 8px solid #4b5563;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}

.status-banner.status-online { border-color: #10b981; }
.status-banner.status-degraded { border-color: #f59e0b; }
.status-banner.status-offline { border-color: #ef4444; }

.status-info {
  display: flex;
  flex-direction: column;
}

.status-label {
  color: #94a3b8;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.status-value {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.status-times {
  display: flex;
  gap: 3rem;
}

.time-item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.time-item span {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
}

.time-item strong {
  font-size: 0.95rem;
  color: #f1f5f9;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 3rem;
}

/* Sections */
.section {
  background: rgba(12, 16, 24, 0.4);
  border: 1px solid rgba(56, 189, 248, 0.05);
  border-radius: 8px;
  padding: 2.5rem;
  margin-bottom: 3rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.section-title {
  font-size: 0.9rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #0ea5e9;
}

/* Checkers List */
.checkers-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.checker-item {
  display: flex;
  background: #030508;
  border: 1px solid rgba(56, 189, 248, 0.1);
  border-radius: 6px;
  overflow: hidden;
  transition: border-color 0.2s;
}

.checker-item:hover {
  border-color: rgba(14, 165, 233, 0.3);
}

.checker-indicator {
  width: 6px;
  background: #475569;
}

.checker-indicator.active {
  background: #10b981;
}

.checker-body {
  flex: 1;
  padding: 1.2rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.checker-name {
  font-size: 1.1rem;
  font-weight: 500;
  margin-bottom: 0.4rem;
}

.checker-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.type-badge {
  font-size: 0.65rem;
  text-transform: uppercase;
  background: #1e293b;
  padding: 2px 6px;
  border-radius: 3px;
  color: #94a3b8;
}

.config-summary {
  font-size: 0.8rem;
  color: #475569;
  font-family: var(--font-mono);
}

/* Results Table */
.results-table-container {
  overflow-x: auto;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.results-table th {
  text-align: left;
  padding: 1rem;
  color: #64748b;
  font-weight: 400;
  border-bottom: 1px solid rgba(56, 189, 248, 0.1);
}

.results-table td {
  padding: 1.2rem 1rem;
  border-bottom: 1px solid rgba(56, 189, 248, 0.03);
}

.marker-online { color: #10b981; }
.marker-offline, .marker-error { color: #ef4444; }
.marker-degraded { color: #f59e0b; }

.status-marker {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.75rem;
}

.status-code {
  font-size: 0.75rem;
  background: #1e293b;
  margin-left: 0.5rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.error-cell {
  color: #94a3b8;
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Side Column Settings */
.side-section {
  padding: 2rem;
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-top: 1rem;
}

.setting-item {
  display: flex;
  flex-direction: column;
}

.setting-item .label {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: #475569;
  margin-bottom: 0.4rem;
}

.setting-item .value {
  color: #f1f5f9;
  font-size: 0.9rem;
  word-break: break-all;
}

.active-text { color: #10b981; }
.inactive-text { color: #ef4444; }

.description-text {
  color: #94a3b8;
  font-size: 0.9rem;
  line-height: 1.6;
}

/* Modals */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.8);
  backdrop-filter: blur(8px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.modal {
  width: 100%;
  max-width: 600px;
  background: #0c1018;
  border: 1px solid rgba(56, 189, 248, 0.1);
  padding: 3rem;
  border-radius: 8px;
  position: relative;
}

.checker-modal {
  max-width: 700px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2.5rem;
}

.modal-close {
  font-size: 2rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-size: 0.8rem;
  color: #94a3b8;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
}

.form-group input, .form-group select {
  width: 100%;
  background: #030508;
  border: 1px solid rgba(56, 189, 248, 0.1);
  padding: 0.8rem 1rem;
  color: #fff;
  border-radius: 4px;
}

.form-row {
  display: flex;
  gap: 1.5rem;
}

.config-section {
  margin: 2rem 0;
  padding: 1.5rem;
  background: rgba(0,0,0,0.3);
  border-radius: 6px;
  border: 1px dashed rgba(56, 189, 248, 0.1);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 3rem;
}

.modal-error {
  color: #ef4444;
  font-size: 0.85rem;
  margin-top: 1rem;
  text-align: right;
}

/* Helpers */
.btn-sm { padding: 0.5rem 1rem; font-size: 0.8rem; }
.btn-ghost { background: transparent; border: none; font-weight: 500; }
.btn-ghost:hover { background: rgba(56, 189, 248, 0.1); }
.text-danger { color: #ef4444 !important; }
.btn-danger { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
.btn-danger:hover { background: #ef4444; color: #fff; }

.empty-checkers {
  padding: 4rem;
  text-align: center;
  border: 1px dashed rgba(56, 189, 248, 0.1);
  border-radius: 6px;
}
.modal-actions-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid rgba(56, 189, 248, 0.1);
}

.main-actions {
  display: flex;
  gap: 1rem;
}

.btn-test {
  background: rgba(14, 165, 233, 0.1);
  color: #0ea5e9;
  border: 1px solid rgba(14, 165, 233, 0.3);
}

.btn-test:hover:not(:disabled) {
  background: #0ea5e9;
  color: #fff;
}

.test-result-box {
  margin-top: 1.5rem;
  padding: 1.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
  border: 1px solid rgba(255,255,255,0.05);
  background: rgba(0,0,0,0.3);
}

.result-success { border-left: 4px solid #10b981; color: #10b981; }
.result-failure, .result-error, .result-timeout { border-left: 4px solid #ef4444; color: #ef4444; }

.result-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.8rem;
  font-weight: 700;
  font-family: var(--font-mono);
  font-size: 1rem;
}

.result-error {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  line-height: 1.5;
  background: rgba(0,0,0,0.4);
  padding: 0.8rem;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
}
</style>
