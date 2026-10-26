<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useAuth } from '../../composables/useAuth'
import { useWatchlist } from '../../composables/useWatchlist'
import PageHeader from '../ui/PageHeader.vue'
import EmptyState from '../ui/EmptyState.vue'
import WatchlistTable from './WatchlistTable.vue'
const auth = useAuth()
const pool = useWatchlist()
const filter = shallowRef<'all' | 'watching' | 'triggered'>('all')
const search = shallowRef('')
const visible = computed(() => pool.state.items.filter((item) => (filter.value === 'all' || item.status === filter.value) && `${item.code} ${item.name}`.toLowerCase().includes(search.value.trim().toLowerCase())))
</script>
<template>
  <PageHeader
    eyebrow="PERSONAL WATCHLIST"
    title="把关注，留在观察池。"
    description="跟踪入池后的信号变化，触发 S 信号时优先展示。"
  >
    <router-link
      to="/signals"
      class="button primary"
    >
      去筛选股票 →
    </router-link>
  </PageHeader>
  <section
    v-if="!auth.state.user"
    class="panel guest-panel"
  >
    <EmptyState
      title="登录，开始你的长期观察"
      description="使用现有团子账号，同步已关注股票与信号状态。"
    >
      <router-link
        to="/login?redirect=/watchlist"
        class="button primary"
      >
        登录并查看观察池
      </router-link>
    </EmptyState>
  </section>
  <template v-else>
    <div class="stats-grid">
      <div class="stat-card">
        <span>池内股票</span><strong>{{ pool.state.loading || pool.state.error ? '—' : pool.state.items.length }}<small>/ 100</small></strong><small>按账户独立保存</small>
      </div><div class="stat-card">
        <span>持续观察</span><strong>{{ pool.state.loading || pool.state.error ? '—' : pool.state.items.length - pool.triggered.value }}<small>只</small></strong><small>入池后尚未出现 S 信号</small>
      </div><div class="stat-card warning-stat">
        <span>S 信号触发</span><strong>{{ pool.state.loading || pool.state.error ? '—' : pool.triggered.value }}<small>只</small></strong><small>已触发的股票会优先展示</small>
      </div>
    </div>
    <div
      v-if="pool.state.error"
      class="notice error"
      role="alert"
    >
      {{ pool.state.error }}<button
        class="text-button"
        @click="pool.load"
      >
        重新加载
      </button>
    </div>
    <div
      v-if="pool.state.message"
      class="notice success"
      role="status"
    >
      {{ pool.state.message }}
    </div>
    <section class="panel">
      <div class="section-heading">
        <div><h2>我的观察清单</h2><p>交易日 10:00 与 14:50 由服务端自动检查。</p></div><button
          class="button secondary compact"
          :disabled="pool.state.busy || pool.state.loading || !pool.state.items.length"
          @click="pool.check"
        >
          {{ pool.state.busy ? '处理中…' : '立即检查' }}
        </button>
      </div>
      <div class="watchlist-toolbar">
        <div
          class="filter-tabs"
          role="group"
          aria-label="观察状态"
        >
          <button
            :aria-pressed="filter === 'all'"
            @click="filter = 'all'"
          >
            全部
          </button><button
            :aria-pressed="filter === 'watching'"
            @click="filter = 'watching'"
          >
            持续观察
          </button><button
            :aria-pressed="filter === 'triggered'"
            @click="filter = 'triggered'"
          >
            S 已触发
          </button>
        </div><input
          v-model="search"
          type="search"
          aria-label="搜索观察池"
          placeholder="搜索名称或代码"
        >
      </div>
      <div
        v-if="pool.state.loading"
        class="loading-state"
        role="status"
      >
        <span class="spinner" />正在同步观察池…
      </div>
      <WatchlistTable
        v-else-if="pool.state.items.length"
        :items="visible"
        :busy="pool.state.busy"
        @remove="pool.remove"
      />
      <EmptyState
        v-else
        :title="pool.state.error ? '观察池暂时无法读取' : '你的观察池还是空的'"
        description="在信号筛选中勾选股票，即可加入并持续跟踪。"
      >
        <router-link
          to="/signals"
          class="button secondary"
        >
          前往信号筛选
        </router-link>
      </EmptyState>
    </section>
  </template>
</template>
