<script setup lang="ts">
import { NButton, NDatePicker, NInput, NRadioButton, NRadioGroup } from 'naive-ui'
import UiIcon from '../ui/UiIcon.vue'
import { isRecentScanDate } from '../../lib/domain'
const mode = defineModel<'market' | 'codes'>('mode', { required: true })
const codesText = defineModel<string>('codesText', { required: true })
const props = defineProps<{ date: string; today: string; busy: boolean; authenticated: boolean }>()
const emit = defineEmits<{ dateChange: [date: string]; scan: [refresh: boolean] }>()
function changeDate(value: string | [string, string] | null) {
  if (typeof value === 'string') emit('dateChange', value)
}
function isUnavailableDate(timestamp: number) {
  const day = new Date(timestamp)
  const value = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
  return !isRecentScanDate(value, props.today)
}
</script>
<template>
  <section class="panel scan-form">
    <div class="section-heading">
      <div><h2>筛选条件</h2><p>选定日期与范围，查看缓存或发起新的扫描。</p></div><span class="subtle-badge">沪深主板 · 非 ST</span>
    </div>
    <div class="form-row">
      <label class="date-field">
        <span class="field-label">信号日期</span><NDatePicker
          type="date"
          :formatted-value="date"
          value-format="yyyy-MM-dd"
          format="yyyy-MM-dd"
          :is-date-disabled="isUnavailableDate"
          :clearable="false"
          :disabled="busy"
          :actions="['now']"
          @update:formatted-value="changeDate"
        />
      </label>
      <fieldset class="scope-field">
        <legend>扫描范围</legend><NRadioGroup
          v-model:value="mode"
          class="scope-options"
          name="scope"
          aria-label="扫描范围"
          :disabled="busy"
        >
          <NRadioButton value="market">
            全市场扫描
          </NRadioButton>
          <NRadioButton value="codes">
            指定代码
          </NRadioButton>
        </NRadioGroup>
      </fieldset>
      <NButton
        type="primary"
        class="scan-button"
        :loading="busy"
        :disabled="busy"
        @click="emit('scan', false)"
      >
        <template #icon>
          <UiIcon
            name="search"
            :size="17"
          />
        </template>{{ busy ? '处理中…' : authenticated ? '开始扫描' : '登录并扫描' }}
      </NButton>
    </div>
    <div
      v-if="mode === 'codes'"
      class="codes-field"
    >
      <label for="stock-codes">股票代码 <span>最多 500 个，逗号、空格或换行分隔</span></label><NInput
        v-model:value="codesText"
        type="textarea"
        :input-props="{ id: 'stock-codes', spellcheck: false }"
        :disabled="busy"
        placeholder="例如：600519, 000001, sz002292"
        :autosize="{ minRows: 3, maxRows: 8 }"
      />
    </div>
    <div class="form-bottom">
      <p>查看历史缓存无需登录。全市场扫描在服务端运行，耗时取决于数据源。</p><NButton
        text
        class="text-button"
        :disabled="busy"
        @click="emit('scan', true)"
      >
        忽略缓存，重新扫描
      </NButton>
    </div>
  </section>
</template>

<style scoped>
.scope-options { display: flex; max-width: 300px; }
.scope-options :deep(.n-radio-button) { flex: 1; text-align: center; }
</style>
