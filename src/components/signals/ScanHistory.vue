<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NSelect } from 'naive-ui'
import UiIcon from '../ui/UiIcon.vue'
import { isRecentScanDate } from '../../lib/domain'

const props = defineProps<{
  date: string
  today: string
  history: readonly { date: string; found: number }[]
  busy: boolean
  error: string
}>()
const emit = defineEmits<{ select: [date: string]; retry: [] }>()
const options = computed(() => {
  const entries = props.history.map((item) => ({
    label: `${item.date} · B ${item.found} 只`,
    value: item.date,
  }))
  return !isRecentScanDate(props.date, props.today) || props.history.some((item) => item.date === props.date)
    ? entries
    : [{ label: `${props.date} · 当前查询`, value: props.date }, ...entries]
})
</script>

<template>
  <section class="history-section">
    <div class="history-description">
      <span class="history-icon"><UiIcon
        name="history"
        :size="19"
      /></span>
      <div><h2>历史扫描</h2><p>仅展示最近 30 天内已完成的扫描日期</p></div>
    </div>
    <NSelect
      v-if="history.length"
      class="history-select"
      aria-label="历史扫描日期"
      :value="isRecentScanDate(date, today) ? date : null"
      placeholder="选择最近 30 天的扫描日期"
      :options="options"
      :menu-props="{ role: 'listbox', 'aria-label': '历史扫描日期' }"
      :node-props="(option) => ({ role: 'option', 'aria-selected': option.value === date })"
      :disabled="busy"
      :consistent-menu-width="true"
      @update:value="emit('select', $event)"
    />
    <span
      v-else
      class="muted"
    >{{ error || '最近 30 天暂无历史扫描记录' }}</span>
    <NButton
      v-if="error"
      text
      @click="emit('retry')"
    >
      重试
    </NButton>
  </section>
</template>

<style scoped>
.history-section {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 24px;
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #ffffff80;
}
.history-description {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}
.history-icon {
  display: grid;
  place-items: center;
  flex: 0 0 38px;
  height: 38px;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 10px;
}
.history-select {
  width: 264px;
  flex: 0 0 264px;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 800px) {
  .history-section { flex-wrap: wrap; gap: 16px; padding: 18px; }
  .history-description { flex-basis: 100%; }
  .history-select { width: 100%; flex-basis: 100%; }
}
</style>
