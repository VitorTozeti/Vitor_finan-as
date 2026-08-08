# GreenFinance

Controle financeiro pessoal e análise de investimentos, feito para uso individual, mobile-first e hospedado no GitHub Pages.

## Objetivo

O GreenFinance ajuda você a:
- Registrar gastos e entradas de dinheiro rapidamente.
- Acompanhar quanto já gastou e quanto ainda pode gastar no mês.
- Definir orçamentos por categoria e metas financeiras.
- Visualizar gráficos de gastos, comparação mensal e evolução de saldo.
- Acompanhar uma carteira de investimentos e pesquisar ativos (ações, ETFs, FIIs) via API pública.
- Simular a evolução de investimentos ao longo do tempo.

Tudo isso funcionando como um app: instalável na tela inicial, com boa parte das funções disponíveis offline.

## Tecnologias

- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router (HashRouter, para funcionar direto no GitHub Pages sem configuração de servidor)
- Recharts (gráficos)
- Lucide Icons
- vite-plugin-pwa (Progressive Web App / service worker)
- localStorage para persistência de dados (não há backend)

## Instalação e execução local

```bash
npm install
npm run dev
```

O site abrirá em `http://localhost:5173`.

## Build de produção

```bash
npm run build
```

O resultado é gerado na pasta `dist/`, pronto para publicação estática.

## Deploy no GitHub Pages

1. Crie um repositório no GitHub e envie este projeto para ele.
2. Em `vite.config.ts`, ajuste o campo `base` para corresponder ao nome do seu repositório:
   ```ts
   base: '/nome-do-seu-repositorio/'
   ```
   O mesmo ajuste deve ser feito em `start_url` e `scope` dentro do `manifest` do plugin PWA, e nos links do `index.html` (`manifest.webmanifest`, ícones).
3. No GitHub, vá em **Settings → Pages** e selecione a origem **GitHub Actions**.
4. O workflow em `.github/workflows/deploy.yml` já está configurado: a cada push na branch `main`, o projeto é buildado e publicado automaticamente.
5. Alternativamente, rode `npm run build` localmente e publique manualmente o conteúdo de `dist/`.

O roteamento usa `HashRouter` (URLs como `/#/gastos`) justamente para evitar problemas de 404 em rotas profundas no GitHub Pages, que não suporta roteamento server-side por padrão.

## Configuração da API de mercado financeiro

O serviço de dados de mercado fica isolado em `src/services/marketApi.ts` — é o único arquivo que conhece o provedor de dados usado. Por padrão, o projeto usa a [brapi.dev](https://brapi.dev), uma API pública para ativos brasileiros (ações, ETFs, FIIs, índices) que funciona **sem chave** para consultas básicas de cotação.

Se você quiser usar um token da brapi (para mais requisições ou dados adicionais):

1. Crie um arquivo `.env.local` na raiz do projeto (esse arquivo já está no `.gitignore` e nunca deve ser commitado):
   ```
   VITE_BRAPI_TOKEN=seu_token_aqui
   ```
2. O serviço já lê automaticamente essa variável de ambiente.

**Importante sobre segurança:** como o projeto é hospedado em GitHub Pages (hospedagem estática, sem backend), qualquer variável de ambiente do Vite é embutida no código publicado — ou seja, nunca coloque chaves realmente secretas aqui. Se no futuro você quiser usar uma API que exija uma chave privada de verdade, crie uma função serverless (Cloudflare Worker, Vercel Function, AWS Lambda, etc.) que guarde a chave no servidor e sirva como proxy entre o app e a API — o frontend nunca deve conhecer a chave.

Se quiser trocar de provedor de dados no futuro, edite apenas `src/services/marketApi.ts` — o restante do app consome as funções `getQuote`, `getMultipleQuotes`, `computePeriodPerformance` e `computeVolatility`, então a troca de provedor não deve exigir mudanças em outras partes do código.

## Armazenamento de dados

Todos os seus dados (gastos, receitas, categorias, orçamento, metas, carteira e configurações) ficam salvos no `localStorage` do seu navegador, no seu próprio dispositivo. Nada é enviado para servidores externos, exceto as consultas de cotação de ativos (que não incluem nenhum dado pessoal seu).

Use a tela **Configurações** para:
- **Exportar** seus dados em JSON (backup completo) ou CSV (para abrir em planilhas).
- **Importar** um backup JSON anterior, restaurando todos os seus dados.

Faça backups periódicos — dados de navegador podem ser perdidos se você limpar o cache ou trocar de dispositivo.

## Estrutura do projeto

```
src/
  components/   componentes reutilizáveis (BottomNavigation, cards, formulários...)
  pages/        páginas/rotas do app
  services/     integração com APIs externas (marketApi.ts)
  store/        estado global (Context + localStorage)
  utils/        funções auxiliares (cálculos financeiros, insights, export/import)
  types/        tipos TypeScript compartilhados
  data/         categorias padrão e dados de demonstração
```

## Funcionamento offline (PWA)

O app pode ser instalado na tela inicial do Android (ou de qualquer navegador compatível) e funciona como um aplicativo:
- Visualizar, adicionar, editar e excluir gastos: **funciona offline**.
- Visualizar gráficos, saldo, metas e orçamento: **funciona offline**.
- Consultar cotações e análises de mercado: **precisa de internet**.

Um indicador discreto aparece no topo da tela quando você está offline.

## Limitações conhecidas

- A lista de feriados usada para ajustar o dia de pagamento cobre apenas feriados nacionais fixos (não inclui feriados móveis como Carnaval ou Corpus Christi, nem feriados estaduais/municipais).
- A API de mercado usada (brapi.dev) é gratuita e pode ter limites de requisições; em uso intenso, considere obter um token gratuito no site deles.
- Este é um projeto single-user, sem autenticação. A arquitetura (store isolado em `src/store`, serviços separados) foi pensada para permitir adicionar login/autenticação no futuro sem grandes refatorações, mas isso não está implementado.
- Análises de investimento são geradas a partir de dados históricos simples (variação percentual e volatilidade), sem uso de IA externa. Todas as informações são educacionais e não constituem recomendação financeira.

## Dados de demonstração

Na primeira vez que você abrir o app, alguns gastos fictícios já aparecem para você conhecer as funcionalidades. Vá em **Configurações → Limpar dados de demonstração** para removê-los quando quiser começar do zero.
