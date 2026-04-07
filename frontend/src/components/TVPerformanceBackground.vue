<template>
  <div class="tv-background">
    <!-- Grid Estática de Baixo Custo -->
    <div class="static-grid"></div>
    
    <!-- Malha de Conexões Fixa (SVG) -->
    <svg class="static-mesh" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stop-color="var(--color-accent)" stop-opacity="0.6" />
          <stop offset="100%" stop-color="var(--color-accent)" stop-opacity="0" />
        </radialGradient>
      </defs>
      
      <!-- Linhas de Conexão Estáticas -->
      <g class="connections">
        <line v-for="(line, i) in staticLines" :key="'l'+i" 
          :x1="line.x1" :y1="line.y1" :x2="line.x2" :y2="line.y2"
          class="mesh-line" :style="{ animationDelay: line.delay + 's' }" />
      </g>
      
      <!-- Nós pulsantes ocasionais -->
      <g class="nodes">
        <circle v-for="(node, i) in staticNodes" :key="'n'+i"
          :cx="node.x" :cy="node.y" r="2"
          class="mesh-node" :style="{ animationDelay: node.delay + 's' }" />
      </g>
    </svg>
    
    <div class="vignette"></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// Geramos uma malha fixa uma única vez
const generateMesh = () => {
  const nodes = [];
  const lines = [];
  const rows = 12;
  const cols = 12;
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c * (1000 / (cols - 1))) + (Math.random() * 40 - 20);
      const y = (r * (1000 / (rows - 1))) + (Math.random() * 40 - 20);
      nodes.push({ x, y, delay: Math.random() * 10 });
    }
  }
  
  // Conectar alguns vizinhos aleatoriamente
  for (let i = 0; i < nodes.length; i++) {
    const neighbors = [i + 1, i + cols, i + cols + 1];
    neighbors.forEach(nIdx => {
      if (nIdx < nodes.length && Math.random() > 0.4) {
        lines.push({
          x1: nodes[i].x, y1: nodes[i].y,
          x2: nodes[nIdx].x, y2: nodes[nIdx].y,
          delay: Math.random() * 10
        });
      }
    });
  }
  return { nodes, lines };
};

const { nodes: staticNodes, lines: staticLines } = generateMesh();
</script>

<style scoped>
.tv-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #04080f; /* Ultra Dark */
  z-index: 0;
  overflow: hidden;
}

.static-grid {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: 
    linear-gradient(rgba(14, 165, 233, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14, 165, 233, 0.03) 1px, transparent 1px);
  background-size: 80px 80px;
  opacity: 0.5;
}

.static-mesh {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.4;
}

.mesh-line {
  stroke: rgba(14, 165, 233, 0.15);
  stroke-width: 0.5;
  animation: slowPulse 12s infinite ease-in-out;
}

.mesh-node {
  fill: var(--color-accent);
  opacity: 0.2;
  animation: nodeBlink 8s infinite ease-in-out;
}

@keyframes slowPulse {
  0%, 100% { opacity: 0.2; stroke-width: 0.5; }
  50% { opacity: 0.6; stroke-width: 0.8; }
}

@keyframes nodeBlink {
  0%, 100% { opacity: 0.1; }
  50% { opacity: 0.8; }
}

.vignette {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at center, transparent 20%, rgba(4, 8, 15, 0.95) 100%);
  pointer-events: none;
}
</style>
