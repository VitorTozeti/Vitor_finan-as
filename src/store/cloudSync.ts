// Sincronização do AppState com a nuvem (Cloudflare D1 via /api/state).
//
// Modelo: o localStorage continua sendo o cache rápido/offline de cada
// usuário; a nuvem é a fonte de verdade entre aparelhos. Cada gravação manda
// a `baseVersion` que o aparelho conhece — se outro aparelho gravou antes, o
// servidor responde 409 e este aparelho adota a versão da nuvem.

import { useEffect, useRef, useState } from 'react'
import { AppState } from '../types'
import { api, ApiError } from '../services/api'
import { validateAndMigrate } from '../utils/stateSchema'
import { pushToast } from '../components/Primitives'

export type SyncStatus = 'loading' | 'synced' | 'saving' | 'offline' | 'error'

const PUSH_DEBOUNCE_MS = 1500
const LEGACY_KEY = 'greenfinance:v1'

export const storageKeyFor = (userId: string) => `greenfinance:v1:u:${userId}`
const metaKeyFor = (userId: string) => `greenfinance:sync:u:${userId}`

interface SyncMeta {
  version: number
  dirty: boolean
}

function readMeta(userId: string): SyncMeta {
  try {
    const raw = localStorage.getItem(metaKeyFor(userId))
    if (raw) return { version: 0, dirty: false, ...JSON.parse(raw) }
  } catch {
    // ignora
  }
  return { version: 0, dirty: false }
}

function writeMeta(userId: string, meta: SyncMeta) {
  try {
    localStorage.setItem(metaKeyFor(userId), JSON.stringify(meta))
  } catch {
    // ignora
  }
}

/** Dados do modo antigo (sem login) deste navegador, para levar à conta na
 * primeira vez que a pessoa entra. */
function readLegacyState(): AppState | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    const r = validateAndMigrate(JSON.parse(raw))
    return r.ok ? r.state : null
  } catch {
    return null
  }
}

interface StateResponse {
  data: unknown
  version: number
  updatedAt: string | null
}

export function useCloudSync(
  userId: string,
  state: AppState,
  replaceState: (s: AppState) => void,
  hasLocalCache: boolean
): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>('loading')
  const meta = useRef<SyncMeta>(readMeta(userId))
  const hydrated = useRef(false)
  const skipNextPush = useRef(false)
  const latest = useRef(state)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef(false)
  latest.current = state

  const saveMeta = (patch: Partial<SyncMeta>) => {
    meta.current = { ...meta.current, ...patch }
    writeMeta(userId, meta.current)
  }

  function adopt(resp: StateResponse) {
    const r = validateAndMigrate(resp.data)
    if (!r.ok) return false
    skipNextPush.current = true
    replaceState(r.state)
    saveMeta({ version: resp.version, dirty: false })
    return true
  }

  async function push(): Promise<void> {
    if (inFlight.current) return
    inFlight.current = true
    setStatus('saving')
    try {
      const res = await api<{ version: number }>('/state', {
        method: 'PUT',
        json: { data: latest.current, baseVersion: meta.current.version }
      })
      saveMeta({ version: res.version, dirty: false })
      setStatus('synced')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.body?.data) {
        adopt(err.body as StateResponse)
        pushToast('Seus dados foram atualizados com a versão salva em outro aparelho.')
        setStatus('synced')
      } else if (err instanceof ApiError && err.status === 0) {
        setStatus('offline')
      } else {
        setStatus('error')
        if (err instanceof ApiError && err.status === 413) pushToast(err.message, 'error')
      }
    } finally {
      inFlight.current = false
    }
  }

  // 1) Ao entrar: baixa da nuvem (ou sobe os dados locais se a nuvem estiver vazia).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const resp = await api<StateResponse>('/state')
        if (cancelled) return
        if (resp.data) {
          if (meta.current.dirty && meta.current.version === resp.version) {
            hydrated.current = true
            await push() // edições offline feitas sobre a última versão da nuvem
          } else {
            adopt(resp)
            hydrated.current = true
            setStatus('synced')
          }
        } else {
          // Nuvem vazia: primeira vez dessa conta. Leva os dados locais deste
          // aparelho (cache da conta ou o modo antigo sem login).
          const legacy = !hasLocalCache ? readLegacyState() : null
          if (legacy) {
            skipNextPush.current = true
            replaceState(legacy)
            latest.current = legacy
            pushToast('Seus dados deste aparelho foram levados para a sua conta.')
          }
          saveMeta({ version: 0, dirty: true })
          hydrated.current = true
          await push()
        }
      } catch (err) {
        hydrated.current = true
        setStatus(err instanceof ApiError && err.status === 0 ? 'offline' : 'error')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // 2) A cada mudança: marca como pendente e envia com debounce.
  useEffect(() => {
    if (!hydrated.current) return
    if (skipNextPush.current) {
      skipNextPush.current = false
      return
    }
    saveMeta({ dirty: true })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(push, PUSH_DEBOUNCE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // 3) Voltou a internet / voltou para a aba: reenvia o que ficou pendente.
  useEffect(() => {
    const retry = () => {
      if (hydrated.current && meta.current.dirty) push()
    }
    const onVisible = () => document.visibilityState === 'visible' && retry()
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(retry, 60000)
    return () => {
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return status
}
