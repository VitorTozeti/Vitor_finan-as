import { useState } from 'react'
import Header from '../components/Header'
import { Card, EmptyState, Modal, ProgressBar, pushToast, ConfirmDialog } from '../components/Primitives'
import { useStore } from '../store/useStore'
import { formatCurrency } from '../utils/finance'
import { Plus, Target } from 'lucide-react'

export default function Goals() {
  const { state, addGoal, updateGoal, deleteGoal } = useStore()
  const [formOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [saved, setSaved] = useState('')
  const [deadline, setDeadline] = useState('')

  function handleAdd() {
    const targetNum = parseFloat(target.replace(',', '.'))
    const savedNum = parseFloat((saved || '0').replace(',', '.'))
    if (!name.trim() || !targetNum || targetNum <= 0) {
      pushToast('Preencha nome e valor da meta', 'error')
      return
    }
    addGoal({ name: name.trim(), target: targetNum, saved: savedNum, deadline: deadline || undefined })
    pushToast('Meta criada')
    setName('')
    setTarget('')
    setSaved('')
    setDeadline('')
    setFormOpen(false)
  }

  return (
    <div className="pb-28">
      <Header title="Metas" subtitle="Seus objetivos financeiros" />
      <div className="px-5 space-y-3">
        {state.goals.length === 0 ? (
          <EmptyState
            title="Nenhuma meta criada ainda"
            description="Defina um objetivo financeiro e acompanhe seu progresso."
            actionLabel="Criar primeira meta"
            onAction={() => setFormOpen(true)}
          />
        ) : (
          state.goals.map(g => {
            const pct = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0
            return (
              <Card key={g.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Target size={15} className="text-green" />
                    {g.name}
                  </span>
                  <button onClick={() => setPendingDelete(g.id)} className="text-muted text-xs">
                    ✕
                  </button>
                </div>
                <ProgressBar value={g.saved} max={g.target} />
                <div className="flex items-center justify-between mt-2 text-xs">
                  <p className="text-muted">
                    {formatCurrency(g.saved)} de {formatCurrency(g.target)}
                  </p>
                  <p className="font-medium text-green">{pct.toFixed(0)}%</p>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="number"
                    placeholder="Adicionar valor"
                    className="flex-1 rounded-lg bg-bg border border-white/10 px-3 py-1.5 text-xs outline-none focus:border-green"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = parseFloat((e.target as HTMLInputElement).value)
                        if (val > 0) {
                          updateGoal(g.id, { saved: g.saved + val })
                          ;(e.target as HTMLInputElement).value = ''
                          pushToast('Progresso atualizado')
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
        onClick={() => setFormOpen(true)}
        aria-label="Criar meta"
        className="fixed bottom-24 right-5 md:bottom-8 h-14 w-14 rounded-full bg-green text-bg flex items-center justify-center shadow-soft active:scale-95 transition-transform z-30"
      >
        <Plus size={26} />
      </button>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Nova meta">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Nome da meta</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Comprar notebook"
              className="w-full rounded-xl bg-bg border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-green"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Valor alvo</label>
              <input
                inputMode="decimal"
                value={target}
                onChange={e => setTarget(e.target.value)}
                className="w-full rounded-xl bg-bg border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-green"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Já guardado</label>
              <input
                inputMode="decimal"
                value={saved}
                onChange={e => setSaved(e.target.value)}
                className="w-full rounded-xl bg-bg border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-green"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Prazo (opcional)</label>
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full rounded-xl bg-bg border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-green"
            />
          </div>
          <button onClick={handleAdd} className="w-full rounded-xl bg-green py-3.5 font-semibold text-bg">
            Criar meta
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
