// GreenFinance — Cloudflare Worker.
//
// Serve o app (assets estáticos do Vite, binding ASSETS) e a API em /api/*:
//   POST /api/auth/register   {email, password, name?}  → {token, user}
//   POST /api/auth/login      {email, password}         → {token, user}
//   POST /api/auth/logout
//   GET  /api/me                                         → {user}
//   GET  /api/state                                      → {data, version, updatedAt}
//   PUT  /api/state           {data, baseVersion}        → {version, updatedAt} | 409
//   POST /api/connect-token   {itemId?}                  → {accessToken}
//   GET  /api/items                                      → {items}
//   DELETE /api/items/:itemId
//   GET  /api/bank/:itemId?months=24                      → {transactions, accounts, investments, meta}
//   GET  /api/brapi/<quote|available|quote/list>...        → proxy brapi.dev (token no servidor + cache)
//
// Todo dado é isolado por usuário: a sessão (Bearer token) identifica o
// usuário e cada conexão Pluggy é criada com clientUserId = id do usuário,
// então ninguém consegue ler o banco de outra pessoa adivinhando o itemId.

const PLUGGY_API = 'https://api.pluggy.ai'
const BRAPI_API = 'https://brapi.dev/api'
const DEFAULT_MONTHS = 24
// Workers grátis permitem ~50 chamadas externas por requisição: polling curto.
const ITEM_POLL_MAX_MS = 40000
const ITEM_POLL_INTERVAL_MS = 4000
const MAX_POSITION_LOOKUPS = 10
const SESSION_DAYS = 30
const PBKDF2_ITERATIONS = 100000
const MAX_STATE_BYTES = 1_900_000
const QUOTE_CACHE_SECONDS = 60
const LOGIN_MAX_FAILS = 8
const LOGIN_WINDOW_MIN = 15

// ───────────────────────── utilidades HTTP ─────────────────────────

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || ''
  // Mesma origem (app servido por este Worker) não precisa de CORS; libera só o dev local.
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      Vary: 'Origin'
    }
  }
  return {}
}

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(request)
    }
  })
}

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    throw new HttpError(400, 'JSON inválido')
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
const nowIso = () => new Date().toISOString()

// ───────────────────────── cripto / sessão ─────────────────────────

const enc = new TextEncoder()

function b64url(bytes) {
  let s = ''
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

function randomToken(len = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(len)))
}

async function sha256(text) {
  return b64url(await crypto.subtle.digest('SHA-256', enc.encode(text)))
}

async function hashPassword(password, saltB64) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64url(saltB64), iterations: PBKDF2_ITERATIONS },
    key,
    256
  )
  return b64url(bits)
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function createSession(env, userId) {
  const token = randomToken()
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString()
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, expires, nowIso())
    .run()
  return token
}

