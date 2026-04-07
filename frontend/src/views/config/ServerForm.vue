<template>
  <div class="server-form-page">
    <div class="form-header">
      <router-link to="/config" class="back-link">← Voltar</router-link>
      <h2>{{ isEdit ? 'Editar Servidor' : 'Novo Servidor' }}</h2>
    </div>

    <form @submit.prevent="handleSubmit" class="config-form">
      <div class="form-group">
        <label>Nome do Servidor *</label>
        <input v-model="form.name" type="text" placeholder="Ex: Servidor Principal" required />
      </div>
      <div class="form-group">
        <label>Host (IP ou Hostname) *</label>
        <input v-model="form.host" type="text" placeholder="Ex: 192.168.1.100" required />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Porta SSH</label>
          <input v-model.number="form.sshPort" type="number" min="1" max="65535" />
        </div>
        <div class="form-group">
          <label>Usuário SSH</label>
          <input v-model="form.sshUser" type="text" placeholder="root" />
        </div>
      </div>
      <div class="form-group">
        <label>Senha SSH</label>
        <input v-model="form.sshPassword" type="password" placeholder="Senha de acesso SSH" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Intervalo de Checagem (s)</label>
          <input v-model.number="form.checkIntervalSeconds" type="number" min="10" />
        </div>
        <div class="form-group checkbox-group">
          <label>
            <input v-model="form.isActive" type="checkbox" />
            Servidor ativo
          </label>
        </div>
      </div>

      <div v-if="errorMessage" class="form-error">{{ errorMessage }}</div>

      <div class="form-actions">
        <button type="submit" class="btn-primary" :disabled="isSubmitting">
          {{ isSubmitting ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Cadastrar') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { serversApi } from '../../services/api';

const router = useRouter();
const route = useRoute();
const isEdit = ref(false);
const isSubmitting = ref(false);
const errorMessage = ref('');

const form = ref({
  name: '',
  host: '',
  sshPort: 22,
  sshUser: 'root',
  sshPassword: '',
  checkIntervalSeconds: 60,
  isActive: true
});

onMounted(async () => {
  const id = route.params.id as string;
  if (id && id !== 'new') {
    isEdit.value = true;
    try {
      const server = await serversApi.getById(id);
      form.value = {
        name: server.name,
        host: server.host,
        sshPort: server.sshPort,
        sshUser: server.sshUser,
        sshPassword: server.sshPassword,
        checkIntervalSeconds: server.checkIntervalSeconds,
        isActive: !!server.isActive
      };
    } catch (e: any) {
      errorMessage.value = e.message;
    }
  }
});

const handleSubmit = async () => {
  isSubmitting.value = true;
  errorMessage.value = '';
  try {
    if (isEdit.value) {
      await serversApi.update(route.params.id as string, form.value);
    } else {
      await serversApi.create(form.value);
    }
    router.push('/config');
  } catch (e: any) {
    errorMessage.value = e.message;
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.server-form-page {
  max-width: 600px;
}

.form-header {
  margin-bottom: 2rem;
}

.back-link {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.85rem;
  display: inline-block;
  margin-bottom: 0.5rem;
  transition: color 0.2s;
}

.back-link:hover {
  color: var(--color-accent);
}

.form-header h2 {
  font-size: 1.5rem;
  font-weight: 300;
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-group label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.form-group input[type="text"],
.form-group input[type="number"],
.form-group input[type="password"] {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  padding: 0.6rem 0.8rem;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.form-hint {
  font-size: 0.7rem;
  color: var(--text-tertiary);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.checkbox-group {
  justify-content: center;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.form-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: var(--color-offline);
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.85rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.btn-primary {
  background: var(--color-accent);
  color: #fff;
  border: none;
  padding: 0.6rem 2rem;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  filter: brightness(1.2);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
