<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { safeReturnTo, unifiedLoginUrl } from '../lib/browser-session'
const route = useRoute()
const target = computed(() => {
  const value = typeof route.query.redirect === 'string' ? route.query.redirect : '/watchlist'
  return unifiedLoginUrl(safeReturnTo(`/xunshi${value.startsWith('/') ? value : '/watchlist'}`, '/xunshi/watchlist'))
})
onMounted(() => window.location.replace(target.value))
</script>
<template>
  <section class="panel">
    <h1>正在前往统一登录…</h1><a :href="target">继续登录团子账号</a>
  </section>
</template>
