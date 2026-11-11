// Cliente da API do GreenFinance (Cloudflare Worker em /api/*).
//
// Em produção o app e a API saem do MESMO Worker, então a base é relativa
// ("/api"). Em dev local (vite) aponte VITE_API_URL para o Worker publicado,
// ex.: VITE_API_URL=https://greenfinance.<conta>.workers.dev/api

const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) || '/api').replace(/\/$/, '')
const TOKEN_KEY = 'greenfinance:auth-token'

export interface AuthUser {
  id: string
  email: string
  name: string | null
}

export class ApiError extends Error {
  status: number
  body: any
  constructor(status: number, message: string, body: any) {
    super(message)
    this.status = status
    this.body = body
  }
}

let unauthorizedHandler: (() => void) | null = null

/** Chamado quando a API responde 401 (sessão expirada) — o AuthProvider desloga. */
export function onUnauthorized(fn: (() => void) | null) {
  unauthorizedHandler = fn
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // storage indisponível — a sessão dura só esta aba
  }
}

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let body = init.body
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(init.json)
  }
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers, body })
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor', null)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && token) unauthorizedHandler?.()
    throw new ApiError(res.status, (data && data.error) || `Erro ${res.status}`, data)
  }
  return data as T
}

export const apiBase = API_BASE
