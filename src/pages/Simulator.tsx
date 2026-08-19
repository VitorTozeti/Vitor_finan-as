import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { Card } from '../components/Primitives'
import { formatCurrency, formatCurrencyShort } from '../utils/finance'
import { PROFILE_PRESETS, presetById, RiskProfile } from '../data/investing'
import { AXIS_TICK, GRID_STROKE, MoneyTooltip, AreaGradient, StatTile, useChartTheme } from '../components/ChartKit'
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts'

function num(v: string): number {
  return parseFloat(v.replace(',', '.')) || 0
}

export default function Simulator() {
  const navigate = useNavigate()
  const chart = useChartTheme()
  const [profile, setProfile] = useState<RiskProfile>('moderado')
  const [initial, setInitial] = useState('500')
  const [monthly, setMonthly] = useState('200')
  const [months, setMonths] = useState(24)
  const [rateYear, setRateYear] = useState('13')
  const [goal, setGoal] = useState('')
  const [realValue, setRealValue] = useState(false)
  const [inflation, setInflation] = useState('4.5')

  function applyProfile(id: RiskProfile) {
    setProfile(id)
    setRateYear(String(presetById(id).rateYear))
  }

  const sim = useMemo(() => {
    const initialNum = num(initial)
    const monthlyNum = num(monthly)
    const monthsNum = Math.max(1, Math.round(months))
    const monthlyRate = Math.pow(1 + num(rateYear) / 100, 1 / 12) - 1
    const monthlyInfl = realValue ? Math.pow(1 + num(inflation) / 100, 1 / 12) - 1 : 0
    const goalNum = num(goal)

    let balance = initialNum
    let invested = initialNum
    const points: { month: number; patrimonio: number; investido: number; rendimento: number }[] = []
    let goalMonth: number | null = null

    for (let m = 0; m <= monthsNum; m++) {
      if (m > 0) {
        balance = balance * (1 + monthlyRate) + monthlyNum
        invested += monthlyNum
      }
      const deflator = realValue ? Math.pow(1 + monthlyInfl, m) : 1
      const shownBalance = balance / deflator
      if (goalNum > 0 && goalMonth === null && shownBalance >= goalNum) goalMonth = m
      points.push({
        month: m,
        patrimonio: Math.round(shownBalance * 100) / 100,
        investido: Math.round(invested * 100) / 100,
        rendimento: Math.round((shownBalance - invested) * 100) / 100
      })
    }

    const last = points[points.length - 1]
    const monthlyIncomeEnd = balance * monthlyRate // rendimento mensal ao final (nominal)
    return {
      points,
      invested: last.investido,
      finalBalance: last.patrimonio,
      rendimento: last.patrimonio - last.investido,
      monthlyIncomeEnd: monthlyIncomeEnd / (realValue ? Math.pow(1 + monthlyInfl, monthsNum) : 1),
      goalMonth
    }
  }, [initial, monthly, months, rateYear, goal, realValue, inflation])

  const suggested = presetById(profile).suggested
  const years = Math.floor(months / 12)
  const remMonths = months % 12
  const periodLabel = years > 0 ? `${years}a${remMonths > 0 ? ` ${remMonths}m` : ''}` : `${months}m`

  return (
    <div className="pb-28">
      <Header title="Simulador" subtitle="Projete seu patrimônio ao longo do tempo" />
      <div className="px-5 space-y-4">
        <Card>
          <p className="text-sm font-medium mb-1">Perfil de investidor</p>
          <p className="text-xs text-muted mb-3">Escolha um ponto de partida. Você pode ajustar a taxa depois.</p>
          <div className="grid grid-cols-3 gap-2">
            {PROFILE_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => applyProfile(p.id)}
                className={`rounded-xl border p-3 text-center transition-colors ${
                  profile === p.id ? 'border-green bg-green/10' : 'border-line/10 hover:border-line/20'
                }`}
              >
                <div className="text-xl mb-1">{p.emoji}</div>
                <p className={`text-xs font-semibold ${profile === p.id ? 'text-green' : 'text-txt'}`}>{p.label}</p>
                <p className="text-[10px] text-muted mt-0.5">{p.rateYear}% a.a.</p>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-3 leading-relaxed">{presetById(profile).description}</p>
        </Card>

        <Card>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Investimento inicial</label>
                <input
                  inputMode="decimal"
                  value={initial}
                  onChange={e => setInitial(e.target.value)}
                  className="w-full rounded-xl bg-bg border border-line/10 px-4 py-2.5 text-sm outline-none focus:border-green"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Aporte mensal</label>
                <input
                  inputMode="decimal"
                  value={monthly}
                  onChange={e => setMonthly(e.target.value)}
                  className="w-full rounded-xl bg-bg border border-line/10 px-4 py-2.5 text-sm outline-none focus:border-green"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted">Período</label>
                <span className="text-xs font-semibold text-green">{periodLabel} · {months} meses</span>
              </div>
              <input
                type="range"
                min={1}
                max={360}
                value={months}
                onChange={e => setMonths(Number(e.target.value))}
                className="w-full accent-green"
              />
              <div className="flex justify-between text-[10px] text-muted mt-1">
                <span>1m</span>
                <span>15a</span>
                <span>30a</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Retorno estimado (% a.a.)</label>
                <input
                  inputMode="decimal"
                  value={rateYear}
                  onChange={e => setRateYear(e.target.value)}
                  className="w-full rounded-xl bg-bg border border-line/10 px-4 py-2.5 text-sm outline-none focus:border-green"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Meta (opcional)</label>
                <input
                  inputMode="decimal"
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  placeholder="Ex: 50000"
                  className="w-full rounded-xl bg-bg border border-line/10 px-4 py-2.5 text-sm outline-none focus:border-green"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-bg border border-line/10 px-4 py-3">
              <div className="min-w-0 pr-3">
                <p className="text-xs font-medium">Mostrar em valor de hoje</p>
                <p className="text-[10px] text-muted">Desconta a inflação para ver o poder de compra real.</p>
              </div>
              <button
                onClick={() => setRealValue(v => !v)}
                aria-pressed={realValue}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${realValue ? 'bg-green' : 'bg-line/15'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${realValue ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
            {realValue && (
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Inflação estimada (% a.a.)</label>
                <input
                  inputMode="decimal"
                  value={inflation}
                  onChange={e => setInflation(e.target.value)}
                  className="w-full rounded-xl bg-bg border border-line/10 px-4 py-2.5 text-sm outline-none focus:border-green"
                />
              </div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Total investido" value={formatCurrency(sim.invested)} />
          <StatTile label="Rendimento" value={formatCurrency(sim.rendimento)} tone="green" />
          <StatTile label="Patrimônio final" value={formatCurrency(sim.finalBalance)} tone="green" />
          <StatTile
            label="Renda mensal ao final"
            value={formatCurrency(sim.monthlyIncomeEnd)}
            hint="se só viver dos rendimentos"
          />
        </div>

        {sim.goalMonth !== null && (
          <Card className="!p-4 flex items-center gap-3 border-green/30">
            <div className="text-2xl">🎯</div>
            <p className="text-xs text-muted">
              Você atinge <span className="text-green font-semibold">{formatCurrency(num(goal))}</span> em{' '}
              <span className="text-txt font-semibold">{sim.goalMonth} meses</span>
              {sim.goalMonth >= 12 ? ` (~${Math.floor(sim.goalMonth / 12)}a ${sim.goalMonth % 12}m)` : ''}.
            </p>
          </Card>
        )}

        <Card>
          <p className="text-sm font-medium mb-3">Evolução simulada</p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sim.points}>
                <defs>
                  <AreaGradient id="grad-patr" color={chart.green} />
                  <AreaGradient id="grad-inv" color="#889389" />
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis
                  dataKey="month"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(m: number) => (m % 12 === 0 ? `${m / 12}a` : '')}
                />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={52} tickFormatter={formatCurrencyShort} />
                <Tooltip content={<MoneyTooltip />} />
                <Area type="monotone" dataKey="investido" name="Investido" stroke="#889389" strokeWidth={1.5} fill="url(#grad-inv)" strokeDasharray="4 4" dot={false} />
                <Area type="monotone" dataKey="patrimonio" name="Patrimônio" stroke={chart.green} strokeWidth={2.5} fill="url(#grad-patr)" dot={false} />
                {num(goal) > 0 && (
                  <ReferenceLine y={num(goal)} stroke="#FFC857" strokeDasharray="5 4" label={{ value: 'Meta', fill: '#FFC857', fontSize: 10, position: 'insideTopRight' }} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <p className="text-sm font-medium mb-1">Ativos que combinam com o perfil {presetById(profile).label}</p>
          <p className="text-xs text-muted mb-3">Toque para ver preço, histórico e indicadores. Conteúdo educacional.</p>
          <div className="flex flex-wrap gap-2">
            {suggested.map(t => (
              <button
                key={t}
                onClick={() => navigate(`/investimentos/${t}`)}
                className="rounded-full border border-line/10 px-3 py-1.5 text-xs font-medium text-muted hover:text-green hover:border-green"
              >
                {t}
              </button>
            ))}
          </div>
        </Card>

        <p className="text-[11px] text-muted text-center px-4">
          A taxa utilizada é uma hipótese de simulação, não uma promessa de retorno. Resultados reais podem variar e
          desempenho passado não garante resultados futuros. Este conteúdo é educacional e não é recomendação de investimento.
        </p>
      </div>
    </div>
  )
}
