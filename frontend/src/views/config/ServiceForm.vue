<template>
  <div class="service-form-view">
    <div class="header">
      <router-link to="/config" class="back-link">← Back to Services</router-link>
      <h1>{{ isEdit ? 'Edit' : 'Create' }} <span class="dim">Service</span></h1>
    </div>

    <form @submit.prevent="handleSubmit" class="main-form card">
      <div class="form-grid">
        <div class="form-section">
          <h2 class="section-title">Core Information</h2>
          
          <div class="field" :class="{ 'has-error': fieldErrors.name }">
            <label>Service Name *</label>
            <input v-model="form.name" type="text" placeholder="e.g. Authentication API" :disabled="loading" />
            <p v-if="fieldErrors.name" class="field-error">{{ fieldErrors.name }}</p>
            <small v-else>Internal display name for this monitored target.</small>
          </div>

          <div class="field">
            <label>Description</label>
            <textarea v-model="form.description" rows="3" placeholder="Describe what this service does..." :disabled="loading"></textarea>
          </div>

          <div class="row">
            <div class="field half" :class="{ 'has-error': fieldErrors.groupName }">
              <label>Group Name *</label>
              <input v-model="form.groupName" type="text" placeholder="e.g. microservices" :disabled="loading" />
              <p v-if="fieldErrors.groupName" class="field-error">{{ fieldErrors.groupName }}</p>
            </div>
            <div class="field half" :class="{ 'has-error': fieldErrors.environment }">
              <label>Environment *</label>
              <input v-model="form.environment" type="text" placeholder="e.g. production" :disabled="loading" />
              <p v-if="fieldErrors.environment" class="field-error">{{ fieldErrors.environment }}</p>
            </div>
          </div>
        </div>

        <div class="form-section">
          <h2 class="section-title">Target & Connectivity</h2>

          <div class="field">
            <label>Host/Domain</label>
            <input v-model="form.host" type="text" placeholder="e.g. auth-api.internal.com" :disabled="loading" />
            <small>Used primarily for ICMP Ping checks.</small>
          </div>

          <div class="field" :class="{ 'has-error': fieldErrors.baseUrl }">
            <label>Base URL</label>
            <input v-model="form.baseUrl" type="text" placeholder="https://auth-api.internal.com/v1" :disabled="loading" />
            <p v-if="fieldErrors.baseUrl" class="field-error">{{ fieldErrors.baseUrl }}</p>
            <small v-else>Base prefix for HTTP checks. Must start with http/https.</small>
          </div>

          <div class="row">
            <div class="field half" :class="{ 'has-error': fieldErrors.checkIntervalSeconds }">
              <label>Check Interval (sec) *</label>
              <input v-model.number="form.checkIntervalSeconds" type="number" :disabled="loading" />
              <p v-if="fieldErrors.checkIntervalSeconds" class="field-error">{{ fieldErrors.checkIntervalSeconds }}</p>
            </div>
            <div class="field half" :class="{ 'has-error': fieldErrors.timeoutSeconds }">
              <label>Default Timeout (sec) *</label>
              <input v-model.number="form.timeoutSeconds" type="number" :disabled="loading" />
              <p v-if="fieldErrors.timeoutSeconds" class="field-error">{{ fieldErrors.timeoutSeconds }}</p>
            </div>
          </div>

          <div class="field checkbox-field">
            <input v-model="form.isActive" type="checkbox" id="isActive" :disabled="loading" />
            <label for="isActive">Active (Enabled Monitoring)</label>
          </div>
        </div>
      </div>

      <div v-if="error" class="error-msg">
        {{ error }}
      </div>

      <div class="form-actions">
        <button type="button" @click="$router.back()" class="btn btn-secondary" :disabled="loading">Cancel</button>
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Service') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { servicesApi } from '../../services/api';
import type { Service } from '../../types';

const route = useRoute();
const router = useRouter();

const isEdit = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const fieldErrors = reactive<Record<string, string>>({});

const form = reactive({
  name: '',
  description: '',
  groupName: 'default',
  host: '',
  baseUrl: '',
  environment: 'production',
  checkIntervalSeconds: 60,
  timeoutSeconds: 10,
  isActive: true
});

onMounted(async () => {
  const id = route.params.id as string;
  if (id && id !== 'new') {
    isEdit.value = true;
    try {
      loading.value = true;
      const data = await servicesApi.getById(id);
      Object.assign(form, data);
    } catch (e: any) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }
});

