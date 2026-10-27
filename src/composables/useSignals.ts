import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { stockApi } from '../lib/api'
import { ApiError } from '../lib/http'
import { chinaToday, isRecentScanDate, parseCodes } from '../lib/domain'
import { session } from '../lib/session'
import type { HistoryDate, ScanRun, Signals, Stock } from '../types'

export function useSignals() {
  const route = useRoute()
  const router = useRouter()
  const today = chinaToday()
  const date = shallowRef(isRecentScanDate(String(route.query.date), today) ? String(route.query.date) : today)
  const mode = shallowRef<'market' | 'codes'>('market')
  const codesText = shallowRef('')
  const history = shallowRef<HistoryDate[]>([])
  const historyError = shallowRef('')
  const result = shallowRef<Signals | null>(null)
  const run = shallowRef<ScanRun | null>(null)
  const loading = shallowRef(false)
  const scanning = shallowRef(false)
  const unscanned = shallowRef(false)
  const error = shallowRef('')
  const notices = shallowRef<string[]>([])
  const selected = shallowRef<string[]>([])
  const copyMessage = shallowRef('')
  let revision = 0
  let current: AbortController | null = null
  const historyController = new AbortController()
  function begin() {
    current?.abort(); current = new AbortController(); revision++
    loading.value = true; scanning.value = false; run.value = null
    result.value = null; unscanned.value = false; error.value = ''; notices.value = []; selected.value = []; copyMessage.value = ''
    return { seq: revision, signal: current.signal }
  }
  async function loadHistory() {
    try {
      const entries = await stockApi.history(historyController.signal)
      history.value = entries.filter((item) => isRecentScanDate(item.date, today))
      historyError.value = ''
    }
    catch { if (!historyController.signal.aborted) historyError.value = '历史日期暂时无法读取，可直接选择日期查询' }
  }
  async function loadDate(value: string) {
    if (!isRecentScanDate(value, today)) { error.value = '请选择最近 30 天内的有效日期（含今天）'; return }
    date.value = value
    const { seq, signal } = begin()
    try { const data = await stockApi.results(value, signal); if (seq === revision) result.value = data }
    catch (e) {
      if (seq !== revision || signal.aborted) return
      if (e instanceof ApiError && e.status === 404) unscanned.value = true
      else error.value = e instanceof Error ? e.message : '查询失败，请重试'
    } finally { if (seq === revision) loading.value = false }
  }
  function updateUrl(extra: Record<string, string> = {}) {
    void router.replace({ query: { date: date.value, ...extra } })
  }
  async function selectDate(value: string) { await loadDate(value); if (date.value === value) updateUrl() }
  function applyRun(value: ScanRun, items: Stock[]) {
    result.value = { date: value.queryDate, items, found: value.found, checked: value.checked, total: value.total, failedCodes: value.failedCodes ?? [], scannedAt: value.updatedAt }
  }
  async function follow(id: string, seq: number, signal: AbortSignal) {
    scanning.value = true
    while (!signal.aborted && seq === revision) {
      const data = await stockApi.run(id, signal)
      if (seq !== revision || signal.aborted) return
      run.value = data.run
      date.value = data.run.queryDate
      if (data.run.status === 'failed') throw new Error('扫描任务失败，请重新扫描')
      if (data.run.status === 'done') {
        applyRun(data.run, data.items ?? []); run.value = null; scanning.value = false
        updateUrl(); void loadHistory(); return
      }
      // 轮询等待也响应取消，离开页面只停止前端跟踪，服务端任务继续运行。
      await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(new DOMException('已取消', 'AbortError')) }
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, 2000)
        signal.addEventListener('abort', abort, { once: true })
      })
    }
  }
  async function start(refresh = false) {
    if (loading.value || scanning.value) return
    if (!session.user) { await router.push({ path: '/login', query: { redirect: route.fullPath } }); return }
    if (!isRecentScanDate(date.value, today)) { error.value = '请选择最近 30 天内的有效日期（含今天）'; return }
    let codes: string[] | undefined
    try { if (mode.value === 'codes') codes = parseCodes(codesText.value) }
    catch (e) { error.value = (e as Error).message; return }
    const { seq, signal } = begin()
    try {
      const data = await stockApi.scan({ date: date.value, codes, refresh }, signal)
      if (seq !== revision || signal.aborted) return
      if (data.result) {
        const value = data.result
        result.value = { date: value.date, items: value.items, found: value.items.length, checked: value.cachedCount + value.fetchedCount, total: value.requested, failedCodes: value.failed, scannedAt: new Date().toISOString() }
        if (value.invalid.length) notices.value = [`已跳过无效代码：${value.invalid.join('、')}`]
        updateUrl()
      } else if (data.cached) { await loadDate(date.value); void loadHistory() }
      else if (data.run) { updateUrl({ run: data.run.id }); await follow(data.run.id, seq, signal) }
      else throw new Error('扫描响应缺少结果，请重试')
    } catch (e) {
      if (seq === revision && !signal.aborted) error.value = e instanceof Error ? e.message : '扫描失败，请重试'
    } finally { if (seq === revision) { loading.value = false; scanning.value = false } }
  }
  async function resume(id: string) {
    const { seq, signal } = begin()
    try { await follow(id, seq, signal) }
    catch (e) { if (seq === revision && !signal.aborted) error.value = e instanceof Error ? e.message : '无法恢复扫描任务' }
    finally { if (seq === revision) { loading.value = false; scanning.value = false } }
  }
  const rows = computed(() => result.value?.items ?? [])
  async function copy() {
    try { await navigator.clipboard.writeText(rows.value.map((item) => item.code).join(',')); copyMessage.value = `已复制 ${rows.value.length} 个代码` }
    catch { copyMessage.value = '复制失败，请手动选择代码复制' }
  }
  // 查询日期与 URL 双向同步，使刷新、分享和浏览器前进后退保持同一日期。
  watch(() => route.query.date, (value) => {
    if (typeof value !== 'string') return
    if (!isRecentScanDate(value, today)) { void selectDate(history.value[0]?.date ?? today); return }
    if (value !== date.value) void loadDate(value)
  })
  void (async () => {
    const initialRevision = revision
    await loadHistory()
    if (historyController.signal.aborted || initialRevision !== revision) return
    if (typeof route.query.run === 'string') { await resume(route.query.run); return }
    const recentDate = typeof route.query.date === 'string' && isRecentScanDate(route.query.date, today)
    if (!recentDate) date.value = history.value[0]?.date ?? today
    await loadDate(date.value)
    if (route.query.date && !recentDate) updateUrl()
  })()
  onScopeDispose(() => { revision++; current?.abort(); historyController.abort() })
  return { today, date, mode, codesText, history, historyError, result, run, loading, scanning, unscanned, error, notices, selected, copyMessage, rows, selectDate, start, copy, loadHistory }
}
