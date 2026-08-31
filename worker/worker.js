// Cloudflare Worker — proxy seguro entre o app (estático) e o Pluggy.
//
// POR QUE ISSO EXISTE: o CLIENT_SECRET do Pluggy NUNCA pode ir para o
// frontend (site estático = código público). Este Worker roda no servidor,
// guarda o segredo (via `wrangler secret put`) e é o único que fala com o
// Pluggy usando esse segredo. O app só conhece a URL deste Worker.
//
// Segredos esperados (definidos com `wrangler secret put`, NUNCA no código):
//   PLUGGY_CLIENT_ID
//   PLUGGY_CLIENT_SECRET
//
// Endpoints que o app (src/services/bankApi.ts) já chama:
//   POST /connect-token          -> devolve { accessToken }
//   GET  /transactions/:itemId   -> devolve { transactions: ParsedStatementTx[], accounts, meta }
//        query opcional: ?months=24  (quanto de histórico buscar; padrão 24)
//                        ?from=YYYY-MM-DD  (data inicial explícita; vence months)

const PLUGGY_API = 'https://api.pluggy.ai'

// Restringe quem pode chamar o Worker. Troque pelo domínio do seu app em
// produção (ex.: 'https://vitortozeti.github.io'). '*' facilita o teste local.
const ALLOWED_ORIGIN = 'https://vitortozeti.github.io'

// Quanto de histórico puxar por padrão (meses). O Pluggy, sem `from`, devolve
// só uma janela recente; com `from` explícito ele traz o máximo que o banco
// disponibiliza (normalmente até ~24 meses).
const DEFAULT_MONTHS = 24

// Paginação: o Pluggy limita cada página; buscamos TODAS as páginas.
const PAGE_SIZE = 500

// Quanto tempo esperar o item terminar de sincronizar antes de ler as
// transações. Se lermos cedo demais, a conexão ainda está `UPDATING` e as
// transações (principalmente faturas de cartão) vêm incompletas ou vazias.
const ITEM_POLL_MAX_MS = 90000
const ITEM_POLL_INTERVAL_MS = 2500

// Permite o domínio de produção e qualquer localhost/127.0.0.1 em desenvolvimento.
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

// Troca CLIENT_ID + CLIENT_SECRET por uma apiKey de curta duração do Pluggy.
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

// GET autenticado no Pluggy que já devolve JSON.
async function pluggyGet(apiKey, path) {
  const res = await fetch(`${PLUGGY_API}${path}`, { headers: { 'X-API-KEY': apiKey } })
  if (!res.ok) throw new Error(`Pluggy GET ${path} falhou (${res.status})`)
  return res.json()
}

// Espera o item sair do estado de atualização. Só quando ele chega a um estado
// terminal (UPDATED / LOGIN_ERROR / etc.) é que os dados estão completos.
// PARTIAL_SUCCESS = alguns produtos vieram, outros não — seguimos mesmo assim.
async function waitItemReady(apiKey, itemId) {
  const deadline = Date.now() + ITEM_POLL_MAX_MS
  let item = await pluggyGet(apiKey, `/items/${encodeURIComponent(itemId)}`)
  while (Date.now() < deadline) {
    const status = item.status
    // Estados terminais do Pluggy — não vale mais a pena esperar.
    if (status !== 'UPDATING' && status !== 'CREATING' && status !== 'LOGIN_IN_PROGRESS') {
      break
    }
    await sleep(ITEM_POLL_INTERVAL_MS)
    item = await pluggyGet(apiKey, `/items/${encodeURIComponent(itemId)}`)
  }
  return item
}

// Busca TODAS as transações de uma conta usando o endpoint /v2/transactions
// da Pluggy com paginação por cursor (parâmetro `next`).
// O endpoint antigo /transactions foi descontinuado e retorna 410 Gone.
async function fetchAllTransactions(apiKey, accountId, from) {
  const all = []
  let cursorNext = null
  let safetyCounter = 0

  while (safetyCounter < 50) {
    safetyCounter++

    // Monta a query string com os parâmetros aceitos pelo /v2/transactions
    const qs = new URLSearchParams({ accountId })
    if (from) qs.set('from', from)
    if (cursorNext) qs.set('next', cursorNext)

    const data = await pluggyGet(apiKey, `/v2/transactions?${qs.toString()}`)
    const results = data.results || []
    all.push(...results)

    // Quando não há mais páginas, data.next vem null/undefined ou results vazio.
    if (!data.next || results.length === 0) break

    // data.next pode ser:
    //   - Uma string de cursor opaca (ex.: "MjAyMC0xMC0xNVQwMDowM...")
    //   - Uma URL completa ou parcial com ?next=... embutido
    // Extraímos o valor puro do cursor para passar no próximo request.
    if (data.next.includes('next=')) {
      try {
        const parsed = new URL(data.next.startsWith('http') ? data.next : `https://api.pluggy.ai${data.next}`)
        cursorNext = parsed.searchParams.get('next') || data.next
      } catch {
        cursorNext = data.next
      }
    } else {
      // Cursor opaco simples — usar diretamente
      cursorNext = data.next
    }
  }
  return all
}