const validate = () => {
  // Clear previous errors
  Object.keys(fieldErrors).forEach(key => delete fieldErrors[key]);
  let isValid = true;

  if (!form.name.trim()) {
    fieldErrors.name = 'Preencha um nome de serviço válido';
    isValid = false;
  }
  
  if (!form.groupName.trim()) {
    fieldErrors.groupName = 'Grupo é obrigatório';
    isValid = false;
  }

  if (!form.environment.trim()) {
    fieldErrors.environment = 'Ambiente é obrigatório';
    isValid = false;
  }

  if (form.baseUrl && form.baseUrl.trim() !== '') {
    if (!/^https?:\/\//.test(form.baseUrl.trim())) {
      fieldErrors.baseUrl = 'Base URL precisa começar com http:// ou https://';
      isValid = false;
    }
  }

  if (!form.checkIntervalSeconds || form.checkIntervalSeconds <= 0) {
    fieldErrors.checkIntervalSeconds = 'Check interval deve ser maior que zero';
    isValid = false;
  }

  if (!form.timeoutSeconds || form.timeoutSeconds <= 0) {
    fieldErrors.timeoutSeconds = 'Timeout deve ser maior que zero';
    isValid = false;
  }

  return isValid;
};

const handleSubmit = async () => {
  error.value = null;
  
  if (!validate()) return;

  loading.value = true;

  // Normalize: trim strings, ensure numbers
  const payload: Record<string, any> = {
    name: form.name.trim(),
    description: (form.description || '').trim(),
    groupName: (form.groupName || '').trim(),
    environment: (form.environment || '').trim(),
    checkIntervalSeconds: Number(form.checkIntervalSeconds),
    timeoutSeconds: Number(form.timeoutSeconds),
    isActive: form.isActive
  };

  // Only include optional fields if they have values
  const host = (form.host || '').trim();
  if (host) payload.host = host;

  const baseUrl = (form.baseUrl || '').trim();
  if (baseUrl) payload.baseUrl = baseUrl;

  console.log('[NEXUS] Submitting payload:', JSON.stringify(payload, null, 2));

  try {
    let result: Service;
    if (isEdit.value) {
      result = await servicesApi.update(route.params.id as string, payload);
    } else {
      result = await servicesApi.create(payload);
    }
    router.push(`/config/services/${result.id}`);
  } catch (e: any) {
    console.error('[NEXUS] Submit error:', e);
    // Show the real error message — no more guessing/masking
    error.value = e.message || 'Erro inesperado ao salvar o serviço.';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.service-form-view {
  max-width: 1000px;
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

.header h1 {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
}

.header h1 .dim {
  color: #475569;
  font-weight: 300;
}

.main-form {
  background: #0c1018;
  border: 1px solid rgba(56, 189, 248, 0.1);
  padding: 3rem;
  border-radius: 8px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  margin-bottom: 3rem;
}

.section-title {
  font-size: 1rem;
  color: #0ea5e9;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-bottom: 1px solid rgba(14, 165, 233, 0.2);
  padding-bottom: 1rem;
  margin-bottom: 2.5rem;
}

.field {
  margin-bottom: 1.5rem;
}

.field label {
  display: block;
  font-size: 0.8rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.field input[type="text"],
.field input[type="number"],
.field textarea {
  width: 100%;
  background: #030508;
  border: 1px solid rgba(56, 189, 248, 0.1);
  padding: 0.8rem 1rem;
  color: #fff;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.95rem;
}

.field input:focus, 
.field textarea:focus {
  outline: none;
  border-color: #0ea5e9;
  box-shadow: 0 0 10px rgba(14, 165, 233, 0.1);
}

.field small {
  display: block;
  color: #475569;
  font-size: 0.75rem;
  margin-top: 0.4rem;
}

.row {
  display: flex;
  gap: 1.5rem;
}

.half {
  flex: 1;
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-top: 2rem;
}

.checkbox-field input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.checkbox-field label {
  margin-bottom: 0;
  cursor: pointer;
  color: #f1f5f9;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1.5rem;
  padding-top: 2rem;
  border-top: 1px solid rgba(56, 189, 248, 0.1);
}

.btn {
  padding: 0.8rem 2rem;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-primary {
  background: #0ea5e9;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #0284c7;
  box-shadow: 0 0 20px rgba(14, 165, 233, 0.4);
}

.btn-secondary {
  background: transparent;
  color: #94a3b8;
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(148, 163, 184, 0.1);
  color: #fff;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-msg {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  padding: 1rem;
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 4px;
  margin-bottom: 2rem;
  font-size: 0.9rem;
}

.field-error {
  color: #ef4444;
  font-size: 0.75rem;
  margin-top: 0.4rem;
  font-weight: 500;
}

.has-error input,
.has-error textarea {
  border-color: rgba(239, 68, 68, 0.5) !important;
  background: rgba(239, 68, 68, 0.05) !important;
}

@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}
</style>
