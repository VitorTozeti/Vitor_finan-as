import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import {
  AppState,
  Transaction,
  Category,
  Budget,
  Goal,
  PortfolioAsset,
  RecurringRule,
  UserSettings,
  Benefit,
  CashbackProgram,
  CashbackEntry
} from '../types'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, buildDemoTransactions, DEMO_BENEFITS } from '../data/defaults'
import { CURRENT_SCHEMA_VERSION, validateAndMigrate } from '../utils/stateSchema'
import { pushToast } from '../components/Primitives'

const STORAGE_KEY = 'greenfinance:v1'
const CORRUPTED_BACKUP_KEY = 'greenfinance:v1:corrupted-backup'
const PERSIST_DEBOUNCE_MS = 400
const FALLBACK_CATEGORY_ID = 'outros'

function defaultState(): AppState {
  return {
    settings: DEFAULT_SETTINGS,
    transactions: buildDemoTransactions(),
    categories: DEFAULT_CATEGORIES,
    budgets: [],
    goals: [],
    portfolio: [],
    recurringRules: [],
    benefits: DEMO_BENEFITS(),
    cashbackPrograms: [],
    unlockedAchievements: [],
    demoDataCleared: false,
    schemaVersion: CURRENT_SCHEMA_VERSION
  }
}

/** Loads the persisted state, validating/migrating it first. If the stored
 * blob is missing, unparsable, or structurally invalid, the raw string is
 * preserved under a separate key (so nothing is silently lost) and the
 * caller is told via `recovered: true` so it can warn the user. */
function loadState(): { state: AppState; recovered: boolean } {
  const rawStr = localStorage.getItem(STORAGE_KEY)
  if (!rawStr) return { state: defaultState(), recovered: false }
  try {
    const parsed = JSON.parse(rawStr)
    const result = validateAndMigrate(parsed)
    if (result.ok) return { state: result.state, recovered: false }
  } catch {
    // JSON.parse failed — fall through to the backup+recover path below
  }
  try {
    localStorage.setItem(CORRUPTED_BACKUP_KEY, rawStr)
  } catch {
    // storage full/unavailable — nothing more we can do
  }
  return { state: defaultState(), recovered: true }
}

