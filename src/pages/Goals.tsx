import { useMemo, useState } from 'react'
import Header from '../components/Header'
import { Card, EmptyState, Modal, ProgressBar, pushToast, ConfirmDialog } from '../components/Primitives'
import { useStore } from '../store/useStore'
import { formatCurrency, daysUntil } from '../utils/finance'
import { Plus, Target, Pencil } from 'lucide-react'

export default function Goals() {
  const { state, addGoal, updateGoal, deleteGoal } = useStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [saved, setSaved] = useState('')
  const [deadline, setDeadline] = useState('')

  function resetForm() {
    setName('')
    setTarget('')
    setSaved('')
    setDeadline('')
    setEditingId(null)
  }

  function openAdd() {
    resetForm()
    setFormOpen(true)
  }

  function openEdit(g: { id: string; name: string; target: number; saved: number; deadline?: string }) {
    setEditingId(g.id)
    setName(g.name)
    setTarget(String(g.target))
    setSaved(String(g.saved))
    setDeadline(g.deadline ?? '')
    setFormOpen(true)
  }

  function handleSave() {
    const targetNum = parseFloat(target.replace(',', '.'))
    const savedNum = parseFloat((saved || '0').replace(',', '.'))
    if (!name.trim() || !targetNum || targetNum <= 0) {
      pushToast('Preencha nome e valor da meta', 'error')
      return
    }
    const payload = { name: name.trim(), target: targetNum, saved: Math.max(0, savedNum), deadline: deadline || undefined }
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
                {days != null && (
                  <p className={`text-[11px] mt-1 ${days < 0 ? 'text-danger' : 'text-muted'}`}>
                    {days < 0
                      ? `Prazo vencido há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}`
                      : days === 0
                        ? 'Prazo é hoje'
                        : `Faltam ${days} dia${days === 1 ? '' : 's'}`}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="number"
                    placeholder="Adicionar valor (ou negativo para corrigir)"
                    className="flex-1 rounded-lg bg-bg border border-line/10 px-3 py-1.5 text-xs outline-none focus:border-green"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = parseFloat((e.target as HTMLInputElement).value)
                        if (val && val !== 0) {
                          updateGoal(g.id, { saved: Math.max(0, g.saved + val) })
                          ;(e.target as HTMLInputElement).value = ''
                          pushToast(val > 0 ? 'Progresso atualizado' : 'Aporte corrigido')
                        }
                      }
                    }}
                  />
                </div>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Valor alvo</label>
              <input
                inputMode="decimal"
                value={target}
                onChange={e => setTarget(e.target.value)}
                className="w-full rounded-xl bg-bg border border-line/10 px-4 py-2.5 text-sm outline-none focus:border-green"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Já guardado</label>
              <input
                inputMode="decimal"
                value={saved}
                onChange={e => setSaved(e.target.value)}
                className="w-full rounded-xl bg-bg border border-line/10 px-4 py-2.5 text-sm outline-none focus:border-green"
              />
            </div>
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
