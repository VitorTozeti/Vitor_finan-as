import { useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import { Card, Badge, Modal, EmptyState, pushToast, ConfirmDialog } from '../components/Primitives'
import { StatTile } from '../components/ChartKit'
import { useStore } from '../store/useStore'
import { formatCurrency, parseAmountInput } from '../utils/finance'
import {
  summarizeBenefits,
  monthlyValue,
  cashbackTotal,
  computeAchievements,
  computeConqueredSavings
} from '../utils/benefits'
import { getMultipleQuotes } from '../services/marketApi'
import { BenefitType, BenefitFrequency, CashbackUnit } from '../types'
import { Plus, Sparkles, Wallet, Trash2 } from 'lucide-react'

const BENEFIT_TYPES: { value: BenefitType; label: string; emoji: string }[] = [
  { value: 'VA', label: 'Vale-alimentação', emoji: '🍽️' },
  { value: 'VR', label: 'Vale-refeição', emoji: '🍱' },
  { value: 'Transporte', label: 'Transporte', emoji: '🚌' },
  { value: 'Saúde', label: 'Saúde', emoji: '💊' },
  { value: 'PLR', label: 'PLR / Bônus', emoji: '💰' },
  { value: 'Outro', label: 'Outro', emoji: '🎁' }
]

const typeMeta = (t: BenefitType) => BENEFIT_TYPES.find(b => b.value === t) ?? BENEFIT_TYPES[5]

type Tab = 'empresa' | 'cashback' | 'conquistas'

export default function Benefits() {
  const {
    state,
    addBenefit,
    deleteBenefit,
    addCashbackProgram,
    deleteCashbackProgram,
    addCashbackEntry,
    markAchievementsUnlocked
  } = useStore()

  const [tab, setTab] = useState<Tab>('empresa')
  const [portfolioValue, setPortfolioValue] = useState(0)

  // Fetch live quotes to value the portfolio for the "conquered savings" panel.
  useEffect(() => {
    if (state.portfolio.length === 0) return
    getMultipleQuotes(state.portfolio.map(p => p.ticker)).then(results => {
      const map = new Map(results.map(r => [r.ticker, r.price]))
      const value = state.portfolio.reduce((acc, p) => acc + p.quantity * (map.get(p.ticker) ?? p.avgPrice), 0)
      setPortfolioValue(value)
    })
  }, [state.portfolio])

  const summary = useMemo(() => summarizeBenefits(state.benefits), [state.benefits])
  const achievements = useMemo(() => computeAchievements(state), [state])
  const conquered = useMemo(() => computeConqueredSavings(state, portfolioValue), [state, portfolioValue])
  const unlockedIds = useMemo(() => new Set(state.unlockedAchievements.map(a => a.id)), [state.unlockedAchievements])

  // Persist any newly-unlocked achievement and celebrate the first time.
  useEffect(() => {
    const fresh = achievements.filter(a => a.unlocked && !unlockedIds.has(a.id))
    if (fresh.length > 0) {
      markAchievementsUnlocked(fresh.map(a => a.id))
      pushToast(`Conquista desbloqueada: ${fresh[0].emoji} ${fresh[0].title}`)
    }
  }, [achievements, unlockedIds, markAchievementsUnlocked])

  const unlockedCount = achievements.filter(a => a.unlocked).length

  return (
    <div className="pb-28">
      <Header title="Benefícios 🎁" subtitle="O que você recebe, acumula e conquista" />
      <div className="px-5 space-y-4">
        {/* Conquered savings hero */}
        <Card variant="accent" className="relative overflow-hidden">
          <div className="flex items-center gap-1.5 text-accent text-xs font-semibold mb-1">
            <Sparkles size={14} /> Você já conquistou
          </div>
          <p className="font-display text-[2.3rem] leading-none font-bold">{formatCurrency(conquered.totalSaved)}</p>
          <p className="text-xs text-muted mt-2">
            Somando o que você guardou em metas e o lucro dos seus investimentos.
          </p>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <StatTile label="Em metas" value={formatCurrency(conquered.goalsProgress)} tone="green" />
            <StatTile label="Lucro investido" value={formatCurrency(conquered.portfolioProfit)} tone="green" />
            <StatTile label="Benefícios/ano" value={formatCurrency(conquered.benefitsPerYear)} tone="accent" />
          </div>
        </Card>

        {/* Tabs */}
        <div className="inline-flex w-full rounded-xl bg-bg border border-white/10 p-0.5 gap-0.5">
          {(
            [
              { value: 'empresa', label: 'Da empresa' },
              { value: 'cashback', label: 'Cashback' },
              { value: 'conquistas', label: `Conquistas ${unlockedCount}/${achievements.length}` }
            ] as { value: Tab; label: string }[]
          ).map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex-1 px-2 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                tab === t.value ? 'bg-green text-bg shadow-glow' : 'text-muted hover:text-txt'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'empresa' && <CompanyBenefits summary={summary} onAdd={addBenefit} onDelete={deleteBenefit} />}
        {tab === 'cashback' && (
          <CashbackSection
            onAddProgram={addCashbackProgram}
            onDeleteProgram={deleteCashbackProgram}
            onAddEntry={addCashbackEntry}
          />
        )}
        {tab === 'conquistas' && (
          <div className="grid grid-cols-2 gap-3 stagger">
            {achievements.map(a => (
              <Badge
                key={a.id}
                emoji={a.emoji}
                title={a.title}
                description={a.description}
                unlocked={a.unlocked}
                progress={a.progress}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CompanyBenefits({
  summary,
  onAdd,
  onDelete
}: {
  summary: ReturnType<typeof summarizeBenefits>
  onAdd: ReturnType<typeof useStore>['addBenefit']
  onDelete: (id: string) => void
}) {
  const { state } = useStore()
  const [open, setOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<BenefitType>('VA')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<BenefitFrequency>('mensal')
  const [balance, setBalance] = useState('')

  function handleAdd() {
    const value = parseAmountInput(amount)
    if (!name.trim() || isNaN(value)) {
      pushToast('Preencha nome e valor', 'error')
      return
    }
    const bal = parseAmountInput(balance)
    onAdd({
      name: name.trim(),
      type,
      amount: value,
      frequency,
      currentBalance: isNaN(bal) ? undefined : bal
    })
    pushToast('Benefício adicionado')
    setName('')
    setAmount('')
    setBalance('')
    setOpen(false)
  }

  return (
    <>
      <Card className="!p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">Você recebe por mês</p>
          <p className="font-display text-xl font-bold text-green">{formatCurrency(summary.monthlyTotal)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Saldo nos cartões</p>
          <p className="font-display text-xl font-bold">{formatCurrency(summary.reloadableBalance)}</p>
        </div>
      </Card>

      {state.benefits.length === 0 ? (
        <EmptyState
          title="Nenhum benefício cadastrado"
          description="Adicione vale-alimentação, transporte, plano de saúde e outros benefícios que você recebe."
          actionLabel="Adicionar benefício"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="space-y-2 stagger">
          {state.benefits.map(b => {
            const meta = typeMeta(b.type)
            return (
              <Card key={b.id} className="!p-4 flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-accent/10 flex items-center justify-center text-2xl">
                  {meta.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{b.name}</p>
                  <p className="text-xs text-muted">
                    {formatCurrency(monthlyValue(b))}/mês · {b.frequency}
                    {b.currentBalance != null ? ` · saldo ${formatCurrency(b.currentBalance)}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setPendingDelete(b.id)}
                  className="text-muted hover:text-danger p-1"
                  aria-label="Remover"
                >
                  <Trash2 size={16} />
                </button>
              </Card>
            )
          })}
        </div>
      )}

      <button
        onClick={() => setOpen(true)}
        aria-label="Adicionar benefício"
        className="fixed bottom-24 right-5 md:bottom-8 h-14 w-14 rounded-full bg-green text-bg flex items-center justify-center shadow-glow active:scale-95 transition-transform z-30"
      >
        <Plus size={26} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Adicionar benefício">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Nome</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Vale-alimentação"
              className="w-full rounded-xl bg-bg border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-green"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {BENEFIT_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`rounded-xl border px-2 py-2 text-xs font-medium transition-all active:scale-95 ${
                    type === t.value ? 'border-green bg-green/10 text-green' : 'border-white/10 text-muted'
                  }`}
                >
                  <span className="block text-base mb-0.5">{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Valor (R$)</label>
              <input
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="600"
                className="w-full rounded-xl bg-bg border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-green"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Saldo atual (opcional)</label>
              <input
                inputMode="decimal"
                value={balance}
                onChange={e => setBalance(e.target.value)}
                placeholder="420"
                className="w-full rounded-xl bg-bg border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-green"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Frequência</label>
            <div className="inline-flex w-full rounded-xl bg-bg border border-white/10 p-0.5 gap-0.5">
              {(['mensal', 'anual', 'único'] as BenefitFrequency[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all active:scale-95 ${
                    frequency === f ? 'bg-green text-bg' : 'text-muted'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleAdd} className="w-full rounded-xl bg-green py-3.5 font-semibold text-bg active:scale-95 transition-transform">
            Adicionar
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Remover benefício?"
        description="Isso apaga apenas o registro aqui."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            onDelete(pendingDelete)
            pushToast('Benefício removido')
          }
          setPendingDelete(null)
        }}
      />
    </>
  )
}

function CashbackSection({
  onAddProgram,
  onDeleteProgram,
  onAddEntry
}: {
  onAddProgram: ReturnType<typeof useStore>['addCashbackProgram']
  onDeleteProgram: (id: string) => void
  onAddEntry: ReturnType<typeof useStore>['addCashbackEntry']
}) {
  const { state } = useStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<CashbackUnit>('R$')
  const [entryFor, setEntryFor] = useState<string | null>(null)
  const [entryAmount, setEntryAmount] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  function handleAddProgram() {
    if (!name.trim()) {
      pushToast('Informe o nome do programa', 'error')
      return
    }
    onAddProgram({ name: name.trim(), unit })
    pushToast('Programa adicionado')
    setName('')
    setOpen(false)
  }

  function handleAddEntry() {
    const value = parseAmountInput(entryAmount)
    if (!entryFor || isNaN(value)) {
      pushToast('Informe um valor', 'error')
      return
    }
    onAddEntry(entryFor, { amount: value, date: new Date().toISOString().slice(0, 10) })
    pushToast('Crédito registrado')
    setEntryAmount('')
    setEntryFor(null)
  }

  return (
    <>
      {state.cashbackPrograms.length === 0 ? (
        <EmptyState
          title="Nenhum programa de cashback"
          description="Acompanhe cashback, pontos e milhas que seus cartões acumulam."
          actionLabel="Adicionar programa"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="space-y-2 stagger">
          {state.cashbackPrograms.map(p => (
            <Card key={p.id} className="!p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-green/10 flex items-center justify-center text-green">
                  <Wallet size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-xs text-muted">
                    Acumulado:{' '}
                    <span className="text-txt font-medium">
                      {p.unit === 'R$' ? formatCurrency(cashbackTotal(p)) : `${cashbackTotal(p).toLocaleString('pt-BR')} ${p.unit}`}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => setEntryFor(p.id)}
                  className="rounded-lg bg-green/10 text-green px-2.5 py-1.5 text-xs font-semibold active:scale-95"
                >
                  + Crédito
                </button>
                <button
                  onClick={() => setPendingDelete(p.id)}
                  className="text-muted hover:text-danger p-1"
                  aria-label="Remover"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <button
        onClick={() => setOpen(true)}
        aria-label="Adicionar programa"
        className="fixed bottom-24 right-5 md:bottom-8 h-14 w-14 rounded-full bg-green text-bg flex items-center justify-center shadow-glow active:scale-95 transition-transform z-30"
      >
        <Plus size={26} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Adicionar programa">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Nome</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Nubank Rewards"
              className="w-full rounded-xl bg-bg border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-green"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Unidade</label>
            <div className="inline-flex w-full rounded-xl bg-bg border border-white/10 p-0.5 gap-0.5">
              {(['R$', 'pontos', 'milhas'] as CashbackUnit[]).map(u => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                    unit === u ? 'bg-green text-bg' : 'text-muted'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleAddProgram} className="w-full rounded-xl bg-green py-3.5 font-semibold text-bg active:scale-95 transition-transform">
            Adicionar
          </button>
        </div>
      </Modal>

      <Modal open={!!entryFor} onClose={() => setEntryFor(null)} title="Registrar crédito">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Valor</label>
            <input
              inputMode="decimal"
              value={entryAmount}
              onChange={e => setEntryAmount(e.target.value)}
              placeholder="0"
              autoFocus
              className="w-full rounded-xl bg-bg border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-green"
            />
          </div>
          <button onClick={handleAddEntry} className="w-full rounded-xl bg-green py-3.5 font-semibold text-bg active:scale-95 transition-transform">
            Registrar
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Remover programa?"
        description="Todo o histórico de créditos será apagado."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            onDeleteProgram(pendingDelete)
            pushToast('Programa removido')
          }
          setPendingDelete(null)
        }}
      />
    </>
  )
}
