import { computed, shallowRef, watch, type Ref } from 'vue'
import { stockApi } from '../lib/api'
import type { Stock, StockSectors } from '../types'

export function useStockSectors(rows: Ref<readonly Stock[]>) {
  const sectors = shallowRef<ReadonlyMap<string, StockSectors>>(new Map())
  const retryKey = shallowRef(0)
  const failed = computed(() => [...sectors.value.values()].some((item) => item.status === 'unavailable'))

  watch([rows, retryKey], ([stocks], _previous, onCleanup) => {
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    sectors.value = new Map()
    const codes = [...new Set(stocks.map((item) => item.code))]
    const batches = Array.from({ length: Math.ceil(codes.length / 25) }, (_, index) => codes.slice(index * 25, index * 25 + 25))
    // 两个工作流分批取数，板块响应不阻塞筛选结果及选股操作。
    async function loadBatches() {
      while (batches.length && !controller.signal.aborted) {
        const batch = batches.shift()!
        let items: StockSectors[] = []
        try {
          const data = await stockApi.sectors(batch, controller.signal)
          if (Array.isArray(data.items)) items = data.items
        }
        catch { /* 每只股票明确标记缺失，不能将失败当成没有板块。 */ }
        if (controller.signal.aborted) return
        const next = new Map(sectors.value)
        for (const code of batch) {
          next.set(code, items.find((item) => item.code === code) ?? {
            code, industries: [], concepts: [], status: 'unavailable', source: 'eastmoney', fetchedAt: null,
          })
        }
        sectors.value = next
      }
    }
    void loadBatches()
    void loadBatches()
  }, { immediate: true })

  return { sectors, failed, retry: () => { retryKey.value++ } }
}