function monthKeyOf(year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, '0')}`
}

function addMonthsToKey(key: string, delta: number): string {
  let [y, m] = key.split('-').map(Number)
  m += delta
  while (m > 12) {
    m -= 12
    y += 1
  }
  while (m < 1) {
    m += 12
    y -= 1
  }
  return monthKeyOf(y, m)
}

/** Generates transactions for any active recurring rule whose due month(s)
 * haven't been generated yet, capped at 2 months of catch-up per rule per
 * run so a long absence doesn't flood the history. Never backfills months
 * before a rule's creation (a rule with no `lastGeneratedMonth` only starts
 * from the current month). Pure — returns the same state if nothing is due. */
function generateDueRecurring(state: AppState): AppState {
  const today = new Date()
  const currentMonthKey = monthKeyOf(today.getFullYear(), today.getMonth() + 1)
  const currentDay = today.getDate()
  const newTransactions: Transaction[] = []
  let anyChange = false

  const updatedRules = state.recurringRules.map(rule => {
    if (!rule.active) return rule
    const due: string[] = []
    let cursor = rule.lastGeneratedMonth ? addMonthsToKey(rule.lastGeneratedMonth, 1) : currentMonthKey
    while (cursor <= currentMonthKey && due.length < 2) {
      if (cursor === currentMonthKey && currentDay < rule.dayOfMonth) break
      due.push(cursor)
      cursor = addMonthsToKey(cursor, 1)
    }
    if (due.length === 0) return rule

    const now = new Date().toISOString()
    for (const key of due) {
      const [y, m] = key.split('-').map(Number)
      const daysInMonth = new Date(y, m, 0).getDate()
      const day = Math.min(rule.dayOfMonth, daysInMonth)
      newTransactions.push({
        id: crypto.randomUUID(),
        type: rule.type,
        amount: rule.amount,
        description: rule.description,
        categoryId: rule.categoryId,
        date: `${key}-${String(day).padStart(2, '0')}`,
        paymentMethod: rule.paymentMethod,
        createdAt: now,
        recurringRuleId: rule.id
      })
    }
    anyChange = true
    return { ...rule, lastGeneratedMonth: due[due.length - 1] }
  })

  if (!anyChange) return state
  return { ...state, recurringRules: updatedRules, transactions: [...state.transactions, ...newTransactions] }
}

interface StoreValue {
  state: AppState
  addTransaction: (t: Omit<Transaction, 'id' | 'createdAt'>) => void
  addTransactionsBulk: (items: Omit<Transaction, 'id' | 'createdAt'>[]) => number
  updateTransaction: (id: string, patch: Partial<Transaction>) => void
  deleteTransaction: (id: string) => void
  restoreTransaction: (t: Transaction) => void
  addCategory: (name: string, icon: string) => void
  updateCategory: (id: string, patch: Partial<Pick<Category, 'name' | 'icon'>>) => void
  deleteCategory: (id: string) => void
  setBudget: (categoryId: string, limit: number) => void
  deleteBudget: (categoryId: string) => void
  addGoal: (goal: Omit<Goal, 'id'>) => void
  updateGoal: (id: string, patch: Partial<Goal>) => void
  deleteGoal: (id: string) => void
  updateSettings: (patch: Partial<UserSettings>) => void
  addPortfolioAsset: (asset: Omit<PortfolioAsset, 'id'>) => void
  updatePortfolioAsset: (id: string, patch: Partial<PortfolioAsset>) => void
  deletePortfolioAsset: (id: string) => void
  addRecurringRule: (rule: Omit<RecurringRule, 'id'>) => void
  updateRecurringRule: (id: string, patch: Partial<RecurringRule>) => void
  deleteRecurringRule: (id: string) => void
  addBenefit: (benefit: Omit<Benefit, 'id'>) => void
  updateBenefit: (id: string, patch: Partial<Benefit>) => void
  deleteBenefit: (id: string) => void
  addCashbackProgram: (program: Omit<CashbackProgram, 'id' | 'entries'>) => void
  deleteCashbackProgram: (id: string) => void
  addCashbackEntry: (programId: string, entry: Omit<CashbackEntry, 'id'>) => void
  deleteCashbackEntry: (programId: string, entryId: string) => void
  markAchievementsUnlocked: (ids: string[]) => void
  clearDemoData: () => void
  importData: (data: unknown) => void
  resetAll: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [initial] = useState(loadState)
  const [state, setState] = useState<AppState>(initial.state)
  const stateRef = useRef(state)
  const persistTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (initial.recovered) {
      pushToast(
        'Não conseguimos ler seus dados salvos — dados de exemplo foram carregados. Uma cópia do arquivo original foi preservada no armazenamento do navegador.',
        'error'
      )
    }
    // Generate any due recurring transactions once per load.
    setState(s => generateDueRecurring(s))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    stateRef.current = state
    if (persistTimeout.current) clearTimeout(persistTimeout.current)
    persistTimeout.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    }, PERSIST_DEBOUNCE_MS)
    return () => {
      if (persistTimeout.current) clearTimeout(persistTimeout.current)
    }
  }, [state])

  const addTransaction = useCallback((t: Omit<Transaction, 'id' | 'createdAt'>) => {
    setState(s => ({
      ...s,
      transactions: [
        ...s.transactions,
        { ...t, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
      ]
    }))
  }, [])

  const addTransactionsBulk = useCallback((items: Omit<Transaction, 'id' | 'createdAt'>[]) => {
    // Compute the deduped set synchronously against the latest state (via ref)
    // so we can return an accurate "added" count to the caller. Prefers the
    // OFX-provided fitid when available (a real unique id), falling back to
    // a composite string key for CSV rows that don't have one.
    const current = stateRef.current
    const seenKeys = new Set(current.transactions.map(t => `${t.date}|${t.amount}|${t.type}|${t.description}`))
    const seenFitids = new Set(current.transactions.filter(t => t.fitid).map(t => t.fitid as string))
    const now = new Date().toISOString()
    const fresh: Transaction[] = []
    for (const item of items) {
      if (item.fitid && seenFitids.has(item.fitid)) continue
      const key = `${item.date}|${item.amount}|${item.type}|${item.description}`
      if (!item.fitid && seenKeys.has(key)) continue
      seenKeys.add(key)
      if (item.fitid) seenFitids.add(item.fitid)
      fresh.push({ ...item, id: crypto.randomUUID(), createdAt: now })
    }
    if (fresh.length > 0) {
      setState(s => ({ ...s, transactions: [...s.transactions, ...fresh] }))
    }
    return fresh.length
  }, [])

  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
    setState(s => ({
      ...s,
      transactions: s.transactions.map(t => (t.id === id ? { ...t, ...patch } : t))
    }))
  }, [])

  const deleteTransaction = useCallback((id: string) => {
    setState(s => ({ ...s, transactions: s.transactions.filter(t => t.id !== id) }))
  }, [])

  const restoreTransaction = useCallback((t: Transaction) => {
    setState(s => (s.transactions.some(x => x.id === t.id) ? s : { ...s, transactions: [...s.transactions, t] }))
  }, [])

  const addCategory = useCallback((name: string, icon: string) => {
    setState(s => ({
      ...s,
      categories: [...s.categories, { id: crypto.randomUUID(), name, icon, custom: true }]
    }))
  }, [])

  const updateCategory = useCallback((id: string, patch: Partial<Pick<Category, 'name' | 'icon'>>) => {
    setState(s => ({ ...s, categories: s.categories.map(c => (c.id === id ? { ...c, ...patch } : c)) }))
  }, [])

  const deleteCategory = useCallback((id: string) => {
    setState(s => {
      const target = s.categories.find(c => c.id === id)
      if (!target || !target.custom) return s
      return {
        ...s,
        categories: s.categories.filter(c => c.id !== id),
        transactions: s.transactions.map(t => (t.categoryId === id ? { ...t, categoryId: FALLBACK_CATEGORY_ID } : t)),
        budgets: s.budgets.filter(b => b.categoryId !== id)
      }
    })
  }, [])

  const setBudget = useCallback((categoryId: string, limit: number) => {
    setState(s => {
      const existing = s.budgets.find(b => b.categoryId === categoryId)
      if (existing) {
        return { ...s, budgets: s.budgets.map(b => (b.categoryId === categoryId ? { ...b, limit } : b)) }
      }
      return { ...s, budgets: [...s.budgets, { categoryId, limit }] }
    })
  }, [])

  const deleteBudget = useCallback((categoryId: string) => {
    setState(s => ({ ...s, budgets: s.budgets.filter(b => b.categoryId !== categoryId) }))
  }, [])

  const addGoal = useCallback((goal: Omit<Goal, 'id'>) => {
    setState(s => ({ ...s, goals: [...s.goals, { ...goal, id: crypto.randomUUID() }] }))
  }, [])

  const updateGoal = useCallback((id: string, patch: Partial<Goal>) => {
    setState(s => ({ ...s, goals: s.goals.map(g => (g.id === id ? { ...g, ...patch } : g)) }))
  }, [])

  const deleteGoal = useCallback((id: string) => {
    setState(s => ({ ...s, goals: s.goals.filter(g => g.id !== id) }))
  }, [])

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setState(s => ({ ...s, settings: { ...s.settings, ...patch } }))
  }, [])

  const addPortfolioAsset = useCallback((asset: Omit<PortfolioAsset, 'id'>) => {
    setState(s => ({ ...s, portfolio: [...s.portfolio, { ...asset, id: crypto.randomUUID() }] }))
  }, [])

  const updatePortfolioAsset = useCallback((id: string, patch: Partial<PortfolioAsset>) => {
    setState(s => ({ ...s, portfolio: s.portfolio.map(p => (p.id === id ? { ...p, ...patch } : p)) }))
  }, [])

  const deletePortfolioAsset = useCallback((id: string) => {
    setState(s => ({ ...s, portfolio: s.portfolio.filter(p => p.id !== id) }))
  }, [])

  const addRecurringRule = useCallback((rule: Omit<RecurringRule, 'id'>) => {
    setState(s => ({ ...s, recurringRules: [...s.recurringRules, { ...rule, id: crypto.randomUUID() }] }))
  }, [])

  const updateRecurringRule = useCallback((id: string, patch: Partial<RecurringRule>) => {
    setState(s => ({ ...s, recurringRules: s.recurringRules.map(r => (r.id === id ? { ...r, ...patch } : r)) }))
  }, [])

  const deleteRecurringRule = useCallback((id: string) => {
    setState(s => ({ ...s, recurringRules: s.recurringRules.filter(r => r.id !== id) }))
  }, [])

  const addBenefit = useCallback((benefit: Omit<Benefit, 'id'>) => {
    setState(s => ({ ...s, benefits: [...s.benefits, { ...benefit, id: crypto.randomUUID() }] }))
  }, [])

  const updateBenefit = useCallback((id: string, patch: Partial<Benefit>) => {
    setState(s => ({ ...s, benefits: s.benefits.map(b => (b.id === id ? { ...b, ...patch } : b)) }))
  }, [])

  const deleteBenefit = useCallback((id: string) => {
    setState(s => ({ ...s, benefits: s.benefits.filter(b => b.id !== id) }))
  }, [])

  const addCashbackProgram = useCallback((program: Omit<CashbackProgram, 'id' | 'entries'>) => {
    setState(s => ({
      ...s,
      cashbackPrograms: [...s.cashbackPrograms, { ...program, id: crypto.randomUUID(), entries: [] }]
    }))
  }, [])

  const deleteCashbackProgram = useCallback((id: string) => {
    setState(s => ({ ...s, cashbackPrograms: s.cashbackPrograms.filter(p => p.id !== id) }))
  }, [])

  const addCashbackEntry = useCallback((programId: string, entry: Omit<CashbackEntry, 'id'>) => {
    setState(s => ({
      ...s,
      cashbackPrograms: s.cashbackPrograms.map(p =>
        p.id === programId ? { ...p, entries: [...p.entries, { ...entry, id: crypto.randomUUID() }] } : p
      )
    }))
  }, [])

  const deleteCashbackEntry = useCallback((programId: string, entryId: string) => {
    setState(s => ({
      ...s,
      cashbackPrograms: s.cashbackPrograms.map(p =>
        p.id === programId ? { ...p, entries: p.entries.filter(e => e.id !== entryId) } : p
      )
    }))
  }, [])

  const markAchievementsUnlocked = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    setState(s => {
      const known = new Set(s.unlockedAchievements.map(a => a.id))
      const fresh = ids.filter(id => !known.has(id))
      if (fresh.length === 0) return s
      const now = new Date().toISOString()
      return {
        ...s,
        unlockedAchievements: [...s.unlockedAchievements, ...fresh.map(id => ({ id, unlockedAt: now }))]
      }
    })
  }, [])

  const clearDemoData = useCallback(() => {
    setState(s => ({
      ...s,
      transactions: s.transactions.filter(t => !t.id.startsWith('demo-')),
      benefits: s.benefits.filter(b => !b.id.startsWith('demo-')),
      demoDataCleared: true
    }))
  }, [])

  const importData = useCallback((data: unknown) => {
    const result = validateAndMigrate(data)
    if (!result.ok) {
      pushToast(`Arquivo de backup inválido: ${result.error}`, 'error')
      return
    }
    setState(result.state)
    if (result.warnings.length > 0) {
      pushToast(`Dados importados com avisos: ${result.warnings.join(' ')}`, 'error')
    } else {
      pushToast('Dados importados com sucesso')
    }
  }, [])

  const resetAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(CORRUPTED_BACKUP_KEY)
    setState({
      settings: DEFAULT_SETTINGS,
      transactions: [],
      categories: DEFAULT_CATEGORIES,
      budgets: [],
      goals: [],
      portfolio: [],
      recurringRules: [],
      benefits: [],
      cashbackPrograms: [],
      unlockedAchievements: [],
      demoDataCleared: true,
      schemaVersion: CURRENT_SCHEMA_VERSION
    })
  }, [])

  const value: StoreValue = {
    state,
    addTransaction,
    addTransactionsBulk,
    updateTransaction,
    deleteTransaction,
    restoreTransaction,
    addCategory,
    updateCategory,
    deleteCategory,
    setBudget,
    deleteBudget,
    addGoal,
    updateGoal,
    deleteGoal,
    updateSettings,
    addPortfolioAsset,
    updatePortfolioAsset,
    deletePortfolioAsset,
    addRecurringRule,
    updateRecurringRule,
    deleteRecurringRule,
    addBenefit,
    updateBenefit,
    deleteBenefit,
    addCashbackProgram,
    deleteCashbackProgram,
    addCashbackEntry,
    deleteCashbackEntry,
    markAchievementsUnlocked,
    clearDemoData,
    importData,
    resetAll
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