// Normaliza uma transação do Pluggy para o formato que o app já consome
// (ParsedStatementTx). Anexa o nome da conta/cartão na descrição para não
// misturar lançamentos de contas e cartões diferentes.
function normalizeTx(t, account) {
  const isCredit = account?.type === 'CREDIT'
  const tag = account
    ? (isCredit ? `Cartão ${account.name || account.marketingName || ''}`.trim() : (account.name || account.marketingName || ''))
    : ''
  const baseDesc = t.description || t.descriptionRaw || 'Lançamento'

  // Na Pluggy:
  // - Em contas correntes/bancárias: valor negativo = débito/gasto (expense), positivo = crédito/depósito (income).
  // - Em cartões de crédito (CREDIT): valor positivo = despesa na fatura (expense), negativo = estorno/pagamento (income).
  let type = 'expense'
  if (isCredit) {
    type = t.amount < 0 ? 'income' : 'expense'
  } else {
    type = t.amount < 0 ? 'expense' : 'income'
  }

  return {
    date: String(t.date).slice(0, 10),
    amount: Math.abs(t.amount),
    type,
    description: tag ? `${baseDesc} · ${tag}` : baseDesc,
    categoryId: 'outros',
    fitid: t.id
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Pré-checagem do navegador (CORS).
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) })
    }

    try {
      // --- Endpoint A: token curto para abrir o widget no app ---
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

      // --- Endpoint B: TODOS os dados de uma conexão (itemId) ---
      // contas + cartões + investimentos, com histórico completo e paginado.
      if (url.pathname.startsWith('/transactions/') && request.method === 'GET') {
        const itemId = decodeURIComponent(url.pathname.slice('/transactions/'.length))
        if (!itemId) return json({ error: 'itemId ausente' }, 400, request)
        const apiKey = await getApiKey(env)

        // Data inicial do histórico: ?from=YYYY-MM-DD tem prioridade;
        // senão ?months (padrão DEFAULT_MONTHS) contados a partir de hoje.
        let from = url.searchParams.get('from')
        if (!from) {
          const months = Number(url.searchParams.get('months')) || DEFAULT_MONTHS
          const d = new Date()
          d.setMonth(d.getMonth() - months)
          from = d.toISOString().slice(0, 10)
        }

        // 1) Esperar o item terminar de sincronizar — senão vem parcial/vazio.
        const item = await waitItemReady(apiKey, itemId)
        if (item.status === 'LOGIN_ERROR' || item.status === 'INVALID_CREDENTIALS') {
          return json({ error: 'Falha no login do banco. Reconecte a conta.', status: item.status }, 400, request)
        }

        // 2) Todas as contas do item (bancárias E cartões de crédito).
        const accounts = (await pluggyGet(apiKey, `/accounts?itemId=${encodeURIComponent(itemId)}`)).results || []

        // 3) Todas as transações de todas as contas, paginadas.
        const transactions = []
        for (const acc of accounts) {
          const raw = await fetchAllTransactions(apiKey, acc.id, from)
          for (const t of raw) transactions.push(normalizeTx(t, acc))
        }

        // 4) Investimentos (best-effort — nem todo banco expõe).
        let investments = []
        try {
          investments = (await pluggyGet(apiKey, `/investments?itemId=${encodeURIComponent(itemId)}`)).results || []
        } catch {
          investments = []
        }

        // Resumo das contas para o app (saldo, tipo, nome) — útil para exibir
        // cartões e contas separadamente sem quebrar a tela de revisão.
        const accountSummary = accounts.map(a => ({
          id: a.id,
          name: a.name || a.marketingName || null,
          type: a.type, // BANK | CREDIT
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
          investments: investments.map(i => ({
            name: i.name,
            type: i.type,
            balance: i.balance ?? null,
            value: i.value ?? null,
            currency: i.currencyCode || 'BRL'
          })),
          meta: {
            itemStatus: item.status,
            from,
            accountsCount: accounts.length,
            transactionsCount: transactions.length,
            investmentsCount: investments.length
          }
        }, 200, request)
      }

      return json({ error: 'not found' }, 404, request)
    } catch (err) {
      return json({ error: err.message || 'erro interno' }, 500, request)
    }
  }
}
