<template>
  <div class="node-network" :class="{ 'tv-perf': isTvMode }">
    <div class="core-node">
      <div class="core-rings">
        <div class="ring r1"></div>
        <div class="ring r2"></div>
        <div class="ring r3"></div>
      </div>
      <div class="core-center" :class="{
         'flash-online': coreFlash.active && coreFlash.state === 'online',
         'flash-degraded': coreFlash.active && coreFlash.state === 'degraded',
         'flash-offline': coreFlash.active && coreFlash.state === 'offline'
      }">NEXUS</div>
    </div>
    
    <div class="orbital-map">
      <div 
        v-for="(service, index) in services" 
        :key="service.serviceId"
        class="service-node"
        :class="[`status-${service.overallStatus}`]"
        :style="getNodeStyle(index, services.length)"
      >
        <!-- Connecting Line to Center -->
        <svg class="connection-line">
          <line x1="1000" y1="1000" :x2="getLineX(index, services.length)" :y2="getLineY(index, services.length)" />
          <circle v-if="service.overallStatus !== 'unknown'" class="pulse-dot" r="2.5" 
            :cx="beams[service.serviceId]?.cx || 1000"
            :cy="beams[service.serviceId]?.cy || 1000"
            :opacity="beams[service.serviceId]?.opacity || 0" />
        </svg>

        <div class="node-glow"></div>
        <div class="node-body" :class="{ 'flash-node-border': beams[service.serviceId]?.flashNode }">
          <div class="node-indicator"></div>
          <div class="node-info">
            <div class="node-env">{{ service.environment }}</div>
            <div class="node-name">{{ service.serviceName }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { NexusService } from '../types';

const props = defineProps<{
  services: NexusService[],
  isTvMode?: boolean
}>();

// Simple circular layout calculation
const radius = 320; // Distance from center
const rotationOffset = ref(0);

// Beam State
interface BeamState {
  progress: number;
  speed: number;
  direction: number;
  cx: number;
  cy: number;
  opacity: number;
  flashNode: boolean;
  flashTimer: number;
  idleTimer: number;
}
const beams = ref<Record<string, BeamState>>({});
const coreFlash = ref({ active: false, state: 'unknown', timer: 0 });

const getAngle = (index: number, total: number) => {
  if (total === 0) return 0;
  // Apply odd/even directional rotation
  const direction = index % 2 === 0 ? 1 : -1;
  return (index / total) * Math.PI * 2 - Math.PI / 2 + (rotationOffset.value * direction);
};

const getLineX = (index: number, total: number) => {
  if (total === 0) return 1000;
  const angle = getAngle(index, total);
  const x = -Math.cos(angle) * radius;
  return 1000 + x;
};

const getLineY = (index: number, total: number) => {
  if (total === 0) return 1000;
  const angle = getAngle(index, total);
  const y = -Math.sin(angle) * radius;
  return 1000 + y;
};

let animationId: number;
let lastTime = 0;

const animate = (time: number) => {
  const dt = lastTime ? time - lastTime : 16;
  lastTime = time;

  // Move extremely slowly: full rotation roughly every 4 minutes (assuming 60fps)
  // In TV mode, core rotation is nearly zero to save GPU/Repaint cycles
  const rotationIncrement = props.isTvMode ? (Math.PI * 2) / 120000 : (Math.PI * 2) / 14400;
  rotationOffset.value += rotationIncrement;
  if (rotationOffset.value > Math.PI * 2) rotationOffset.value -= Math.PI * 2;
  
  // Handle Core Flash Decay
  if (coreFlash.value.timer > 0) {
    coreFlash.value.timer -= dt;
    if (coreFlash.value.timer <= 0) coreFlash.value.active = false;
  }

  // Handle Beams
  props.services.forEach((s, idx) => {
    if (s.overallStatus === 'unknown') return;

    if (!beams.value[s.serviceId]) {
      beams.value[s.serviceId] = {
        progress: Math.random() * 0.7 + 0.15,
        speed: 0.1 + Math.random() * 0.15, // Greatly reduced speed
        direction: Math.random() > 0.5 ? 1 : -1,
        cx: 1000, cy: 1000, opacity: 0,
        flashNode: false, flashTimer: 0,
        idleTimer: Math.random() * 8000 // Greatly prolonged wait between 0 to 8 seconds
      };
    }

    const b = beams.value[s.serviceId];

    // Node Flash Decay
    if (b.flashTimer > 0) {
      b.flashTimer -= dt;
      if (b.flashTimer <= 0) b.flashNode = false;
    }

    // Handle Idle Pauses between bursts
    if (b.idleTimer > 0) {
      b.idleTimer -= dt;
      b.opacity = 0;
      return;
    }

    const angle = getAngle(idx, props.services.length);

    // Calculate exact boundary hit thresholds!
    // PROGRESS: 0 = Center of the NODE (because line starts at 1000,1000 inside the SVG localized to the node child)
    // PROGRESS: 1 = Center of the CORE (because targetX, targetY points back to the center of the viewport)
    
    // Core is an 80px circle (radius 40px). Distance = 320. 
    // It hits the core when distance FROM node is (320 - 40) = 280.
    // Progress = 280 / 320 = 0.875
    const hitCoreThreshold = 1 - (40 / radius);
    
    // Node is a ~180px by ~56px rectangle.
    const dx = Math.abs(90 / Math.cos(angle));
    const dy = Math.abs(28 / Math.sin(angle));
    const hitDistFromNodeCenter = Math.min(dx, dy); 
    // It hits the node edge when distance FROM node is exactly hitDistFromNodeCenter.
    // Progress = hitDistFromNodeCenter / 320
    const hitNodeThreshold = hitDistFromNodeCenter / radius;

    b.progress += (b.speed * (dt / 1000)) * b.direction;

    let hitDest = false;
    if (b.progress >= hitCoreThreshold) {
      // Reached the Core!
      b.progress = hitCoreThreshold;
      b.direction = -1; // Go back to Node
      coreFlash.value.active = true;
      coreFlash.value.state = s.overallStatus;
      coreFlash.value.timer = 1000;
      b.idleTimer = 3000 + Math.random() * 7000;
      hitDest = true;
    } else if (b.progress <= hitNodeThreshold) {
      // Reached the Node!
      b.progress = hitNodeThreshold;
      b.direction = 1; // Go back to Core
      b.flashNode = true;
      b.flashTimer = 1500;
      b.idleTimer = 3000 + Math.random() * 7000;
      hitDest = true;
    }

    const targetX = getLineX(idx, props.services.length);
    const targetY = getLineY(idx, props.services.length);

    b.cx = 1000 + (targetX - 1000) * b.progress;
    b.cy = 1000 + (targetY - 1000) * b.progress;

    const fadeWindow = 0.03;
    if (b.progress < hitNodeThreshold + fadeWindow && !hitDest) 
      b.opacity = (b.progress - hitNodeThreshold) / fadeWindow;
    else if (b.progress > hitCoreThreshold - fadeWindow && !hitDest) 
      b.opacity = (hitCoreThreshold - b.progress) / fadeWindow;
    else 
      b.opacity = hitDest ? 0 : 1;
    
    if (b.opacity < 0) b.opacity = 0;
    if (b.opacity > 1) b.opacity = 1;
  });

  const frameDelay = props.isTvMode ? 33 : 0; // Target ~30fps on TV to save CPU
  if (frameDelay > 0) {
    setTimeout(() => {
      animationId = requestAnimationFrame(animate);
    }, frameDelay);
  } else {
    animationId = requestAnimationFrame(animate);
  }
};

onMounted(() => {
  animationId = requestAnimationFrame(animate);
});

onUnmounted(() => {
  cancelAnimationFrame(animationId);
});

const getNodeStyle = (index: number, total: number) => {
  if (total === 0) return {};
  const angle = getAngle(index, total);
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  
  return {
    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
  };
};
</script>

<style scoped>
.node-network {
  position: relative;
  width: 800px;
  height: 800px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.core-node {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100px;
  height: 100px;
  z-index: 20;
  display: flex;
  justify-content: center;
  align-items: center;
}

.core-center {
  background: var(--bg-surface);
  border: 1px solid var(--border-strong);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.9rem;
  letter-spacing: 0.1em;
  padding: 1rem;
  border-radius: 50%;
  width: 80px;
  height: 80px;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 0 30px rgba(14, 165, 233, 0.2);
  z-index: 2;
}

.core-rings .ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1px solid rgba(14, 165, 233, 0.25);
}

.core-rings .r1 { width: 150px; height: 150px; border-style: dashed; animation: spin 20s linear infinite; }
.core-rings .r2 { width: 300px; height: 300px; border-color: rgba(14, 165, 233, 0.15); }
.core-rings .r3 { width: 640px; height: 640px; border-color: rgba(14, 165, 233, 0.1); }

@keyframes spin {
  100% { transform: translate(-50%, -50%) rotate(360deg); }
}

.orbital-map {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
}

.service-node {
  position: absolute;
  top: 0;
  left: 0;
  width: 180px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.connection-line {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2000px;  /* arbitrarily large */
  height: 2000px;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: -1;
}

.connection-line line {
  stroke: var(--glow-color);
  stroke-width: 1;
  opacity: 0.6;
}

.connection-line .pulse-dot {
  fill: var(--glow-color);
}

.node-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 120px;
  height: 120px;
  border-radius: 50%;
  /* Use radial gradient instead of filter:blur for TV performance */
  background: radial-gradient(circle, var(--glow-color) 0%, transparent 70%);
  opacity: 0.3;
  z-index: 0;
}

.node-network:not(.tv-perf) .node-glow {
  filter: blur(25px);
  animation: breathe 3s infinite ease-in-out;
}

.node-body {
  position: relative;
  background: rgba(12, 16, 24, 0.95); /* Solid dark instead of backdrop-blur */
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 160px;
  z-index: 1;
  box-shadow: 0 4px 15px rgba(0,0,0,0.8);
  transition: all 1.8s ease-out;
}

.node-network:not(.tv-perf) .node-body {
  backdrop-filter: blur(10px);
}

/* Status specifics */
.status-online .node-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--status-color);
  box-shadow: 0 0 10px var(--glow-color);
}

