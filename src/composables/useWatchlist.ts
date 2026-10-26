import { computed, onMounted, reactive, readonly, watch } from 'vue'
import { session } from '../lib/session'
import { stockApi } from '../lib/api'
import type { Stock, WatchItem } from '../types'

const state = reactive({ items: [] as WatchItem[], loading: false, busy: false, error: '', message: '' })
let query = 0
let controller: AbortController | null = null
function stopQuery() { query++; controller?.abort(); controller = null; state.loading = false }
async function load() {
  stopQuery()
  if (!session.user) return
  const seq = query
  const revision = session.revision
  controller = new AbortController()
  state.loading = true
  state.error = ''
  try {
    const result = await stockApi.watchlist(controller.signal)
    if (seq === query && revision === session.revision) state.items = result.items
  } catch (error) {
    if (seq === query && revision === session.revision) state.error = error instanceof Error ? error.message : '观察池加载失败'
  } finally { if (seq === query) state.loading = false }
}
// 身份变化先清空个人数据，再查询新账户，旧响应不得回填。
watch(() => session.revision, () => {
  stopQuery(); state.items = []; state.error = ''; state.message = ''; state.busy = false
})
watch(() => session.user?.id, () => { if (session.user) void load() }, { immediate: true })
async function mutate(action: () => Promise<{ items: WatchItem[]; message: string }>) {
  if (!session.user || state.busy) return
  stopQuery()
  const revision = session.revision
  state.busy = true; state.error = ''; state.message = ''
  try {
    const result = await action()
    if (revision !== session.revision) return
    state.items = result.items; state.message = result.message
  } catch (error) {
    if (revision === session.revision) state.error = error instanceof Error ? error.message : '操作失败，请重试'
  } finally { if (revision === session.revision) state.busy = false }
}
const triggered = computed(() => state.items.filter((item) => item.status === 'triggered').length)
const codes = computed(() => new Set(state.items.map((item) => item.code)))
export function useWatchlist() {
  onMounted(() => { if (session.user && !state.loading && !state.busy) void load() })
  return {
    state: readonly(state), triggered, codes, load,
    add: (items: readonly Stock[], date: string) => mutate(async () => {
      const result = await stockApi.add(items.map((item) => ({ ...item, entrySignalDate: date })))
      const notes = [`已加入 ${result.added.length} 只`]
      if (result.duplicated.length) notes.push(`${result.duplicated.length} 只已在池中`)
      if (result.invalid.length) notes.push(`${result.invalid.length} 只不符合规则`)
      if (result.overflow.length) notes.push(`${result.overflow.length} 只超出容量`)
      return { items: result.items, message: notes.join('；') }
    }),
    remove: (id: string) => mutate(async () => {
      await stockApi.remove(id)
      return { items: state.items.filter((item) => item.id !== id), message: '已从观察池移除' }
    }),
    check: () => mutate(async () => {
      const result = await stockApi.check()
      return { items: result.items, message: `检查完成：已检查 ${result.checked} 只，新增 ${result.triggered} 只 S 信号` }
    }),
  }
}
