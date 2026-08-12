import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { formatCurrency } from '../utils/finance'

export function ProgressBar({ value, max, tone = 'green' }: { value: number; max: number; tone?: 'green' | 'warn' | 'danger' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const colors: Record<string, string> = {
    green: 'bg-green',
    warn: 'bg-warn',
    danger: 'bg-danger'
  }
  return (
    <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
      <div
        className={`h-full rounded-full ${colors[tone]} transition-all duration-500 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-card border border-white/5 shadow-soft p-5 ${className}`}>{children}</div>
  )
}

export function BalanceCard({ balance, spentLabel }: { balance: number; spentLabel: string }) {
  const positive = balance >= 0
  return (
    <Card className="bg-gradient-to-br from-card to-bg2">
      <p className="text-sm text-muted mb-1">Saldo disponível este mês</p>
      <p className={`text-4xl font-extrabold tracking-tight ${positive ? 'text-txt' : 'text-danger'}`}>
        {formatCurrency(balance)}
      </p>
      <p className="text-xs text-muted mt-2">{spentLabel}</p>
    </Card>
  )
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction
}: {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4 text-2xl">🌱</div>
      <p className="font-semibold text-txt mb-1">{title}</p>
      {description && <p className="text-sm text-muted max-w-xs">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 rounded-xl bg-green px-5 py-2.5 text-sm font-semibold text-bg active:scale-95 transition-transform"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 animate-fadeIn" onClick={onClose} />
      <div className="relative w-full md:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-bg2 border border-white/10 p-5 animate-slideUp">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 text-muted hover:text-txt"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  title: string
  description?: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl bg-bg2 border border-white/10 p-5">
        <p className="font-semibold mb-1">{title}</p>
        {description && <p className="text-sm text-muted mb-5">{description}</p>}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl bg-white/5 py-2.5 text-sm font-medium text-txt"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-danger py-2.5 text-sm font-semibold text-white"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  )
}

export interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastMessage {
  id: number
  text: string
  tone: 'success' | 'error'
  action?: ToastAction
}

let toastId = 0
const toastListeners = new Set<(t: ToastMessage) => void>()

export function pushToast(text: string, tone: 'success' | 'error' = 'success', action?: ToastAction) {
  const msg = { id: ++toastId, text, tone, action }
  toastListeners.forEach(fn => fn(msg))
}

export function ToastHost() {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([])

  useEffect(() => {
    const listener = (t: ToastMessage) => {
      setToasts(prev => [...prev, t])
      setTimeout(
        () => {
          setToasts(prev => prev.filter(x => x.id !== t.id))
        },
        t.action ? 5000 : 2600
      )
    }
    toastListeners.add(listener)
    return () => {
      toastListeners.delete(listener)
    }
  }, [])

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center w-full px-6">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium shadow-soft animate-slideUp ${
            t.tone === 'success' ? 'bg-green text-bg' : 'bg-danger text-white'
          }`}
        >
          <span>{t.text}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action?.onClick()
                setToasts(prev => prev.filter(x => x.id !== t.id))
              }}
              className="underline underline-offset-2 font-semibold shrink-0"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className}`} />
}
