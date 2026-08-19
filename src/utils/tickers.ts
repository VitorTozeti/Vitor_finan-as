// Ticker catalog helpers. The local catalog (src/data/b3-tickers.json) is the
// "rustic database" committed to the repo — it powers instant, offline
// autocomplete. For full market coverage ("todas as ações"), searchTickers also
// queries brapi's free /available endpoint live and merges the results.

import catalog from '../data/b3-tickers.json'
import { searchAvailable } from '../services/marketApi'

export type TickerKind = 'Ação' | 'ETF' | 'FII' | 'FII/ETF'

export interface TickerEntry {
  ticker: string
  name: string
  kind: TickerKind
}

export const TICKER_CATALOG = catalog as TickerEntry[]

const BY_TICKER = new Map(TICKER_CATALOG.map(t => [t.ticker.toUpperCase(), t]))

/** Exact lookup in the local catalog. */
export function findTicker(ticker: string): TickerEntry | undefined {
  return BY_TICKER.get(ticker.trim().toUpperCase())
}

/** Local, synchronous fuzzy search over symbol + company name. */
export function searchLocal(query: string, limit = 8): TickerEntry[] {
  const q = query.trim().toUpperCase()
  if (!q) return []
  const starts: TickerEntry[] = []
  const contains: TickerEntry[] = []
  for (const t of TICKER_CATALOG) {
    const sym = t.ticker.toUpperCase()
    const name = t.name.toUpperCase()
    if (sym.startsWith(q)) starts.push(t)
    else if (sym.includes(q) || name.includes(q)) contains.push(t)
    if (starts.length >= limit) break
  }
  return [...starts, ...contains].slice(0, limit)
}

function guessKind(ticker: string): TickerKind {
  return /11$/.test(ticker) ? 'FII/ETF' : 'Ação'
}

/** Local-first search that falls back to a live brapi lookup so any listed
 * ticker (not just the curated seed) can be found. Local hits are returned
 * immediately by the caller; this resolves the merged, deduped list. */
export async function searchTickers(query: string, limit = 8): Promise<TickerEntry[]> {
  const local = searchLocal(query, limit)
  const seen = new Set(local.map(t => t.ticker.toUpperCase()))
  const out = [...local]
  if (out.length >= limit) return out
  try {
    const live = await searchAvailable(query)
    for (const sym of live) {
      const up = sym.toUpperCase()
      if (seen.has(up)) continue
      seen.add(up)
      const known = BY_TICKER.get(up)
      out.push(known ?? { ticker: up, name: up, kind: guessKind(up) })
      if (out.length >= limit) break
    }
  } catch {
    /* offline / rate-limited — local results still stand */
  }
  return out
}
