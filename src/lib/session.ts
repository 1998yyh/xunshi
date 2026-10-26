import { reactive } from 'vue'
import type { Tokens, User } from '../types'
const key = 'xunshi.session.v1'
export const session = reactive({ user: null as User | null, ready: false, expired: false, revision: 0 })
export function getTokens(): Tokens | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null') as Tokens | null
    return value?.accessToken && value?.refreshToken ? value : null
  } catch { return null }
}
export function saveTokens(value: Tokens) { localStorage.setItem(key, JSON.stringify(value)) }
export function clearSession(expired = false) {
  localStorage.removeItem(key)
  session.revision++
  session.user = null
  session.expired = expired
}
export function startSession(value: Tokens) { clearSession(); saveTokens(value) }
