// Regras ÚNICAS de valuation da carteira — usadas por Carteira, Dashboard e
// Investimentos para que os três mostrem o mesmo número.
//
// Preço atual de um ativo, em ordem de preferência:
//   1. cotação ao vivo (brapi) — só para ativos de bolsa (ações, FIIs, ETFs, BDRs);
//   2. preço/valor informado pelo banco na última sincronização (Open Finance);
//   3. preço médio de compra (sem informação melhor, assume sem variação).

import { PortfolioAsset } from '../types'
import { QuoteResult } from '../services/marketApi'

const B3_TICKER = /^[A-Z]{4}\d{1,2}$/

/** O ativo tem cotação em bolsa? (renda fixa/fundo vindos do banco não têm.) */
export function isQuotable(p: Pick<PortfolioAsset, 'ticker' | 'listed'>): boolean {
  if (p.listed === false) return false
  return B3_TICKER.test(p.ticker.toUpperCase())
}

/** Tickers distintos que valem uma consulta de cotação. */
export function quotableTickers(portfolio: PortfolioAsset[]): string[] {
  return [...new Set(portfolio.filter(isQuotable).map(p => p.ticker.toUpperCase()))]
}

export function assetPrice(p: PortfolioAsset, quote?: QuoteResult | null): number {
  if (quote?.price && isQuotable(p)) return quote.price
  if (p.bankPrice && p.bankPrice > 0) return p.bankPrice
  if (p.marketValue && p.marketValue > 0 && p.quantity > 0) return p.marketValue / p.quantity
  return p.avgPrice
}

export function assetValue(p: PortfolioAsset, quote?: QuoteResult | null): number {
  if (quote?.price && isQuotable(p)) return p.quantity * quote.price
  if (p.marketValue && p.marketValue > 0) return p.marketValue
  return p.quantity * assetPrice(p, quote)
}

export function assetCost(p: PortfolioAsset): number {
  return p.quantity * p.avgPrice
}

/** De onde veio o preço exibido — para a UI explicar o número. */
export function priceSource(p: PortfolioAsset, quote?: QuoteResult | null): 'live' | 'bank' | 'cost' {
  if (quote?.price && isQuotable(p)) return 'live'
  if ((p.bankPrice && p.bankPrice > 0) || (p.marketValue && p.marketValue > 0)) return 'bank'
  return 'cost'
}

export function portfolioTotals(portfolio: PortfolioAsset[], quotes: Record<string, QuoteResult | undefined>) {
  let invested = 0
  let current = 0
  for (const p of portfolio) {
    invested += assetCost(p)
    current += assetValue(p, quotes[p.ticker.toUpperCase()])
  }
  const profit = current - invested
  return { invested, current, profit, profitPct: invested > 0 ? (profit / invested) * 100 : 0 }
}

/** Label curto do tipo do ativo para a lista. */
export function assetTypeLabel(p: PortfolioAsset): string {
  const t = (p.assetType || '').toUpperCase()
  if (t === 'FIXED_INCOME') return 'Renda fixa'
  if (t === 'MUTUAL_FUND') return 'Fundo'
  if (t === 'SECURITY') return 'Previdência'
  if (t === 'COE') return 'COE'
  if (t === 'ETF') return 'ETF'
  const tk = p.ticker.toUpperCase()
  if (/11$/.test(tk)) return 'FII/ETF/Unit'
  if (/3[2-5]$/.test(tk)) return 'BDR'
  if (isQuotable(p)) return 'Ação'
  return 'Outro'
}
