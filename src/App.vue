<script setup lang="ts">
import { NConfigProvider, zhCN, dateZhCN } from 'naive-ui'
import AppShell from './components/layout/AppShell.vue'
import { themeOverrides } from './theme'
</script>
<template>
  <NConfigProvider
    :locale="zhCN"
    :date-locale="dateZhCN"
    :theme-overrides="themeOverrides"
  >
    <AppShell><router-view /></AppShell>
  </NConfigProvider>
</template>
