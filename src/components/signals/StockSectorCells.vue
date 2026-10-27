<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { StockSectors } from '../../types'
const props = defineProps<{ value?: StockSectors; name: string }>()
const expanded = shallowRef(false)
const industries = computed(() => props.value?.industries.map((item) => item.name).join(' / ') || '暂未提供')
const concepts = computed(() => props.value?.concepts ?? [])
const visibleConcepts = computed(() => expanded.value ? concepts.value : concepts.value.slice(0, 3))
const placeholder = computed(() => !props.value ? '加载中…' : props.value.status === 'unavailable' ? '暂不可用' : '')
</script>

<template>
  <td
    class="industry-cell"
    data-label="行业板块"
  >
    <span
      v-if="placeholder"
      class="muted"
    >{{ placeholder }}</span>
    <span v-else>{{ industries }}</span>
  </td>
  <td
    class="concept-cell"
    data-label="概念板块"
  >
    <span
      v-if="placeholder"
      class="muted"
    >{{ placeholder }}</span>
    <div
      v-else-if="concepts.length"
      class="concept-tags"
    >
      <span
        v-for="concept in visibleConcepts"
        :key="concept.code"
        class="concept-tag"
      >{{ concept.name }}</span>
      <button
        v-if="concepts.length > 3"
        class="text-button"
        :aria-expanded="expanded"
        :aria-label="`${expanded ? '收起' : '展开'} ${name} 的概念板块`"
        @click="expanded = !expanded"
      >
        {{ expanded ? '收起' : `+${concepts.length - 3}` }}
      </button>
    </div>
    <span
      v-else
      class="muted"
    >暂无主题概念</span>
  </td>
</template>

<style scoped>
.industry-cell {
  width: 20%;
  white-space: normal;
  line-height: 1.8;
  overflow-wrap: anywhere;
}

.concept-cell {
  width: 28%;
  white-space: normal;
}

.concept-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.concept-tag {
  padding: 4px 8px;
  border-radius: 5px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 10px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

@media (max-width: 800px) {
  .industry-cell,
  .concept-cell {
    width: auto;
  }
}
</style>
