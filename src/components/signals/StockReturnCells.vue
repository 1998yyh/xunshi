<script setup lang="ts">
import { computed } from 'vue'
import type { StockPerformance } from '../../types'
const props = defineProps<{ value?: StockPerformance }>()
function percent(value: number) { return `${value > 0 ? '+' : ''}${(Object.is(value, -0) ? 0 : value).toFixed(2)}%` }
function tone(value: number | null | undefined) { return value === null || value === undefined || value === 0 ? 'muted' : value > 0 ? 'return-up' : 'return-down' }
const quoteTime = computed(() => props.value?.quoteAsOf ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(props.value.quoteAsOf)) : '')
</script>

<template>
  <td
    class="return-cell"
    data-label="当日涨幅"
  >
    <span
      v-if="value?.dayPercent !== null && value?.dayPercent !== undefined"
      :class="tone(value.dayPercent)"
    >{{ percent(value.dayPercent) }}</span>
    <span
      v-else
      class="return-missing"
    >{{ value ? value.dayReason || '暂不可用' : '加载中…' }}</span>
  </td>
  <td
    class="return-cell"
    data-label="距今涨幅"
  >
    <span
      v-if="value?.sincePercent !== null && value?.sincePercent !== undefined"
      :class="tone(value.sincePercent)"
    >{{ percent(value.sincePercent) }}</span>
    <span
      v-else
      class="return-missing"
    >{{ value?.sinceReason === '基准日未收盘' ? '待收盘' : value ? value.sinceReason || '暂不可用' : '加载中…' }}</span>
    <small
      v-if="quoteTime"
      class="quote-time"
    >截至 {{ quoteTime }}</small>
  </td>
</template>

<style scoped>
.return-cell {
  min-width: 112px;
  font-variant-numeric: tabular-nums;
}
.return-up { color: var(--danger); }
.return-down { color: var(--accent); }
.return-missing { color: var(--muted); font-size: 10px; }
.quote-time { display: block; color: var(--muted); font-size: 9px; margin-top: 5px; }
@media (max-width: 800px) {
  .return-cell { min-width: 0; }
}
</style>
