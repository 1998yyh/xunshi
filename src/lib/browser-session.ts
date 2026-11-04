/* eslint-disable no-unused-vars -- 函数类型签名参数由 TypeScript 检查。 */
// 统一会话协议 v1：各独立前端使用相同实现；凭据只存在 HttpOnly Cookie 中。
export interface SessionUser {
  id: string
  username: string
  email: string
  role: 'user' | 'admin'
  createdAt: string
  updatedAt: string
}
export interface SessionView {
  user: SessionUser
  apps: string[]
  csrfToken: string
  expiresAt: string
}
export interface SessionState {
  user: SessionUser | null
  apps: string[]
  ready: boolean
  revision: number
  error: string
}
export class SessionError extends Error {
  readonly status: number
  constructor(message: string, status: number) { super(message); this.status = status; this.name = 'SessionError' }
}
const aborted = () => new DOMException('登录身份已变化，请重新操作', 'AbortError')
const unsafe = (method: string) => !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())

export class BrowserSessionClient {
  private value: SessionState = { user: null, apps: [], ready: false, revision: 0, error: '' }
  private csrf = ''
  private pending: Promise<SessionState> | null = null
  private readonly listeners = new Set<(value: SessionState) => void>()
  private channel?: BroadcastChannel
  private readonly fetcher: typeof fetch

  constructor(fetcher: typeof fetch = (...args) => globalThis.fetch(...args)) {
    this.fetcher = fetcher
    if (typeof window !== 'undefined') {
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel('tuanzi-auth-v1')
        this.channel.onmessage = () => {
          this.reset(false)
          void this.restore().catch(() => {})
        }
      }
      window.addEventListener('focus', () => { void this.restore(true).catch(() => {}) })
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) void this.restore(true).catch(() => {})
      })
    }
  }

  get state(): SessionState { return this.value }
  subscribe(listener: (value: SessionState) => void) {
    this.listeners.add(listener); listener(this.value)
    return () => { this.listeners.delete(listener) }
  }
  private emit() { this.listeners.forEach(listener => listener(this.value)) }
  private reset(ready: boolean) {
    this.pending = null; this.csrf = ''
    this.value = { user: null, apps: [], ready, revision: this.value.revision + 1, error: '' }
    this.emit()
  }
  private apply(view: SessionView) {
    const changed = this.value.user?.id !== view.user.id || (!!this.csrf && this.csrf !== view.csrfToken)
      || this.value.user?.role !== view.user.role || this.value.apps.join() !== view.apps.join()
    this.csrf = view.csrfToken
    this.value = { user: view.user, apps: view.apps, ready: true, revision: this.value.revision + (changed ? 1 : 0), error: '' }
    // 仅移除已废弃的认证键，不触碰主题或业务设置；不读取或传播旧令牌。
    if (typeof window !== 'undefined') {
      for (const key of ['accessToken', 'refreshToken', 'xunshi.session.v1', 'xiaofeiyu.accessToken', 'tuanzi-admin.access-token']) {
        try { localStorage.removeItem(key); sessionStorage.removeItem(key) } catch { /* 浏览器禁用存储不影响 Cookie 会话。 */ }
      }
    }
    this.emit()
  }
  private async failure(response: Response): Promise<never> {
    const data = await response.json().catch(() => ({})) as { message?: string | string[] }
    throw new SessionError(Array.isArray(data.message) ? data.message.join('；') : data.message || `请求失败（${response.status}）`, response.status)
  }
  private announce() { this.channel?.postMessage({ type: 'identity-changed' }) }
  assertRevision(revision: number) { if (this.value.revision !== revision) throw aborted() }
  unauthorized(revision: number) { if (this.value.revision === revision) this.reset(true) }

  async restore(force = false): Promise<SessionState> {
    if (this.pending) return this.pending
    if (this.value.ready && !this.value.error && !force) return this.value
    const revision = this.value.revision
    const job = (async () => {
      const response = await this.fetcher('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' })
      this.assertRevision(revision)
      if (response.status === 401) { this.reset(true); return this.value }
      if (!response.ok) return this.failure(response)
      const view = await response.json() as SessionView
      this.assertRevision(revision)
      this.apply(view)
      return this.value
    })()
    this.pending = job
    try { return await job }
    catch (error) {
      if (this.value.revision === revision) { this.value = { ...this.value, ready: true, error: error instanceof Error ? error.message : '暂时无法验证登录状态' }; this.emit() }
      throw error
    } finally { if (this.pending === job) this.pending = null }
  }

  async login(login: string, password: string, remember = false) {
    this.reset(false)
    const revision = this.value.revision
    const response = await this.fetcher('/api/auth/session', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Tuanzi-CSRF': 'login' },
      body: JSON.stringify({ login: login.trim(), password, remember }),
    })
    this.assertRevision(revision)
    if (!response.ok) { this.reset(true); return this.failure(response) }
    const view = await response.json() as SessionView
    this.assertRevision(revision)
    this.apply(view); this.announce()
    return view.user
  }

  async prepare(method = 'GET'): Promise<Record<string, string>> {
    if (!unsafe(method)) return {}
    const state = await this.restore()
    if (!state.user) throw new SessionError('请登录后继续', 401)
    return { 'X-Tuanzi-CSRF': this.csrf }
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//') || /[\\\r\n]/.test(path)) throw new Error('只允许本站接口路径')
    const csrf = await this.prepare(options.method ?? 'GET')
    const revision = this.value.revision
    const headers = new Headers(options.headers)
    for (const [key, value] of Object.entries(csrf)) headers.set(key, value)
    if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
    const response = await this.fetcher(path, { ...options, headers, credentials: 'same-origin', cache: 'no-store' })
    this.assertRevision(revision)
    if (!response.ok) {
      if (response.status === 401) this.unauthorized(revision)
      return this.failure(response)
    }
    const data = response.status === 204 ? undefined : await response.json()
    this.assertRevision(revision)
    return data as T
  }

  async logout(allDevices = false) {
    // 先推进代际，阻止退出前的响应重新填充私人数据；成功后广播，失败仍向用户报告。
    this.pending = null
    this.value = { ...this.value, revision: this.value.revision + 1 }; this.emit()
    await this.request(allDevices ? '/api/auth/logout-all' : '/api/auth/session', { method: allDevices ? 'POST' : 'DELETE' })
    this.reset(true); this.announce()
  }
}

export const browserSession = new BrowserSessionClient()

export function safeReturnTo(value: unknown, fallback = '/apps'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return fallback
  const target = new URL(value, 'https://local.invalid')
  const paths = ['/apps', '/xunshi', '/xiaofeiyu', '/admin', '/dsh', '/agents', '/studio', '/canvas', '/ai-news', '/stock-news', '/dev-tools', '/assets', '/channels', '/mcp-servers', '/skills']
  if (target.origin !== 'https://local.invalid' || (target.pathname !== '/' && !paths.some(path => target.pathname === path || target.pathname.startsWith(path + '/')))) return fallback
  return target.pathname + target.search + target.hash
}

export function unifiedLoginUrl(returnTo: string, reason?: string) {
  const query = new URLSearchParams({ returnTo: safeReturnTo(returnTo) })
  if (reason) query.set('reason', reason)
  return `/login?${query}`
}
