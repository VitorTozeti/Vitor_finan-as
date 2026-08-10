// Educational investing presets. These are illustrative assumptions to power
// the simulator and to frame the "recommended" lists — they are NOT investment
// advice and NOT a promise of return. Rates are rough long-run nominal
// expectations for the Brazilian market and are intentionally conservative.

export type RiskProfile = 'conservador' | 'moderado' | 'arrojado'

export interface ProfilePreset {
  id: RiskProfile
  label: string
  emoji: string
  /** Illustrative expected nominal return, % per year. */
  rateYear: number
  description: string
  /** Tickers that broadly fit this profile (ETFs / FIIs / blue chips). */
  suggested: string[]
}

export const PROFILE_PRESETS: ProfilePreset[] = [
  {
    id: 'conservador',
    label: 'Conservador',
    emoji: '🛡️',
    rateYear: 10.5,
    description: 'Foco em preservar o dinheiro. Renda fixa e fundos imobiliários de tijolo, com pouca oscilação.',
    suggested: ['MXRF11', 'IVVB11', 'BOVA11']
  },
  {
    id: 'moderado',
    label: 'Moderado',
    emoji: '⚖️',
    rateYear: 13,
    description: 'Equilíbrio entre segurança e crescimento. Mistura de ETFs amplos, FIIs e algumas ações sólidas.',
    suggested: ['BOVA11', 'IVVB11', 'ITUB4', 'MXRF11']
  },
  {
    id: 'arrojado',
    label: 'Arrojado',
    emoji: '🚀',
    rateYear: 16,
    description: 'Busca mais crescimento aceitando oscilações maiores. Peso maior em ações e setores cíclicos.',
    suggested: ['PETR4', 'VALE3', 'WEGE3', 'BOVA11']
  }
]

export function presetById(id: RiskProfile): ProfilePreset {
  return PROFILE_PRESETS.find(p => p.id === id) ?? PROFILE_PRESETS[1]
}

// Curated watchlist used for the "Destaques do mercado" / recommended section.
// Quotes are fetched live from brapi; this only decides which tickers to show
// and how to describe them in plain language.
export interface WatchItem {
  ticker: string
  label: string
  kind: 'Ação' | 'ETF' | 'FII'
  note: string
}

export const WATCHLIST: WatchItem[] = [
  { ticker: 'BOVA11', label: 'Ibovespa (ETF)', kind: 'ETF', note: 'Segue as maiores empresas da bolsa de uma vez só.' },
  { ticker: 'IVVB11', label: 'S&P 500 (ETF)', kind: 'ETF', note: 'Exposição às maiores empresas dos EUA, em reais.' },
  { ticker: 'MXRF11', label: 'Maxi Renda (FII)', kind: 'FII', note: 'Fundo imobiliário popular, paga rendimentos mensais.' },
  { ticker: 'ITUB4', label: 'Itaú Unibanco', kind: 'Ação', note: 'Maior banco privado do país, historicamente estável.' },
  { ticker: 'PETR4', label: 'Petrobras', kind: 'Ação', note: 'Estatal de petróleo, costuma pagar bons dividendos.' },
  { ticker: 'VALE3', label: 'Vale', kind: 'Ação', note: 'Mineradora global, ligada ao preço do minério de ferro.' },
  { ticker: 'WEGE3', label: 'WEG', kind: 'Ação', note: 'Indústria de motores e energia, foco em crescimento.' }
]
