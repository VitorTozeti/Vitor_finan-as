// Market data service
//
// This file is the ONLY place that should know about the underlying market
// data provider. If you need to switch providers, change the implementation
// here and keep the exported function signatures the same.
//
// Default provider: brapi.dev — a free public API for Brazilian tickers
// (stocks, ETFs, FIIs, indexes) that works without an API key for basic
// quote data. If you get a paid brapi token, put it in an environment
// variable (VITE_BRAPI_TOKEN) — never hardcode it here or commit it.
//
// This project is deployed on GitHub Pages (static hosting only), so any
// provider that requires a private/secret key cannot be called directly
// from the frontend. If you switch to such a provider, add a serverless
// function (e.g. a Cloudflare Worker or Vercel Function) that holds the
// secret and proxy requests through it — never expose secret keys here.

export interface QuoteResult {
  ticker: string
  name?: string
  price: number
  change: number
  changePercent: number
  dayHigh?: number
  dayLow?: number
  volume?: number
  currency?: string
  history?: { date: string; close: number }[]
}

const BASE_URL = 'https://brapi.dev/api'
// Optional token for higher rate limits / extended history. Safe to leave
// empty — the public tier works for basic quotes without one.
const TOKEN = import.meta.env.VITE_BRAPI_TOKEN as string | undefined

