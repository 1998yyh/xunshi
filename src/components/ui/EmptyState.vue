<script setup lang="ts">
import UiIcon from './UiIcon.vue'
defineProps<{ title: string; description?: string }>()
</script>
<template>
  <div class="empty-state">
    <span class="empty-icon"><UiIcon
      name="empty"
      :size="28"
    /></span><h3>{{ title }}</h3><p v-if="description">
      {{ description }}
    </p><div class="empty-actions">
      <slot />
    </div>
  </div>
</template>
