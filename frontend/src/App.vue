<template>
  <router-view />
  <AuthModal />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import AuthModal from './components/AuthModal.vue';
import { currentRole, promptAuth } from './composables/useAuth';

onMounted(() => {
  if (!currentRole.value) {
    promptAuth('initial');
  }
});
</script>

<style>
/* Root styles for App */
</style>
