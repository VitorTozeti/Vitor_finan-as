// Regenerates src/data/b3-tickers.json — the local "rustic database" of B3
// tickers committed to the repo. Uses brapi.dev's free endpoints:
//   1. GET /api/available            → every listed symbol
//   2. GET /api/quote/A,B,C,...      → longName + type (batched)
//
// Usage:
//   node scripts/gen-tickers.mjs                 (public tier, may be rate-limited)
//   BRAPI_TOKEN=xxxxx node scripts/gen-tickers.mjs   (higher limits, more names)
//
// The public tier is rate-limited, so we fetch names in small batches with a
// pause between them. If a name can't be fetched the symbol is still kept
// (label falls back to the symbol). Then commit the regenerated JSON.

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const BASE = 'https://brapi.dev/api'
const TOKEN = process.env.BRAPI_TOKEN
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'b3-tickers.json')

const withToken = (url) => (TOKEN ? `${url}${url.includes('?') ? '&' : '?'}token=${TOKEN}` : url)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Classify by ticker shape: FIIs and most ETFs end in 11; the rest are stocks.
function classify(symbol) {
  if (/11$/.test(symbol)) return 'FII/ETF'
  return 'Ação'
}

async function main() {
  console.log('Buscando lista de símbolos...')
  const availRes = await fetch(withToken(`${BASE}/available`))
  const avail = await availRes.json()
  const symbols = (avail?.stocks || avail?.indexes || []).filter(Boolean)
  if (symbols.length === 0) throw new Error('Nenhum símbolo retornado por /available')
  console.log(`${symbols.length} símbolos. Buscando nomes em lotes...`)

  const names = new Map()
  const BATCH = 15
  for (let i = 0; i < symbols.length; i += BATCH) {
    const slice = symbols.slice(i, i + BATCH)
    try {
      const res = await fetch(withToken(`${BASE}/quote/${slice.join(',')}`))
      const data = await res.json()
      for (const r of data?.results || []) {
        if (r?.symbol) names.set(r.symbol, r.longName || r.shortName || r.symbol)
      }
    } catch {
      /* keep going — missing names fall back to the symbol */
    }
    if (i % 150 === 0) console.log(`  ${i}/${symbols.length}`)
    await sleep(TOKEN ? 120 : 700)
  }

  const out = symbols
    .map((s) => ({ ticker: s, name: names.get(s) || s, kind: classify(s) }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker))

  await writeFile(OUT, JSON.stringify(out, null, 0) + '\n', 'utf8')
  console.log(`Gravado ${out.length} tickers em ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
