// Cloudflare Worker — proxy seguro entre o app (estático) e o Pluggy.

const PLUGGY_API = 'https://api.pluggy.ai'
const ALLOWED_ORIGIN = 'https://vitortozeti.github.io'
const DEFAULT_MONTHS = 24
const ITEM_POLL_MAX_MS = 90000
const ITEM_POLL_INTERVAL_MS = 2500

function getOriginHeader(request) {
  const origin = request?.headers?.get('Origin') || ''
  if (
    origin === 'https://vitortozeti.github.io' ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
  ) {
    return origin
  }
  return 'https://vitortozeti.github.io'
}

function corsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getOriginHeader(request),
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  }
}

function json(body, status = 200, request = null) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) })
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function getApiKey(env) {
  const res = await fetch(`${PLUGGY_API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: env.PLUGGY_CLIENT_ID,
      clientSecret: env.PLUGGY_CLIENT_SECRET
    })
  })
  if (!res.ok) throw new Error('Falha ao autenticar no Pluggy')
  const data = await res.json()
  return data.apiKey
}

async function pluggyGet(apiKey, path) {
  const res = await fetch(`${PLUGGY_API}${path}`, { headers: { 'X-API-KEY': apiKey } })
  if (!res.ok) throw new Error(`Pluggy GET ${path} falhou (${res.status})`)
  return res.json()
}

async function waitItemReady(apiKey, itemId) {
  const deadline = Date.now() + ITEM_POLL_MAX_MS
  let item = await pluggyGet(apiKey, `/items/${encodeURIComponent(itemId)}`)
  while (Date.now() < deadline) {
    const status = item.status
    if (status !== 'UPDATING' && status !== 'CREATING' && status !== 'LOGIN_IN_PROGRESS') {
      break
    }
    await sleep(ITEM_POLL_INTERVAL_MS)
    item = await pluggyGet(apiKey, `/items/${encodeURIComponent(itemId)}`)
  }
  return item
}

async function fetchAllTransactions(apiKey, accountId, from) {
  const all = []
  let cursorAfter = null
  let safetyCounter = 0
 
  while (safetyCounter < 50) {
    safetyCounter++
 
    const qs = new URLSearchParams({ accountId })
    if (from) qs.set('dateFrom', from)
    if (cursorAfter) qs.set('after', cursorAfter)
 
    const data = await pluggyGet(apiKey, `/v2/transactions?${qs.toString()}`)
    const results = data.results || []
    all.push(...results)
 
    if (!data.next || results.length === 0) break
 
    // data.next pode vir como:
    //   - cursor opaco puro (ex.: "MjAyMC0xMC0xNVQwMDowM...")
    //   - query string ou URL completa contendo "after=..."
    if (data.next.includes('after=')) {
      try {
        const parsed = new URL(data.next.startsWith('http') ? data.next : `https://api.pluggy.ai${data.next}`)
        cursorAfter = parsed.searchParams.get('after') || data.next
      } catch {
        cursorAfter = data.next
      }
    } else {
      cursorAfter = data.next
    }
  }
  return all
}

