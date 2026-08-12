import { useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import { useStore } from '../store/useStore'
import TransactionList from '../components/TransactionList'
import TransactionForm from '../components/TransactionForm'
import { EmptyState } from '../components/Primitives'
import { Plus, Search } from 'lucide-react'
import { Transaction } from '../types'

const PAGE_SIZE = 50

export default function Expenses() {
  const { state } = useStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [filterCat, setFilterCat] = useState<string | 'all'>('all')
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const filtered = useMemo(() => {
    return state.transactions
      .filter(t => (filterCat === 'all' ? true : t.categoryId === filterCat))
      .filter(t => t.description.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [state.transactions, filterCat, search])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [filterCat, search])

  const visible = filtered.slice(0, visibleCount)

  return (
    <div className="pb-28">
      <Header title="Gastos" subtitle="Suas transações registradas" />
      <div className="px-5 space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar transação..."
            className="w-full rounded-xl bg-card border border-white/5 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-green"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-none">
          <button
            onClick={() => setFilterCat('all')}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium border ${
              filterCat === 'all' ? 'bg-green/15 border-green text-green' : 'border-white/10 text-muted'
            }`}
          >
            Todas
          </button>
          {state.categories.map(c => (
            <button
              key={c.id}
              onClick={() => setFilterCat(c.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium border flex items-center gap-1 ${
                filterCat === c.id ? 'bg-green/15 border-green text-green' : 'border-white/10 text-muted'
              }`}
            >
              <span>{c.icon}</span>
              {c.name}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="Você ainda não possui gastos registrados."
            description="Comece adicionando seu primeiro gasto para acompanhar suas finanças."
            actionLabel="Adicionar primeiro gasto"
            onAction={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          />
        ) : (
          <>
            <TransactionList
              transactions={visible}
              categories={state.categories}
              onEdit={t => {
                setEditing(t)
                setFormOpen(true)
              }}
            />
            {filtered.length > visible.length && (
              <button
                onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                className="w-full rounded-xl bg-white/5 py-2.5 text-xs font-medium text-muted"
              >
                Carregar mais ({filtered.length - visible.length} restantes)
              </button>
            )}
          </>
        )}
      </div>

      <button
        onClick={() => {
          setEditing(null)
          setFormOpen(true)
        }}
        aria-label="Adicionar gasto"
        className="fixed bottom-24 right-5 md:bottom-8 h-14 w-14 rounded-full bg-green text-bg flex items-center justify-center shadow-soft active:scale-95 transition-transform z-30"
      >
        <Plus size={26} />
      </button>

      <TransactionForm
        open={formOpen}
        editing={editing}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
      />
    </div>
  )
}
