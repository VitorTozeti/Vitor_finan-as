import { useState } from 'react'
import Header from '../components/Header'
import { Card, ProgressBar, pushToast } from '../components/Primitives'
import { useStore } from '../store/useStore'
import { isSameMonth, formatCurrency, parseAmountInput } from '../utils/finance'

export default function Budget() {
  const { state, setBudget } = useStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [value, setValue] = useState('')

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

  return (
    <div className="pb-28">
      <Header title="Orçamento" subtitle="Defina limites por categoria" />
      <div className="px-5 space-y-3">
        {state.categories.map(cat => {
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
                      className="w-24 rounded-lg bg-bg border border-white/10 px-2 py-1 text-xs outline-none focus:border-green"
                    />
                    <button onClick={() => save(cat.id)} className="text-xs font-semibold text-green">
                      Salvar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(cat.id)
                      setValue(budget ? String(budget.limit) : '')
                    }}
                    className="text-xs font-medium text-green"
                  >
                    {budget ? 'Editar' : 'Definir limite'}
                  </button>
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
    </div>
  )
}
