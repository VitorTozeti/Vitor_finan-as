import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { Card, Skeleton } from '../components/Primitives'
import { getQuote, QuoteResult, computePeriodPerformance, computeVolatility } from '../services/marketApi'
import { formatCurrency } from '../utils/finance'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { ChevronLeft, TrendingUp, TrendingDown } from 'lucide-react'

export default function AssetAnalysis() {
  const { ticker } = useParams()
  const navigate = useNavigate()
  const [quote, setQuote] = useState<QuoteResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    getQuote(ticker ?? '').then(result => {
      if (!active) return
      setLoading(false)
      if (!result) setError(true)
      else setQuote(result)
    })
    return () => {
      active = false
    }
  }, [ticker])

  const perf1w = computePeriodPerformance(quote?.history, 7)
  const perf1m = computePeriodPerformance(quote?.history, 30)
  const perf3m = computePeriodPerformance(quote?.history, 90)
  const perf6m = computePeriodPerformance(quote?.history, 180)
  const volatility = computeVolatility(quote?.history)

  return (
    <div className="pb-28">
      <div className="px-5 pt-6 pb-2 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted" aria-label="Voltar">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-bold">{ticker}</h1>
      </div>

      <div className="px-5 space-y-4 mt-2">
        {loading && (
          <Card>
            <Skeleton className="h-8 w-1/2 mb-3" />
            <Skeleton className="h-4 w-1/3 mb-2" />
            <Skeleton className="h-48 w-full" />
          </Card>
        )}

        {!loading && error && (
          <Card>
            <p className="text-sm text-muted">
              Não foi possível carregar os dados desse ativo agora. Verifique sua conexão ou tente novamente mais tarde.
            </p>
          </Card>
        )}

        {!loading && quote && (
          <>
            <Card>
              <p className="text-xs text-muted mb-1">{quote.name ?? quote.ticker}</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-extrabold">{formatCurrency(quote.price)}</p>
                <div className={`flex items-center gap-1 text-sm font-semibold ${quote.change >= 0 ? 'text-green' : 'text-danger'}`}>
                  {quote.change >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                  {quote.change >= 0 ? '+' : ''}
                  {quote.changePercent?.toFixed(2)}%
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
                <div>
                  <p className="text-muted">Máxima</p>
                  <p className="font-medium">{quote.dayHigh ? formatCurrency(quote.dayHigh) : '—'}</p>
                </div>
                <div>
                  <p className="text-muted">Mínima</p>
                  <p className="font-medium">{quote.dayLow ? formatCurrency(quote.dayLow) : '—'}</p>
                </div>
                <div>
                  <p className="text-muted">Volume</p>
                  <p className="font-medium">{quote.volume ? quote.volume.toLocaleString('pt-BR') : '—'}</p>
                </div>
              </div>
            </Card>

            {quote.history && quote.history.length > 1 && (
              <Card>
                <p className="text-sm font-medium mb-3">Histórico (6 meses)</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={quote.history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#8B9690' }} axisLine={false} tickLine={false} minTickGap={40} />
                      <YAxis tick={{ fontSize: 10, fill: '#8B9690' }} axisLine={false} tickLine={false} width={40} domain={['auto', 'auto']} />
                      <Tooltip
                        formatter={(v: number) => formatCurrency(v)}
                        contentStyle={{ background: '#151A17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                      />
                      <Line type="monotone" dataKey="close" stroke="#00D26A" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            <Card>
              <p className="text-sm font-medium mb-3">Indicadores de desempenho</p>
              <div className="grid grid-cols-2 gap-3">
                <PerfBox label="1 semana" value={perf1w} />
                <PerfBox label="1 mês" value={perf1m} />
                <PerfBox label="3 meses" value={perf3m} />
                <PerfBox label="6 meses" value={perf6m} />
              </div>
              {volatility != null && (
                <p className="text-xs text-muted mt-4">
                  Volatilidade anualizada estimada: <span className="text-txt font-medium">{volatility.toFixed(1)}%</span>
                </p>
              )}
            </Card>

            <Card>
              <p className="text-sm font-medium mb-2">Análise em linguagem simples</p>
              <p className="text-xs text-muted leading-relaxed">
                {perf6m != null
                  ? `Com base nos dados históricos, o ativo apresentou ${perf6m >= 0 ? 'valorização' : 'desvalorização'} de aproximadamente ${Math.abs(perf6m).toFixed(1)}% nos últimos 6 meses`
                  : 'Ainda não há dados históricos suficientes para uma análise de tendência'}
                {volatility != null ? `, com volatilidade ${volatility > 30 ? 'elevada' : volatility > 15 ? 'moderada' : 'baixa'}.` : '.'}
              </p>
              <p className="text-[11px] text-muted mt-3 leading-relaxed">
                Estas informações são educacionais, baseadas em dados históricos, e não constituem recomendação
                financeira. Desempenho passado não garante resultados futuros.
              </p>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

function PerfBox({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl bg-bg p-3">
      <p className="text-xs text-muted mb-1">{label}</p>
      {value == null ? (
        <p className="text-sm font-medium text-muted">—</p>
      ) : (
        <p className={`text-sm font-semibold ${value >= 0 ? 'text-green' : 'text-danger'}`}>
          {value >= 0 ? '+' : ''}
          {value.toFixed(1)}%
        </p>
      )}
    </div>
  )
}
