import { ref } from 'vue';
import router from '../router';

export const currentRole = ref<string | null>(sessionStorage.getItem('nexus_role'));
export const showAuthModal = ref<boolean>(false);
export const authModalType = ref<'initial' | 'config'>('initial');
export const authPendingRoute = ref<string | null>(null);
export const authError = ref<string>('');
export const authLoading = ref<boolean>(false);

export async function verifyAuth(password: string) {
  authLoading.value = true;
  authError.value = '';
  try {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const payload = await res.json();
    
    // Support either wrapped envelope or direct response based on our current interceptors
    const data = payload && payload.success && payload.data ? payload.data : payload;

    if (data.success && data.role) {
      if (authModalType.value === 'config' && data.role !== 'admin') {
         authError.value = 'Acesso Negado (Requer nível Administrador)';
         authLoading.value = false;
         return false;
      }
      
      currentRole.value = data.role;
      sessionStorage.setItem('nexus_role', data.role);
      showAuthModal.value = false;
      authError.value = '';
      
      if (authPendingRoute.value) {
        const target = authPendingRoute.value;
        authPendingRoute.value = null;
        router.push(target);
      }
      
      authLoading.value = false;
      return true;
    } else {
      authError.value = 'Senha Inválida';
      authLoading.value = false;
      return false;
    }
  } catch (e) {
    authError.value = 'Erro de conexão';
    authLoading.value = false;
    return false;
  }
}

export function promptAuth(type: 'initial' | 'config', targetRoute?: string) {
  authModalType.value = type;
  if (targetRoute) authPendingRoute.value = targetRoute;
  showAuthModal.value = true;
}
