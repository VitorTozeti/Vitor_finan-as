// Open Finance / account-aggregator integration (Pluggy, Belvo, etc.).
//
// IMPORTANT — read before wiring this up:
// Automatic bank sync requires secret credentials (client_id / client_secret)
// and, in Brazil, regulatory enrollment. Those secrets CANNOT live in this
// frontend: this app is shipped as static files on GitHub Pages, so anything
// here is public. The correct architecture is:
//
//   [ this app ] --> [ your backend / serverless proxy ] --> [ Pluggy/Belvo ]
//                         (holds the secret, exchanges tokens)
//
// The proxy (e.g. a Cloudflare Worker, Vercel Function or small Node service)
// authenticates with the aggregator, creates a Connect Token, and later returns
// the fetched transactions already normalized. This file talks ONLY to your
// proxy — never directly to the aggregator with a secret.
//
// To enable it, set VITE_BANK_PROXY_URL to your proxy's base URL. While it is
// unset, isBankSyncConfigured() returns false and the UI shows setup guidance
// instead of a broken button.

import { ParsedStatementTx } from '../utils/statementImport'

const PROXY_URL = (import.meta.env.VITE_BANK_PROXY_URL as string | undefined)?.replace(/\/$/, '')

export function isBankSyncConfigured(): boolean {
  return !!PROXY_URL
}

/** Step 1: ask the proxy for a short-lived Connect Token to open the bank widget. */
export async function createConnectToken(): Promise<string | null> {
  if (!PROXY_URL) return null
  try {
    const res = await fetch(`${PROXY_URL}/connect-token`, { method: 'POST' })
    if (!res.ok) return null
    const data = await res.json()
    return (data?.accessToken as string) ?? (data?.token as string) ?? null
  } catch {
    return null
  }
}

/** Resumo de uma conta ou cartão devolvido pelo proxy. */
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

export interface BankInvestment {
  code?: string | null
  name: string
  type: string
  subtype?: string | null
  quantity?: number | null
  price?: number | null
  originalAmount?: number | null
  avgPrice?: number | null
  balance?: number | null
  value?: number | null
  marketValue?: number | null
  currency: string
}

export interface BankSyncResult {
  transactions: ParsedStatementTx[]
  accounts: BankAccountSummary[]
  investments: BankInvestment[]
  meta: {
    itemStatus?: string
    from?: string
    accountsCount?: number
    transactionsCount?: number
    investmentsCount?: number
    investmentsError?: string | null
  }
  error?: string
}

/** Step 2: after the user links an account, the proxy returns ALL normalized
 * transactions (contas + cartões, histórico completo e paginado), além do
 * resumo das contas e investimentos. A forma de `transactions` bate com o
 * parser de extrato, então as duas vias alimentam a mesma tela de revisão.
 *
 * @param months quanto de histórico buscar (padrão do proxy: 24 meses). */
export async function fetchBankData(itemId: string, months?: number): Promise<BankSyncResult | null> {
  if (!PROXY_URL) return null
  try {
    const qs = months ? `?months=${encodeURIComponent(months)}` : ''
    const res = await fetch(`${PROXY_URL}/transactions/${encodeURIComponent(itemId)}${qs}`)
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        transactions: [],
        accounts: [],
        investments: [],
        meta: {},
        error: (data?.error as string) || `Falha ao buscar dados (${res.status})`
      }
    }
    if (!Array.isArray(data?.transactions)) return null
    return {
      transactions: data.transactions as ParsedStatementTx[],
      accounts: (data.accounts as BankAccountSummary[]) ?? [],
      investments: (data.investments as BankInvestment[]) ?? [],
      meta: data.meta ?? {}
    }
  } catch {
    return null
  }
}

/** Compatibilidade: devolve só as transações (usado pela tela de revisão). */
export async function fetchBankTransactions(itemId: string): Promise<ParsedStatementTx[] | null> {
  const data = await fetchBankData(itemId)
  return data ? data.transactions : null
}
