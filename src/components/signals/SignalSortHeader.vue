<script setup lang="ts">
import { computed } from 'vue'
import { NButton } from 'naive-ui'
import { signalSortOrder, type SignalSort, type SignalSortColumn } from '../../lib/signal-sort'

const props = defineProps<{ label: string; column: SignalSortColumn; sort: SignalSort; description: string }>()
const emit = defineEmits<{ toggle: [column: SignalSortColumn] }>()
const order = computed(() => signalSortOrder(props.sort, props.column))
</script>

<template>
  <th
    :aria-sort="order"
    :title="description"
  >
    <NButton
      text
      class="sort-heading"
      :class="{ 'sort-active': order !== 'none' }"
      :aria-label="`${label}排序`"
      @click="emit('toggle', column)"
    >
      {{ label }}
      <svg
        class="sort-icon"
        width="12"
        height="16"
        viewBox="0 0 12 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="m3 6 3-3 3 3"
          :class="{ active: order === 'ascending' }"
        />
        <path
          d="m3 10 3 3 3-3"
          :class="{ active: order === 'descending' }"
        />
      </svg>
    </NButton>
  </th>
</template>

<style scoped>
.sort-heading { font-size: inherit; color: inherit; }
.sort-active { color: var(--accent); }
.sort-icon { margin-left: 6px; vertical-align: middle; flex-shrink: 0; }
.sort-icon path { stroke: #b8bfcd; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.sort-icon path.active { stroke: var(--accent); stroke-width: 2; }
</style>
