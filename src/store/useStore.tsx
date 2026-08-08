import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { AppState, Transaction, Category, Budget, Goal, PortfolioAsset, UserSettings } from '../types'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, buildDemoTransactions } from '../data/defaults'

const STORAGE_KEY = 'greenfinance:v1'

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore corrupted storage
  }
  return {
    settings: DEFAULT_SETTINGS,
    transactions: buildDemoTransactions(),
    categories: DEFAULT_CATEGORIES,
    budgets: [],
    goals: [],
    portfolio: [],
    demoDataCleared: false
  }
}

interface StoreValue {
  state: AppState
  addTransaction: (t: Omit<Transaction, 'id' | 'createdAt'>) => void
  updateTransaction: (id: string, patch: Partial<Transaction>) => void
  deleteTransaction: (id: string) => void
  addCategory: (name: string, icon: string) => void
  setBudget: (categoryId: string, limit: number) => void
  addGoal: (goal: Omit<Goal, 'id'>) => void
  updateGoal: (id: string, patch: Partial<Goal>) => void
  deleteGoal: (id: string) => void
  updateSettings: (patch: Partial<UserSettings>) => void
  addPortfolioAsset: (asset: Omit<PortfolioAsset, 'id'>) => void
  updatePortfolioAsset: (id: string, patch: Partial<PortfolioAsset>) => void
  deletePortfolioAsset: (id: string) => void
  clearDemoData: () => void
  importData: (data: AppState) => void
  resetAll: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
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

  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
    setState(s => ({
      ...s,
      transactions: s.transactions.map(t => (t.id === id ? { ...t, ...patch } : t))
    }))
  }, [])

  const deleteTransaction = useCallback((id: string) => {
    setState(s => ({ ...s, transactions: s.transactions.filter(t => t.id !== id) }))
  }, [])

  const addCategory = useCallback((name: string, icon: string) => {
    setState(s => ({
      ...s,
      categories: [...s.categories, { id: crypto.randomUUID(), name, icon, custom: true }]
    }))
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

  const clearDemoData = useCallback(() => {
    setState(s => ({
      ...s,
      transactions: s.transactions.filter(t => !t.id.startsWith('demo-')),
      demoDataCleared: true
    }))
  }, [])

  const importData = useCallback((data: AppState) => {
    setState(data)
  }, [])

  const resetAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setState({
      settings: DEFAULT_SETTINGS,
      transactions: [],
      categories: DEFAULT_CATEGORIES,
      budgets: [],
      goals: [],
      portfolio: [],
      demoDataCleared: true
    })
  }, [])

  const value: StoreValue = {
    state,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    setBudget,
    addGoal,
    updateGoal,
    deleteGoal,
    updateSettings,
    addPortfolioAsset,
    updatePortfolioAsset,
    deletePortfolioAsset,
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
