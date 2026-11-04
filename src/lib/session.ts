import { reactive } from 'vue'
import { browserSession } from './browser-session'
import type { User } from '../types'
export const session = reactive({ user: null as User | null, ready: false, expired: false, revision: 0, error: '' })
browserSession.subscribe(value => {
  session.user = value.user; session.ready = value.ready; session.revision = value.revision; session.error = value.error
})
export function clearSession(expired = false) { browserSession.unauthorized(browserSession.state.revision); session.expired = expired }
