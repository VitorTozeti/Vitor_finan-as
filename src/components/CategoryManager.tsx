import { useState } from 'react'
import { Card, ConfirmDialog, pushToast } from './Primitives'
import { useStore } from '../store/useStore'
import { Pencil, Trash2, Check, X } from 'lucide-react'

/** Lets the user rename any category (icon + name) and delete custom ones.
 * Built-in categories (e.g. "outros") can't be deleted since parts of the
 * app — the bank-statement category guesser, demo data — rely on their ids
 * existing as a fallback. */
export default function CategoryManager() {
  const { state, updateCategory, deleteCategory } = useStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  function startEdit(id: string, currentName: string, currentIcon: string) {
    setEditingId(id)
    setName(currentName)
    setIcon(currentIcon)
  }

  function saveEdit() {
    if (!editingId) return
    if (!name.trim()) {
      pushToast('Informe um nome para a categoria', 'error')
      return
    }
    updateCategory(editingId, { name: name.trim(), icon: icon.trim() || '🏷️' })
    pushToast('Categoria atualizada')
    setEditingId(null)
  }

  const pendingCategory = state.categories.find(c => c.id === pendingDeleteId)
  const affectedCount = pendingCategory ? state.transactions.filter(t => t.categoryId === pendingCategory.id).length : 0

  return (
    <Card>
      <p className="text-sm font-medium mb-3">Categorias</p>
      <div className="space-y-2">
        {state.categories.map(c => (
          <div key={c.id} className="flex items-center gap-2 rounded-xl bg-bg px-3 py-2">
            {editingId === c.id ? (
              <>
                <input
                  value={icon}
                  onChange={e => setIcon(e.target.value)}
                  className="w-11 shrink-0 rounded-lg bg-card border border-line/10 px-2 py-1.5 text-sm text-center outline-none focus:border-green"
                />
                <input
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="flex-1 min-w-0 rounded-lg bg-card border border-line/10 px-2 py-1.5 text-sm outline-none focus:border-green"
                />
                <button onClick={saveEdit} aria-label="Salvar" className="text-green shrink-0">
                  <Check size={16} />
                </button>
                <button onClick={() => setEditingId(null)} aria-label="Cancelar" className="text-muted shrink-0">
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <span className="text-lg shrink-0">{c.icon}</span>
                <span className="flex-1 min-w-0 text-sm truncate">{c.name}</span>
                <button
                  onClick={() => startEdit(c.id, c.name, c.icon)}
                  aria-label="Editar categoria"
                  className="text-muted hover:text-green shrink-0"
                >
                  <Pencil size={14} />
                </button>
                {c.custom && (
                  <button
                    onClick={() => setPendingDeleteId(c.id)}
                    aria-label="Excluir categoria"
                    className="text-muted hover:text-danger shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Excluir categoria?"
        description={
          affectedCount > 0
            ? `${affectedCount} transação(ões) e o orçamento dessa categoria serão movidos para "Outros".`
            : 'Essa ação não pode ser desfeita.'
        }
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) {
            deleteCategory(pendingDeleteId)
            pushToast('Categoria excluída')
          }
          setPendingDeleteId(null)
        }}
      />
    </Card>
  )
}
