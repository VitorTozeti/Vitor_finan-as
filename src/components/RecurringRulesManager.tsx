import { useState } from 'react'
import { Card, ConfirmDialog, pushToast } from './Primitives'
import { useStore } from '../store/useStore'
import { parseAmountInput, formatCurrency } from '../utils/finance'
import { Plus, Trash2 } from 'lucide-react'

/** Manages recurring rules (rent, subscriptions, salary) — the store
 * generates the actual transaction each month once the day arrives. */
export default function RecurringRulesManager() {
  const { state, addRecurringRule, updateRecurringRule, deleteRecurringRule } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id ?? '')
  const [dayOfMonth, setDayOfMonth] = useState('5')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  function resetForm() {
    setDescription('')
    setAmount('')
    setType('expense')
    setCategoryId(state.categories[0]?.id ?? '')
    setDayOfMonth('5')
    setShowForm(false)
  }

  function handleAdd() {
    const numeric = parseAmountInput(amount)
    const day = parseInt(dayOfMonth, 10)
    if (!description.trim()) {
      pushToast('Informe uma descrição', 'error')
      return
    }
    if (!numeric || numeric <= 0) {
      pushToast('Informe um valor válido', 'error')
      return
    }
    if (!day || day < 1 || day > 31) {
      pushToast('Informe um dia válido (1-31)', 'error')
      return
    }
    if (!categoryId) {
      pushToast('Escolha uma categoria', 'error')
      return
    }
    addRecurringRule({ description: description.trim(), amount: numeric, type, categoryId, dayOfMonth: day, active: true })
    pushToast('Recorrência criada — o lançamento do mês entra automaticamente')
    resetForm()
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium">Recorrências</p>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1 text-xs font-medium text-green">
          <Plus size={14} /> Nova
        </button>
      </div>
      <p className="text-xs text-muted mb-3">
        Lançamentos que se repetem todo mês (aluguel, assinatura, salário) são criados automaticamente quando o dia
        chega.
      </p>

      {showForm && (
        <div className="rounded-xl bg-bg p-3 mb-3 space-y-2.5">
          <div className="flex rounded-lg bg-white/5 p-1">
            {(['expense', 'income'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                  type === t ? (t === 'expense' ? 'bg-danger text-white' : 'bg-green text-bg') : 'text-muted'
                }`}
              >
                {t === 'expense' ? 'Gasto' : 'Entrada'}
              </button>
            ))}
          </div>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Descrição (ex: Aluguel)"
            className="w-full rounded-lg bg-card border border-white/10 px-3 py-2 text-sm outline-none focus:border-green"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Valor"
              className="rounded-lg bg-card border border-white/10 px-3 py-2 text-sm outline-none focus:border-green"
            />
            <input
              inputMode="numeric"
              value={dayOfMonth}
              onChange={e => setDayOfMonth(e.target.value)}
              placeholder="Dia do mês"
              className="rounded-lg bg-card border border-white/10 px-3 py-2 text-sm outline-none focus:border-green"
            />
          </div>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            className="w-full rounded-lg bg-card border border-white/10 px-3 py-2 text-sm outline-none focus:border-green"
          >
            {state.categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
          <button onClick={handleAdd} className="w-full rounded-lg bg-green py-2 text-sm font-semibold text-bg">
            Criar recorrência
          </button>
        </div>
      )}

      <div className="space-y-2">
        {state.recurringRules.length === 0 && !showForm && <p className="text-xs text-muted">Nenhuma recorrência cadastrada.</p>}
        {state.recurringRules.map(rule => {
          const cat = state.categories.find(c => c.id === rule.categoryId)
          return (
            <div key={rule.id} className="flex items-center gap-2 rounded-xl bg-bg px-3 py-2">
              <span className="text-lg shrink-0">{cat?.icon ?? '📦'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{rule.description}</p>
                <p className="text-[11px] text-muted">
                  Dia {rule.dayOfMonth} · {rule.type === 'income' ? '+' : '-'}
                  {formatCurrency(rule.amount)}
                </p>
              </div>
              <button
                onClick={() => updateRecurringRule(rule.id, { active: !rule.active })}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  rule.active ? 'bg-green/15 text-green' : 'bg-white/10 text-muted'
                }`}
              >
                {rule.active ? 'Ativa' : 'Pausada'}
              </button>
              <button
                onClick={() => setPendingDeleteId(rule.id)}
                aria-label="Excluir recorrência"
                className="text-muted hover:text-danger shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Excluir recorrência?"
        description="Lançamentos já criados não serão apagados."
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) {
            deleteRecurringRule(pendingDeleteId)
            pushToast('Recorrência excluída')
          }
          setPendingDeleteId(null)
        }}
      />
    </Card>
  )
}
