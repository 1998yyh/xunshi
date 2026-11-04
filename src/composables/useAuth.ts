import { readonly } from 'vue'
import { session } from '../lib/session'
import { browserSession } from '../lib/browser-session'
async function restore() {
  try { await browserSession.restore() }
  catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) session.error = error instanceof Error ? error.message : '暂时无法验证身份' }
}
export function useAuth() { return { state: readonly(session), restore, logout: () => browserSession.logout() } }
