<template>
  <div class="background-wrapper">
    <div class="tech-grid"></div>
    <canvas ref="canvasEl" class="particle-net"></canvas>
    <div class="vignette"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const canvasEl = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let animationFrameId: number;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

const particles: Particle[] = [];
const numParticles = 80; // Not too dense

const resize = () => {
  if (canvasEl.value) {
    canvasEl.value.width = window.innerWidth;
    canvasEl.value.height = window.innerHeight;
  }
};

const initParticles = () => {
  particles.length = 0;
  for (let i = 0; i < numParticles; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 1.5 + 0.5
    });
  }
};

const draw = () => {
  if (!ctx || !canvasEl.value) return;
  const width = canvasEl.value.width;
  const height = canvasEl.value.height;

  ctx.clearRect(0, 0, width, height);

  // Update & Draw Particles
  ctx.fillStyle = 'rgba(14, 165, 233, 0.6)';
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;

    // Bounce
    if (p.x < 0 || p.x > width) p.vx *= -1;
    if (p.y < 0 || p.y > height) p.vy *= -1;

    ctx!.beginPath();
    ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx!.fill();
  });

  // Draw Connections
  ctx.lineWidth = 0.5;
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 150) {
        const alpha = 1 - dist / 150;
        ctx.strokeStyle = `rgba(14, 165, 233, ${alpha * 0.35})`;
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }

  animationFrameId = requestAnimationFrame(draw);
};

onMounted(() => {
  if (canvasEl.value) {
    ctx = canvasEl.value.getContext('2d');
    resize();
    initParticles();
    window.addEventListener('resize', resize);
    draw();
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', resize);
  cancelAnimationFrame(animationFrameId);
});
</script>

<style scoped>
.background-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: hidden;
  background-color: var(--bg-core);
}

.tech-grid {
  position: absolute;
  top: 0;
  left: 0;
  width: 200%;
  height: 200%;
  background-image: 
    linear-gradient(rgba(14, 165, 233, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14, 165, 233, 0.08) 1px, transparent 1px);
  background-size: 50px 50px;
  background-position: center bottom;
  pointer-events: none;
  animation: pan-grid 60s linear infinite;
}

@keyframes pan-grid {
  0% { transform: translate(0, 0); }
  100% { transform: translate(-50px, -50px); }
}

.particle-net {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.9;
}

.vignette {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at center, transparent 30%, var(--bg-core) 100%);
  pointer-events: none;
}
</style>
