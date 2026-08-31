import { useEffect, useRef, useState } from 'react'
import { formatCurrency } from '../utils/finance'

/** Reusable BRL amount field used everywhere a value is entered (expense,
 * income, goal target, goal contribution). Formats live as "R$ 1.234,56"
 * while the user types — under the hood it tracks the amount in cents, so a
 * plain numeric keypad is all that's needed (no need to know the pt-BR format).
 * Optional `quickAdd` renders one-tap chips that add to the current value. */
export default function AmountInput({
  value,
  onChange,
  quickAdd,
  allowNegative = false,
  autoFocus = false,
  placeholder = 'R$ 0,00'
}: {
  value: number
  onChange: (n: number) => void
  quickAdd?: number[]
  allowNegative?: boolean
  autoFocus?: boolean
  placeholder?: string
}) {
  // Internal digit string ("12345" -> R$ 123,45). Kept in sync with the
  // numeric value coming from the parent (e.g. when editing or after a reset).
  const [digits, setDigits] = useState('')
  const [negative, setNegative] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const cents = Math.round(Math.abs(value) * 100)
    const current = parseInt(digits || '0', 10)
    if (cents !== current) setDigits(cents === 0 ? '' : String(cents))
    setNegative(allowNegative && value < 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function emit(nextDigits: string, neg: boolean) {
    const cents = parseInt(nextDigits || '0', 10)
    const reais = cents / 100
    onChange(neg ? -reais : reais)
  }

  function handleChange(raw: string) {
    // Keep only digits; a leading '-' toggles sign when negatives are allowed.
    const neg = allowNegative ? raw.trim().startsWith('-') : false
    const onlyDigits = raw.replace(/\D/g, '').replace(/^0+/, '')
    setDigits(onlyDigits)
    setNegative(neg)
    emit(onlyDigits, neg)
  }

  function addQuick(amount: number) {
    const cents = parseInt(digits || '0', 10) + Math.round(amount * 100)
    const clamped = Math.max(0, cents)
    setDigits(clamped === 0 ? '' : String(clamped))
    setNegative(false)
    emit(String(clamped), false)
    inputRef.current?.focus()
  }

  const display = digits ? `${negative ? '-' : ''}${formatCurrency(parseInt(digits, 10) / 100)}` : ''

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        inputMode="decimal"
        value={display}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl bg-bg border border-line/10 px-4 py-3 text-xl font-semibold outline-none focus:border-green"
      />
      {quickAdd && quickAdd.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickAdd.map(v => (
            <button
              key={v}
              type="button"
              onClick={() => addQuick(v)}
              className="rounded-full bg-line/5 border border-line/10 px-3 py-1.5 text-xs font-medium text-muted hover:text-txt hover:border-green/40 transition-colors"
            >
              +{v}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
