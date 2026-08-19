import { useEffect, useState } from 'react'
import { Modal, pushToast } from './Primitives'
import { useStore } from '../store/useStore'
import { Transaction, PaymentMethod } from '../types'
import { parseAmountInput } from '../utils/finance'

const PAYMENT_METHODS: PaymentMethod[] = ['Pix', 'Débito', 'Crédito', 'Dinheiro', 'Outro']

export default function TransactionForm({
  open,
  onClose,
  editing
}: {
  open: boolean
  onClose: () => void
  editing?: Transaction | null
}) {
  const { state, addTransaction, updateTransaction, addCategory } = useStore()
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id ?? '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Pix')
  const [note, setNote] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  useEffect(() => {
    if (editing) {
      setType(editing.type)
      setAmount(String(editing.amount))
      setDescription(editing.description)
      setCategoryId(editing.categoryId)
      setDate(editing.date)
      setPaymentMethod(editing.paymentMethod ?? 'Pix')
      setNote(editing.note ?? '')
    } else if (open) {
      setType('expense')
      setAmount('')
      setDescription('')
      setCategoryId(state.categories[0]?.id ?? '')
      setDate(new Date().toISOString().slice(0, 10))
      setPaymentMethod('Pix')
      setNote('')
    }
  }, [editing, open])

  function handleSave() {
    const numeric = parseAmountInput(amount)
    if (!numeric || numeric <= 0) {
      pushToast('Informe um valor válido', 'error')
      return
    }
    if (!categoryId) {
      pushToast('Escolha uma categoria', 'error')
      return
    }
    const payload = {
      type,
      amount: numeric,
      description: description.trim(),
      categoryId,
      date,
      paymentMethod,
      note: note.trim() || undefined
    }
    if (editing) {
      updateTransaction(editing.id, payload)
      pushToast('Alterações salvas')
    } else {
      addTransaction(payload)
      pushToast('Gasto adicionado com sucesso')
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar transação' : 'Adicionar gasto'}>
      <div className="space-y-4">
        <div className="flex rounded-xl bg-line/5 p-1">
          {(['expense', 'income'] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                type === t ? (t === 'expense' ? 'bg-danger text-white' : 'bg-green text-bg') : 'text-muted'
              }`}
            >
              {t === 'expense' ? 'Gasto' : 'Entrada'}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">Valor</label>
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="R$ 0,00"
            className="w-full rounded-xl bg-bg border border-line/10 px-4 py-3 text-xl font-semibold outline-none focus:border-green"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">Descrição (opcional)</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Ex: Mercado, Uber..."
            className="w-full rounded-xl bg-bg border border-line/10 px-4 py-2.5 text-sm outline-none focus:border-green"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-muted">Categoria</label>
            <button
              onClick={() => setShowNewCategory(v => !v)}
              className="text-xs font-medium text-green"
            >
              + Nova categoria
            </button>
          </div>
          {showNewCategory && (
            <div className="flex gap-2 mb-2">
              <input
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="Nome da categoria"
                className="flex-1 rounded-xl bg-bg border border-line/10 px-3 py-2 text-sm outline-none focus:border-green"
              />
              <button
                onClick={() => {
                  if (newCategoryName.trim()) {
                    addCategory(newCategoryName.trim(), '🏷️')
                    setNewCategoryName('')
                    setShowNewCategory(false)
                  }
                }}
                className="rounded-xl bg-green px-3 text-sm font-semibold text-bg"
              >
                Criar
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {state.categories.map(c => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium border transition-colors ${
                  categoryId === c.id
                    ? 'bg-green/15 border-green text-green'
                    : 'bg-bg border-line/10 text-muted'
                }`}
              >
                <span>{c.icon}</span>
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Data</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full rounded-xl bg-bg border border-line/10 px-3 py-2.5 text-sm outline-none focus:border-green"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Pagamento</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-xl bg-bg border border-line/10 px-3 py-2.5 text-sm outline-none focus:border-green"
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">Observação (opcional)</label>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full rounded-xl bg-bg border border-line/10 px-4 py-2.5 text-sm outline-none focus:border-green"
          />
        </div>

        <button
          onClick={handleSave}
          className="w-full rounded-xl bg-green py-3.5 font-semibold text-bg active:scale-[0.98] transition-transform"
        >
          Salvar
        </button>
      </div>
    </Modal>
  )
}
