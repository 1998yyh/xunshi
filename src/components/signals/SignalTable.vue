<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { NCheckbox } from 'naive-ui'
import type { Stock, StockSectors, StockPerformance } from '../../types'
import StockSectorCells from './StockSectorCells.vue'
import StockReturnCells from './StockReturnCells.vue'
import SignalSortControls from './SignalSortControls.vue'
import SignalSortHeader from './SignalSortHeader.vue'
import { sortSignalRows, nextSignalSort, type SignalSort, type SignalSortColumn } from '../../lib/signal-sort'
const selected = defineModel<string[]>({ required: true })
const props = defineProps<{ rows: readonly Stock[]; sectors: ReadonlyMap<string, StockSectors>; performance: ReadonlyMap<string, StockPerformance>; authenticated: boolean; pooled: Set<string>; busy: boolean }>()
const sort = shallowRef<SignalSort>('default')
const orderedRows = computed(() => sortSignalRows(props.rows, sort.value, props.performance, props.sectors))
const available = computed(() => orderedRows.value.filter((item) => !props.pooled.has(item.code)))
const all = computed(() => available.value.length > 0 && available.value.slice(0, 100).every((item) => selected.value.includes(item.code)))
const partiallySelected = computed(() => !all.value && available.value.some((item) => selected.value.includes(item.code)))
function toggle(code: string) { selected.value = selected.value.includes(code) ? selected.value.filter((v) => v !== code) : [...selected.value, code] }
function toggleAll() { selected.value = all.value ? [] : available.value.slice(0, 100).map((item) => item.code) }
function toggleSort(column: SignalSortColumn) { sort.value = nextSignalSort(sort.value, column) }
</script>
<template>
  <SignalSortControls v-model="sort" />
  <div class="table-scroll signals-scroll">
    <table class="data-table">
      <thead>
        <tr>
          <th
            v-if="authenticated"
            class="check-cell"
          >
            <NCheckbox
              aria-label="全选未入池股票（最多100只）"
              :checked="all"
              :indeterminate="partiallySelected"
              :disabled="!available.length || busy"
              @update:checked="toggleAll"
            />
          </th><th>股票</th>
          <SignalSortHeader
            label="当日涨幅"
            column="day"
            :sort="sort"
            description="所选筛选日期相对前一交易日的涨跌幅；点击切换降序、升序、默认顺序"
            @toggle="toggleSort"
          />
          <SignalSortHeader
            label="距今涨幅"
            column="since"
            :sort="sort"
            description="所选筛选日收盘至最新报价的涨跌幅，前复权口径；点击切换降序、升序、默认顺序"
            @toggle="toggleSort"
          />
          <SignalSortHeader
            label="行业板块"
            column="industry"
            :sort="sort"
            description="按一级行业名称拼音排序，不使用二级行业或概念；点击切换升序、降序、默认顺序"
            @toggle="toggleSort"
          />
          <th>概念板块</th><th>观察状态</th>
        </tr>
      </thead><tbody>
        <tr
          v-for="item in orderedRows"
          :key="item.code"
        >
          <td
            v-if="authenticated"
            class="check-cell"
          >
            <NCheckbox
              :aria-label="`选择 ${item.name || item.code}`"
              :checked="selected.includes(item.code)"
              :disabled="pooled.has(item.code) || busy || (!selected.includes(item.code) && selected.length >= 100)"
              @update:checked="toggle(item.code)"
            />
          </td><td><strong class="stock-name">{{ item.name || '未命名股票' }}</strong><span class="stock-code">{{ item.code }}</span></td>
          <StockReturnCells :value="performance.get(item.code)" />
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
