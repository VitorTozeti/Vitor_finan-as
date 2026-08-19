import { useState } from 'react'
import { Transaction, Category } from '../types'
import { groupTransactionsByDate, relativeDateLabel, formatCurrency } from '../utils/finance'
import { ConfirmDialog } from './Primitives'
import { useStore } from '../store/useStore'
import { pushToast } from './Primitives'

export default function TransactionList({
  transactions,
  categories,
  onEdit
}: {
  transactions: Transaction[]
  categories: Category[]
  onEdit: (t: Transaction) => void
}) {
  const { deleteTransaction, restoreTransaction } = useStore()
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const groups = groupTransactionsByDate(transactions)
  const catMap = new Map(categories.map(c => [c.id, c]))

  function handleDeleteConfirmed() {
    const target = transactions.find(t => t.id === pendingDelete)
    if (target) {
      deleteTransaction(target.id)
      pushToast('Transação excluída', 'success', { label: 'Desfazer', onClick: () => restoreTransaction(target) })
    }
    setPendingDelete(null)
  }

  return (
    <div className="space-y-6">
      {groups.map(group => (
        <div key={group.date}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2 px-1">
            {relativeDateLabel(group.date)}
          </p>
          <div className="space-y-2">
            {group.items.map(t => {
              const cat = catMap.get(t.categoryId)
              return (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onEdit(t)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onEdit(t)
                    }
                  }}
                  className="w-full flex items-center gap-3 rounded-xl bg-card border border-line/5 px-4 py-3 text-left active:scale-[0.99] transition-transform cursor-pointer"
                >
                  <div className="h-10 w-10 shrink-0 rounded-full bg-line/5 flex items-center justify-center text-lg">
                    {cat?.icon ?? '📦'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.description || cat?.name}</p>
                    <p className="text-xs text-muted">{cat?.name}{t.paymentMethod ? ` · ${t.paymentMethod}` : ''}</p>
                  </div>
                  <p className={`text-sm font-semibold shrink-0 ${t.type === 'income' ? 'text-green' : 'text-txt'}`}>
                    {t.type === 'income' ? '+' : '-'}
                    {formatCurrency(t.amount)}
                  </p>
                  <button
                    type="button"
                    aria-label="Excluir"
                    onClick={e => {
                      e.stopPropagation()
                      setPendingDelete(t.id)
                    }}
                    className="ml-1 text-muted hover:text-danger text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Excluir transação?"
        description="Essa ação não pode ser desfeita."
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  )
}
