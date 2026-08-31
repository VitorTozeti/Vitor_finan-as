# CLAUDE.md — GreenFinance (Vitor_finan-as)

Instruções e contexto para o Claude Code trabalhar neste projeto.

## O que é

App de finanças pessoais **React 18 + TypeScript + Vite**, PWA, **single-user**, sem
backend próprio. Hospedado **estático no GitHub Pages**. Dados persistidos em
`localStorage` (nada em servidor). Roteamento com `HashRouter` (evita 404 no Pages).

- Repositório: `VitorTozeti/Vitor_finan-as`
- Site: `https://vitortozeti.github.io/Vitor_finan-as/`
- `base` do Vite: `/Vitor_finan-as/` (precisa bater com o nome do repo; ajustar também em
  `index.html` e no manifest do PWA se o repo for renomeado).

## Build e deploy

- **Não há Node instalado na máquina do usuário.** Todo build roda na nuvem via
  **GitHub Actions** (`.github/workflows/deploy.yml`): push na `main` → build → GitHub Pages.
- Variáveis de build vêm de **secrets do repositório** (Settings → Secrets → Actions):
  - `VITE_BRAPI_TOKEN` (opcional — cotações brapi.dev)
  - `VITE_BANK_PROXY_URL` (URL do Cloudflare Worker do Open Finance)
- Para publicar mudança de código: **commit + push na `main`** (dispara o deploy).
  Não tente `npm run build` local — não há Node aqui.

## Estrutura

```
src/
  components/  UI reutilizável        pages/    rotas/telas
  services/    APIs externas          store/    estado global (Context + localStorage)
  utils/       cálculos, import/export, parsers de extrato
  types/  data/
worker/        Cloudflare Worker (proxy do Open Finance)
```

Dados de mercado isolados em `src/services/marketApi.ts` (provedor: brapi.dev, sem chave
para uso básico). Para trocar de provedor, mexa só nesse arquivo.

## Conectar banco — duas formas

1. **Importar extrato** (PDF/OFX/CSV) — funciona 100% offline, lido no navegador.
   Parsers em `src/utils/statementImport.ts` e `src/utils/pdfExtract.ts`.
2. **Open Finance (Pluggy)** — sincronização automática. Arquitetura:
   `App (estático) → Cloudflare Worker (guarda o segredo) → Pluggy → banco`.

### Setup do Open Finance (JÁ CONFIGURADO — via painéis web, sem rodar nada local)

- **Cloudflare Worker** em `worker/worker.js` (colado manualmente no dashboard da
  Cloudflare — editar lá exige **re-colar/editar no editor do dashboard**, o arquivo do
  repo é só a fonte de verdade).
  - Worker atual: `https://blue-bonus-47ec.vitortozeti.workers.dev`
  - Secrets no Worker (Cloudflare → Settings → Variables, tipo *Secret*):
    `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` (credenciais do dashboard.pluggy.ai).
  - `ALLOWED_ORIGIN` fixo em `https://vitortozeti.github.io`.
  - Endpoints: `POST /connect-token` → `{accessToken}`; `GET /transactions/:itemId` →
    `{transactions}` normalizadas.
- **Secret do GitHub** `VITE_BANK_PROXY_URL` = URL do Worker acima (sem barra no final).
- Cliente em `src/services/bankApi.ts`; UI + carga do SDK em `src/pages/ConnectBank.tsx`.
- SDK do widget: `https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js`
  (versões fixas antigas como `v2.9.1` saíram do ar e retornam 404 — usar `latest`).
- `includeSandbox: true` em `ConnectBank.tsx` mostra bancos de teste; trocar para `false`
  depois de validar com o sandbox, para produção.

### Diagnóstico rápido do Open Finance

- "Confira o proxy" → app não obteve token: `VITE_BANK_PROXY_URL` errado/desatualizado, ou
  Worker fora do ar. Testar `curl -X POST <worker>/connect-token` (deve vir `{accessToken}`).
- "Falha ao abrir o Pluggy" → token OK, mas o SDK do widget não carregou (URL do SDK 404).
- 404 `{"error":"not found"}` ao abrir a URL do Worker no navegador é **normal** (rota raiz
  não existe; rotas válidas são as de cima).

## Regras deste projeto

- **NÃO registrar nada deste projeto no vault de conhecimento** (instrução explícita do
  usuário). A regra global do vault NÃO se aplica aqui.
- Segredos (Pluggy client id/secret, tokens) NUNCA vão para o código nem para o repo —
  só como secret do Cloudflare/GitHub.
- Textos de UI e mensagens em **português (Brasil)**.
