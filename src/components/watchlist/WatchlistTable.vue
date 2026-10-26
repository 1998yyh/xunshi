<script setup lang="ts">
import { shallowRef } from 'vue'
import type { WatchItem } from '../../types'
import EmptyState from '../ui/EmptyState.vue'
defineProps<{ items: readonly WatchItem[]; busy: boolean }>()
const emit = defineEmits<{ remove: [id: string] }>()
const confirming = shallowRef('')
function confirm(id: string) { confirming.value = ''; emit('remove', id) }
</script>
<template>
  <div
    v-if="items.length"
    class="table-scroll watchlist-scroll"
  >
    <table class="data-table">
      <thead>
        <tr>
          <th>股票</th><th>入池信号日期</th><th>跟踪状态</th><th>S 信号日期</th><th class="align-right">
            操作
          </th>
        </tr>
      </thead><tbody>
        <tr
          v-for="item in items"
          :key="item.id"
          :class="{ 'triggered-row': item.status === 'triggered' }"
        >
          <td><strong class="stock-name">{{ item.name || '未命名股票' }}</strong><span class="stock-code">{{ item.market.toUpperCase() }} {{ item.code }}</span></td><td
            class="mono"
            data-label="入池信号日期"
          >
            {{ item.entrySignalDate }}
          </td><td data-label="跟踪状态">
            <span
              class="signal-badge"
              :class="item.status === 'triggered' ? 's' : 'watching'"
            >{{ item.status === 'triggered' ? 'S 已触发' : '持续观察' }}</span>
          </td><td
            class="mono"
            data-label="S 信号日期"
            :class="{ 'danger-text': item.status === 'triggered' }"
          >
            {{ item.triggeredSignalDate || '—' }}
          </td><td class="align-right">
            <span
              v-if="confirming === item.id"
              class="confirm-actions"
            ><button
              class="text-button danger-text"
              :disabled="busy"
              @click="confirm(item.id)"
            >确认移除</button><button
              class="text-button muted"
              @click="confirming = ''"
            >取消</button></span><button
              v-else
              class="text-button"
              :disabled="busy"
              :aria-label="`移除 ${item.name || item.code}`"
              @click="confirming = item.id"
            >
              移除
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <EmptyState
    v-else
    title="没有符合条件的股票"
    description="调整搜索内容或切换状态筛选。"
  />
</template>
