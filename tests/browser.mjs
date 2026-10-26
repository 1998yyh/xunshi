import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'
import { chromium } from 'playwright'
const server = await createServer({ mode: process.env.TEST_DEPLOYMENT ? 'production' : 'test', server: { host: '127.0.0.1', port: 0, strictPort: true } })
let browser, page, releaseRemove, releaseSectors
try {
  await server.listen()
  const base = server.resolvedUrls.local[0]
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, permissions: ['clipboard-read', 'clipboard-write'] })
  page = await context.newPage()
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const one = { code: '600519', market: 'sh', name: '测试甲' }
  const two = { code: '000001', market: 'sz', name: '测试乙' }
  const pools = { alice: [], bob: [] }
  let posts = 0, polls = 0, refreshes = 0, expire = false, denyRefresh = false
  let denyRemove = false, removeGate = null
  let failWatchlistCheck = false
  let denySectors = false
  let manyRows = null
  const sectorRequests = []
  let onSectorRequest = () => {}
  let sectorGate = new Promise((resolve) => { releaseSectors = resolve })
  const sectorData = [
    { code: one.code, industries: [{ code: 'BK0438', name: '食品饮料', level: 1 }, { code: 'BK0896', name: '白酒', level: 2 }], concepts: ['超级品牌', '电商概念', '乡村振兴', '央国企改革', '西部大开发'].map((name, index) => ({ code: `BK${index}`, name })), status: 'ready', source: 'eastmoney', fetchedAt: '2026-10-26T10:00:00Z' },
    { code: two.code, industries: [{ code: 'BK0475', name: '银行', level: 1 }], concepts: [], status: 'ready', source: 'eastmoney', fetchedAt: '2026-10-26T10:00:00Z' },
  ]
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
    if (path === '/stock-signals/dates') return reply([{ date: '2026-09-10', found: 2 }, { date: '2026-09-09', found: 0 }])
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
  await mkdir('results', { recursive: true })
  await page.goto(base)
  await page.getByRole('cell', { name: /测试甲.*600519/ }).waitFor()
  assert.deepEqual(await page.getByRole('columnheader').allTextContents(), ['股票', '行业板块', '概念板块', '观察状态'])
  assert.ok(await page.getByRole('cell', { name: '加载中…', exact: true }).count() > 0, '板块加载不阻塞股票结果')
  releaseSectors()
  sectorGate = null
  await page.getByRole('cell', { name: '食品饮料 / 白酒', exact: true }).waitFor()
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
  assert.equal(await page.locator('nav a').count(), 2)
  await page.getByRole('button', { name: '登录并扫描', exact: true }).click()
  await page.getByRole('heading', { name: '登录循势', exact: true }).waitFor()
  assert.equal(posts, 0)
  await login('alice')
  await page.getByRole('cell', { name: /测试甲.*600519/ }).waitFor()
  assert.equal(await page.evaluate(() => localStorage.getItem('accessToken')), null)
  console.log('✓ 公开缓存、独立登录和扫描回跳')

  await page.getByLabel('信号日期').fill('2026-09-09')
  await page.getByLabel('信号日期').dispatchEvent('change')
  await page.getByRole('heading', { name: '当日没有命中 B 信号' }).waitFor()
  assert.ok(seen.includes('2026-09-09'))
  await page.getByLabel('信号日期').fill('2026-09-07')
  await page.getByLabel('信号日期').dispatchEvent('change')
  await page.getByRole('heading', { name: '该日期尚未扫描' }).waitFor()
  await page.getByLabel('信号日期').fill('2026-09-04')
  await page.getByLabel('信号日期').dispatchEvent('change')
  await page.getByRole('alert').filter({ hasText: '数据源暂不可用' }).waitFor()
  await page.getByLabel('历史扫描日期').selectOption('2026-09-10')
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
  await page.locator('label').filter({ hasText: /^指定代码$/ }).click()
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
  await page.getByLabel('信号日期').dispatchEvent('change')
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
  await page.getByLabel('信号日期').dispatchEvent('change')
  await page.getByRole('heading', { name: '当日没有命中 B 信号' }).waitFor()
  releaseSectors()
  sectorGate = null
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  assert.equal(sectorRequests.length - beforeCancel, 2, '日期切换后不再发送旧批次')
  assert.equal(await page.locator('.signals-scroll').count(), 0, '迟到板块响应不能恢复旧股票')
  console.log('✓ 板块分批、并发限制与切换日期取消旧请求')
  assert.deepEqual(errors, [])
  console.log('✓ 扫描失败、空态、窄屏筛选页与运行时检查')
} catch (error) {
  await mkdir('results', { recursive: true })
  if (page) { await page.screenshot({ path: 'results/failure.png', fullPage: true }); console.error(await page.locator('main').innerText()) }
  throw error
} finally { releaseRemove?.(); releaseSectors?.(); await browser?.close(); await server.close() }
