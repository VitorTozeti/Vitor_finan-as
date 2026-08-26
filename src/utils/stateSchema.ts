import {
  AppState,
  Benefit,
  Budget,
  CashbackProgram,
  Category,
  Goal,
  PortfolioAsset,
  RecurringRule,
  Transaction,
  UnlockedAchievement,
  UserSettings
} from '../types'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '../data/defaults'
import { isValidTheme, DEFAULT_THEME, CUSTOM_THEME_ID } from '../data/themes'

// Validates and migrates an unknown blob (from localStorage or an imported
// backup file) into a well-formed AppState. Invalid rows inside otherwise
// valid arrays are dropped individually (with a warning) instead of failing
// the whole load — a single bad transaction shouldn't nuke the user's entire
// history. Missing arrays introduced by newer schema versions (e.g.
// recurringRules) default to empty so old backups keep working.

export const CURRENT_SCHEMA_VERSION = 5

const HEX_COLOR_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/

function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && HEX_COLOR_RE.test(v)
}

export interface ValidationSuccess {
  ok: true
  state: AppState
  warnings: string[]
}

export interface ValidationFailure {
  ok: false
  error: string
}

export type ValidateResult = ValidationSuccess | ValidationFailure

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function sanitizeSettings(raw: unknown, warnings: string[]): UserSettings {
  if (!isObject(raw)) {
    warnings.push('Configurações ausentes ou inválidas — usando padrão.')
    return { ...DEFAULT_SETTINGS }
  }
  return {
    onboarded: typeof raw.onboarded === 'boolean' ? raw.onboarded : DEFAULT_SETTINGS.onboarded,
    mainIncome:
      typeof raw.mainIncome === 'number' && isFinite(raw.mainIncome) ? raw.mainIncome : DEFAULT_SETTINGS.mainIncome,
    payDay:
      typeof raw.payDay === 'number' && raw.payDay >= 1 && raw.payDay <= 31 ? raw.payDay : DEFAULT_SETTINGS.payDay,
    otherIncomeSources: Array.isArray(raw.otherIncomeSources) ? (raw.otherIncomeSources as UserSettings['otherIncomeSources']) : [],
    monthlyBudgetTotal: typeof raw.monthlyBudgetTotal === 'number' ? raw.monthlyBudgetTotal : undefined,
    mainGoalDescription: typeof raw.mainGoalDescription === 'string' ? raw.mainGoalDescription : undefined,
    // Schema v4 — default to the house theme when missing or unknown.
    // Schema v5 — 'custom' is also valid when a well-formed customPalette accompanies it.
    theme: (() => {
      const t = raw.theme as string | undefined
      if (t === CUSTOM_THEME_ID && isObject(raw.customPalette)) return CUSTOM_THEME_ID
      return isValidTheme(t) ? (t as string) : DEFAULT_THEME
    })(),
    customPalette: (() => {
      const p = raw.customPalette
      if (!isObject(p)) return undefined
      if (isHexColor(p.bg) && isHexColor(p.primary) && isHexColor(p.accent)) {
        return { bg: p.bg, primary: p.primary, accent: p.accent }
      }
      return undefined
    })()
  }
}

function sanitizeArray<T>(raw: unknown, isValid: (item: unknown) => item is T, label: string, warnings: string[]): T[] {
  if (!Array.isArray(raw)) return []
  const out: T[] = []
  let dropped = 0
  for (const item of raw) {
    if (isValid(item)) out.push(item)
    else dropped++
  }
  if (dropped > 0) warnings.push(`${dropped} registro(s) de ${label} inválido(s) foram ignorados.`)
  return out
}

function isTransaction(v: unknown): v is Transaction {
  if (!isObject(v)) return false
  return (
    typeof v.id === 'string' &&
    (v.type === 'expense' || v.type === 'income') &&
    typeof v.amount === 'number' &&
    isFinite(v.amount as number) &&
    typeof v.description === 'string' &&
    typeof v.categoryId === 'string' &&
    typeof v.date === 'string' &&
    typeof v.createdAt === 'string'
  )
}

