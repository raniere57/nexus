<template>
  <div v-if="showAuthModal" class="auth-modal-overlay">
    <div class="auth-modal">
      <div class="auth-header">
        <h2>{{ authModalType === 'initial' ? 'SYSTEM ACCESS' : 'ELEVATED ACCESS REQUIRED' }}</h2>
        <div class="subtitle">{{ authModalType === 'initial' ? 'Enter authentication phrase' : 'Admin credentials required for Config' }}</div>
      </div>
      
      <form @submit.prevent="submitAuth" class="auth-form">
        <input 
          type="password" 
          v-model="password" 
          placeholder="Access password..." 
          ref="passInput"
          :class="{'has-error': authError}"
          autofocus
        />
        <div v-if="authError" class="auth-error">{{ authError }}</div>
        
        <button type="submit" :disabled="!password || authLoading" class="btn-submit">
          {{ authLoading ? 'VERIFYING...' : 'AUTHORIZE' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { showAuthModal, authModalType, authError, authLoading, verifyAuth } from '../composables/useAuth';

const password = ref('');
const passInput = ref<HTMLInputElement | null>(null);

watch(showAuthModal, (newVal) => {
  if (newVal) {
    password.value = '';
    authError.value = '';
    nextTick(() => {
      passInput.value?.focus();
    });
  }
});

const submitAuth = async () => {
  if (!password.value) return;
  await verifyAuth(password.value);
};
</script>

<style scoped>
.auth-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(4, 6, 10, 0.85);
  backdrop-filter: blur(15px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 99999;
}

.auth-modal {
  background: var(--bg-surface);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  box-shadow: 0 0 50px rgba(14, 165, 233, 0.1);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  animation: modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.auth-header h2 {
  font-family: var(--font-mono);
  color: var(--text-primary);
  font-size: 1.25rem;
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

input {
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--border-subtle);
  padding: 1rem;
  border-radius: 6px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 1rem;
  outline: none;
  transition: all 0.2s;
}

input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 10px rgba(14, 165, 233, 0.2);
}

input.has-error {
  border-color: var(--status-error);
}

.auth-error {
  color: var(--status-error);
  font-size: 0.8rem;
  font-weight: 500;
}

.btn-submit {
  background: var(--color-accent);
  color: #fff;
  border: none;
  padding: 1rem;
  border-radius: 6px;
  font-weight: 600;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-submit:hover:not(:disabled) {
  background: var(--color-accent-glow);
  box-shadow: 0 0 15px rgba(14, 165, 233, 0.4);
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
