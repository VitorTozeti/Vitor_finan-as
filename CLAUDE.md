# CLAUDE.md — GreenFinance (Vitor_finan-as)

Instruções e contexto para o Claude Code trabalhar neste projeto.

## O que é

App de finanças pessoais **React 18 + TypeScript + Vite**, PWA, **multiusuário**, hospedado
na **Cloudflare**: um único Worker (`worker/worker.js`, config em `wrangler.toml` na raiz)
serve o app (assets do `dist/`) e a API em `/api/*`. Cada pessoa cria conta (e-mail + senha,
PBKDF2) e os dados ficam no **D1** (`user_state`, um JSON do `AppState` por usuário, com
versão para detectar conflito entre aparelhos). O `localStorage` continua como cache
offline por usuário (`greenfinance:v1:u:<userId>`). Roteamento com `HashRouter`.

- Repositório: `VitorTozeti/Vitor_finan-as`
- Site: `https://greenfinance.<subdominio-da-conta>.workers.dev` (Worker `greenfinance`)
- `base` do Vite: `/` (variável `VITE_BASE` só para publicar em subpasta).
- GitHub Pages (`vitortozeti.github.io/Vitor_finan-as`) e o Worker antigo
  `blue-bonus-47ec` são legado — não recebem mais deploy.

## Build e deploy

- **Não há Node instalado na máquina do usuário.** Todo build roda no **GitHub Actions**
  (`.github/workflows/deploy.yml`): qualquer push → `tsc` + `vite build` + `wrangler deploy
  --dry-run`; push na **`main`** → cria o D1 `greenfinance` se faltar, injeta o id no
  `wrangler.toml` (placeholder `__D1_DATABASE_ID__`), aplica `migrations/*.sql` e publica.
- Secrets do GitHub (Settings → Secrets → Actions): `CLOUDFLARE_API_TOKEN` (Workers + D1
  edit), `CLOUDFLARE_ACCOUNT_ID`, `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `BRAPI_TOKEN`
  (opcional). O workflow envia os três últimos como secrets do Worker (`wrangler secret bulk`).

## Estrutura

```
src/
  components/  UI reutilizável        pages/    rotas/telas (Login.tsx = entrada)
  services/    api.ts (cliente /api), bankApi.ts (Pluggy), marketApi.ts (cotações)
  store/       useStore (estado + cache local), cloudSync (D1), useAuth (sessão)
  utils/       portfolio.ts = valuation ÚNICA da carteira (Carteira/Dashboard/Investimentos)
worker/        worker.js — API + assets           migrations/  schema D1
```

## API (`worker/worker.js`)

`/api/auth/register|login|logout`, `/api/me`, `GET|PUT /api/state` (409 em conflito de
versão), `POST /api/connect-token` (Pluggy, `clientUserId` = id do usuário), `GET /api/items`,
`GET /api/bank/:itemId` (confere dono do item), `GET /api/brapi/quote/A,B,C` (divide em 1
ticker por chamada, em paralelo, cache 60 s, token no servidor), `/api/brapi/available`,
`/api/brapi/quote/list`.

## Carteira de investimentos

- Worker busca **todas as páginas** de `/investments` (antes só a 1ª, 20 itens) e ignora
  `TOTAL_WITHDRAWAL`. Pluggy: `value` = preço unitário, `quantity` = cotas,
  `balance`/`amount` = total atual, `amountOriginal` = custo. Sem `quantity`/custo em ativo de
  bolsa → reconstrói por `/investments/:id/transactions` (compras − vendas, custo médio).
- Ticker extraído de code/name (`.SA` e `F` fracionário removidos). Renda fixa/fundos
  entram com `listed: false` e valor do banco.
- Carteira casa posições por `externalId` (ou ticker + `itemId`) e remove as que o banco
  não devolveu mais; ativos manuais (sem `itemId`) nunca são tocados.
- Preço exibido: ao vivo (brapi) → banco → preço médio (`utils/portfolio.ts`).

## Open Finance (Pluggy)

- SDK do widget: `https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js`
  (usar `latest`; versões fixas antigas dão 404). `includeSandbox: false` em produção.
- Tela Conectar → "Suas conexões" lista os itens do usuário com **Sincronizar** (puxa de novo
  sem refazer login) e **Reconectar** (widget em modo update).
- Diagnóstico: `GET /api/health` mostra `{db, pluggy}` configurados. 503 "Open Finance não
  configurado" = faltam os secrets do Pluggy no Worker.

## Regras deste projeto

- **NÃO registrar nada deste projeto no vault de conhecimento** (instrução explícita do
  usuário). A regra global do vault NÃO se aplica aqui.
- Segredos (Pluggy client id/secret, tokens) NUNCA vão para o código nem para o repo —
  só como secret do Cloudflare/GitHub.
- Textos de UI e mensagens em **português (Brasil)**.
