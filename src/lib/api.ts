import { request } from './http'
import type { AddResponse, HistoryDate, ScanResponse, ScanRun, Signals, Stock, WatchItem } from '../types'
export const stockApi = {
  history: (signal?: AbortSignal) => request<HistoryDate[]>('/stock-signals/dates', { signal }),
  results: (date: string, signal?: AbortSignal) => request<Signals>(`/stock-signals?date=${encodeURIComponent(date)}`, { signal }),
  scan: (body: { date: string; codes?: string[]; refresh: boolean }, signal?: AbortSignal) => request<ScanResponse>('/stock-signals/scans', { method: 'POST', body, signal }),
  run: (id: string, signal?: AbortSignal) => request<{ run: ScanRun; items?: Stock[] }>(`/stock-signals/scans/${encodeURIComponent(id)}`, { signal }),
  watchlist: (signal?: AbortSignal) => request<{ items: WatchItem[] }>('/stock-watchlist', { signal }),
  add: (items: (Stock & { entrySignalDate: string })[]) => request<AddResponse>('/stock-watchlist', { method: 'POST', body: { items } }),
  remove: (id: string) => request<void>(`/stock-watchlist/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  check: () => request<{ checked: number; triggered: number; items: WatchItem[] }>('/stock-watchlist/check', { method: 'POST' }),
}
