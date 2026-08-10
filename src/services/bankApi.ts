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

/** Step 2: after the user links an account, the proxy returns normalized
 * transactions for the given connection id (itemId). Shape matches the
 * statement-import parser so both paths feed the same review screen. */
export async function fetchBankTransactions(itemId: string): Promise<ParsedStatementTx[] | null> {
  if (!PROXY_URL) return null
  try {
    const res = await fetch(`${PROXY_URL}/transactions/${encodeURIComponent(itemId)}`)
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data?.transactions)) return null
    return data.transactions as ParsedStatementTx[]
  } catch {
    return null
  }
}
