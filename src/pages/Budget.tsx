import { useMemo, useState } from 'react'
import Header from '../components/Header'
import { Card, ProgressBar, pushToast, ConfirmDialog } from '../components/Primitives'
import { StatTile } from '../components/ChartKit'
import { useStore } from '../store/useStore'
import { isSameMonth, formatCurrency, parseAmountInput } from '../utils/finance'
import { Trash2 } from 'lucide-react'

export default function Budget() {
  const { state, setBudget, deleteBudget } = useStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const thisMonthExpenses = state.transactions.filter(t => t.type === 'expense' && isSameMonth(t.date))
  const spentByCategory = new Map<string, number>()
  for (const t of thisMonthExpenses) {
    spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + t.amount)
  }

  function toneFor(pct: number): 'green' | 'warn' | 'danger' {
    if (pct >= 100) return 'danger'
    if (pct >= 75) return 'warn'
    return 'green'
  }

  function statusLabel(pct: number): string {
    if (pct >= 100) return 'Orçamento ultrapassado'
    if (pct >= 90) return 'Alerta'
    if (pct >= 75) return 'Atenção'
    return 'Normal'
  }

  function save(categoryId: string) {
    const numeric = parseAmountInput(value)
    if (!numeric || numeric <= 0) {
      pushToast('Informe um valor válido', 'error')
      return
    }
    setBudget(categoryId, numeric)
    pushToast('Orçamento salvo')
    setEditingId(null)
    setValue('')
  }

  // Categories with a budget first (worst % first), then categories without
  // one at the end — keeps the categories that need attention on top instead
  // of following the arbitrary order of state.categories.
  const ordered = useMemo(() => {
    return [...state.categories].sort((a, b) => {
      const ba = state.budgets.find(x => x.categoryId === a.id)
      const bb = state.budgets.find(x => x.categoryId === b.id)
      if (!ba && !bb) return 0
      if (!ba) return 1
      if (!bb) return -1
      const pctA = (spentByCategory.get(a.id) ?? 0) / ba.limit
      const pctB = (spentByCategory.get(b.id) ?? 0) / bb.limit
      return pctB - pctA
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.categories, state.budgets, thisMonthExpenses])

  const totalBudgeted = state.budgets.reduce((acc, b) => acc + b.limit, 0)
  const totalSpentBudgeted = state.budgets.reduce((acc, b) => acc + (spentByCategory.get(b.categoryId) ?? 0), 0)
  const overCount = state.budgets.filter(b => (spentByCategory.get(b.categoryId) ?? 0) >= b.limit).length

  return (
    <div className="pb-28">
      <Header title="Orçamento" subtitle="Defina limites por categoria" />
      <div className="px-5 space-y-3">
        {state.budgets.length > 0 && (
          <Card variant="elevated">
            <p className="text-sm font-medium mb-1">Visão geral do mês</p>
            <ProgressBar value={totalSpentBudgeted} max={totalBudgeted} tone={toneFor((totalSpentBudgeted / Math.max(1, totalBudgeted)) * 100)} />
            <div className="grid grid-cols-3 gap-2 mt-3">
              <StatTile label="Orçado" value={formatCurrency(totalBudgeted)} />
              <StatTile label="Gasto" value={formatCurrency(totalSpentBudgeted)} tone={totalSpentBudgeted > totalBudgeted ? 'danger' : 'green'} />
              <StatTile
                label={overCount === 1 ? 'Categoria estourada' : 'Categorias estouradas'}
                value={String(overCount)}
                tone={overCount > 0 ? 'danger' : 'green'}
              />
            </div>
          </Card>
        )}

        {ordered.map(cat => {
          const budget = state.budgets.find(b => b.categoryId === cat.id)
          const spent = spentByCategory.get(cat.id) ?? 0
          const pct = budget ? (spent / budget.limit) * 100 : 0
          return (
            <Card key={cat.id} className="!p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span>{cat.icon}</span> {cat.name}
                </span>
                {editingId === cat.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      inputMode="decimal"
                      value={value}
                      onChange={e => setValue(e.target.value)}
                      placeholder="Limite"
                      className="w-24 rounded-lg bg-bg border border-line/10 px-2 py-1 text-xs outline-none focus:border-green"
                    />
                    <button onClick={() => save(cat.id)} className="text-xs font-semibold text-green">
                      Salvar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setEditingId(cat.id)
                        setValue(budget ? String(budget.limit) : '')
                      }}
                      className="text-xs font-medium text-green"
                    >
                      {budget ? 'Editar' : 'Definir limite'}
                    </button>
                    {budget && (
                      <button
                        onClick={() => setPendingDelete(cat.id)}
                        aria-label="Remover limite"
                        className="text-muted hover:text-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {budget && (
                <>
                  <ProgressBar value={spent} max={budget.limit} tone={toneFor(pct)} />
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-muted">
                      {formatCurrency(spent)} de {formatCurrency(budget.limit)}
                    </p>
                    <p
                      className={`text-xs font-medium ${
                        pct >= 100 ? 'text-danger' : pct >= 75 ? 'text-warn' : 'text-green'
                      }`}
                    >
                      {statusLabel(pct)}
                    </p>
                  </div>
                </>
              )}
            </Card>
          )
        })}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Remover limite deste orçamento?"
        description="A categoria continua existindo, só o limite definido é apagado."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deleteBudget(pendingDelete)
            pushToast('Limite removido')
          }
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
