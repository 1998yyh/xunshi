<script setup lang="ts">
import UiIcon from '../ui/UiIcon.vue'
const mode = defineModel<'market' | 'codes'>('mode', { required: true })
const codesText = defineModel<string>('codesText', { required: true })
defineProps<{ date: string; today: string; busy: boolean; authenticated: boolean }>()
const emit = defineEmits<{ dateChange: [date: string]; scan: [refresh: boolean] }>()
</script>
<template>
  <section class="panel scan-form">
    <div class="section-heading">
      <div><h2>筛选条件</h2><p>选定日期与范围，查看缓存或发起新的扫描。</p></div><span class="subtle-badge">沪深主板 · 非 ST</span>
    </div>
    <div class="form-row">
      <div class="date-field">
        <label for="signal-date">信号日期</label><input
          id="signal-date"
          type="date"
          :value="date"
          :max="today"
          :disabled="busy"
          @change="emit('dateChange', ($event.target as HTMLInputElement).value)"
        >
      </div>
      <fieldset class="scope-field">
        <legend>扫描范围</legend><div class="segmented-control">
          <label :class="{ selected: mode === 'market' }"><input
            v-model="mode"
            type="radio"
            name="scope"
            value="market"
            :disabled="busy"
          >全市场扫描</label><label :class="{ selected: mode === 'codes' }"><input
            v-model="mode"
            type="radio"
            name="scope"
            value="codes"
            :disabled="busy"
          >指定代码</label>
        </div>
      </fieldset>
      <button
        class="button primary scan-button"
        :disabled="busy"
        @click="emit('scan', false)"
      >
        <UiIcon
          name="search"
          :size="17"
        />{{ busy ? '处理中…' : authenticated ? '开始扫描' : '登录并扫描' }}
      </button>
    </div>
    <div
      v-if="mode === 'codes'"
      class="codes-field"
    >
      <label for="stock-codes">股票代码 <span>最多 500 个，逗号、空格或换行分隔</span></label><textarea
        id="stock-codes"
        v-model="codesText"
        :disabled="busy"
        placeholder="例如：600519, 000001, sz002292"
        rows="3"
        spellcheck="false"
      />
    </div>
    <div class="form-bottom">
      <p>查看历史缓存无需登录。全市场扫描在服务端运行，耗时取决于数据源。</p><button
        class="text-button"
        :disabled="busy"
        @click="emit('scan', true)"
      >
        忽略缓存，重新扫描
      </button>
    </div>
  </section>
</template>
