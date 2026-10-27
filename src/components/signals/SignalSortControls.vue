<script setup lang="ts">
import { NSelect } from 'naive-ui'
import type { SignalSort } from '../../lib/signal-sort'

const sort = defineModel<SignalSort>({ required: true })
const options: { label: string; value: SignalSort }[] = [
  { label: '默认顺序', value: 'default' },
  { label: '当日涨幅 · 高到低', value: 'day-desc' },
  { label: '当日涨幅 · 低到高', value: 'day-asc' },
  { label: '距今涨幅 · 高到低', value: 'since-desc' },
  { label: '距今涨幅 · 低到高', value: 'since-asc' },
  { label: '一级板块 · 拼音升序', value: 'industry-asc' },
  { label: '一级板块 · 拼音降序', value: 'industry-desc' },
]
</script>

<template>
  <div class="sort-toolbar">
    <span class="sort-label">结果排序</span>
    <NSelect
      v-model:value="sort"
      class="result-sort-select"
      size="small"
      aria-label="结果排序"
      :options="options"
      :menu-props="{ role: 'listbox', 'aria-label': '结果排序' }"
      :node-props="(option) => ({ role: 'option', 'aria-selected': option.value === sort })"
    />
    <span class="sort-hint">缺失数据置后 · 板块按一级行业名称排序</span>
  </div>
</template>

<style scoped>
.sort-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 14px; padding: 14px 25px; border-bottom: 1px solid var(--line); }
.sort-label { color: var(--muted); font-size: 11px; }
.result-sort-select { width: 220px; }
.sort-hint { margin-left: auto; color: var(--muted); font-size: 10px; }
@media (max-width: 800px) {
  .sort-toolbar { padding: 16px 20px; }
  .result-sort-select { flex: 1; min-width: 0; }
  .sort-hint { margin-left: 0; flex-basis: 100%; line-height: 1.6; }
}
</style>
