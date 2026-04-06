import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'tv-dashboard',
    component: () => import('../views/TVDashboard.vue')
  },
  {
    path: '/config',
    component: () => import('../components/layout/ConfigLayout.vue'),
    children: [
      {
        path: '',
        name: 'config-services',
        component: () => import('../views/config/ServiceList.vue')
      },
      {
        path: 'services/new',
        name: 'config-service-new',
        component: () => import('../views/config/ServiceForm.vue')
      },
      {
        path: 'services/:id',
        name: 'config-service-detail',
        component: () => import('../views/config/ServiceDetail.vue')
      }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to, from, next) => {
  // Try to dynamically load auth logic without circularly depending too early
  const { currentRole, promptAuth } = await import('../composables/useAuth');
  
  if (to.path.startsWith('/config')) {
    if (currentRole.value !== 'admin') {
      promptAuth('config', to.fullPath);
      return next(false);
    }
  }
  next();
});

export default router;