async function requireUser(request, env) {
  const auth = request.headers.get('Authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) throw new HttpError(401, 'Faça login para continuar')
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, s.expires_at, s.token_hash FROM sessions s
     JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`
  )
    .bind(await sha256(token))
    .first()
  if (!row) throw new HttpError(401, 'Sessão inválida. Entre novamente.')
  if (row.expires_at < nowIso()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(row.token_hash).run()
    throw new HttpError(401, 'Sessão expirada. Entre novamente.')
  }
  return { id: row.id, email: row.email, name: row.name, tokenHash: row.token_hash }
}

const publicUser = u => ({ id: u.id, email: u.email, name: u.name || null })
const normalizeEmail = email => String(email || '').trim().toLowerCase()

// ───────────────────────── auth ─────────────────────────

async function register(request, env) {
  const body = await readJson(request)
  const email = normalizeEmail(body.email)
  const password = String(body.password || '')
  const name = String(body.name || '').trim().slice(0, 80) || null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw new HttpError(400, 'E-mail inválido')
  if (password.length < 8) throw new HttpError(400, 'A senha precisa ter pelo menos 8 caracteres')
  if (password.length > 200) throw new HttpError(400, 'Senha longa demais')

  const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (exists) throw new HttpError(409, 'Já existe uma conta com esse e-mail')

  const id = crypto.randomUUID()
  const salt = randomToken(16)
  const hash = await hashPassword(password, salt)
  await env.DB.prepare('INSERT INTO users (id, email, name, pass_hash, pass_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, email, name, hash, salt, nowIso())
    .run()
  const token = await createSession(env, id)
  return json(request, { token, user: publicUser({ id, email, name }) }, 201)
}

async function login(request, env) {
  const body = await readJson(request)
  const email = normalizeEmail(body.email)
  const password = String(body.password || '')

  const since = new Date(Date.now() - LOGIN_WINDOW_MIN * 60000).toISOString()
  const fails = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE email = ? AND at > ?')
    .bind(email, since)
    .first()
  if ((fails?.n || 0) >= LOGIN_MAX_FAILS) {
    throw new HttpError(429, `Muitas tentativas. Tente de novo em ${LOGIN_WINDOW_MIN} minutos.`)
  }

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()
  const ok = user && timingSafeEqual(await hashPassword(password, user.pass_salt), user.pass_hash)
  if (!ok) {
    await env.DB.prepare('INSERT INTO login_attempts (email, at) VALUES (?, ?)').bind(email, nowIso()).run()
    throw new HttpError(401, 'E-mail ou senha incorretos')
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM login_attempts WHERE email = ? OR at < ?').bind(email, since),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').bind(user.id, nowIso())
  ])
  const token = await createSession(env, user.id)
  return json(request, { token, user: publicUser(user) })
}

async function logout(request, env) {
  const user = await requireUser(request, env)
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(user.tokenHash).run()
  return json(request, { ok: true })
}

// ───────────────────────── estado na nuvem ─────────────────────────

async function readStateRow(env, userId) {
  return env.DB.prepare('SELECT data, version, updated_at FROM user_state WHERE user_id = ?').bind(userId).first()
}

async function getState(request, env) {
  const user = await requireUser(request, env)
  const row = await readStateRow(env, user.id)
  if (!row) return json(request, { data: null, version: 0, updatedAt: null })
  return json(request, { data: JSON.parse(row.data), version: row.version, updatedAt: row.updated_at })
}

async function putState(request, env) {
  const user = await requireUser(request, env)
  const body = await readJson(request)
  if (!body || typeof body.data !== 'object' || body.data === null) throw new HttpError(400, 'Campo data ausente')
  const text = JSON.stringify(body.data)
  if (text.length > MAX_STATE_BYTES) {
    throw new HttpError(
      413,
      'Seus dados passaram do limite da nuvem (≈1,9 MB). Exporte um backup e apague lançamentos antigos.'
    )
  }
  const baseVersion = Number(body.baseVersion) || 0
  const row = await readStateRow(env, user.id)
  const currentVersion = row?.version || 0

  const conflict = () =>
    json(
      request,
      {
        error: 'Seus dados foram alterados em outro aparelho',
        data: row ? JSON.parse(row.data) : null,
        version: currentVersion,
        updatedAt: row?.updated_at || null
      },
      409
    )
  if (currentVersion !== baseVersion && !body.force) return conflict()

  const next = currentVersion + 1
  const updatedAt = nowIso()
  // UPSERT condicionado à versão lida: não sobrescreve escrita concorrente.
  const res = await env.DB.prepare(
    `INSERT INTO user_state (user_id, data, version, updated_at) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(user_id) DO UPDATE SET data = ?2, version = ?3, updated_at = ?4
     WHERE user_state.version = ?5`
  )
    .bind(user.id, text, next, updatedAt, currentVersion)
    .run()
  if (!res.meta?.changes) throw new HttpError(409, 'Seus dados foram alterados em outro aparelho')
  return json(request, { version: next, updatedAt })
}

// ───────────────────────── Pluggy ─────────────────────────

async function pluggyApiKey(env) {
  if (!env.PLUGGY_CLIENT_ID || !env.PLUGGY_CLIENT_SECRET) {
    throw new HttpError(503, 'Open Finance não configurado no servidor')
  }
  const res = await fetch(`${PLUGGY_API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: env.PLUGGY_CLIENT_ID, clientSecret: env.PLUGGY_CLIENT_SECRET })
  })
  if (!res.ok) throw new HttpError(502, 'Falha ao autenticar no Pluggy')
  return (await res.json()).apiKey
}

