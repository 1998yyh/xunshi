<script setup lang="ts">
import { NButton } from 'naive-ui'
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
            <div class="row-actions">
              <span
                class="confirm-actions"
                :class="{ 'actions-hidden': confirming !== item.id }"
              ><NButton
                text
                type="error"
                class="text-button danger-text"
                :disabled="busy"
                @click="confirm(item.id)"
              >确认移除</NButton><NButton
                text
                class="text-button muted"
                @click="confirming = ''"
              >取消</NButton></span><NButton
                text
                class="text-button"
                :class="{ 'actions-hidden': confirming === item.id }"
                :disabled="busy"
                :aria-label="`移除 ${item.name || item.code}`"
                @click="confirming = item.id"
              >
                移除
              </NButton>
            </div>
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

<style scoped>
.row-actions {
  display: inline-grid;
  align-items: center;
  justify-items: end;
}

.row-actions > * {
  grid-area: 1 / 1;
}

/* 两种操作共享占位，切换时保留较宽一组的尺寸。 */
.actions-hidden {
  visibility: hidden;
}

@media (max-width: 800px) {
  .stock-name {
    line-height: 1.4;
  }

  .stock-code {
    line-height: 1.2;
  }
}
</style>