function normalizeTx(t, account) {
  const isCredit = account?.type === 'CREDIT'
  const tag = account
    ? (isCredit ? `Cartão ${account.name || account.marketingName || ''}`.trim() : (account.name || account.marketingName || ''))
    : ''
  const baseDesc = t.description || t.descriptionRaw || 'Lançamento'

  let type = 'expense'
  if (isCredit) {
    type = t.amount < 0 ? 'income' : 'expense'
  } else {
    type = t.amount < 0 ? 'expense' : 'income'
  }

  let paymentMethod = 'Débito'
  if (isCredit) {
    paymentMethod = 'Crédito'
  } else if (t.paymentData?.paymentMethod === 'PIX' || /(^|\s)pix(\s|$)/i.test(baseDesc)) {
    paymentMethod = 'Pix'
  }

  return {
    date: String(t.date).slice(0, 10),
    amount: Math.abs(t.amount),
    type,
    description: tag ? `${baseDesc} · ${tag}` : baseDesc,
    categoryId: 'outros',
    rawCategory: t.category || t.categorySlug || null,
    paymentMethod,
    fitid: t.id
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) })
    }

    try {
      if (url.pathname === '/connect-token' && request.method === 'POST') {
        const apiKey = await getApiKey(env)
        const res = await fetch(`${PLUGGY_API}/connect_token`, {
          method: 'POST',
          headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
        const data = await res.json()
        return json({ accessToken: data.accessToken }, 200, request)
      }

      if (url.pathname.startsWith('/transactions/') && request.method === 'GET') {
        const itemId = decodeURIComponent(url.pathname.slice('/transactions/'.length))
        if (!itemId) return json({ error: 'itemId ausente' }, 400, request)
        const apiKey = await getApiKey(env)

        let from = url.searchParams.get('from')
        if (!from) {
          const months = Number(url.searchParams.get('months')) || DEFAULT_MONTHS
          const d = new Date()
          d.setMonth(d.getMonth() - months)
          from = d.toISOString().slice(0, 10)
        }

        const item = await waitItemReady(apiKey, itemId)
        if (item.status === 'LOGIN_ERROR' || item.status === 'INVALID_CREDENTIALS') {
          return json({ error: 'Falha no login do banco. Reconecte a conta.', status: item.status }, 400, request)
        }

        const accounts = (await pluggyGet(apiKey, `/accounts?itemId=${encodeURIComponent(itemId)}`)).results || []

        const transactions = []
        for (const acc of accounts) {
          const raw = await fetchAllTransactions(apiKey, acc.id, from)
          for (const t of raw) transactions.push(normalizeTx(t, acc))
        }

        let investments = []
        let investmentsError = null
        try {
          investments = (await pluggyGet(apiKey, `/investments?itemId=${encodeURIComponent(itemId)}`)).results || []
        } catch (err) {
          console.error('Erro ao buscar investimentos:', err)
          investmentsError = err?.message || String(err)
          investments = []
        }

        const accountSummary = accounts.map(a => ({
          id: a.id,
          name: a.name || a.marketingName || null,
          type: a.type,
          subtype: a.subtype || null,
          number: a.number || null,
          balance: a.balance ?? null,
          currency: a.currencyCode || 'BRL',
          creditLimit: a.creditData?.creditLimit ?? null,
          availableLimit: a.creditData?.availableCreditLimit ?? null
        }))

        return json({
          transactions,
          accounts: accountSummary,
          investments: investments.map(i => {
            // Campos do Pluggy (schema de Investment):
            //   value          → preço/cota UNITÁRIO atual
            //   quantity       → nº de cotas/unidades
            //   balance/amount → valor TOTAL atual da posição (patrimônio)
            //   amountOriginal → valor total investido (custo)
            const num = v => (typeof v === 'number' && isFinite(v) ? v : Number(v)) || 0
            const unitPrice = num(i.value)
            const balance = num(i.balance)
            const amount = num(i.amount)
            const amountOriginal = num(i.amountOriginal) || num(i.originalAmount)

            // Valor de mercado atual (total) da posição.
            const marketValue = balance || amount || (unitPrice && num(i.quantity) ? unitPrice * num(i.quantity) : 0)
            // Quantidade (deriva do total / preço unitário quando não vier).
            const quantity = num(i.quantity) || (unitPrice ? marketValue / unitPrice : 0) || 1
            // Preço médio de custo por unidade.
            let avgPrice = amountOriginal && quantity ? amountOriginal / quantity : 0
            if (!avgPrice) avgPrice = unitPrice || (marketValue && quantity ? marketValue / quantity : 0)

            let code = i.code || i.symbol || i.ticker || i.isin || ''
            if (!code && i.name) {
              const tickerMatch = i.name.match(/\b([A-Z]{4}(?:3|4|11|5|6|33|34))\b/i)
              if (tickerMatch) code = tickerMatch[1].toUpperCase()
            }

            const round2 = n => Math.round(n * 100) / 100
            return {
              code: code || i.name,
              name: i.name,
              type: i.type,
              subtype: i.subtype || null,
              quantity: Math.round(quantity * 1e6) / 1e6,
              price: round2(unitPrice || (quantity ? marketValue / quantity : 0)),
              originalAmount: round2(amountOriginal || avgPrice * quantity),
              avgPrice: round2(avgPrice),
              marketValue: round2(marketValue),
              balance: balance || null,
              value: unitPrice || null,
              currency: i.currencyCode || 'BRL'
            }
          }),
          meta: {
            itemStatus: item.status,
            from,
            accountsCount: accounts.length,
            transactionsCount: transactions.length,
            investmentsCount: investments.length,
            investmentsError
          }
        }, 200, request)
      }

      return json({ error: 'not found' }, 404, request)
    } catch (err) {
      return json({ error: err.message || 'erro interno' }, 500, request)
    }
  }
}
