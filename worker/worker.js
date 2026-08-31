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
//   GET  /transactions/:itemId   -> devolve { transactions: ParsedStatementTx[] }

const PLUGGY_API = 'https://api.pluggy.ai'

// Restringe quem pode chamar o Worker. Troque pelo domínio do seu app em
// produção (ex.: 'https://vitortozeti.github.io'). '*' facilita o teste local.
const ALLOWED_ORIGIN = 'https://vitortozeti.github.io'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders() })
}

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Pré-checagem do navegador (CORS).
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() })
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
        return json({ accessToken: data.accessToken })
      }

      // --- Endpoint B: transações de uma conexão (itemId) já normalizadas ---
      if (url.pathname.startsWith('/transactions/') && request.method === 'GET') {
        const itemId = decodeURIComponent(url.pathname.slice('/transactions/'.length))
        if (!itemId) return json({ error: 'itemId ausente' }, 400)
        const apiKey = await getApiKey(env)

        // Um item pode ter várias contas; buscamos as transações de todas.
        const accountsRes = await fetch(`${PLUGGY_API}/accounts?itemId=${encodeURIComponent(itemId)}`, {
          headers: { 'X-API-KEY': apiKey }
        })
        const accounts = (await accountsRes.json()).results || []

        const transactions = []
        for (const acc of accounts) {
          const txRes = await fetch(`${PLUGGY_API}/transactions?accountId=${acc.id}&pageSize=200`, {
            headers: { 'X-API-KEY': apiKey }
          })
          const results = (await txRes.json()).results || []
          for (const t of results) {
            // Pluggy: amount negativo = saída. Traduz para o formato que o app já usa.
            transactions.push({
              date: String(t.date).slice(0, 10),
              amount: Math.abs(t.amount),
              type: t.amount < 0 ? 'expense' : 'income',
              description: t.description || t.descriptionRaw || 'Lançamento',
              categoryId: 'outros',
              fitid: t.id
            })
          }
        }
        return json({ transactions })
      }

      return json({ error: 'not found' }, 404)
    } catch (err) {
      return json({ error: err.message || 'erro interno' }, 500)
    }
  }
}