async function pluggyGet(apiKey, path) {
  const res = await fetch(`${PLUGGY_API}${path}`, { headers: { 'X-API-KEY': apiKey } })
  if (!res.ok) throw new HttpError(502, `Pluggy GET ${path.split('?')[0]} falhou (${res.status})`)
  return res.json()
}

/** Busca TODAS as páginas de um endpoint paginado (page/totalPages).
 * Antes o /investments lia só a 1ª página (20 itens) e ativos sumiam. */
async function pluggyGetAllPages(apiKey, path, pageSize = 500) {
  const all = []
  const sep = path.includes('?') ? '&' : '?'
  for (let page = 1; page <= 50; page++) {
    const data = await pluggyGet(apiKey, `${path}${sep}pageSize=${pageSize}&page=${page}`)
    const results = data.results || []
    all.push(...results)
    const totalPages = Number(data.totalPages) || 1
    if (page >= totalPages || !results.length) break
  }
  return all
}

async function waitItemReady(apiKey, itemId) {
  const deadline = Date.now() + ITEM_POLL_MAX_MS
  let item = await pluggyGet(apiKey, `/items/${encodeURIComponent(itemId)}`)
  while (Date.now() < deadline && ['UPDATING', 'CREATING', 'LOGIN_IN_PROGRESS'].includes(item.status)) {
    await sleep(ITEM_POLL_INTERVAL_MS)
    item = await pluggyGet(apiKey, `/items/${encodeURIComponent(itemId)}`)
  }
  return item
}

/** Garante que o item Pluggy pertence ao usuário logado. */
async function assertItemOwner(env, apiKey, user, itemId) {
  const item = await pluggyGet(apiKey, `/items/${encodeURIComponent(itemId)}`)
  if (item.clientUserId === user.id) return item
  const row = await env.DB.prepare('SELECT user_id FROM pluggy_items WHERE item_id = ?').bind(itemId).first()
  if (row?.user_id === user.id) return item
  // Item sem dono (criado antes da correção do clientUserId): fica com o
  // primeiro usuário que o sincroniza. Item de outra pessoa → recusado.
  if (!row && !item.clientUserId) return item
  throw new HttpError(404, 'Conexão bancária não encontrada')
}

