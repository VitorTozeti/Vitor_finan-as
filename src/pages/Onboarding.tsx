import { useState } from 'react'
import { useStore } from '../store/useStore'
import { pushToast } from '../components/Primitives'

export default function Onboarding() {
  const { updateSettings } = useStore()
  const [step, setStep] = useState(0)
  const [income, setIncome] = useState('1290')
  const [payDay, setPayDay] = useState('5')
  const [goal, setGoal] = useState('')

  function finish() {
    const numericIncome = parseFloat(income.replace(',', '.')) || 1290
    const numericPayDay = parseInt(payDay, 10) || 5
    updateSettings({
      mainIncome: numericIncome,
      payDay: numericPayDay,
      mainGoalDescription: goal.trim() || undefined,
      onboarded: true
    })
    pushToast('Tudo pronto! Bem-vindo ao GreenFinance')
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-green mx-auto flex items-center justify-center text-bg font-bold text-2xl mb-4">
            G
          </div>
          <h1 className="text-2xl font-bold">Bem-vindo ao GreenFinance</h1>
          <p className="text-sm text-muted mt-1.5">Vamos configurar seu controle financeiro.</p>
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Qual sua renda mensal?</label>
              <input
                inputMode="decimal"
                value={income}
                onChange={e => setIncome(e.target.value)}
                className="w-full rounded-xl bg-card border border-line/10 px-4 py-3 text-lg font-semibold outline-none focus:border-green"
              />
            </div>
            <button
              onClick={() => setStep(1)}
              className="w-full rounded-xl bg-green py-3.5 font-semibold text-bg"
            >
              Continuar
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Qual dia você recebe?</label>
              <input
                inputMode="numeric"
                value={payDay}
                onChange={e => setPayDay(e.target.value)}
                className="w-full rounded-xl bg-card border border-line/10 px-4 py-3 text-lg font-semibold outline-none focus:border-green"
              />
              <p className="text-[11px] text-muted mt-1.5">
                Se cair em fim de semana ou feriado, ajustamos para o dia útil anterior.
              </p>
            </div>
            <button onClick={() => setStep(2)} className="w-full rounded-xl bg-green py-3.5 font-semibold text-bg">
              Continuar
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">
                Qual seu objetivo principal? (opcional)
              </label>
              <input
                value={goal}
                onChange={e => setGoal(e.target.value)}
                placeholder="Ex: Guardar dinheiro, controlar gastos..."
                className="w-full rounded-xl bg-card border border-line/10 px-4 py-3 text-sm outline-none focus:border-green"
              />
            </div>
            <button onClick={finish} className="w-full rounded-xl bg-green py-3.5 font-semibold text-bg">
              Começar a usar
            </button>
          </div>
        )}

        <div className="flex justify-center gap-1.5 mt-6">
          {[0, 1, 2].map(i => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-green' : 'w-1.5 bg-line/10'}`} />
          ))}
        </div>
      </div>
    </div>
  )
}
