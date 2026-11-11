// Open Finance (Pluggy) via API do GreenFinance.
//
//   [ app ] --(sessão do usuário)--> [ Worker /api ] --(segredo Pluggy)--> [ Pluggy ] --> banco
//
// O segredo do Pluggy fica só no Worker. Cada conexão é criada com
// clientUserId = id do usuário logado, e o Worker recusa itemIds de outra
// pessoa — por isso todas as chamadas daqui exigem login.

import { ParsedStatementTx } from '../utils/statementImport'
import { PortfolioAsset } from '../types'
import { api, ApiError } from './api'

export function isBankSyncConfigured(): boolean {
  return true // a API sempre existe; se o Pluggy não estiver configurado, o Worker responde 503
}

/** Token de curta duração para abrir o widget do Pluggy. Com itemId abre em
 * modo "atualizar conexão" (reautenticar um banco já ligado). */
export async function createConnectToken(itemId?: string): Promise<string | null> {
  try {
    const data = await api<{ accessToken: string }>('/connect-token', {
      method: 'POST',
      json: itemId ? { itemId } : {}
    })
    return data.accessToken ?? null
  } catch {
    return null
  }
}

export interface BankAccountSummary {
  id: string
  name: string | null
  type: string // 'BANK' | 'CREDIT'
  subtype: string | null
  number: string | null
  balance: number | null
  currency: string
  creditLimit: number | null
  availableLimit: number | null
}

/** Posição de investimento já normalizada pelo Worker. */
export interface BankInvestment {
  externalId: string | null
  itemId: string
  /** Ticker B3 quando é ativo de bolsa (PETR4, MXRF11...). */
  ticker: string | null
  code: string | null
  name: string
  type: string | null
  subtype: string | null
  listed: boolean
  quantity: number
  quantityKnown: boolean
  /** Preço unitário atual informado pelo banco. */
  price: number
  avgPrice: number
  originalAmount: number
  marketValue: number
  currency: string
}

export interface BankSyncResult {
  transactions: ParsedStatementTx[]
  accounts: BankAccountSummary[]
  investments: BankInvestment[]
  meta: {
    itemId?: string
    connector?: string | null
    itemStatus?: string
    from?: string
    accountsCount?: number
    transactionsCount?: number
    investmentsCount?: number
    investmentsError?: string | null
  }
  error?: string
}

/** Busca tudo de uma conexão: transações (contas + cartões, paginadas),
 * contas e TODAS as posições de investimento. */
export async function fetchBankData(itemId: string, months?: number): Promise<BankSyncResult | null> {
  try {
    const qs = months ? `?months=${encodeURIComponent(months)}` : ''
    const data = await api<BankSyncResult>(`/bank/${encodeURIComponent(itemId)}${qs}`)
    if (!Array.isArray(data?.transactions)) return null
    return {
      transactions: data.transactions,
      accounts: data.accounts ?? [],
      investments: data.investments ?? [],
      meta: data.meta ?? {}
    }
  } catch (err) {
    if (err instanceof ApiError && err.status !== 0) {
      return { transactions: [], accounts: [], investments: [], meta: {}, error: err.message }
    }
    return null
  }
}

export interface PluggyItemSummary {
  itemId: string
  connector: string | null
  lastSyncAt: string | null
  createdAt: string
}

export async function listBankItems(): Promise<PluggyItemSummary[]> {
  try {
    return (await api<{ items: PluggyItemSummary[] }>('/items')).items
  } catch {
    return []
  }
}

/** Converte as posições do banco em ativos da carteira. */
export function investmentsToPortfolio(investments: BankInvestment[]): Omit<PortfolioAsset, 'id'>[] {
  return investments
    .filter(inv => inv.quantity > 0 && (inv.marketValue > 0 || inv.quantityKnown))
    .map(inv => ({
      ticker: inv.ticker || (inv.code || inv.name || 'ATIVO').replace(/\s+/g, ' ').trim().slice(0, 32),
      name: inv.name,
      listed: inv.listed,
      assetType: inv.type || undefined,
      quantity: inv.quantity,
      avgPrice: Math.round(inv.avgPrice * 10000) / 10000,
      bankPrice: inv.price > 0 ? inv.price : undefined,
      marketValue: inv.marketValue > 0 ? inv.marketValue : undefined,
      itemId: inv.itemId,
      externalId: inv.externalId || undefined
    }))
}