async function connectToken(request, env) {
  const user = await requireUser(request, env)
  const body = (request.headers.get('Content-Type') || '').includes('json') ? await readJson(request) : {}
  const apiKey = await pluggyApiKey(env)
  // A Pluggy espera clientUserId dentro de "options" (fora dele é ignorado).
  const payload = { options: { clientUserId: user.id } }
  if (body?.itemId) {
    await assertItemOwner(env, apiKey, user, String(body.itemId))
    payload.itemId = String(body.itemId) // modo "atualizar conexão"
  }
  const res = await fetch(`${PLUGGY_API}/connect_token`, {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new HttpError(502, 'Falha ao gerar token de conexão')
  const data = await res.json()
  return json(request, { accessToken: data.accessToken })
}

async function listItems(request, env) {
  const user = await requireUser(request, env)
  const { results } = await env.DB.prepare(
    `SELECT item_id AS itemId, connector, last_sync_at AS lastSyncAt, created_at AS createdAt
     FROM pluggy_items WHERE user_id = ? ORDER BY created_at`
  )
    .bind(user.id)
    .all()
  return json(request, { items: results || [] })
}

async function deleteItem(request, env, itemId) {
  const user = await requireUser(request, env)
  const apiKey = await pluggyApiKey(env)
  await assertItemOwner(env, apiKey, user, itemId)
  await fetch(`${PLUGGY_API}/items/${encodeURIComponent(itemId)}`, { method: 'DELETE', headers: { 'X-API-KEY': apiKey } })
  await env.DB.prepare('DELETE FROM pluggy_items WHERE item_id = ? AND user_id = ?').bind(itemId, user.id).run()
  return json(request, { ok: true })
}

async function fetchAllTransactions(apiKey, accountId, from) {
  const all = []
  let cursorAfter = null
  for (let i = 0; i < 50; i++) {
    const qs = new URLSearchParams({ accountId })
    if (from) qs.set('dateFrom', from)
    if (cursorAfter) qs.set('after', cursorAfter)
    const data = await pluggyGet(apiKey, `/v2/transactions?${qs.toString()}`)
    const results = data.results || []
    all.push(...results)
    if (!data.next || results.length === 0) break
    if (data.next.includes('after=')) {
      try {
        const parsed = new URL(data.next.startsWith('http') ? data.next : `${PLUGGY_API}${data.next}`)
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
  const accName = account?.name || account?.marketingName || ''
  const tag = account ? (isCredit ? `Cartão ${accName}`.trim() : accName) : ''
  const baseDesc = t.description || t.descriptionRaw || 'Lançamento'
  const type = isCredit ? (t.amount < 0 ? 'income' : 'expense') : t.amount < 0 ? 'expense' : 'income'
  let paymentMethod = 'Débito'
  if (isCredit) paymentMethod = 'Crédito'
  else if (t.paymentData?.paymentMethod === 'PIX' || /(^|\s)pix(\s|$)/i.test(baseDesc)) paymentMethod = 'Pix'
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

// ── Investimentos ──

const num = v => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d

// Ticker B3: 4 letras + 1–2 dígitos (PETR4, TAEE11, BOVA11, AAPL34), com "F" opcional (fracionário).
const TICKER_RE = /\b([A-Z]{4}\d{1,2})F?\b/

/** Extrai o ticker B3 de code/name, removendo ".SA" e o "F" do fracionário. */
function extractTicker(i) {
  for (const c of [i.code, i.symbol, i.ticker, i.name]) {
    if (!c) continue
    const m = String(c).toUpperCase().replace(/\.SA\b/, '').match(TICKER_RE)
    if (m) return m[1]
  }
  return null
}

/** Ativos negociados em bolsa (têm cotação ao vivo na brapi). */
function isListed(i) {
  const t = String(i.type || '').toUpperCase()
  const st = String(i.subtype || '').toUpperCase()
  return t === 'EQUITY' || t === 'ETF' || ['STOCK', 'REAL_ESTATE_FUND', 'BDR', 'ETF'].includes(st)
}

/** Reconstrói cotas e custo somando compras − vendas, para quando o banco não
 * informa quantity/amountOriginal da posição. */
async function positionFromTransactions(apiKey, investmentId) {
  let txs
  try {
    txs = await pluggyGetAllPages(apiKey, `/investments/${encodeURIComponent(investmentId)}/transactions`)
  } catch {
    return null
  }
  let qty = 0
  let cost = 0
  const sorted = txs.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)))
  for (const t of sorted) {
    const q = Math.abs(num(t.quantity))
    if (!q) continue
    const amount = Math.abs(num(t.amount) || num(t.netAmount) || q * num(t.value))
    const type = String(t.type || t.movementType || '').toUpperCase()
    if (['BUY', 'TRANSFER_IN', 'SUBSCRIPTION'].includes(type)) {
      qty += q
      cost += amount
    } else if (['SELL', 'TRANSFER_OUT', 'REDEMPTION'].includes(type)) {
      const avg = qty > 0 ? cost / qty : 0 // venda baixa o custo pelo preço médio
      qty = Math.max(0, qty - q)
      cost = Math.max(0, cost - avg * q)
    }
  }
  return qty > 0 ? { quantity: qty, cost } : null
}

async function normalizeInvestment(apiKey, i, itemId, budget = { left: MAX_POSITION_LOOKUPS }) {
  const ticker = extractTicker(i)
  const listed = isListed(i) && !!ticker
  const unitPrice = num(i.value) // Pluggy: valor UNITÁRIO da cota
  const balance = num(i.balance) // valor TOTAL atual (líquido)
  const gross = num(i.amount) // valor TOTAL bruto
  let quantity = num(i.quantity)
  let cost = num(i.amountOriginal) || num(i.originalAmount)

  if (listed && (!quantity || !cost) && i.id && budget.left-- > 0) {
    const pos = await positionFromTransactions(apiKey, i.id)
    if (pos) {
      if (!quantity) quantity = pos.quantity
      if (!cost) cost = pos.cost
    }
  }

  const marketValue = balance || gross || (unitPrice && quantity ? unitPrice * quantity : 0)
  if (!quantity && unitPrice > 0 && marketValue > 0) quantity = marketValue / unitPrice
  // Renda fixa / fundos sem cota: a posição vira 1 unidade com o valor total.
  const quantityKnown = quantity > 0
  if (!quantityKnown) quantity = 1
  const price = unitPrice || marketValue / quantity
  const avgPrice = cost ? cost / quantity : price

  return {
    externalId: i.id || null,
    itemId,
    ticker: listed ? ticker : null,
    code: ticker || i.code || i.isin || i.name || null,
    name: i.name || ticker || 'Investimento',
    type: i.type || null,
    subtype: i.subtype || null,
    listed,
    quantity: round(quantity, 6),
    quantityKnown,
    price: round(price, 4),
    avgPrice: round(avgPrice, 4),
    originalAmount: round(cost || avgPrice * quantity),
    marketValue: round(marketValue),
    currency: i.currencyCode || 'BRL',
    status: i.status || null,
    dueDate: i.dueDate || null
  }
}

async function bankData(request, env, itemId) {
  const user = await requireUser(request, env)
  const url = new URL(request.url)
  const apiKey = await pluggyApiKey(env)
  await assertItemOwner(env, apiKey, user, itemId)

  let from = url.searchParams.get('from')
  if (!from) {
    const months = Number(url.searchParams.get('months')) || DEFAULT_MONTHS
    const d = new Date()
    d.setMonth(d.getMonth() - months)
    from = d.toISOString().slice(0, 10)
  }

  const item = await waitItemReady(apiKey, itemId)
  if (item.status === 'LOGIN_ERROR' || item.status === 'INVALID_CREDENTIALS') {
    throw new HttpError(400, 'Falha no login do banco. Reconecte a conta.', { status: item.status })
  }

  const accounts = await pluggyGetAllPages(apiKey, `/accounts?itemId=${encodeURIComponent(itemId)}`)
  const transactions = []
  for (const acc of accounts) {
    const raw = await fetchAllTransactions(apiKey, acc.id, from)
    for (const t of raw) transactions.push(normalizeTx(t, acc))
  }

  let investments = []
  let investmentsError = null
  try {
    const raw = await pluggyGetAllPages(apiKey, `/investments?itemId=${encodeURIComponent(itemId)}`)
    const active = raw.filter(i => i.status !== 'TOTAL_WITHDRAWAL')
    const budget = { left: MAX_POSITION_LOOKUPS }
    investments = (await Promise.all(active.map(i => normalizeInvestment(apiKey, i, itemId, budget)))).filter(
      i => i.marketValue > 0 || i.quantityKnown
    )
  } catch (err) {
    investmentsError = err?.message || String(err)
  }

  await env.DB.prepare(
    `INSERT INTO pluggy_items (item_id, user_id, connector, last_sync_at, created_at) VALUES (?1, ?2, ?3, ?4, ?4)
     ON CONFLICT(item_id) DO UPDATE SET last_sync_at = ?4, connector = ?3 WHERE pluggy_items.user_id = ?2`
  )
    .bind(itemId, user.id, item.connector?.name || null, nowIso())
    .run()

  return json(request, {
    transactions,
    accounts: accounts.map(a => ({
      id: a.id,
      name: a.name || a.marketingName || null,
      type: a.type,
      subtype: a.subtype || null,
      number: a.number || null,
      balance: a.balance ?? null,
      currency: a.currencyCode || 'BRL',
      creditLimit: a.creditData?.creditLimit ?? null,
      availableLimit: a.creditData?.availableCreditLimit ?? null
    })),
    investments,
    meta: {
      itemId,
      connector: item.connector?.name || null,
      itemStatus: item.status,
      from,
      accountsCount: accounts.length,
      transactionsCount: transactions.length,
      investmentsCount: investments.length,
      investmentsError
    }
  })
}

// ───────────────────────── brapi (cotações) ─────────────────────────

async function brapiFetchCached(env, ctx, path, params) {
  const qs = new URLSearchParams(params)
  qs.delete('token')
  qs.sort()
  const cacheKey = new Request(`https://brapi-cache.greenfinance.internal/${path}?${qs.toString()}`)
  const cache = caches.default
  const hit = await cache.match(cacheKey)
  if (hit) return hit.json()

  if (env.BRAPI_TOKEN) qs.set('token', env.BRAPI_TOKEN)
  const res = await fetch(`${BRAPI_API}/${path}?${qs.toString()}`, { headers: { Accept: 'application/json' } })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data) return { results: [], error: data?.message || `brapi ${res.status}` }
  ctx.waitUntil(
    cache.put(
      cacheKey,
      new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${QUOTE_CACHE_SECONDS}` }
      })
    )
  )
  return data
}

const YAHOO_SPARK = 'https://query1.finance.yahoo.com/v7/finance/spark'

/** Ticker B3 → símbolo do Yahoo (PETR4 → PETR4.SA; índices como ^BVSP ficam iguais). */
const toYahoo = t => (t.startsWith('^') || t.includes('.') ? t : `${t}.SA`)

/** Cotações gratuitas do Yahoo Finance no MESMO formato da brapi
 * (regularMarketPrice, regularMarketChangePercent, historicalDataPrice…),
 * para o app não precisar saber de onde veio. */
async function yahooQuotes(tickers, withHistory) {
  const out = []
  for (let i = 0; i < tickers.length; i += 20) {
    const chunk = tickers.slice(i, i + 20)
    const qs = new URLSearchParams({
      symbols: chunk.map(toYahoo).join(','),
      range: withHistory ? '6mo' : '5d',
      interval: '1d'
    })
    const res = await fetch(`${YAHOO_SPARK}?${qs}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (GreenFinance)', Accept: 'application/json' }
    })
    if (!res.ok) throw new Error(`yahoo ${res.status}`)
    const data = await res.json()
    const results = data?.spark?.result || []
    for (const r of results) {
      const resp = r.response?.[0]
      const meta = resp?.meta
      const price = meta?.regularMarketPrice
      if (typeof price !== 'number') continue
      const closes = resp.indicators?.quote?.[0]?.close || []
      const times = resp.timestamp || []
      const history = times
        .map((ts, idx) => ({ date: ts, close: closes[idx] }))
        .filter(h => typeof h.close === 'number')
      // Variação do dia: preço atual vs. fechamento anterior.
      const prev =
        history.length >= 2 ? history[history.length - 2].close : meta.chartPreviousClose || meta.previousClose
      const change = prev ? price - prev : 0
      const symbol = chunk.find(t => toYahoo(t) === r.symbol) || r.symbol.replace(/\.SA$/, '')
      out.push({
        symbol,
        shortName: meta.shortName || symbol,
        longName: meta.longName || meta.shortName || symbol,
        regularMarketPrice: price,
        regularMarketChange: change,
        regularMarketChangePercent: prev ? (change / prev) * 100 : 0,
        regularMarketDayHigh: meta.regularMarketDayHigh,
        regularMarketDayLow: meta.regularMarketDayLow,
        regularMarketVolume: meta.regularMarketVolume,
        currency: meta.currency || 'BRL',
        historicalDataPrice: withHistory ? history : undefined,
        source: 'yahoo'
      })
    }
  }
  return out
}

async function brapiProxy(request, env, ctx, subpath) {
  const params = Object.fromEntries(new URL(request.url).searchParams)
  if (subpath === 'available' || subpath === 'quote/list') {
    return json(request, await brapiFetchCached(env, ctx, subpath, params))
  }
  if (subpath.startsWith('quote/')) {
    const tickers = [
      ...new Set(
        decodeURIComponent(subpath.slice('quote/'.length))
          .split(',')
          .map(t => t.trim().toUpperCase())
          .filter(t => /^[A-Z0-9^.]{1,12}$/.test(t))
      )
    ].slice(0, 80)
    if (!tickers.length) throw new HttpError(400, 'Nenhum ticker válido')
    const withHistory = !!params.range

    // Cache da resposta inteira (1 leitura + 1 escrita, poupa chamadas externas).
    const cacheKey = new Request(
      `https://quotes-cache.greenfinance.internal/${[...tickers].sort().join(',')}?h=${withHistory ? 1 : 0}`
    )
    const hit = await caches.default.match(cacheKey)
    if (hit) return json(request, await hit.json())

    // 1) Yahoo Finance (grátis, sem token, até 20 ativos por chamada).
    const found = new Map()
    try {
      for (const q of await yahooQuotes(tickers, withHistory)) found.set(q.symbol, q)
    } catch (err) {
      console.error('yahoo', err)
    }
    // 2) O que faltou: brapi, um por vez (sem token ela só libera alguns ativos).
    const errors = []
    for (const t of tickers.filter(t => !found.has(t)).slice(0, 8)) {
      const data = await brapiFetchCached(env, ctx, `quote/${encodeURIComponent(t)}`, params)
      if (data?.results?.[0]) found.set(t, data.results[0])
      else errors.push({ ticker: t, error: data?.error || 'não encontrado' })
    }
    const body = { results: tickers.filter(t => found.has(t)).map(t => found.get(t)), errors }
    if (body.results.length) {
      ctx.waitUntil(
        caches.default.put(
          cacheKey,
          new Response(JSON.stringify(body), {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${QUOTE_CACHE_SECONDS}` }
          })
        )
      )
    }
    return json(request, body)
  }
  throw new HttpError(404, 'Rota brapi não permitida')
}

// ───────────────────────── roteador ─────────────────────────

async function handleApi(request, env, ctx, url) {
  const path = url.pathname.replace(/^\/api/, '') || '/'
  const m = request.method

  if (path === '/health') return json(request, { ok: true, db: !!env.DB, pluggy: !!env.PLUGGY_CLIENT_ID })
  if (path === '/auth/register' && m === 'POST') return register(request, env)
  if (path === '/auth/login' && m === 'POST') return login(request, env)
  if (path === '/auth/logout' && m === 'POST') return logout(request, env)
  if (path === '/me' && m === 'GET') return json(request, { user: publicUser(await requireUser(request, env)) })
  if (path === '/state' && m === 'GET') return getState(request, env)
  if (path === '/state' && m === 'PUT') return putState(request, env)
  if (path === '/connect-token' && m === 'POST') return connectToken(request, env)
  if (path === '/items' && m === 'GET') return listItems(request, env)
  if (path.startsWith('/items/') && m === 'DELETE') return deleteItem(request, env, decodeURIComponent(path.slice(7)))
  if (path.startsWith('/bank/') && m === 'GET') return bankData(request, env, decodeURIComponent(path.slice(6)))
  if (path.startsWith('/brapi/') && m === 'GET') return brapiProxy(request, env, ctx, path.slice(7))
  throw new HttpError(404, 'Rota não encontrada')
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 })
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) })
    try {
      return await handleApi(request, env, ctx, url)
    } catch (err) {
      if (err instanceof HttpError) return json(request, { error: err.message, ...(err.extra || {}) }, err.status)
      console.error(err)
      return json(request, { error: 'Erro interno' }, 500)
    }
  }
}
