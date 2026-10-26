<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../../composables/useAuth'
import UiIcon from '../ui/UiIcon.vue'
const auth = useAuth()
const router = useRouter()
const route = useRoute()
function logout() { auth.logout(); void router.push('/signals') }
</script>
<template>
  <div class="app-shell">
    <aside class="sidebar">
      <router-link
        to="/signals"
        class="brand"
      >
        <span class="brand-symbol">循</span><span>循势<small>STOCK WORKSPACE</small></span>
      </router-link>
      <p class="nav-label">
        我的工作台
      </p>
      <nav aria-label="主导航">
        <router-link to="/signals">
          <UiIcon name="signals" /><span>信号筛选</span>
        </router-link>
        <router-link to="/watchlist">
          <UiIcon name="pool" /><span>我的观察池</span>
        </router-link>
      </nav>
      <div class="sidebar-note">
        <span class="status-dot" />关注信号，保持节奏<p>从筛选到跟踪，让每一次观察都有记录。</p>
      </div>
      <div class="account-box">
        <template v-if="auth.state.user">
          <span class="avatar">{{ auth.state.user.username.slice(0, 1).toUpperCase() }}</span><div class="account-name">
            <strong>{{ auth.state.user.username }}</strong><small>个人工作台</small>
          </div><button
            class="text-button"
            @click="logout"
          >
            退出
          </button>
        </template>
        <template v-else>
          <span class="avatar">访</span><div class="account-name">
            <strong>访客模式</strong><small>登录同步个人观察池</small>
          </div><router-link
            :to="{ path: '/login', query: { redirect: route.fullPath } }"
            class="text-button"
          >
            登录
          </router-link>
        </template>
      </div>
    </aside>
    <div class="workspace">
      <div class="topbar">
        <span>工作台 <span class="breadcrumb-divider">/</span> <strong>{{ route.meta.title }}</strong></span><span class="data-source">信号数据 · 新浪财经</span>
      </div>
      <div
        v-if="auth.state.expired"
        class="session-banner"
        role="status"
      >
        登录已过期，重新登录后可继续管理观察池。<router-link :to="{ path: '/login', query: { redirect: route.fullPath } }">
          重新登录 →
        </router-link>
      </div>
      <main class="main-content">
        <slot />
      </main>
      <footer class="app-footer">
        信号用于辅助观察，不构成投资建议。 · 以实际交易与数据更新时间为准
      </footer>
    </div>
  </div>
</template>