.status-degraded .node-indicator {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: var(--status-color);
  box-shadow: 0 0 15px var(--glow-color);
  animation: flicker 4s infinite;
}

.status-offline .node-indicator {
  width: 8px;
  height: 8px;
  background: transparent;
  border: 2px solid var(--status-color);
}

.status-offline .node-body {
  border-color: rgba(239, 68, 68, 0.3);
  opacity: 0.7;
}

.status-offline .node-glow {
  opacity: 0.1;
  animation: none;
}

.node-info {
  display: flex;
  flex-direction: column;
}

.node-env {
  font-size: 0.6rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.node-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
}

/* Core Flash Effects (Fade Out) */
.core-center {
  transition: box-shadow 2.5s ease-out, border-color 2.5s ease-out, background 2.5s ease-out;
}

/* Core Flash Effects (Instantly Turn On!) */
.core-center.flash-online,
.core-center.flash-degraded,
.core-center.flash-offline {
  transition: box-shadow 0.05s ease-out, border-color 0.05s ease-out, background 0.05s ease-out;
}

.core-center.flash-online {
  border-color: #10b981;
  box-shadow: 0 0 50px rgba(16, 185, 129, 0.6);
  background: rgba(16, 185, 129, 0.1);
}

.core-center.flash-degraded {
  border-color: #f59e0b;
  box-shadow: 0 0 50px rgba(245, 158, 11, 0.6);
  background: rgba(245, 158, 11, 0.1);
}

.core-center.flash-offline {
  border-color: #ef4444;
  box-shadow: 0 0 50px rgba(239, 68, 68, 0.6);
  background: rgba(239, 68, 68, 0.1);
}

/* Node Flash Effects (Instantly Turn On!) */
.status-online .flash-node-border,
.status-degraded .flash-node-border,
.status-offline .flash-node-border {
  transition: all 0.05s ease-out;
}

.status-online .flash-node-border {
  border-color: #10b981;
  box-shadow: 0 0 30px rgba(16, 185, 129, 0.5);
  background: rgba(16, 185, 129, 0.05);
}

.status-degraded .flash-node-border {
  border-color: #f59e0b;
  box-shadow: 0 0 30px rgba(245, 158, 11, 0.5);
  background: rgba(245, 158, 11, 0.05);
}

.status-offline .flash-node-border {
  border-color: #ef4444;
  box-shadow: 0 0 30px rgba(239, 68, 68, 0.5);
  background: rgba(239, 68, 68, 0.05);
}
</style>
