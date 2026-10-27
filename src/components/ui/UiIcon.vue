<script setup lang="ts">
withDefaults(defineProps<{ name: 'signals' | 'pool' | 'arrow' | 'search' | 'check' | 'empty' | 'history'; size?: number }>(), { size: 20 })
const paths = {
  signals: 'M4 19V5m0 14h16M8 14l4-5 4 3 4-7',
  pool: 'M4 5h16v15l-8-4-8 4V5Zm4 4h8',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  search: 'M21 21l-5-5M18 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  check: 'm5 12 4 4L19 6',
  empty: 'M4 7h16v13H4V7Zm3 0 2-4h6l2 4M8 12h8',
  history: 'M3 11a9 9 0 1 1 2.6 7M3 4v7h7m2-4v5l3 2',
}
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  ><path :d="paths[name]" /></svg>
</template>
