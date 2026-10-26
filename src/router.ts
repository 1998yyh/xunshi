import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from './composables/useAuth'
const router = createRouter({ history: createWebHistory(import.meta.env.BASE_URL), routes: [
  { path: '/', redirect: '/signals' },
  { path: '/signals', component: () => import('./pages/SignalsPage.vue'), meta: { title: '信号筛选' } },
  { path: '/watchlist', component: () => import('./pages/WatchlistPage.vue'), meta: { title: '我的观察池' } },
  { path: '/login', component: () => import('./pages/LoginPage.vue'), meta: { title: '登录' } },
  { path: '/stock-signals', redirect: (to) => to.query.tab === 'pool' ? '/watchlist' : '/signals' },
  { path: '/:pathMatch(.*)*', redirect: '/signals' },
] })
router.beforeEach(() => useAuth().restore())
router.afterEach((to) => { document.title = `${String(to.meta.title)} · 循势` })
export default router
