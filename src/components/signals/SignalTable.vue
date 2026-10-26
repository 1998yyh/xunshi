<script setup lang="ts">
import { computed } from 'vue'
import type { Stock, StockSectors } from '../../types'
import StockSectorCells from './StockSectorCells.vue'
const selected = defineModel<string[]>({ required: true })
const props = defineProps<{ rows: readonly Stock[]; sectors: ReadonlyMap<string, StockSectors>; authenticated: boolean; pooled: Set<string>; busy: boolean }>()
const available = computed(() => props.rows.filter((item) => !props.pooled.has(item.code)))
const all = computed(() => available.value.length > 0 && available.value.slice(0, 100).every((item) => selected.value.includes(item.code)))
function toggle(code: string) { selected.value = selected.value.includes(code) ? selected.value.filter((v) => v !== code) : [...selected.value, code] }
function toggleAll() { selected.value = all.value ? [] : available.value.slice(0, 100).map((item) => item.code) }
</script>
<template>
  <div class="table-scroll signals-scroll">
    <table class="data-table">
      <thead>
        <tr>
          <th
            v-if="authenticated"
            class="check-cell"
          >
            <input
              type="checkbox"
              aria-label="全选未入池股票（最多100只）"
              :checked="all"
              :disabled="!available.length || busy"
              @change="toggleAll"
            >
          </th><th>股票</th><th>行业板块</th><th>概念板块</th><th>观察状态</th>
        </tr>
      </thead><tbody>
        <tr
          v-for="item in rows"
          :key="item.code"
        >
          <td
            v-if="authenticated"
            class="check-cell"
          >
            <input
              type="checkbox"
              :aria-label="`选择 ${item.name || item.code}`"
              :checked="selected.includes(item.code)"
              :disabled="pooled.has(item.code) || busy || (!selected.includes(item.code) && selected.length >= 100)"
              @change="toggle(item.code)"
            >
          </td><td><strong class="stock-name">{{ item.name || '未命名股票' }}</strong><span class="stock-code">{{ item.code }}</span></td>
          <StockSectorCells
            :value="sectors.get(item.code)"
            :name="item.name || item.code"
          />
          <td data-label="观察状态">
            <span
              v-if="pooled.has(item.code)"
              class="status-pooled"
            >已在观察池</span><span
              v-else
              class="muted"
            >—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
@media (max-width: 800px) {
  .data-table,
  tbody {
    display: block;
  }

  thead {
    display: none;
  }

  tr {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 14px;
    padding: 20px;
    border-bottom: 1px solid var(--line);
  }

  tr:last-child {
    border-bottom: 0;
  }

  td,
  :deep(td) {
    display: block;
    padding: 0;
    border: 0;
    white-space: normal;
  }

  td:not(.check-cell),
  :deep(td[data-label]) {
    grid-column: 2;
  }

  .check-cell {
    grid-column: 1;
    grid-row: 1;
  }

  :deep(td[data-label])::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 7px;
    color: var(--muted);
    font-size: 10px;
  }
}
</style>
