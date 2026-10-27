/** 日期按上海时区计算，避免部署机器时区改变默认查询日。 */
export function chinaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (key: string) => parts.find((p) => p.type === key)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function validDate(value: string, today = chinaToday()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value && value <= today
}
/** 历史列表按上海日期保留含今天在内的最近 30 个自然日。 */
export function isRecentScanDate(value: string, today = chinaToday()): boolean {
  if (!validDate(value, today)) return false
  const earliest = new Date(`${today}T00:00:00Z`)
  earliest.setUTCDate(earliest.getUTCDate() - 29)
  return value >= earliest.toISOString().slice(0, 10)
}
export function parseCodes(text: string): string[] {
  const codes = [...new Set(text.split(/[\s,，;；]+/).filter(Boolean).map((s) => s.toLowerCase()))]
  if (!codes.length) throw new Error('请输入至少一个股票代码')
  if (codes.length > 500) throw new Error('单次最多扫描 500 个代码')
  if (codes.some((code) => !/^(sh|sz)?\d{6}$/.test(code))) throw new Error('请使用六位股票代码，可带 sh 或 sz 前缀')
  return codes
}
export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/signals'
  return ['/signals', '/watchlist'].includes(value.split(/[?#]/)[0] ?? '') ? value : '/signals'
}
export function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}