function isCategory(v: unknown): v is Category {
  if (!isObject(v)) return false
  return typeof v.id === 'string' && typeof v.name === 'string' && typeof v.icon === 'string'
}

function isBudget(v: unknown): v is Budget {
  if (!isObject(v)) return false
  return typeof v.categoryId === 'string' && typeof v.limit === 'number'
}

function isGoal(v: unknown): v is Goal {
  if (!isObject(v)) return false
  return typeof v.id === 'string' && typeof v.name === 'string' && typeof v.target === 'number' && typeof v.saved === 'number'
}

function isPortfolioAsset(v: unknown): v is PortfolioAsset {
  if (!isObject(v)) return false
  return typeof v.id === 'string' && typeof v.ticker === 'string' && typeof v.quantity === 'number' && typeof v.avgPrice === 'number'
}

function isRecurringRule(v: unknown): v is RecurringRule {
  if (!isObject(v)) return false
  return (
    typeof v.id === 'string' &&
    typeof v.description === 'string' &&
    typeof v.amount === 'number' &&
    (v.type === 'expense' || v.type === 'income') &&
    typeof v.categoryId === 'string' &&
    typeof v.dayOfMonth === 'number' &&
    typeof v.active === 'boolean'
  )
}

function isBenefit(v: unknown): v is Benefit {
  if (!isObject(v)) return false
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.type === 'string' &&
    typeof v.amount === 'number' &&
    typeof v.frequency === 'string'
  )
}

function isCashbackProgram(v: unknown): v is CashbackProgram {
  if (!isObject(v)) return false
  return typeof v.id === 'string' && typeof v.name === 'string' && typeof v.unit === 'string' && Array.isArray(v.entries)
}

function isUnlockedAchievement(v: unknown): v is UnlockedAchievement {
  if (!isObject(v)) return false
  return typeof v.id === 'string' && typeof v.unlockedAt === 'string'
}

/** Validates an unknown blob and migrates it into the current AppState shape.
 * Requires at minimum a `transactions` array to be considered a plausible
 * GreenFinance backup — everything else is sanitized/defaulted rather than
 * rejected, so partial or older-schema data still loads. */
export function validateAndMigrate(raw: unknown): ValidateResult {
  if (!isObject(raw)) {
    return { ok: false, error: 'O arquivo não parece ser um backup válido do GreenFinance.' }
  }
  if (!Array.isArray(raw.transactions)) {
    return { ok: false, error: 'O arquivo não contém uma lista de transações válida.' }
  }

  const warnings: string[] = []
  const settings = sanitizeSettings(raw.settings, warnings)
  const transactions = sanitizeArray(raw.transactions, isTransaction, 'transações', warnings)
  const categoriesRaw = sanitizeArray(raw.categories, isCategory, 'categorias', warnings)
  const categories = categoriesRaw.length > 0 ? categoriesRaw : DEFAULT_CATEGORIES
  const budgets = sanitizeArray(raw.budgets, isBudget, 'orçamentos', warnings)
  const goals = sanitizeArray(raw.goals, isGoal, 'metas', warnings)
  const portfolio = sanitizeArray(raw.portfolio, isPortfolioAsset, 'ativos', warnings)
  const recurringRules = sanitizeArray(raw.recurringRules, isRecurringRule, 'recorrências', warnings)
  // Schema v3 arrays — default to empty so v1/v2 backups keep working.
  const benefits = sanitizeArray(raw.benefits, isBenefit, 'benefícios', warnings)
  const cashbackPrograms = sanitizeArray(raw.cashbackPrograms, isCashbackProgram, 'cashback', warnings)
  const unlockedAchievements = sanitizeArray(raw.unlockedAchievements, isUnlockedAchievement, 'conquistas', warnings)
  const demoDataCleared = typeof raw.demoDataCleared === 'boolean' ? raw.demoDataCleared : false

  const state: AppState = {
    settings,
    transactions,
    categories,
    budgets,
    goals,
    portfolio,
    recurringRules,
    benefits,
    cashbackPrograms,
    unlockedAchievements,
    demoDataCleared,
    schemaVersion: CURRENT_SCHEMA_VERSION
  }

  return { ok: true, state, warnings }
}
