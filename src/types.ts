export interface Stock { code: string; market: string; name: string }
export interface Sector { code: string; name: string; level?: number }
export interface StockSectors { code: string; industries: Sector[]; concepts: Sector[]; status: 'ready' | 'unavailable'; source: 'eastmoney'; fetchedAt: string | null }
export interface Signals { date: string; items: Stock[]; found: number; checked: number; total: number; failedCodes: string[]; scannedAt: string }
export type ScanStatus = 'pending' | 'running' | 'done' | 'failed'
export interface ScanRun { id: string; queryDate: string; status: ScanStatus; total: number; checked: number; found: number; failedCodes: string[] | null; updatedAt: string }
export interface ScanResponse { cached?: boolean; run?: ScanRun; result?: { date: string; items: Stock[]; requested: number; fetchedCount: number; cachedCount: number; failed: string[]; invalid: string[] } }
export interface HistoryDate { date: string; found: number; checked: number; total: number; scannedAt: string }
export interface WatchItem extends Stock { id: string; entrySignalDate: string; status: 'watching' | 'triggered'; triggeredSignalDate: string | null; createdAt: string }
export interface AddResponse { items: WatchItem[]; added: string[]; invalid: string[]; duplicated: string[]; overflow: string[] }
export interface User { id: string; username: string; email: string; role: 'admin' | 'user' }
export interface Tokens { accessToken: string; refreshToken: string }
