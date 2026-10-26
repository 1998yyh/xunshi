import test from 'node:test'
import assert from 'node:assert/strict'
import { chinaToday, validDate, parseCodes, safeRedirect } from '../src/lib/domain.ts'

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
