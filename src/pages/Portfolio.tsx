import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { Card, EmptyState, Modal, pushToast, ConfirmDialog } from '../components/Primitives'
import { useStore } from '../store/useStore'
import { formatCurrency } from '../utils/finance'
import { getMultipleQuotes, QuoteResult } from '../services/marketApi'
import { Plus } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

const COLORS = ['#00D26A', '#00A854', '#4E9AF1', '#FFC857', '#B98CE0', '#5CD0B3', '#E37EC1']

export default function Portfolio() {
  const { state, addPortfolioAsset, deletePortfolioAsset } = useStore()
  const [quotes, setQuotes] = useState<Record<string, QuoteResult>>({})
  const [formOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [ticker, setTicker] = useState('')
  const [quantity, setQuantity] = useState('')
  const [avgPrice, setAvgPrice] = useState('')

  useEffect(() => {
    if (state.portfolio.length === 0) return
    getMultipleQuotes(state.portfolio.map(p => p.ticker)).then(results => {
      const map: Record<string, QuoteResult> = {}
      for (const r of results) map[r.ticker] = r
      setQuotes(map)
    })
  }, [state.portfolio])

  function handleAdd() {
    const qty = parseFloat(quantity.replace(',', '.'))
    const price = parseFloat(avgPrice.replace(',', '.'))
    if (!ticker.trim() || !qty || !price) {
      pushToast('Preencha todos os campos', 'error')
      return
    }
    addPortfolioAsset({ ticker: ticker.trim().toUpperCase(), quantity: qty, avgPrice: price })
    pushToast('Ativo adicionado à carteira')
    setTicker('')
    setQuantity('')
    setAvgPrice('')
    setFormOpen(false)
  }

  const invested = state.portfolio.reduce((acc, p) => acc + p.quantity * p.avgPrice, 0)
  const current = state.portfolio.reduce((acc, p) => {
    const q = quotes[p.ticker]
    return acc + p.quantity * (q?.price ?? p.avgPrice)
  }, 0)
  const profit = current - invested
  const profitPct = invested > 0 ? (profit / invested) * 100 : 0

  const distribution = state.portfolio.map(p => {
    const q = quotes[p.ticker]
    return { name: p.ticker, value: p.quantity * (q?.price ?? p.avgPrice) }
  })

  return (
    <div className="pb-28">
      <Header title="Carteira" subtitle="Seus ativos e rentabilidade" />
      <div className="px-5 space-y-4">
        {state.portfolio.length === 0 ? (
          <EmptyState
            title="Nenhum ativo cadastrado"
            description="Adicione seus investimentos para acompanhar rentabilidade e distribuição."
            actionLabel="Adicionar ativo"
            onAction={() => setFormOpen(true)}
          />
        ) : (
          <>
            <Card>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted mb-1">Valor investido</p>
                  <p className="text-lg font-bold">{formatCurrency(invested)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">Valor atual</p>
                  <p className="text-lg font-bold">{formatCurrency(current)}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-xs text-muted mb-1">Lucro / prejuízo</p>
                <p className={`text-lg font-bold ${profit >= 0 ? 'text-green' : 'text-danger'}`}>
                  {profit >= 0 ? '+' : ''}
                  {formatCurrency(profit)} ({profitPct.toFixed(1)}%)
                </p>
              </div>
            </Card>

            {distribution.length > 0 && (
              <Card>
                <p className="text-sm font-medium mb-3">Distribuição da carteira</p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                        {distribution.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number) => formatCurrency(v)}
                        contentStyle={{ background: '#151A17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            <div className="space-y-2">
              {state.portfolio.map(p => {
                const q = quotes[p.ticker]
                const value = p.quantity * (q?.price ?? p.avgPrice)
                const cost = p.quantity * p.avgPrice
                const pProfit = value - cost
                return (
                  <Card key={p.id} className="!p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{p.ticker}</p>
                      <p className="text-xs text-muted">
                        {p.quantity} un · preço médio {formatCurrency(p.avgPrice)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(value)}</p>
                      <p className={`text-xs ${pProfit >= 0 ? 'text-green' : 'text-danger'}`}>
                        {pProfit >= 0 ? '+' : ''}
                        {formatCurrency(pProfit)}
                      </p>
                    </div>
                    <button onClick={() => setPendingDelete(p.id)} className="ml-3 text-muted text-xs" aria-label="Remover">
                      ✕
                    </button>
                  </Card>
                )
              })}
            </div>
          </>
        )}
      </div>

      <button
        onClick={() => setFormOpen(true)}
        aria-label="Adicionar ativo"
        className="fixed bottom-24 right-5 md:bottom-8 h-14 w-14 rounded-full bg-green text-bg flex items-center justify-center shadow-soft active:scale-95 transition-transform z-30"
      >
        <Plus size={26} />
      </button>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Adicionar ativo">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Ticker</label>
            <input
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              placeholder="Ex: PETR4"
              className="w-full rounded-xl bg-bg border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-green"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Quantidade</label>
              <input
                inputMode="decimal"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="w-full rounded-xl bg-bg border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-green"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Preço médio</label>
              <input
                inputMode="decimal"
                value={avgPrice}
                onChange={e => setAvgPrice(e.target.value)}
                className="w-full rounded-xl bg-bg border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-green"
              />
            </div>
          </div>
          <button onClick={handleAdd} className="w-full rounded-xl bg-green py-3.5 font-semibold text-bg">
            Adicionar
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Remover ativo?"
        description="Isso não afeta seus investimentos reais, apenas o registro aqui."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deletePortfolioAsset(pendingDelete)
            pushToast('Ativo removido')
          }
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
