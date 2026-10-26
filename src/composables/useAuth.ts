import { readonly } from 'vue'
import { clearSession, getTokens, session, startSession } from '../lib/session'
import { request } from '../lib/http'
import type { Tokens, User } from '../types'
let restoreJob: Promise<void> | null = null
async function restore() {
  if (session.ready) return
  if (!restoreJob) restoreJob = (async () => {
    if (getTokens()) {
      const revision = session.revision
      try {
        const user = await request<User>('/auth/profile')
        if (revision === session.revision) session.user = user
      } catch { if (revision === session.revision) clearSession() }
    }
    session.ready = true
  })().finally(() => { restoreJob = null })
  return restoreJob
}
async function login(login: string, password: string) {
  const tokens = await request<Tokens>('/auth/login', { method: 'POST', body: { login, password } })
  startSession(tokens)
  const revision = session.revision
  try {
    const user = await request<User>('/auth/profile')
    if (revision !== session.revision) throw new Error('登录状态已变化')
    session.user = user
  } catch (error) { if (revision === session.revision) clearSession(); throw error }
}
export function useAuth() { return { state: readonly(session), restore, login, logout: () => clearSession() } }
