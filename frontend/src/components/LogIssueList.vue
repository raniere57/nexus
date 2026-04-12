<template>
  <div class="log-issues-card">
    <div v-if="loading" class="log-issues-empty">Loading log clusters...</div>
    <div v-else-if="clusters.length === 0" class="log-issues-empty">{{ emptyMessage }}</div>
    <div v-else class="log-issues-table-container">
      <table class="log-issues-table">
        <thead>
          <tr>
            <th>Issue</th>
            <th>Severity</th>
            <th>24h</th>
            <th>Total</th>
            <th>First Seen</th>
            <th>Last Seen</th>
            <th>Sample</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cluster in clusters" :key="cluster.id">
            <td>
              <div class="issue-title">{{ cluster.title }}</div>
              <div class="issue-fingerprint">{{ cluster.fingerprint.slice(0, 12) }}</div>
            </td>
            <td>
              <span class="severity-pill" :class="`severity-${cluster.severity}`">
                {{ cluster.severity }}
              </span>
            </td>
            <td>{{ cluster.count24h }}</td>
            <td>{{ cluster.totalCount }}</td>
            <td>{{ formatDate(cluster.firstSeenAt) }}</td>
            <td>{{ formatDate(cluster.lastSeenAt) }}</td>
            <td class="sample-cell">{{ cluster.sampleLog }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LogIssueCluster } from '../types';

defineProps<{
  clusters: LogIssueCluster[];
  loading?: boolean;
  emptyMessage?: string;
}>();

const formatDate = (iso: string) => {
  return new Date(iso).toLocaleString();
};
</script>

<style scoped>
.log-issues-card {
  min-height: 160px;
}

.log-issues-empty {
  color: #64748b;
  padding: 2rem 0;
}

.log-issues-table-container {
  overflow-x: auto;
}

.log-issues-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 960px;
}

.log-issues-table th,
.log-issues-table td {
  text-align: left;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  vertical-align: top;
}

.log-issues-table th {
  color: #94a3b8;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.issue-title {
  color: #e2e8f0;
  font-weight: 600;
}

.issue-fingerprint {
  color: #64748b;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.severity-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.severity-warning {
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.18);
}

.severity-critical {
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.sample-cell {
  color: #cbd5e1;
  max-width: 360px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>