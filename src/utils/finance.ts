import { Transaction } from '../types'

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Parses a pt-BR (or plain) decimal typed by the user in a form field, e.g.
 * "1.234,56", "1234,56", "1234.56", "1234". Tolerant of a thousands
 * separator, unlike a naive `parseFloat(str.replace(',', '.'))`. Returns
 * NaN for empty/unparsable input. */
export function parseAmountInput(raw: string): number {
  let s = raw.replace(/[^0-9.,-]/g, '').trim()
  if (!s) return NaN
  const neg = s.startsWith('-')
  s = s.replace(/-/g, '')
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    // '.' thousands, ',' decimal (pt-BR)
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    s = s.replace(',', '.')
  } else if (hasDot) {
    const parts = s.split('.')
    // A single dot followed by exactly 3 digits and nothing else is more
    // likely a thousands separator ("1.234" = 1234) than a decimal.
    if (parts.length === 2 && parts[1].length === 3) {
      s = parts.join('')
    }
  }
  const value = parseFloat(s)
  if (isNaN(value)) return NaN
  return neg ? -value : value
}

export function formatCompact(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

/** Short, axis-friendly BRL label: R$ 1,2 mil / R$ 3,4 mi. */
export function formatCurrencyShort(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return `${sign}R$ ${abs.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

/** Signed percentage label, e.g. +12,3% / -4,0%. */
export function formatSignedPct(value: number, digits = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits).replace('.', ',')}%`
}

// Simple fixed list of Brazilian national holidays (month-day). Not exhaustive,
// but covers fixed-date holidays which is enough for the "adjust payday" feature.
const FIXED_HOLIDAYS = new Set([
  '01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25'
])

function isWeekendOrHoliday(date: Date): boolean {
  const day = date.getDay()
  if (day === 0 || day === 6) return true
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return FIXED_HOLIDAYS.has(mmdd)
}

/** Returns the effective payment date for a given month/year, moving backward
 * to the previous business day if the payDay falls on a weekend/holiday. */
export function getEffectivePayDate(year: number, month: number, payDay: number): Date {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const safeDay = Math.min(payDay, daysInMonth)
  const date = new Date(year, month, safeDay)
  while (isWeekendOrHoliday(date)) {
    date.setDate(date.getDate() - 1)
  }
  return date
}

export function getNextPayDate(payDay: number): Date {
  const now = new Date()
  let candidate = getEffectivePayDate(now.getFullYear(), now.getMonth(), payDay)
  if (candidate < now) {
    const nextMonth = now.getMonth() + 1
    const year = now.getFullYear() + (nextMonth > 11 ? 1 : 0)
    candidate = getEffectivePayDate(year, nextMonth % 12, payDay)
  }
  return candidate
}

export function daysUntil(date: Date): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / 86400000)
}

export function isSameMonth(dateIso: string, ref = new Date()): boolean {
  const d = new Date(dateIso)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}

export function monthKey(dateIso: string): string {
  const d = new Date(dateIso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

export function sumByType(transactions: Transaction[], type: 'expense' | 'income'): number {
  return transactions.filter(t => t.type === type).reduce((acc, t) => acc + t.amount, 0)
}

export function groupTransactionsByDate(transactions: Transaction[]): { date: string; items: Transaction[] }[] {
  const map = new Map<string, Transaction[]>()
  for (const t of [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1))) {
    const arr = map.get(t.date) ?? []
    arr.push(t)
    map.set(t.date, arr)
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }))
}

export function relativeDateLabel(dateIso: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dateIso === today) return 'Hoje'
  if (dateIso === yesterday) return 'Ontem'
  return new Date(dateIso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

export type HealthStatus = 'healthy' | 'attention' | 'critical'

export function computeHealthStatus(percentUsed: number, trendWorse: boolean): HealthStatus {
  if (percentUsed >= 90 || (percentUsed >= 75 && trendWorse)) return 'critical'
  if (percentUsed >= 60 || trendWorse) return 'attention'
  return 'healthy'
}