function withToken(url: string): string {
  if (!TOKEN) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}token=${TOKEN}`
}

// Live ticker search across every B3 symbol via brapi's free /available
// endpoint (accepts a `search` term). Returns a list of matching symbols.
// Used as a fallback so the app covers all listed tickers, not just the
// curated local catalog. Fails soft (empty list) when offline/rate-limited.
export async function searchAvailable(query: string): Promise<string[]> {
  const q = query.trim()
  if (!q) return []
  try {
    const res = await fetch(withToken(`${BASE_URL}/available?search=${encodeURIComponent(q)}`))
    if (!res.ok) return []
    const data = await res.json()
    const stocks = Array.isArray(data?.stocks) ? (data.stocks as string[]) : []
    return stocks
  } catch {
    return []
  }
}

export async function getQuote(ticker: string): Promise<QuoteResult | null> {
  try {
    const url = withToken(`${BASE_URL}/quote/${encodeURIComponent(ticker.toUpperCase())}?range=6mo&interval=1d`)
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const result = data?.results?.[0]
    if (!result) return null
    return {
      ticker: result.symbol,
      name: result.longName || result.shortName,
      price: result.regularMarketPrice,
      change: result.regularMarketChange,
      changePercent: result.regularMarketChangePercent,
      dayHigh: result.regularMarketDayHigh,
      dayLow: result.regularMarketDayLow,
      volume: result.regularMarketVolume,
      currency: result.currency,
      history: (result.historicalDataPrice || []).map((h: { date: number; close: number }) => ({
        date: new Date(h.date * 1000).toISOString().slice(0, 10),
        close: h.close
      }))
    }
  } catch {
    return null
  }
}

export interface MarketListItem {
  ticker: string
  name: string
  price: number
  changePercent: number
  volume?: number
  marketCap?: number
  sector?: string
  type: 'stock' | 'fund' | 'bdr'
  subType?: string
}

// Broad market listing via brapi's /quote/list — returns hundreds of tickers
// at once (sector, type, change, volume, market cap included), so it can back
// "show everything" views (top movers, sector filters) without one request per
// ticker. Needs a brapi token for full coverage; fails soft (empty list) when
// unavailable so callers can fall back to a smaller curated set.
export async function listQuotes(opts: {
  sortBy?: 'change' | 'volume' | 'market_cap_basic' | 'name'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  page?: number
  sector?: string
  type?: 'stock' | 'fund' | 'bdr'
  subType?: string
  search?: string
} = {}): Promise<MarketListItem[]> {
  try {
    const params = new URLSearchParams()
    if (opts.sortBy) params.set('sortBy', opts.sortBy)
    if (opts.sortOrder) params.set('sortOrder', opts.sortOrder)
    if (opts.limit) params.set('limit', String(opts.limit))
    if (opts.page) params.set('page', String(opts.page))
    if (opts.sector) params.set('sector', opts.sector)
    if (opts.type) params.set('type', opts.type)
    if (opts.subType) params.set('subType', opts.subType)
    if (opts.search) params.set('search', opts.search)
    const url = withToken(`${BASE_URL}/quote/list?${params.toString()}`)
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    const stocks = Array.isArray(data?.stocks) ? data.stocks : []
    return stocks
      .filter((s: { stock?: string; close?: number }) => s.stock && typeof s.close === 'number')
      .map((s: Record<string, unknown>) => ({
        ticker: s.stock as string,
        name: (s.name as string) || (s.stock as string),
        price: s.close as number,
        changePercent: (s.change as number) ?? 0,
        volume: s.volume as number | undefined,
        marketCap: s.market_cap as number | undefined,
        sector: (s.sector as string) || undefined,
        type: (s.type as MarketListItem['type']) || 'stock',
        subType: (s.subType as string) || undefined
      }))
  } catch {
    return []
  }
}

export async function getMultipleQuotes(tickers: string[]): Promise<QuoteResult[]> {
  const results = await Promise.all(tickers.map(t => getQuote(t)))
  return results.filter((r): r is QuoteResult => r !== null)
}

// Fetches many tickers in a single request (brapi accepts a comma-separated
// list). Lighter on the public rate limit than one call per ticker. History is
// omitted here to keep the payload small — use getQuote for a single asset's
// detail view. Falls back to per-ticker fetches if the batch endpoint fails.
export async function getQuotesBatch(tickers: string[]): Promise<QuoteResult[]> {
  if (tickers.length === 0) return []
  try {
    const list = tickers.map(t => encodeURIComponent(t.toUpperCase())).join(',')
    const res = await fetch(withToken(`${BASE_URL}/quote/${list}`))
    if (!res.ok) return getMultipleQuotes(tickers)
    const data = await res.json()
    const results = Array.isArray(data?.results) ? data.results : []
    const mapped: QuoteResult[] = results
      .filter((r: { regularMarketPrice?: number }) => typeof r?.regularMarketPrice === 'number')
      .map((r: Record<string, unknown>) => ({
        ticker: r.symbol as string,
        name: (r.longName as string) || (r.shortName as string),
        price: r.regularMarketPrice as number,
        change: (r.regularMarketChange as number) ?? 0,
        changePercent: (r.regularMarketChangePercent as number) ?? 0,
        dayHigh: r.regularMarketDayHigh as number | undefined,
        dayLow: r.regularMarketDayLow as number | undefined,
        volume: r.regularMarketVolume as number | undefined,
        currency: r.currency as string | undefined
      }))
    return mapped.length > 0 ? mapped : getMultipleQuotes(tickers)
  } catch {
    return getMultipleQuotes(tickers)
  }
}

export function computePeriodPerformance(history: { date: string; close: number }[] | undefined, days: number): number | null {
  if (!history || history.length === 0) return null
  const last = history[history.length - 1]
  const targetTime = new Date(last.date).getTime() - days * 86400000
  let closest = history[0]
  for (const h of history) {
    if (new Date(h.date).getTime() <= targetTime) closest = h
  }
  if (closest.close === 0) return null
  return ((last.close - closest.close) / closest.close) * 100
}

export function computeVolatility(history: { date: string; close: number }[] | undefined): number | null {
  if (!history || history.length < 2) return null
  const returns: number[] = []
  for (let i = 1; i < history.length; i++) {
    returns.push((history[i].close - history[i - 1].close) / history[i - 1].close)
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length
  return Math.sqrt(variance) * Math.sqrt(252) * 100 // annualized, in %
}
