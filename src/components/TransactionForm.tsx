import { useEffect, useMemo, useState } from 'react'
import { Modal, pushToast } from './Primitives'
import AmountInput from './AmountInput'
import { useStore } from '../store/useStore'
import { Transaction, PaymentMethod } from '../types'
import { ChevronDown } from 'lucide-react'

const PAYMENT_METHODS: PaymentMethod[] = ['Pix', 'Débito', 'Crédito', 'Dinheiro', 'Outro']
const FALLBACK_CATEGORY_ID = 'outros'
const QUICK_ADD = [10, 20, 50, 100]

/** Builds a local 'YYYY-MM-DD' string for `base` shifted by `monthDelta`
 * months, clamping the day to the target month's length. Avoids the timezone
 * drift of `new Date('YYYY-MM-DD')`. */
function shiftMonth(baseIso: string, monthDelta: number): string {
  const [y, m, d] = baseIso.split('-').map(Number)
  const target = new Date(y, m - 1 + monthDelta, 1)
  const daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  const day = Math.min(d, daysInMonth)
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function TransactionForm({
  open,
  onClose,
  editing
}: {
  open: boolean
  onClose: () => void
  editing?: Transaction | null
}) {
  const { state, addTransaction, updateTransaction, addCategory, addRecurringRule } = useStore()
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState(0)
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Pix')
  const [note, setNote] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [repeatMonthly, setRepeatMonthly] = useState(false)
  const [installments, setInstallments] = useState(1)

  useEffect(() => {
    if (editing) {
      setType(editing.type)
      setAmount(editing.amount)
      setDescription(editing.description)
      setCategoryId(editing.categoryId)
      setDate(editing.date)
      setPaymentMethod(editing.paymentMethod ?? 'Pix')
      setNote(editing.note ?? '')
    } else if (open) {
      setType('expense')
      setAmount(0)
      setDescription('')
      setCategoryId('')
      setDate(new Date().toISOString().slice(0, 10))
      setPaymentMethod('Pix')
      setNote('')
    }
    // Reset the "more options" section every time the modal opens.
    if (open) {
      setShowMore(false)
      setRepeatMonthly(false)
      setInstallments(1)
      setShowNewCategory(false)
    }
  }, [editing, open])

  // Most-recently-used categories first, so the common case is a single tap.
  const orderedCategories = useMemo(() => {
    const lastUsed = new Map<string, string>()
    for (const t of state.transactions) {
      const prev = lastUsed.get(t.categoryId)
      if (!prev || t.date > prev) lastUsed.set(t.categoryId, t.date)
    }
    return [...state.categories].sort((a, b) => (lastUsed.get(b.id) ?? '').localeCompare(lastUsed.get(a.id) ?? ''))
  }, [state.categories, state.transactions])

  function handleSave() {
    if (!amount || amount <= 0) {
      pushToast('Informe um valor válido', 'error')
      return
    }
    // Only the value is required — an unpicked category falls back to "Outros".
    const finalCategoryId = categoryId || FALLBACK_CATEGORY_ID
    const trimmedDescription = description.trim()

    if (editing) {
      updateTransaction(editing.id, {
        type,
        amount,
        description: trimmedDescription,
        categoryId: finalCategoryId,
        date,
        paymentMethod,
        note: note.trim() || undefined
      })
      pushToast('Alterações salvas')
      onClose()
      return
    }

    const count = Math.max(1, Math.min(48, Math.round(installments)))
    if (count > 1) {
      // Split across `count` monthly transactions; last parcel absorbs any
      // rounding remainder so the parts sum exactly to the total.
      const perCents = Math.floor((amount * 100) / count)
      for (let i = 0; i < count; i++) {
        const cents = i === count - 1 ? Math.round(amount * 100) - perCents * (count - 1) : perCents
        addTransaction({
          type,
          amount: cents / 100,
          description: `${trimmedDescription || 'Compra parcelada'} (${i + 1}/${count})`,
          categoryId: finalCategoryId,
          date: shiftMonth(date, i),
          paymentMethod,
          note: note.trim() || undefined
        })
      }
      pushToast(`Parcelamento lançado em ${count}x`)
      onClose()
      return
    }

    addTransaction({
      type,
      amount,
      description: trimmedDescription,
      categoryId: finalCategoryId,
      date,
      paymentMethod,
      note: note.trim() || undefined
    })

    if (repeatMonthly) {
      // Register the recurring rule and mark this month as already generated so
      // the store doesn't create a duplicate for the transaction we just added.
      const [y, m, d] = date.split('-').map(Number)
      addRecurringRule({
        description: trimmedDescription || 'Recorrência',
        amount,
        type,
        categoryId: finalCategoryId,
        paymentMethod,
        dayOfMonth: d,
        active: true,
        lastGeneratedMonth: `${y}-${String(m).padStart(2, '0')}`
      })
      pushToast('Gasto adicionado e recorrência criada')
    } else {
      pushToast(type === 'expense' ? 'Gasto adicionado com sucesso' : 'Entrada adicionada com sucesso')
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
          <AmountInput value={amount} onChange={setAmount} quickAdd={QUICK_ADD} autoFocus />
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
            <label className="block text-xs font-medium text-muted">Categoria (opcional)</label>
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
            {orderedCategories.map(c => (
              <button
                key={c.id}
                onClick={() => setCategoryId(id => (id === c.id ? '' : c.id))}
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

        {editing && (
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Observação (opcional)</label>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full rounded-xl bg-bg border border-line/10 px-4 py-2.5 text-sm outline-none focus:border-green"
            />
          </div>
        )}

        {!editing && (
          <div className="rounded-xl border border-line/10">
            <button
              type="button"
              onClick={() => setShowMore(v => !v)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-muted"
            >
              Mais opções
              <ChevronDown size={15} className={`transition-transform ${showMore ? 'rotate-180' : ''}`} />
            </button>
            {showMore && (
              <div className="space-y-3 px-4 pb-4">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-sm">Repete todo mês</span>
                  <input
                    type="checkbox"
                    checked={repeatMonthly}
                    disabled={installments > 1}
                    onChange={e => setRepeatMonthly(e.target.checked)}
                    className="h-4 w-4 accent-green"
                  />
                </label>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">Parcelar em</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={48}
                      value={installments}
                      onChange={e => {
                        const n = Math.max(1, Math.min(48, parseInt(e.target.value, 10) || 1))
                        setInstallments(n)
                        if (n > 1) setRepeatMonthly(false)
                      }}
                      className="w-16 rounded-lg bg-bg border border-line/10 px-2 py-1.5 text-sm text-center outline-none focus:border-green"
                    />
                    <span className="text-sm text-muted">x</span>
                  </div>
                </div>
                {installments > 1 && amount > 0 && (
                  <p className="text-[11px] text-muted">
                    {installments} parcelas mensais a partir da data escolhida.
                  </p>
                )}
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Observação (opcional)</label>
                  <input
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="w-full rounded-xl bg-bg border border-line/10 px-4 py-2.5 text-sm outline-none focus:border-green"
                  />
                </div>
              </div>
            )}
          </div>
        )}

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
