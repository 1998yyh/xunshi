import { browserSession } from './browser-session'
export { SessionError as ApiError } from './browser-session'
type Options = { method?: string; body?: unknown; signal?: AbortSignal }
export function request<T>(path: string, options: Options = {}): Promise<T> {
  return browserSession.request<T>(`/api${path}`, { method: options.method ?? 'GET', signal: options.signal, ...(options.body ? { body: JSON.stringify(options.body) } : {}) })
}
