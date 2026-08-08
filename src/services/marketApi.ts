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

export async function getMultipleQuotes(tickers: string[]): Promise<QuoteResult[]> {
  const results = await Promise.all(tickers.map(t => getQuote(t)))
  return results.filter((r): r is QuoteResult => r !== null)
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
