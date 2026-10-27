<script setup lang="ts">
import { computed, watch } from 'vue'
import { useSignals } from '../../composables/useSignals'
import { useWatchlist } from '../../composables/useWatchlist'
import { useAuth } from '../../composables/useAuth'
import { useStockSectors } from '../../composables/useStockSectors'
import { useStockPerformance } from '../../composables/useStockPerformance'
import { formatTime } from '../../lib/domain'
import PageHeader from '../ui/PageHeader.vue'
import EmptyState from '../ui/EmptyState.vue'
import ScanForm from './ScanForm.vue'
import SignalTable from './SignalTable.vue'
const auth = useAuth()
const pool = useWatchlist()
const { today, date, mode, codesText, history, historyError, result, run, loading, scanning, unscanned, error, notices, selected, copyMessage, rows, selectDate, start, copy, loadHistory } = useSignals()
const { sectors, failed: sectorsFailed, retry: retrySectors } = useStockSectors(rows)
const { performance, failed: performanceFailed, retry: retryPerformance } = useStockPerformance(rows, date)
const chosen = computed(() => rows.value.filter((item) => selected.value.includes(item.code)))
const progress = computed(() => run.value?.total ? Math.min(100, Math.round(run.value.checked / run.value.total * 100)) : 0)
watch(pool.codes, (codes) => { selected.value = selected.value.filter((code) => !codes.has(code)) })
watch(() => auth.state.user?.id, () => { selected.value = [] })
async function add() { if (result.value && chosen.value.length) await pool.add(chosen.value, result.value.date) }
</script>
<template>
  <PageHeader
    eyebrow="SIGNAL SCREENER"
    title="发现信号，建立观察。"
    description="从沪深主板筛选 B 信号，将值得关注的股票加入你的观察池。"
  >
    <router-link
      to="/watchlist"
      class="button secondary"
    >
      查看观察池 →
    </router-link>
  </PageHeader>
  <div class="stats-grid">
    <div class="stat-card">
      <span>当前查询日期</span><strong class="date-stat">{{ date }}</strong><small>{{ result ? '已有缓存结果' : scanning ? '正在扫描' : '按日查询信号' }}</small>
    </div><div class="stat-card">
      <span>B 信号命中</span><strong>{{ result ? result.found : '—' }}<small>只</small></strong><small>{{ result ? `已检查 ${result.checked} / ${result.total} 只` : '完成查询后展示' }}</small>
    </div><div class="stat-card accent-stat">
      <span>我的观察池</span><strong>{{ auth.state.user && !pool.state.loading && !pool.state.error ? pool.state.items.length : '—' }}<small>只</small></strong><small>{{ auth.state.user ? pool.state.error ? '读取失败，请重试' : pool.state.loading ? '正在读取' : `${pool.triggered.value} 只已触发 S 信号` : '登录后同步个人清单' }}</small>
    </div>
  </div>
  <ScanForm
    v-model:mode="mode"
    v-model:codes-text="codesText"
    :date="date"
    :today="today"
    :busy="loading || scanning"
    :authenticated="!!auth.state.user"
    @date-change="selectDate"
    @scan="start"
  />
  <div
    v-if="scanning"
    class="scan-progress"
    role="status"
  >
    <div><strong>服务端扫描中</strong><span>{{ run ? `${run.checked} / ${run.total || '准备中'}` : '正在获取进度…' }}</span></div><progress
      :value="progress"
      max="100"
    /><p>可以离开本页。当前任务链接可用于返回查看进度。</p>
  </div>
  <div
    v-if="error"
    class="notice error"
    role="alert"
  >
    {{ error }}<button
      class="text-button"
      @click="selectDate(date)"
    >
      重新查询
    </button>
  </div>
  <div
    v-if="pool.state.error && auth.state.user"
    class="notice error"
    role="alert"
  >
    {{ pool.state.error }}<button
      class="text-button"
      @click="pool.load"
    >
      重试观察池查询
    </button>
  </div>
  <div
    v-if="pool.state.message"
    class="notice success"
    role="status"
  >
    {{ pool.state.message }}
  </div>
  <div
    v-for="notice in notices"
    :key="notice"
    class="notice"
  >
    {{ notice }}
  </div>
  <div
    v-if="result?.failedCodes.length"
    class="notice"
  >
    {{ result.failedCodes.length }} 只股票读取失败，本次结果可能不完整。
  </div>
  <section class="panel results-panel">
    <div class="section-heading results-heading">
      <div>
        <h2>
          筛选结果 <span
            v-if="result"
            class="count-badge"
          >{{ rows.length }}</span>
        </h2><p>{{ result ? `更新时间 ${formatTime(result.scannedAt)} · 信号来源：新浪财经` : '查询后展示当日 B 信号股票' }}</p>
        <p
          v-if="rows.length"
          class="sector-source"
        >
          板块来源：东方财富 · 当前归属，非历史快照
          <button
            v-if="sectorsFailed"
            class="text-button"
            @click="retrySectors"
          >
            重试板块查询
          </button>
        </p>
        <p
          v-if="rows.length"
          class="sector-source"
        >
          当日涨幅对应 {{ date }}；距今涨幅从该日收盘起算 · 腾讯行情 / 前复权 · 每 30 秒更新
          <button
            v-if="performanceFailed"
            class="text-button"
            @click="retryPerformance"
          >
            重试涨幅查询
          </button>
        </p>
      </div><div class="result-actions">
        <button
          v-if="rows.length"
          class="button secondary compact"
          @click="copy"
        >
          复制代码
        </button><button
          v-if="rows.length && auth.state.user"
          class="button primary compact"
          :disabled="!selected.length || pool.state.busy || scanning || loading"
          @click="add"
        >
          {{ pool.state.busy ? '处理中…' : `加入观察池${selected.length ? ` (${selected.length})` : ''}` }}
        </button>
      </div>
    </div>
    <p
      v-if="copyMessage"
      class="inline-feedback"
      role="status"
    >
      {{ copyMessage }}
    </p>
    <div
      v-if="loading && !scanning"
      class="loading-state"
      role="status"
    >
      <span class="spinner" />正在读取信号数据…
    </div>
    <SignalTable
      v-else-if="rows.length && result"
      v-model="selected"
      :rows="rows"
      :sectors="sectors"
      :performance="performance"
      :authenticated="!!auth.state.user"
      :pooled="pool.codes.value"
      :busy="pool.state.busy"
    />
    <EmptyState
      v-else-if="unscanned"
      title="该日期尚未扫描"
      description="选择已有历史日期，或登录后发起扫描。"
    />
    <EmptyState
      v-else-if="result"
      title="当日没有命中 B 信号"
      description="你可以查看其他日期，或改变扫描范围。"
    />
    <EmptyState
      v-else
      :title="scanning ? '正在发现信号' : error ? '暂时无法展示结果' : '选择日期，开始观察'"
      description="结果将在查询或扫描完成后显示。"
    />
    <div
      v-if="rows.length && auth.state.user"
      class="table-note"
    >
      单次最多选择 100 只；观察池总容量为 100 只。
    </div>
  </section>
  <section class="history-section">
    <div><h2>历史扫描</h2><p>仅展示已完成的扫描日期</p></div><select
      v-if="history.length"
      aria-label="历史扫描日期"
      :value="date"
      :disabled="loading || scanning"
      @change="selectDate(($event.target as HTMLSelectElement).value)"
    >
      <option
        v-if="!history.some((item) => item.date === date)"
        :value="date"
      >
        {{ date }} · 当前查询
      </option><option
        v-for="item in history"
        :key="item.date"
        :value="item.date"
      >
        {{ item.date }} · B {{ item.found }} 只
      </option>
    </select><span
      v-else
      class="muted"
    >{{ historyError || '暂无历史扫描记录' }}</span><button
      v-if="historyError"
      class="text-button"
      @click="loadHistory"
    >
      重试
    </button>
  </section>
</template>

<style scoped>
.sector-source {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
}
</style>
