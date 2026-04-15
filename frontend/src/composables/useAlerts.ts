import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { NexusService, NexusServer } from '../types';

export function useAlerts() {
  const servicesOfflineCount = ref(0);
  const serversOfflineCount = ref(0);
  const logCriticalCount = ref(0);
  let alertInterval: number | null = null;
  let soundInterval: number | null = null;
  let alertState = ref(false);
  let componentMountedAt = ref<number>(0);

  const playAlertSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const audioCtx = new AudioContext();
        const now = audioCtx.currentTime;
        const notes = [
          { frequency: 880, start: 0, duration: 0.1 },
          { frequency: 880, start: 0.15, duration: 0.1 },
          { frequency: 880, start: 0.3, duration: 0.1 },
          { frequency: 880, start: 0.45, duration: 0.1 }
        ];

        notes.forEach(({ frequency, start, duration }) => {
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();

          oscillator.type = 'triangle';
          oscillator.frequency.setValueAtTime(frequency, now + start);
12, now + start + 0.02
          gainNode.gain.setValueAtTime(0.0001, now + start);
          gainNode.gain.exponentialRampToValueAtTime(0.08, now + start + 0.015);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);

          oscillator.start(now + start);
          oscillator.stop(now + start + duration + 0.02);
        });

        window.setTimeout(() => {
          audioCtx.close().catch(() => undefined);
        }, 1000);
      }
    } catch (e) {
      console.error('Error playing alert sound:', e);
    }
  };

  const startAlertPulse = () => {
    // Piscar a cada 5 segundos (inverte o estado)
    alertInterval = window.setInterval(() => {
      alertState.value = !alertState.value;
    }, 5000);
  };

  const startSoundAlert = () => {
    // Emitir som a cada 1 minuto enquanto houver offline
    soundInterval = window.setInterval(() => {
      if (servicesOfflineCount.value > 0 || serversOfflineCount.value > 0 || logCriticalCount.value > 0) {
        playAlertSound();
      }
    }, 60000);
  };

  const setServicesOfflineCount = (count: number) => {
    servicesOfflineCount.value = count;
  };

  const setServersOfflineCount = (count: number) => {
    serversOfflineCount.value = count;
  };

  const setLogCriticalCount = (count: number) => {
    logCriticalCount.value = count;
  };

  const getTotalCritical = () => servicesOfflineCount.value + serversOfflineCount.value + logCriticalCount.value;

  const isAlertPulsing = computed(() => {
    const totalOffline = getTotalCritical();
    const timeSinceMount = componentMountedAt.value > 0 ? Date.now() - componentMountedAt.value : 0;
    const shouldPulse = totalOffline > 0 && (timeSinceMount < 5000 || alertState.value);
    console.log('[useAlerts] totalOffline:', totalOffline, 'timeSinceMount:', timeSinceMount, 'alertState:', alertState.value, 'shouldPulse:', shouldPulse);
    return shouldPulse;
  });

  onMounted(() => {
    componentMountedAt.value = Date.now();
    startAlertPulse();
    startSoundAlert();
    console.log('NEXUS: Alert system initialized');
  });

  onUnmounted(() => {
    if (alertInterval) {
      clearInterval(alertInterval);
      alertInterval = null;
    }
    if (soundInterval) {
      clearInterval(soundInterval);
      soundInterval = null;
    }
  });

  return {
    setServicesOfflineCount,
    setServersOfflineCount,
    setLogCriticalCount,
    isAlertPulsing
  };
}
