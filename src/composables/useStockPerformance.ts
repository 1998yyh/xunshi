import { computed, shallowRef, watch, type Ref } from 'vue'
import { stockApi } from '../lib/api'
import type { Stock, StockPerformance } from '../types'

export function useStockPerformance(rows: Ref<readonly Stock[]>, date: Ref<string>) {
  const performance = shallowRef<ReadonlyMap<string, StockPerformance>>(new Map())
  const retryKey = shallowRef(0)
  const failed = computed(() => [...performance.value.values()].some((item) => item.dayPercent === null || (item.sincePercent === null && item.sinceReason !== '基准日未收盘')))

  watch([rows, date, retryKey], ([stocks, referenceDate], _previous, onCleanup) => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    onCleanup(() => { controller.abort(); clearTimeout(timer) })
    performance.value = new Map()
    const codes = [...new Set(stocks.map((item) => item.code))]
    function schedule() {
      if (codes.length && !controller.signal.aborted) timer = setTimeout(() => {
        if (document.visibilityState === 'visible') void refresh()
        else schedule()
      }, 30000)
    }
    async function refresh() {
      const batches = Array.from({ length: Math.ceil(codes.length / 10) }, (_, index) => codes.slice(index * 10, index * 10 + 10))
      async function worker() {
        while (batches.length && !controller.signal.aborted) {
          const batch = batches.shift()!
          let items: StockPerformance[] = []
          try {
            const data = await stockApi.performance(referenceDate, batch, controller.signal)
            if (Array.isArray(data.items)) items = data.items
          } catch { /* 保留股票结果，逐只标记报价缺失。 */ }
          if (controller.signal.aborted) return
          const next = new Map(performance.value)
          for (const code of batch) next.set(code, items.find((item) => item.code === code && item.date === referenceDate) ?? {
            code, date: referenceDate, dayPercent: null, sincePercent: null,
            dayReason: '行情暂不可用', sinceReason: '行情暂不可用', quoteAsOf: null,
            source: 'tencent', adjustment: 'qfq', fetchedAt: new Date().toISOString(),
          })
          performance.value = next
        }
      }
      await Promise.all([worker(), worker()])
      schedule()
    }
    if (codes.length) void refresh()
  }, { immediate: true })

  return { performance, failed, retry: () => { retryKey.value++ } }
}
