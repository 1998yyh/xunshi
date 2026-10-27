import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'
import { chromium } from 'playwright'
const server = await createServer({ mode: process.env.TEST_DEPLOYMENT ? 'production' : 'test', server: { host: '127.0.0.1', port: 0, strictPort: true } })
let browser, page, releaseRemove, releaseSectors, releasePerformance
try {
  await server.listen()
  const base = server.resolvedUrls.local[0]
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, permissions: ['clipboard-read', 'clipboard-write'] })
  page = await context.newPage()
  page.setDefaultTimeout(10000)
  // 固定上海业务日期，避免历史窗口随运行日期漂移。
  await page.clock.install({ time: new Date('2026-09-10T04:00:00Z') })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const one = { code: '600519', market: 'sh', name: '测试甲' }
  const two = { code: '000001', market: 'sz', name: '测试乙' }
  const pools = { alice: [], bob: [] }
  let posts = 0, polls = 0, refreshes = 0, expire = false, denyRefresh = false
  let denyRemove = false, removeGate = null
  let failWatchlistCheck = false
  let denySectors = false
  let denyPerformance = false, performanceGate = null, pendingBaseline = false, useBackup = true, swappedQuotes = false
  const performanceRequests = []
  let onPerformanceRequest = () => {}
  let manyRows = null
  const sectorRequests = []
  let onSectorRequest = () => {}
  let sectorGate = new Promise((resolve) => { releaseSectors = resolve })
  const sectorData = [
    { code: one.code, industries: [{ code: 'BK0438', name: '食品饮料', level: 1 }, { code: 'BK0896', name: '白酒', level: 2 }], concepts: ['超级品牌', '电商概念', '乡村振兴', '央国企改革', '西部大开发'].map((name, index) => ({ code: `BK${index}`, name })), status: 'ready', source: 'eastmoney', fetchedAt: '2026-10-26T10:00:00Z' },
    { code: two.code, industries: [{ code: 'BK0475', name: '银行', level: 1 }], concepts: [], status: 'ready', source: 'eastmoney', fetchedAt: '2026-10-26T10:00:00Z' },
  ]
  const defaultHistory = [{ date: '2026-09-10', found: 2 }, { date: '2026-09-09', found: 0 }, { date: '2026-08-12', found: 1 }, { date: '2026-08-11', found: 99 }]
  let historyEntries = defaultHistory
  const seen = []
  const run = (status) => ({ id: 'test-run', queryDate: '2026-09-10', status, total: 2, checked: status === 'done' ? 2 : 1, found: 2, failedCodes: [], updatedAt: '2026-09-10T07:00:00Z' })
  const results = (date) => ({ date, items: date === '2026-09-09' ? [] : manyRows ?? [one, two], found: date === '2026-09-09' ? 0 : manyRows?.length ?? 2, checked: manyRows?.length ?? 2, total: manyRows?.length ?? 2, failedCodes: [], scannedAt: '2026-09-10T07:00:00Z' })
  await page.route('**/api/**', async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.replace(/^\/(?:xunshi\/)?api/, ''), method = req.method()
    const user = req.headers().authorization?.includes('bob') ? 'bob' : 'alice'
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (path === '/auth/login') { const name = req.postDataJSON().login; return reply({ accessToken: `access-${name}`, refreshToken: `refresh-${name}` }) }
    if (path === '/auth/refresh') {
      refreshes++
      await new Promise((resolve) => setTimeout(resolve, 100))
      if (denyRefresh) return reply({ message: 'refresh expired' }, 401)
      const owner = req.postDataJSON().refreshToken.includes('bob') ? 'bob' : 'alice'
      return reply({ accessToken: `renewed-${owner}`, refreshToken: `renewed-refresh-${owner}` })
    }
    if (expire && !req.headers().authorization?.startsWith('Bearer renewed-')) return reply({ message: 'access expired' }, 401)
    if (path === '/auth/profile') return reply({ id: user, username: user, email: `${user}@test.invalid`, role: 'user' })
    if (path === '/stock-signals/dates') return reply(historyEntries)
    if (path === '/stock-signals/performance') {
      const codes = url.searchParams.get('codes').split(','), date = url.searchParams.get('date')
      performanceRequests.push({ codes, date })
      onPerformanceRequest()
      const denied = denyPerformance, pending = pendingBaseline
      if (performanceGate) await performanceGate
      if (denied) return reply({ message: '行情来源暂不可用' }, 503)
      return reply({ items: codes.map((code, index) => ({ code, date,
        dayPercent: date === '2026-09-08' ? 2.5 : index % 2 === 0 ? 12.34 : 0,
        sincePercent: pending ? null : swappedQuotes ? index % 2 === 0 ? -8 : 9 : index % 2 === 0 ? 56.78 : -3.21,
        dayReason: null, sinceReason: pending ? '基准日未收盘' : null,
        quoteAsOf: '2026-10-27T02:00:00Z', source: useBackup && index % 2 === 1 ? 'tencent' : 'eastmoney', adjustment: 'qfq', fetchedAt: '2026-10-27T02:00:01Z',
      })) })
    }
    if (path === '/stock-signals/sectors') {
      const codes = url.searchParams.get('codes').split(',')
      sectorRequests.push(codes)
      onSectorRequest()
      const denied = denySectors
      if (sectorGate) await sectorGate
      if (denied) return reply({ message: '板块来源暂不可用' }, 503)
      return reply({ items: sectorData.filter((item) => codes.includes(item.code)) })
    }
    if (path === '/stock-signals') {
      const date = url.searchParams.get('date'); seen.push(date)
      if (date === '2026-09-08') await new Promise((resolve) => setTimeout(resolve, 300))
      if (date === '2026-09-07') return reply({ message: '尚未扫描' }, 404)
      if (date === '2026-09-04') return reply({ message: '数据源暂不可用' }, 503)
      return reply(results(date))
    }
    if (path === '/stock-signals/scans' && method === 'POST') {
      posts++
      const data = req.postDataJSON()
      if (data.codes) return reply({ result: { date: data.date, items: [one], requested: 1, cachedCount: 1, fetchedCount: 0, failed: [], invalid: [] } })
      if (!data.refresh) return reply({ cached: true, run: run('done') })
      polls = 0; return reply({ cached: false, run: run('running') })
    }
    if (path === '/stock-signals/scans/test-run') { polls++; return reply({ run: run(polls >= 2 ? 'done' : 'running'), ...(polls >= 2 ? { items: [one, two] } : {}) }) }
    if (path === '/stock-signals/scans/failed-run') return reply({ run: run('failed') })
    if (path === '/stock-watchlist' && method === 'GET') return reply({ items: pools[user] })
    if (path === '/stock-watchlist' && method === 'POST') {
      const added = req.postDataJSON().items.map((item) => ({ ...item, id: item.code, status: 'watching', triggeredSignalDate: null }))
      pools[user] = added; return reply({ items: added, added: added.map((item) => item.code), duplicated: [], invalid: [], overflow: [] })
    }
    if (path === '/stock-watchlist/check') {
      const watching = pools[user].filter((item) => item.status === 'watching')
      if (failWatchlistCheck) return reply({ checked: 0, triggered: 0, failed: watching.map((item) => `${item.market.toUpperCase()}${item.code}`), items: pools[user] })
      const triggered = watching.filter((item) => [one.code, '600396'].includes(item.code)).length
      pools[user] = pools[user].map((item) => item.status === 'watching' && [one.code, '600396'].includes(item.code) ? { ...item, status: 'triggered', triggeredSignalDate: item.code === '600396' ? '2026-09-15' : '2026-09-11' } : item)
      return reply({ checked: watching.length, triggered, failed: [], items: pools[user] })
    }
    if (path.startsWith('/stock-watchlist/') && method === 'DELETE') {
      if (removeGate) await removeGate
      if (denyRemove) return reply({ message: '移除失败，请稍后重试' }, 503)
      pools[user] = pools[user].filter((item) => item.id !== path.split('/').at(-1)); return route.fulfill({ status: 204 })
    }
    throw new Error(`未定义的测试请求: ${method} ${path}`)
  })
  const login = async (name) => {
    await page.getByLabel('邮箱或用户名').fill(name)
    await page.getByLabel('密码', { exact: true }).fill('integration-only')
    await page.getByRole('button', { name: '登录工作台', exact: true }).click()
  }
  const rowCodes = () => page.locator('.signals-scroll .stock-code').allTextContents()
  const chooseSort = async (label) => {
    await page.locator('.result-sort-select').click()
    await page.getByRole('option', { name: label, exact: true }).click()
    await page.getByRole('listbox', { name: '结果排序', exact: true }).waitFor({ state: 'hidden' })
  }
  await mkdir('results', { recursive: true })
  await page.goto(base)
  await page.getByRole('cell', { name: /测试甲.*600519/ }).waitFor()
  assert.deepEqual((await page.getByRole('columnheader').allTextContents()).map((text) => text.trim()), ['股票', '当日涨幅', '距今涨幅', '行业板块', '概念板块', '观察状态'])
  await page.getByRole('cell', { name: '+12.34%', exact: true }).waitFor()
  await page.getByRole('cell', { name: '0.00%', exact: true }).waitFor()
  await page.getByText('-3.21%', { exact: true }).waitFor()
  await page.getByText('+56.78%', { exact: true }).waitFor()
  assert.equal(performanceRequests[0].date, '2026-09-10', '当日涨幅请求的是筛选日期')
  await page.getByText(/东方财富优先，腾讯备用 \/ 前复权/).waitFor()
  await page.locator('.quote-source').filter({ hasText: '腾讯备用' }).waitFor()
  assert.deepEqual(await page.locator('.quote-source').allTextContents(), ['东方财富', '腾讯备用'], '逐只标出实际来源')
  assert.ok(await page.getByRole('cell', { name: '加载中…', exact: true }).count() > 0, '板块加载不阻塞股票结果')
  await chooseSort('一级板块 · 拼音降序')
  assert.deepEqual(await rowCodes(), [one.code, two.code], '板块加载中保持原顺序')
  releaseSectors()
  sectorGate = null
  await page.getByRole('cell', { name: '食品饮料 / 白酒', exact: true }).waitFor()
  assert.deepEqual(await rowCodes(), [two.code, one.code], '板块补齐后自动应用排序')
  await chooseSort('默认顺序')
  const countsBeforeSort = [sectorRequests.length, performanceRequests.length, posts]
  const dayHeader = page.getByRole('button', { name: '当日涨幅排序', exact: true })
  await dayHeader.click()
  assert.deepEqual(await rowCodes(), [one.code, two.code])
  assert.equal(await page.locator('th').filter({ hasText: '当日涨幅' }).getAttribute('aria-sort'), 'descending')
  await dayHeader.click()
  assert.deepEqual(await rowCodes(), [two.code, one.code], '当日涨幅升序，真实零排在正数前')
  await dayHeader.click()
  assert.deepEqual(await rowCodes(), [one.code, two.code], '第三次点击恢复接口原顺序')
  await page.getByRole('button', { name: '距今涨幅排序', exact: true }).click()
  await page.getByRole('button', { name: '距今涨幅排序', exact: true }).click()
  assert.deepEqual(await rowCodes(), [two.code, one.code], '距今涨幅按负数到正数排序')
  await page.getByRole('button', { name: '行业板块排序', exact: true }).click()
  assert.deepEqual(await rowCodes(), [one.code, two.code], '一级板块拼音升序')
  await page.getByRole('button', { name: '行业板块排序', exact: true }).click()
  assert.deepEqual(await rowCodes(), [two.code, one.code], '一级板块拼音降序')
  await page.screenshot({ path: 'results/sorting-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await chooseSort('当日涨幅 · 高到低')
  assert.deepEqual(await rowCodes(), [one.code, two.code], '手机端下拉排序与表头共用状态')
  await chooseSort('距今涨幅 · 低到高')
  assert.deepEqual(await rowCodes(), [two.code, one.code])
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.screenshot({ path: 'results/sorting-mobile.png', fullPage: true })
  await chooseSort('默认顺序')
  await page.setViewportSize({ width: 1440, height: 1050 })
  assert.deepEqual([sectorRequests.length, performanceRequests.length, posts], countsBeforeSort, '排序不会重新查询板块、行情或创建扫描')
  console.log('✓ 表头三态、涨幅正负与零、一级行业排序、延迟补齐、手机排序及无新增请求')
  await page.getByRole('cell', { name: '暂无主题概念', exact: true }).waitFor()
  assert.equal(await page.getByText('西部大开发', { exact: true }).count(), 0)
  await page.getByRole('button', { name: '展开 测试甲 的概念板块', exact: true }).click()
  await page.getByText('西部大开发', { exact: true }).waitFor()
  await page.screenshot({ path: 'results/sectors-expanded-desktop.png', fullPage: true })
  await page.getByRole('button', { name: '收起 测试甲 的概念板块', exact: true }).click()
  denySectors = true
  await page.reload()
  await page.getByRole('button', { name: '重试板块查询', exact: true }).waitFor()
  assert.equal(await page.getByRole('cell', { name: '暂不可用', exact: true }).count(), 4)
  assert.equal(await page.getByRole('cell', { name: /测试甲.*600519/ }).count(), 1)
  denySectors = false
  await page.getByRole('button', { name: '重试板块查询', exact: true }).click()
  await page.getByRole('cell', { name: '食品饮料 / 白酒', exact: true }).waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '展开 测试甲 的概念板块', exact: true }).click()
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.screenshot({ path: 'results/sectors-expanded-mobile.png', fullPage: true })
  await page.getByRole('button', { name: '收起 测试甲 的概念板块', exact: true }).click()
  await page.setViewportSize({ width: 1440, height: 1050 })
  console.log('✓ 行业层级、概念展开、空概念、非阻塞加载、接口失败降级及重试')
  assert.equal(await page.getByLabel('信号日期').inputValue(), '2026-09-10', '默认选择最新缓存日期')
  // 组件库控件的真实菜单、键盘和窄屏布局，避免回退到浏览器原生选择器。
  assert.equal(await page.locator('select, input[type=date]').count(), 0)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1050 })
    const historySelect = page.locator('.history-select')
    await historySelect.scrollIntoViewIfNeeded()
    const selection = historySelect.locator('.n-base-selection')
    const arrow = historySelect.locator('.n-base-suffix')
    const fieldBox = await selection.boundingBox(), arrowBox = await arrow.boundingBox()
    assert.ok(Math.abs(fieldBox.y + fieldBox.height / 2 - arrowBox.y - arrowBox.height / 2) <= 1, `${width}px：历史扫描箭头垂直居中`)
    assert.ok(fieldBox.x + fieldBox.width - arrowBox.x - arrowBox.width >= 10, `${width}px：箭头保留右侧间距`)
    await historySelect.click()
    await page.getByRole('option', { name: '2026-09-10 · B 2 只', exact: true }).waitFor()
    assert.equal(await page.getByRole('option', { name: '2026-08-12 · B 1 只', exact: true }).count(), 1, '保留窗口内最早一天')
    assert.equal(await page.getByRole('option', { name: '2026-08-11 · B 99 只', exact: true }).count(), 0, '隐藏超过 30 天的记录')
    await page.waitForFunction(() => { const menu = document.querySelector('.n-base-select-menu'); return menu && getComputedStyle(menu).opacity === '1' })
    const menuBox = await page.locator('.n-base-select-menu').boundingBox()
    assert.ok(menuBox.x >= 0 && menuBox.x + menuBox.width <= width + 1, `${width}px：下拉菜单不超出屏幕`)
    assert.ok(menuBox.y >= 0 && menuBox.y + menuBox.height <= 1051, `${width}px：下拉菜单在视口内可见`)
    await page.screenshot({ path: `results/ui-history-${width}.png` })
    await page.keyboard.press('Escape')
    await page.getByRole('option').first().waitFor({ state: 'hidden' })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  }
  await page.setViewportSize({ width: 1440, height: 1050 })
  await page.getByLabel('信号日期').click()
  await page.locator('.n-date-panel').waitFor()
  await page.waitForFunction(() => { const panel = document.querySelector('.n-date-panel'); return panel && getComputedStyle(panel).opacity === '1' })
  await page.screenshot({ path: 'results/ui-date-picker.png' })
  await page.keyboard.press('Escape')
  console.log('✓ 组件库下拉菜单、箭头居中、边距、Escape 关闭、日历及桌面/手机布局')
  await page.goto(`${base}signals?date=2026-08-11`)
  await page.getByRole('cell', { name: /测试甲.*600519/ }).waitFor()
  assert.equal(await page.getByLabel('信号日期').inputValue(), '2026-09-10', '过期书签回到最近有效日期')
  await page.waitForURL('**/signals?date=2026-09-10')
  assert.equal(seen.includes('2026-08-11'), false, '不请求已过期日期')
  await page.locator('.history-select').click()
  assert.equal(await page.getByRole('option').filter({ hasText: '2026-08-11' }).count(), 0, '旧日期查询不会重新插入历史列表')
  await page.keyboard.press('Escape')
  historyEntries = [{ date: '2026-08-11', found: 99 }]
  await page.goto(base)
  await page.getByText('最近 30 天暂无历史扫描记录', { exact: true }).waitFor()
  await page.getByRole('cell', { name: /测试甲.*600519/ }).waitFor()
  assert.equal(await page.getByLabel('信号日期').inputValue(), '2026-09-10', '全部过期时默认今天，不自动选择旧记录')
  assert.equal(await page.locator('.history-select').count(), 0)
  historyEntries = defaultHistory
  await page.goto(base)
  await page.getByRole('cell', { name: /测试甲.*600519/ }).waitFor()
  console.log('✓ 近 30 天边界、过期书签归一且不请求旧日期、全部过期空态及默认今天')


  assert.equal(await page.locator('nav a').count(), 2)
  await page.getByRole('button', { name: '登录并扫描', exact: true }).click()
  await page.getByRole('heading', { name: '登录循势', exact: true }).waitFor()
  assert.equal(posts, 0)
  await login('alice')
  await page.getByRole('cell', { name: /测试甲.*600519/ }).waitFor()
  assert.equal(await page.evaluate(() => localStorage.getItem('accessToken')), null)
  console.log('✓ 公开缓存、独立登录和扫描回跳')

  await page.getByLabel('信号日期').fill('2026-09-09')
  await page.getByLabel('信号日期').press('Tab')
  await page.locator('.n-date-panel').waitFor({ state: 'hidden' })
  await page.getByRole('heading', { name: '当日没有命中 B 信号' }).waitFor()
  assert.ok(seen.includes('2026-09-09'))
  await page.getByLabel('信号日期').fill('2026-09-07')
  await page.getByLabel('信号日期').press('Tab')
  await page.locator('.n-date-panel').waitFor({ state: 'hidden' })
  await page.getByRole('heading', { name: '该日期尚未扫描' }).waitFor()
  await page.getByLabel('信号日期').fill('2026-09-04')
  await page.getByLabel('信号日期').press('Tab')
  await page.locator('.n-date-panel').waitFor({ state: 'hidden' })
  await page.getByRole('alert').filter({ hasText: '数据源暂不可用' }).waitFor()
  await page.locator('.history-select').click()
  await page.getByRole('option', { name: '2026-09-10 · B 2 只', exact: true }).click()
  await page.getByRole('cell', { name: /测试甲.*600519/ }).waitFor()
  console.log('✓ 日期查询、空结果、未扫描、错误提示和历史选择')

  await page.getByRole('button', { name: '开始扫描', exact: true }).click()
  await page.getByRole('cell', { name: /测试甲.*600519/ }).waitFor()
  assert.equal(posts, 1)
  await page.getByRole('button', { name: '忽略缓存，重新扫描', exact: true }).click()
  await page.getByText('服务端扫描中', { exact: true }).waitFor()
  await page.waitForTimeout(150)
  assert.match(page.url(), /run=test-run/)
  await page.reload()
  await page.getByRole('cell', { name: /测试甲.*600519/ }).waitFor()
  assert.equal(posts, 2, '刷新页面只恢复轮询，不重复创建扫描')
  assert.ok(polls >= 2)
  await page.getByText('指定代码', { exact: true }).click()
  await page.getByLabel('股票代码', { exact: false }).fill('bad-code')
  await page.getByRole('button', { name: '开始扫描', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '六位股票代码' }).waitFor()
  assert.equal(posts, 2)
  await page.getByLabel('股票代码', { exact: false }).fill('600519')
  await page.getByRole('button', { name: '开始扫描', exact: true }).click()
  await page.getByRole('cell', { name: /测试甲.*600519/ }).waitFor()
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1)
  await page.getByRole('button', { name: '复制代码', exact: true }).click()
  await page.getByText('已复制 1 个代码').waitFor()
  console.log('✓ 缓存复用、异步扫描刷新恢复、代码校验和复制')

  await page.getByText('全市场扫描', { exact: true }).click()
  await page.getByLabel('信号日期').fill('2026-09-10')
  await page.getByLabel('信号日期').press('Tab')
  await page.locator('.n-date-panel').waitFor({ state: 'hidden' })
  await page.getByRole('cell', { name: /测试乙.*000001/ }).waitFor()
  await page.getByLabel('选择 测试甲', { exact: true }).check()
  await chooseSort('当日涨幅 · 低到高')
  assert.deepEqual(await rowCodes(), [two.code, one.code])
  assert.equal(await page.getByLabel('选择 测试甲', { exact: true }).isChecked(), true, '排序后保留已选股票')
  assert.equal(await page.getByLabel('选择 测试乙', { exact: true }).isChecked(), false)
  await page.getByLabel('全选未入池股票（最多100只）').check()
  assert.equal(await page.getByLabel('选择 测试乙', { exact: true }).isChecked(), true)
  await page.getByLabel('全选未入池股票（最多100只）').uncheck()
  await page.getByLabel('选择 测试甲', { exact: true }).check()
  await page.getByRole('button', { name: '加入观察池 (1)', exact: true }).click()
  await page.getByText('已在观察池', { exact: true }).waitFor()
  await page.screenshot({ path: 'results/signals-desktop.png', fullPage: true })
  await page.locator('nav').getByRole('link', { name: '我的观察池', exact: true }).click()
  await page.getByRole('cell', { name: /测试甲.*600519/ }).waitFor()
  await page.getByLabel('搜索观察池').fill('missing')
  await page.getByRole('heading', { name: '没有符合条件的股票' }).waitFor()
  await page.getByLabel('搜索观察池').fill('600519')
  await page.getByRole('cell', { name: /测试甲.*600519/ }).waitFor()
  await page.getByRole('button', { name: 'S 已触发', exact: true }).click()
  await page.getByRole('heading', { name: '没有符合条件的股票' }).waitFor()
  await page.getByRole('button', { name: '立即检查', exact: true }).click()
  await page.getByRole('cell', { name: '2026-09-11', exact: true }).waitFor()
  await page.screenshot({ path: 'results/watchlist-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.screenshot({ path: 'results/watchlist-mobile.png', fullPage: true })
  await page.getByRole('button', { name: '移除 测试甲', exact: true }).click()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  assert.equal(pools.alice.length, 1)
  await page.getByRole('button', { name: '移除 测试甲', exact: true }).click()
  await page.getByRole('button', { name: '确认移除', exact: true }).click()
  await page.getByRole('heading', { name: '你的观察池还是空的' }).waitFor()
  console.log('✓ 观察池增删、状态筛选、搜索、S 检查与手机布局')

  // 比较实际布局，覆盖确认操作、提示切换及慢请求引起的跳动。
  const watchlistLayout = () => page.evaluate(() => {
    const rect = (element) => {
      const { x, y, width, height } = element.getBoundingClientRect()
      return { x: x + scrollX, y: y + scrollY, width, height }
    }
    return {
      heading: rect(document.querySelector('.section-heading')),
      toolbar: rect(document.querySelector('.watchlist-toolbar')),
      cells: [...document.querySelectorAll('.watchlist-scroll th, .watchlist-scroll tbody tr:first-child td')].filter((element) => element.getClientRects().length).map(rect),
    }
  })
  for (const width of [1440, 390]) {
    pools.alice = [one, two].map((item) => ({ ...item, id: item.code, entrySignalDate: '2026-09-10', status: 'watching', triggeredSignalDate: null }))
    await page.setViewportSize({ width, height: 1050 })
    await page.reload()
    await page.getByRole('button', { name: '移除 测试甲', exact: true }).waitFor()
    const initial = await watchlistLayout()
    await page.getByRole('button', { name: '移除 测试甲', exact: true }).click()
    assert.deepEqual(await watchlistLayout(), initial, `${width}px：展开确认不得改变列宽或行高`)
    assert.equal(await page.getByRole('button', { name: '确认移除', exact: true }).count(), 1, '隐藏操作不能暴露到无障碍树')
    await page.screenshot({ path: `results/watchlist-confirm-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: '移除 测试乙', exact: true }).click()
    assert.deepEqual(await watchlistLayout(), initial, `${width}px：切换确认行时布局稳定`)
    assert.equal(await page.getByRole('button', { name: '确认移除', exact: true }).count(), 1)
    await page.getByRole('button', { name: '取消', exact: true }).click()
    assert.deepEqual(await watchlistLayout(), initial, `${width}px：取消确认时布局稳定`)
    assert.equal(pools.alice.length, 2)

    denyRemove = true
    await page.getByRole('button', { name: '移除 测试甲', exact: true }).click()
    await page.getByRole('button', { name: '确认移除', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: '移除失败，请稍后重试' }).waitFor()
    assert.deepEqual(await watchlistLayout(), initial, `${width}px：错误提示不得推移列表`)
    assert.equal(pools.alice.length, 2, '失败时保留原数据')

    denyRemove = false
    removeGate = new Promise((resolve) => { releaseRemove = resolve })
    await page.getByRole('button', { name: '移除 测试甲', exact: true }).click()
    await page.getByRole('button', { name: '确认移除', exact: true }).click()
    await page.getByRole('button', { name: '处理中…', exact: true }).waitFor()
    assert.deepEqual(await watchlistLayout(), initial, `${width}px：请求等待期间布局稳定`)
    assert.equal(await page.getByRole('button', { name: '移除 测试甲', exact: true }).isDisabled(), true)
    releaseRemove()
    removeGate = null
    await page.getByRole('status').filter({ hasText: '已从观察池移除' }).waitFor()
    assert.equal(await page.getByRole('button', { name: '移除 测试甲', exact: true }).count(), 0)
    assert.equal(pools.alice.length, 1)
    const afterRemoval = await watchlistLayout()
    assert.deepEqual(afterRemoval.heading, initial.heading, `${width}px：移除后清单标题位置稳定`)
    assert.deepEqual(afterRemoval.toolbar, initial.toolbar, `${width}px：移除后筛选栏位置稳定`)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))

    await page.getByRole('button', { name: '移除 测试乙', exact: true }).click()
    await page.getByRole('button', { name: '确认移除', exact: true }).click()
    await page.getByRole('heading', { name: '你的观察池还是空的' }).waitFor()
  }
  console.log('✓ 桌面与手机移除确认、取消、切换行、失败、慢请求、成功及末项空态的布局回归')

  pools.alice = [{ code: '600396', market: 'sh', name: '华电辽能' }, two].map((item) => ({ ...item, id: item.code, entrySignalDate: '2026-09-10', status: 'watching', triggeredSignalDate: null }))
  await page.setViewportSize({ width: 1440, height: 1050 })
  await page.reload()
  await page.getByRole('button', { name: '移除 华电辽能', exact: true }).waitFor()
  failWatchlistCheck = true
  await page.getByRole('button', { name: '立即检查', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '检查未完成：2 只历史信号读取失败，请重试' }).waitFor()
  assert.equal(pools.alice.filter((item) => item.status === 'triggered').length, 0)
  failWatchlistCheck = false
  await page.getByRole('button', { name: '立即检查', exact: true }).click()
  await page.getByRole('cell', { name: '2026-09-15', exact: true }).waitFor()
  await page.getByRole('status').filter({ hasText: '新增 1 只 S，池内已触发 1 只' }).waitFor()
  await page.getByRole('button', { name: '立即检查', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '新增 0 只 S，池内已触发 1 只' }).waitFor()
  assert.equal(await page.getByRole('cell', { name: '2026-09-15', exact: true }).count(), 1)
  await page.screenshot({ path: 'results/watchlist-history-desktop.png', fullPage: true })
  console.log('✓ 历史检查失败提示、旧日期 S 展示及新增数量与已触发数量区分')

  // 在退出前保留一条私人记录，切换账号后不得显示前一账户内容。
  pools.alice = [{ ...one, id: 'private-alice', entrySignalDate: '2026-09-10', status: 'watching', triggeredSignalDate: null }]
  await page.reload()
  await page.getByRole('cell', { name: /测试甲.*600519/ }).waitFor()
  await page.getByRole('button', { name: '退出', exact: true }).click()
  await page.getByRole('cell', { name: /测试甲.*600519/ }).waitFor() // 公开信号结果
  await page.locator('.account-box').getByRole('link', { name: '登录', exact: true }).click()
  await login('bob')
  await page.locator('nav').getByRole('link', { name: '我的观察池', exact: true }).click()
  await page.getByRole('heading', { name: '你的观察池还是空的' }).waitFor()
  assert.equal(await page.getByRole('cell', { name: /测试甲.*600519/ }).count(), 0)
  expire = true
  await page.reload()
  await page.getByRole('heading', { name: '你的观察池还是空的' }).waitFor()
  assert.equal(refreshes, 1)
  denyRefresh = true
  await page.evaluate(() => { const tokens = JSON.parse(localStorage.getItem('xunshi.session.v1')); tokens.accessToken = 'expired-bob'; localStorage.setItem('xunshi.session.v1', JSON.stringify(tokens)) })
  await page.reload()
  await page.getByRole('heading', { name: '登录，开始你的长期观察' }).waitFor()
  assert.equal(await page.evaluate(() => localStorage.getItem('xunshi.session.v1')), null)
  console.log('✓ 账户切换隔离、令牌刷新与过期清理')

  expire = false
  await page.goto(`${base}signals?date=2026-09-10&run=failed-run`)
  await page.getByRole('alert').filter({ hasText: '扫描任务失败' }).waitFor()
  await page.goto(`${base}signals?date=2026-09-10`)
  await page.getByRole('cell', { name: /测试甲.*600519/ }).waitFor()
  await page.getByLabel('信号日期').fill('2026-09-09')
  await page.getByLabel('信号日期').press('Tab')
  await page.locator('.n-date-panel').waitFor({ state: 'hidden' })
  await page.getByRole('heading', { name: '当日没有命中 B 信号' }).waitFor()
  await page.setViewportSize({ width: 1440, height: 1050 })
  await page.screenshot({ path: 'results/empty-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.screenshot({ path: 'results/signals-mobile.png', fullPage: true })
  manyRows = Array.from({ length: 60 }, (_, index) => ({ code: String(600000 + index), market: 'sh', name: `批量股票${index}` }))
  sectorData.push(...manyRows.map((item) => ({ ...sectorData[0], code: item.code })))
  const beforeBatches = sectorRequests.length
  await page.goto(`${base}signals?date=2026-09-10`)
  await page.waitForFunction(() => [...document.querySelectorAll('.industry-cell')].filter((cell) => cell.textContent.trim() === '食品饮料 / 白酒').length === 60)
  assert.equal(sectorRequests.length - beforeBatches, 3, '60 只股票分三批查询')
  assert.ok(sectorRequests.slice(beforeBatches).every((codes) => codes.length <= 25))

  sectorGate = new Promise((resolve) => { releaseSectors = resolve })
  const beforeCancel = sectorRequests.length
  const twoStarted = new Promise((resolve) => { onSectorRequest = () => { if (sectorRequests.length === beforeCancel + 2) resolve() } })
  await page.reload()
  await twoStarted
  assert.equal(sectorRequests.length - beforeCancel, 2, '最多并发两个板块请求')
  await page.getByLabel('信号日期').fill('2026-09-09')
  await page.getByLabel('信号日期').press('Tab')
  await page.locator('.n-date-panel').waitFor({ state: 'hidden' })
  await page.getByRole('heading', { name: '当日没有命中 B 信号' }).waitFor()
  releaseSectors()
  sectorGate = null
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  assert.equal(sectorRequests.length - beforeCancel, 2, '日期切换后不再发送旧批次')
  assert.equal(await page.locator('.signals-scroll').count(), 0, '迟到板块响应不能恢复旧股票')
  console.log('✓ 板块分批、并发限制与切换日期取消旧请求')

  manyRows = null
  denyPerformance = true
  await page.goto(`${base}signals?date=2026-09-10`)
  await page.getByRole('button', { name: '重试涨幅查询', exact: true }).waitFor()
  assert.equal(await page.locator('.return-cell').filter({ hasText: '行情暂不可用' }).count(), 4)
  assert.equal(await page.getByRole('cell', { name: /测试甲.*600519/ }).count(), 1)
  assert.equal(await page.locator('.quote-source').count(), 0, '缺失数据不标成成功行情来源')
  denyPerformance = false
  await page.getByRole('button', { name: '重试涨幅查询', exact: true }).click()
  await page.getByText('+56.78%', { exact: true }).waitFor()
  await page.getByLabel('信号日期').fill('2026-09-08')
  await page.getByLabel('信号日期').press('Tab')
  await page.locator('.n-date-panel').waitFor({ state: 'hidden' })
  await page.getByText('+2.50%', { exact: true }).first().waitFor()
  assert.equal(performanceRequests.at(-1).date, '2026-09-08')
  assert.equal(await page.getByText('+12.34%', { exact: true }).count(), 0, '日期切换清除旧涨幅')

  pendingBaseline = true
  await page.reload()
  await page.getByText('待收盘', { exact: true }).first().waitFor()
  assert.equal(await page.getByText('+56.78%', { exact: true }).count(), 0, '未收盘时不展示假累计')
  pendingBaseline = false

  await page.setViewportSize({ width: 1440, height: 1050 })
  await page.goto(`${base}signals?date=2026-09-10`)
  await page.getByText('+56.78%', { exact: true }).waitFor()
  await page.screenshot({ path: 'results/returns-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.screenshot({ path: 'results/returns-mobile.png', fullPage: true })
  await chooseSort('距今涨幅 · 高到低')
  assert.deepEqual(await rowCodes(), [one.code, two.code])
  swappedQuotes = true
  useBackup = false
  const quotesBeforeRefresh = performanceRequests.length
  const automaticRequest = new Promise((resolve) => { onPerformanceRequest = resolve })
  await page.clock.fastForward(31000)
  await automaticRequest
  await page.waitForFunction(() => [...document.querySelectorAll('.quote-source')].length === 2 && [...document.querySelectorAll('.quote-source')].every((node) => node.textContent === '东方财富'))
  assert.equal(await page.locator('.quote-source').filter({ hasText: '腾讯备用' }).count(), 0, '后端恢复主源后页面自动更新来源')
  assert.ok(performanceRequests.length > quotesBeforeRefresh, '页面可见时每 30 秒更新涨幅')
  assert.deepEqual(await rowCodes(), [two.code, one.code], '报价更新后保留排序选项并自动重新排序')

  const beforePerformanceCancel = performanceRequests.length
  performanceGate = new Promise((resolve) => { releasePerformance = resolve })
  const requested = new Promise((resolve) => { onPerformanceRequest = resolve })
  await page.reload()
  await requested
  await page.getByLabel('信号日期').fill('2026-09-09')
  await page.getByLabel('信号日期').press('Tab')
  await page.locator('.n-date-panel').waitFor({ state: 'hidden' })
  await page.getByRole('heading', { name: '当日没有命中 B 信号' }).waitFor()
  releasePerformance()
  performanceGate = null
  await page.clock.fastForward(31000)
  assert.equal(performanceRequests.length - beforePerformanceCancel, 1, '切换到空结果后取消旧报价和刷新计时器')
  assert.equal(await page.locator('.return-cell').count(), 0)
  console.log('✓ 筛选日涨幅、累计正负与零值、失败重试、待收盘、桌面/手机布局、自动刷新及取消')
  assert.deepEqual(errors, [])
  console.log('✓ 扫描失败、空态、窄屏筛选页与运行时检查')
} catch (error) {
  await mkdir('results', { recursive: true })
  if (page) { await page.screenshot({ path: 'results/failure.png', fullPage: true }); console.error(await page.locator('main').innerText()) }
  throw error
} finally { releaseRemove?.(); releaseSectors?.(); releasePerformance?.(); await browser?.close(); await server.close() }
