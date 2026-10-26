<script setup lang="ts">
import { computed } from 'vue'
import type { Stock } from '../../types'
const selected = defineModel<string[]>({ required: true })
const props = defineProps<{ rows: readonly Stock[]; date: string; authenticated: boolean; pooled: Set<string>; busy: boolean }>()
const available = computed(() => props.rows.filter((item) => !props.pooled.has(item.code)))
const all = computed(() => available.value.length > 0 && available.value.slice(0, 100).every((item) => selected.value.includes(item.code)))
function toggle(code: string) { selected.value = selected.value.includes(code) ? selected.value.filter((v) => v !== code) : [...selected.value, code] }
function toggleAll() { selected.value = all.value ? [] : available.value.slice(0, 100).map((item) => item.code) }
</script>
<template>
  <div class="table-scroll">
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
          </th><th>股票</th><th>市场</th><th>信号日期</th><th>信号</th><th>观察状态</th>
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
          </td><td><strong class="stock-name">{{ item.name || '未命名股票' }}</strong><span class="stock-code">{{ item.code }}</span></td><td><span class="market-tag">{{ item.market.toUpperCase() }}</span></td><td class="mono">
            {{ date }}
          </td><td><span class="signal-badge b">B <small>信号值 1</small></span></td><td>
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
