import test from 'node:test'
import { sortSignalRows, nextSignalSort, signalSortOrder, type SignalSort } from '../src/lib/signal-sort.ts'
import type { StockPerformance, StockSectors } from '../src/types.ts'
import assert from 'node:assert/strict'
import { chinaToday, validDate, isRecentScanDate, parseCodes, safeRedirect } from '../src/lib/domain.ts'

test('上海跨日与合法日期校验', () => {
  assert.equal(chinaToday(new Date('2026-10-25T16:30:00Z')), '2026-10-26')
  assert.equal(validDate('2024-02-29', '2026-10-26'), true)
  for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-1-01', '2026-10-27', '']) assert.equal(validDate(date, '2026-10-26'), false)
})
test('批量代码支持中文分隔符并拒绝空值、非法格式和超限', () => {
  assert.deepEqual(parseCodes('600519，SZ000001; 600519\n002292'), ['600519', 'sz000001', '002292'])
  assert.throws(() => parseCodes('  '), /至少一个/)
  assert.throws(() => parseCodes('123,abc'), /六位/)
  assert.throws(() => parseCodes(Array.from({ length: 501 }, (_, i) => String(i).padStart(6, '0')).join(',')), /500/)
})
test('登录回跳只允许两个业务页面，拦截外部网址与登录循环', () => {
  assert.equal(safeRedirect('/signals?date=2026-09-10'), '/signals?date=2026-09-10')
  assert.equal(safeRedirect('/watchlist'), '/watchlist')
  for (const value of ['https://example.com', '//example.com', '/\\example.com', '/login', '/unknown', null, ['/watchlist']]) assert.equal(safeRedirect(value), '/signals')
})

test('涨幅排序按数值比较，零有效，缺失/非有限值始终置后且同值稳定', () => {
  const rows = ['missing', 'zero', 'up', 'down', 'tie', 'invalid', 'pending'].map((code) => ({ code, market: 'sh', name: code }))
  const performance = new Map<string, StockPerformance>([
    ['zero', quote('zero', 0, -2)], ['up', quote('up', 12.34, 3)],
    ['down', quote('down', -3, 100)], ['tie', quote('tie', 12.34, 3)],
    ['invalid', quote('invalid', Number.NaN, Number.POSITIVE_INFINITY)], ['pending', quote('pending', null, null)],
  ])
  const codes = (sort: SignalSort) => sortSignalRows(rows, sort, performance, new Map()).map((item) => item.code)
  assert.deepEqual(codes('day-desc'), ['up', 'tie', 'zero', 'down', 'missing', 'invalid', 'pending'])
  assert.deepEqual(codes('day-asc'), ['down', 'zero', 'up', 'tie', 'missing', 'invalid', 'pending'])
  assert.deepEqual(codes('since-desc'), ['down', 'up', 'tie', 'zero', 'missing', 'invalid', 'pending'])
  assert.deepEqual(codes('since-asc'), ['zero', 'up', 'tie', 'down', 'missing', 'invalid', 'pending'])
  assert.strictEqual(sortSignalRows(rows, 'default', performance, new Map()), rows)
  assert.deepEqual(rows.map((item) => item.code), ['missing', 'zero', 'up', 'down', 'tie', 'invalid', 'pending'])
  // 仅一列有数据时，两种涨幅独立判断缺失。
  performance.set('pending', quote('pending', null, 200))
  assert.equal(codes('since-desc')[0], 'pending')
  assert.equal(codes('day-desc').at(-1), 'pending')
})

test('板块按明确 level=1 的行业名称拼音排序，不使用二级、概念或失败数据', () => {
  const rows = ['bank', 'missing', 'food', 'power', 'tie', 'secondary', 'failed'].map((code) => ({ code, market: 'sh', name: code }))
  const sectors = new Map<string, StockSectors>([
    ['bank', sector('bank', [{ code: '2', name: '白酒', level: 2 }, { code: '1', name: '银行', level: 1 }])],
    ['food', sector('food', [{ code: '1', name: '食品饮料', level: 1 }])],
    ['power', sector('power', [{ code: '1', name: '电力', level: 1 }])],
    ['tie', sector('tie', [{ code: '1', name: '食品饮料', level: 1 }])],
    ['secondary', sector('secondary', [{ code: '2', name: '半导体', level: 2 }])],
    ['failed', { ...sector('failed', [{ code: '1', name: '保险', level: 1 }]), status: 'unavailable' }],
  ])
  assert.deepEqual(sortSignalRows(rows, 'industry-asc', new Map(), sectors).map((row) => row.code), ['power', 'food', 'tie', 'bank', 'missing', 'secondary', 'failed'])
  assert.deepEqual(sortSignalRows(rows, 'industry-desc', new Map(), sectors).map((row) => row.code), ['bank', 'food', 'tie', 'power', 'missing', 'secondary', 'failed'])
})

test('表头排序三态循环，涨幅先降序，板块先升序，切换列重新开始', () => {
  assert.equal(nextSignalSort('default', 'day'), 'day-desc')
  assert.equal(nextSignalSort('day-desc', 'day'), 'day-asc')
  assert.equal(nextSignalSort('day-asc', 'day'), 'default')
  assert.equal(nextSignalSort('day-asc', 'since'), 'since-desc')
  assert.equal(nextSignalSort('default', 'industry'), 'industry-asc')
  assert.equal(nextSignalSort('industry-asc', 'industry'), 'industry-desc')
  assert.equal(nextSignalSort('industry-desc', 'industry'), 'default')
  assert.equal(signalSortOrder('day-desc', 'day'), 'descending')
  assert.equal(signalSortOrder('industry-asc', 'industry'), 'ascending')
  assert.equal(signalSortOrder('since-asc', 'day'), 'none')
})

function quote(code: string, dayPercent: number | null, sincePercent: number | null): StockPerformance {
  return { code, dayPercent, sincePercent, date: '2026-09-10', dayReason: null, sinceReason: null, quoteAsOf: null, source: 'eastmoney', adjustment: 'qfq', fetchedAt: '2026-10-27T00:00:00Z' }
}
function sector(code: string, industries: StockSectors['industries']): StockSectors {
  return { code, industries, concepts: [{ code: 'concept', name: '保险' }], status: 'ready', source: 'eastmoney', fetchedAt: null }
}


test('历史扫描只包含今天在内的近 30 个自然日，跨月跨年及闰年边界准确', () => {
  assert.equal(isRecentScanDate('2026-10-27', '2026-10-27'), true)
  assert.equal(isRecentScanDate('2026-09-28', '2026-10-27'), true)
  for (const value of ['2026-09-27', '2026-10-28', '2026-09-31', '', '2026-9-28']) assert.equal(isRecentScanDate(value, '2026-10-27'), false)
  assert.equal(isRecentScanDate('2025-12-03', '2026-01-01'), true)
  assert.equal(isRecentScanDate('2025-12-02', '2026-01-01'), false)
  assert.equal(isRecentScanDate('2024-02-01', '2024-03-01'), true)
  assert.equal(isRecentScanDate('2024-01-31', '2024-03-01'), false)
  assert.equal(isRecentScanDate('2024-02-29', '2024-03-01'), true)
})
