import { clearSession, getTokens, saveTokens, session } from './session'
import type { Tokens } from '../types'
const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) { super(message); this.name = 'ApiError'; this.status = status }
}
type Options = { method?: string; body?: unknown; signal?: AbortSignal }
let refreshJob: Promise<void> | null = null
async function refresh(revision: number) {
  if (!refreshJob) {
    refreshJob = (async () => {
      const tokens = getTokens()
      if (!tokens) throw new ApiError('请重新登录', 401)
      const response = await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: tokens.refreshToken }) })
      if (!response.ok) throw new ApiError('登录已过期，请重新登录', response.status)
      const next = await response.json() as Tokens
      // 退出、切换账户后的迟到刷新不得恢复旧会话。
      if (session.revision !== revision) throw new ApiError('登录状态已变化', 401)
      saveTokens(next)
    })().catch((error: unknown) => {
      if (session.revision === revision) clearSession(true)
      throw error
    }).finally(() => { refreshJob = null })
  }
  await refreshJob
}
export async function request<T>(path: string, options: Options = {}): Promise<T> {
  const revision = session.revision
  const send = () => {
    const tokens = getTokens()
    return fetch(`${base}${path}`, { method: options.method || 'GET', signal: options.signal,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}) },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}) })
  }
  let response = await send()
  if (response.status === 401 && getTokens() && !['/auth/login', '/auth/refresh'].includes(path)) {
    if (revision !== session.revision) throw new ApiError('登录状态已变化', 401)
    await refresh(revision)
    if (revision !== session.revision) throw new ApiError('登录状态已变化', 401)
    response = await send()
    if (response.status === 401 && session.revision === revision) clearSession(true)
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string | string[] }
    throw new ApiError(Array.isArray(body.message) ? body.message.join('；') : body.message || `请求失败（${response.status}）`, response.status)
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}
