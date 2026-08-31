import { useMemo, useState } from 'react'
import Header from '../components/Header'
import { Card, EmptyState, Modal, ProgressBar, pushToast, ConfirmDialog } from '../components/Primitives'
import AmountInput from '../components/AmountInput'
import { useStore } from '../store/useStore'
import { formatCurrency, daysUntil } from '../utils/finance'
import { Goal } from '../types'
import { Plus, Target, Pencil } from 'lucide-react'

const CONTRIBUTION_QUICK_ADD = [20, 50, 100]

/** Suggested monthly deposit to hit a goal's deadline, plus a human label.
 * Returns null when there's nothing left to save or no deadline to pace by. */
function monthlyPlan(goal: Goal): string | null {
  const remaining = goal.target - goal.saved
  if (remaining <= 0) return null
  if (!goal.deadline) return null
  const days = daysUntil(new Date(goal.deadline))
  if (days < 0) return `Faltam ${formatCurrency(remaining)} e o prazo já venceu`
  const monthsLeft = Math.max(1, Math.ceil(days / 30))
  const perMonth = remaining / monthsLeft
  return `Guarde ${formatCurrency(perMonth)}/mês para chegar no prazo`
}

/** Per-goal contribution field with quick-add chips. Kept as its own component
 * so each card holds its own draft amount. */
function GoalContribution({ goal, onAdd }: { goal: Goal; onAdd: (delta: number) => void }) {
  const [amount, setAmount] = useState(0)
  return (
    <div className="mt-3 space-y-2">
      <AmountInput
        value={amount}
        onChange={setAmount}
        quickAdd={CONTRIBUTION_QUICK_ADD}
        allowNegative
        placeholder="Adicionar valor"
      />
      <button
        onClick={() => {
          if (amount !== 0) {
            onAdd(amount)
            setAmount(0)
          }
        }}
        disabled={amount === 0}
        className="w-full rounded-lg bg-green py-2 text-xs font-semibold text-bg disabled:opacity-40"
      >
        {amount < 0 ? 'Corrigir aporte' : 'Adicionar ao guardado'}
      </button>
    </div>
  )
}

export default function Goals() {
  const { state, addGoal, updateGoal, deleteGoal } = useStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [target, setTarget] = useState(0)
  const [saved, setSaved] = useState(0)
  const [deadline, setDeadline] = useState('')

  function resetForm() {
    setName('')
    setTarget(0)
    setSaved(0)
    setDeadline('')
    setEditingId(null)
  }

  function openAdd() {
    resetForm()
    setFormOpen(true)
  }

  function openEdit(g: Goal) {
    setEditingId(g.id)
    setName(g.name)
    setTarget(g.target)
    setSaved(g.saved)
    setDeadline(g.deadline ?? '')
    setFormOpen(true)
  }

  function handleSave() {
    if (!name.trim() || !target || target <= 0) {
      pushToast('Preencha nome e valor da meta', 'error')
      return
    }
    const payload = { name: name.trim(), target, saved: Math.max(0, saved), deadline: deadline || undefined }
    if (editingId) {
      updateGoal(editingId, payload)
      pushToast('Meta atualizada')
    } else {
      addGoal(payload)
      pushToast('Meta criada')
    }
    resetForm()
    setFormOpen(false)
  }

  // Closest deadline first; goals without one sort last.
  const orderedGoals = useMemo(() => {
    return [...state.goals].sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return a.deadline.localeCompare(b.deadline)
    })
  }, [state.goals])

  return (
    <div className="pb-28">
      <Header title="Metas" subtitle="Seus objetivos financeiros" />
      <div className="px-5 space-y-3">
        {state.goals.length === 0 ? (
          <EmptyState
            title="Nenhuma meta criada ainda"
            description="Defina um objetivo financeiro e acompanhe seu progresso."
            actionLabel="Criar primeira meta"
            onAction={openAdd}
          />
        ) : (
          orderedGoals.map(g => {
            const pct = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0
            const days = g.deadline ? daysUntil(new Date(g.deadline)) : null
            const remaining = Math.max(0, g.target - g.saved)
            const plan = monthlyPlan(g)
            return (
              <Card key={g.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Target size={15} className="text-green" />
                    {g.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => openEdit(g)} className="text-muted hover:text-txt" aria-label="Editar">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setPendingDelete(g.id)} className="text-muted text-xs" aria-label="Excluir">
                      ✕
                    </button>
                  </div>
                </div>
                <ProgressBar value={g.saved} max={g.target} />
                <div className="flex items-center justify-between mt-2 text-xs">
                  <p className="text-muted">
                    {formatCurrency(g.saved)} de {formatCurrency(g.target)}
                  </p>
                  <p className="font-medium text-green">{pct.toFixed(0)}%</p>
                </div>
                {remaining > 0 ? (
                  <p className="text-[11px] text-muted mt-1">Faltam {formatCurrency(remaining)}</p>
                ) : (
                  <p className="text-[11px] text-green mt-1">Meta alcançada! 🎉</p>
                )}
                {plan && <p className="text-[11px] text-muted mt-0.5">{plan}</p>}
                {days != null && (
                  <p className={`text-[11px] mt-1 ${days < 0 ? 'text-danger' : 'text-muted'}`}>
                    {days < 0
                      ? `Prazo vencido há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}`
                      : days === 0
                        ? 'Prazo é hoje'
                        : `Faltam ${days} dia${days === 1 ? '' : 's'}`}
                  </p>
                )}
                <GoalContribution
                  goal={g}
                  onAdd={val => {
                    updateGoal(g.id, { saved: Math.max(0, g.saved + val) })
                    pushToast(val > 0 ? 'Progresso atualizado' : 'Aporte corrigido')
                  }}
                />
              </Card>
            )
          })
        )}
      </div>

      <button
        onClick={openAdd}
        aria-label="Criar meta"
        className="fixed bottom-24 right-5 md:bottom-8 h-14 w-14 rounded-full bg-green text-bg flex items-center justify-center shadow-soft active:scale-95 transition-transform z-30"
      >
        <Plus size={26} />
      </button>

      <Modal
        open={formOpen}
        onClose={() => {
          resetForm()
          setFormOpen(false)
        }}
        title={editingId ? 'Editar meta' : 'Nova meta'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Nome da meta</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Comprar notebook"
              className="w-full rounded-xl bg-bg border border-line/10 px-4 py-2.5 text-sm outline-none focus:border-green"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Valor alvo</label>
            <AmountInput value={target} onChange={setTarget} quickAdd={[100, 500, 1000]} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Já guardado</label>
            <AmountInput value={saved} onChange={setSaved} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Prazo (opcional)</label>
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full rounded-xl bg-bg border border-line/10 px-4 py-2.5 text-sm outline-none focus:border-green"
            />
          </div>
          <button onClick={handleSave} className="w-full rounded-xl bg-green py-3.5 font-semibold text-bg">
            {editingId ? 'Salvar alterações' : 'Criar meta'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir meta?"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deleteGoal(pendingDelete)
            pushToast('Meta excluída')
          }
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
