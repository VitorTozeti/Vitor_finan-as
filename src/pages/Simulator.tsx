import { useMemo, useState } from 'react'
import Header from '../components/Header'
import { Card } from '../components/Primitives'
import { formatCurrency } from '../utils/finance'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

export default function Simulator() {
  const [initial, setInitial] = useState('500')
  const [monthly, setMonthly] = useState('200')
  const [months, setMonths] = useState('24')
  const [rateYear, setRateYear] = useState('10')

  const data = useMemo(() => {
    const initialNum = parseFloat(initial.replace(',', '.')) || 0
    const monthlyNum = parseFloat(monthly.replace(',', '.')) || 0
    const monthsNum = Math.max(1, Math.round(parseFloat(months) || 0))
    const rateYearNum = parseFloat(rateYear.replace(',', '.')) || 0
    const monthlyRate = Math.pow(1 + rateYearNum / 100, 1 / 12) - 1

    let balance = initialNum
    let invested = initialNum
    const points = [{ month: 0, patrimonio: balance, investido: invested }]
    for (let m = 1; m <= monthsNum; m++) {
      balance = balance * (1 + monthlyRate) + monthlyNum
      invested += monthlyNum
      points.push({ month: m, patrimonio: Math.round(balance * 100) / 100, investido: invested })
    }
    return { points, finalBalance: balance, invested, rendimento: balance - invested }
  }, [initial, monthly, months, rateYear])

  return (
    <div className="pb-28">
      <Header title="Simulador" subtitle="Projete seu patrimônio ao longo do tempo" />
      <div className="px-5 space-y-4">
        <Card>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Investimento inicial</label>
              <input
                inputMode="decimal"
                value={initial}
                onChange={e => setInitial(e.target.value)}
                className="w-full rounded-xl bg-bg border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-green"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Aporte mensal</label>
                <input
                  inputMode="decimal"
                  value={monthly}
                  onChange={e => setMonthly(e.target.value)}
                  className="w-full rounded-xl bg-bg border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-green"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Período (meses)</label>
                <input
                  inputMode="numeric"
                  value={months}
                  onChange={e => setMonths(e.target.value)}
                  className="w-full rounded-xl bg-bg border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-green"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Taxa de retorno estimada (% ao ano)</label>
              <input
                inputMode="decimal"
                value={rateYear}
                onChange={e => setRateYear(e.target.value)}
                className="w-full rounded-xl bg-bg border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-green"
              />
            </div>
          </div>
        </Card>

        <Card>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted mb-1">Total investido</p>
              <p className="text-sm font-bold">{formatCurrency(data.invested)}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Rendimento</p>
              <p className="text-sm font-bold text-green">{formatCurrency(data.rendimento)}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Patrimônio final</p>
              <p className="text-sm font-bold">{formatCurrency(data.finalBalance)}</p>
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-sm font-medium mb-3">Evolução simulada</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8B9690' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8B9690' }} axisLine={false} tickLine={false} width={45} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ background: '#151A17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="patrimonio" stroke="#00D26A" strokeWidth={2.5} dot={false} name="Patrimônio" />
                <Line type="monotone" dataKey="investido" stroke="#8B9690" strokeWidth={1.5} dot={false} strokeDasharray="4 4" name="Investido" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <p className="text-[11px] text-muted text-center px-4">
          A taxa utilizada é uma hipótese de simulação, não uma promessa de retorno. Resultados reais podem variar.
        </p>
      </div>
    </div>
  )
}
