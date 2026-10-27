import type { Stock, StockPerformance, StockSectors } from '../types.ts'

export type SignalSortColumn = 'day' | 'since' | 'industry'
export type SignalSort = 'default' | `${SignalSortColumn}-${'asc' | 'desc'}`
export type SignalSortOrder = 'none' | 'ascending' | 'descending'

const industryCollator = new Intl.Collator('zh-CN', { sensitivity: 'base' })

export function signalSortOrder(sort: SignalSort, column: SignalSortColumn): SignalSortOrder {
  return !sort.startsWith(`${column}-`) ? 'none' : sort.endsWith('-asc') ? 'ascending' : 'descending'
}

export function nextSignalSort(sort: SignalSort, column: SignalSortColumn): SignalSort {
  const first = column === 'industry' ? 'asc' : 'desc'
  if (sort === `${column}-${first}`) return `${column}-${first === 'asc' ? 'desc' : 'asc'}`
  return signalSortOrder(sort, column) === 'none' ? `${column}-${first}` : 'default'
}

export function sortSignalRows(
  rows: readonly Stock[],
  sort: SignalSort,
  performance: ReadonlyMap<string, StockPerformance>,
  sectors: ReadonlyMap<string, StockSectors>,
): readonly Stock[] {
  if (sort === 'default') return rows
  const direction = sort.endsWith('-asc') ? 1 : -1
  const industry = sort.startsWith('industry-')
  const entries = rows.map((stock, index) => {
    const sector = sectors.get(stock.code)
    const name = sector?.status === 'ready' ? sector.industries.find((item) => item.level === 1)?.name.trim() : undefined
    const quote = performance.get(stock.code)
    const percent = sort.startsWith('day-') ? quote?.dayPercent : quote?.sincePercent
    return { stock, index, value: industry ? name || null : typeof percent === 'number' && Number.isFinite(percent) ? percent : null }
  })
  entries.sort((a, b) => {
    // 缺失、待收盘与尚未加载的值在两个方向都排末尾，不能按零处理。
    if (a.value === null) return b.value === null ? a.index - b.index : 1
    if (b.value === null) return -1
    const comparison = typeof a.value === 'number' && typeof b.value === 'number'
      ? a.value - b.value
      : industryCollator.compare(String(a.value), String(b.value))
    return comparison * direction || a.index - b.index
  })
  return entries.map((item) => item.stock)
}
