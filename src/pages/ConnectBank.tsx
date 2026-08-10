import { useRef, useState } from 'react'
import Header from '../components/Header'
import { Card, pushToast } from '../components/Primitives'
import { useStore } from '../store/useStore'
import { formatCurrency } from '../utils/finance'
import { parseStatement, ParsedStatementTx } from '../utils/statementImport'
import { isBankSyncConfigured } from '../services/bankApi'
import { Upload, FileText, ArrowLeftRight, Trash2, Link2, ShieldCheck, TrendingUp, TrendingDown } from 'lucide-react'

type Tab = 'import' | 'sync'

export default function ConnectBank() {
  const { state, addTransactionsBulk } = useStore()
  const [tab, setTab] = useState<Tab>('import')
  const [rows, setRows] = useState<ParsedStatementTx[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const result = parseStatement(String(reader.result), file.name, state.categories)
      setRows(result.transactions)
      setWarnings(result.warnings)
      if (result.transactions.length > 0) {
        pushToast(`${result.transactions.length} lançamento(s) lidos do arquivo`)
      } else {
        pushToast('Nenhum lançamento reconhecido', 'error')
      }
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  function invertAll() {
    setRows(rows.map(r => ({ ...r, type: r.type === 'expense' ? 'income' : 'expense' })))
  }

  function toggleRowType(idx: number) {
    setRows(rows.map((r, i) => (i === idx ? { ...r, type: r.type === 'expense' ? 'income' : 'expense' } : r)))
  }

  function setRowCategory(idx: number, categoryId: string) {
    setRows(rows.map((r, i) => (i === idx ? { ...r, categoryId } : r)))
  }

  function removeRow(idx: number) {
    setRows(rows.filter((_, i) => i !== idx))
  }

  function confirmImport() {
    if (rows.length === 0) return
    const added = addTransactionsBulk(
      rows.map(r => ({
        type: r.type,
        amount: r.amount,
        description: r.description,
        categoryId: r.categoryId,
        date: r.date
      }))
    )
    const skipped = rows.length - added
    pushToast(
      skipped > 0
        ? `${added} importado(s), ${skipped} já existiam`
        : `${added} lançamento(s) importados!`
    )
    setRows([])
    setWarnings([])
    setFileName(null)
  }

  const totals = rows.reduce(
    (acc, r) => {
      if (r.type === 'income') acc.income += r.amount
      else acc.expense += r.amount
      return acc
    },
    { income: 0, expense: 0 }
  )

  return (
    <div className="pb-28">
      <Header title="Conectar banco" subtitle="Traga seus lançamentos para o app" />
      <div className="px-5 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTab('import')}
            className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
              tab === 'import' ? 'bg-green text-bg' : 'bg-white/5 text-muted'
            }`}
          >
            Importar extrato
          </button>
          <button
            onClick={() => setTab('sync')}
            className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
              tab === 'sync' ? 'bg-green text-bg' : 'bg-white/5 text-muted'
            }`}
          >
            Open Finance
          </button>
        </div>

        {tab === 'import' && (
          <>
            <Card>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-green/10 flex items-center justify-center text-green shrink-0">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium">Seus dados não saem do aparelho</p>
                  <p className="text-xs text-muted mt-0.5">
                    O arquivo é lido aqui no seu navegador. Nada é enviado a servidores — sem senha do banco.
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <p className="text-sm font-medium mb-1">Como fazer</p>
              <ol className="text-xs text-muted space-y-1.5 mb-4 list-decimal list-inside">
                <li>No app do seu banco, exporte o extrato como <span className="text-txt font-medium">OFX</span> ou <span className="text-txt font-medium">CSV</span>.</li>
                <li>Selecione o arquivo abaixo.</li>
                <li>Confira os lançamentos e importe.</li>
              </ol>
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-green py-3 text-sm font-semibold text-bg"
              >
                <Upload size={16} /> Selecionar arquivo (.ofx / .csv)
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".ofx,.csv,.txt,text/csv,application/x-ofx"
                onChange={handleFile}
                className="hidden"
              />
              {fileName && (
                <p className="text-[11px] text-muted mt-2 flex items-center gap-1.5">
                  <FileText size={12} /> {fileName}
                </p>
              )}
            </Card>

            {warnings.length > 0 && (
              <Card className="border-warn/30">
                {warnings.map((w, i) => (
                  <p key={i} className="text-xs text-warn">
                    {w}
                  </p>
                ))}
              </Card>
            )}

            {rows.length > 0 && (
              <>
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium">{rows.length} lançamentos</p>
                    <button
                      onClick={invertAll}
                      className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-green"
                    >
                      <ArrowLeftRight size={13} /> Inverter entradas/gastos
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-bg p-3">
                      <p className="text-[11px] text-muted mb-1">Entradas</p>
                      <p className="text-sm font-bold text-green">{formatCurrency(totals.income)}</p>
                    </div>
                    <div className="rounded-xl bg-bg p-3">
                      <p className="text-[11px] text-muted mb-1">Gastos</p>
                      <p className="text-sm font-bold text-danger">{formatCurrency(totals.expense)}</p>
                    </div>
                  </div>
                </Card>

                <div className="space-y-2">
                  {rows.map((r, idx) => (
                    <Card key={idx} className="!p-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleRowType(idx)}
                          aria-label="Alternar tipo"
                          className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                            r.type === 'income' ? 'bg-green/10 text-green' : 'bg-danger/10 text-danger'
                          }`}
                        >
                          {r.type === 'income' ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{r.description}</p>
                          <p className="text-[11px] text-muted">{r.date}</p>
                        </div>
                        <p className={`text-sm font-semibold shrink-0 ${r.type === 'income' ? 'text-green' : 'text-danger'}`}>
                          {r.type === 'income' ? '+' : '-'}
                          {formatCurrency(r.amount)}
                        </p>
                        <button onClick={() => removeRow(idx)} aria-label="Remover" className="text-muted shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <select
                        value={r.categoryId}
                        onChange={e => setRowCategory(idx, e.target.value)}
                        className="mt-2 w-full rounded-lg bg-bg border border-white/10 px-2 py-1.5 text-xs outline-none focus:border-green"
                      >
                        {state.categories.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.icon} {c.name}
                          </option>
                        ))}
                      </select>
                    </Card>
                  ))}
                </div>

                <button
                  onClick={confirmImport}
                  className="w-full rounded-xl bg-green py-3.5 text-sm font-semibold text-bg sticky bottom-24 md:bottom-6 shadow-soft"
                >
                  Importar {rows.length} lançamento(s)
                </button>
              </>
            )}
          </>
        )}

        {tab === 'sync' && <OpenFinancePanel />}
      </div>
    </div>
  )
}

function OpenFinancePanel() {
  const configured = isBankSyncConfigured()

  return (
    <>
      <Card>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-green/10 flex items-center justify-center text-green shrink-0">
            <Link2 size={18} />
          </div>
          <div>
            <p className="text-sm font-medium">Sincronização automática (Open Finance)</p>
            <p className="text-xs text-muted mt-0.5">
              Conecta sua conta via um agregador (Pluggy, Belvo) e traz os lançamentos sozinho.
            </p>
          </div>
        </div>
      </Card>

      {configured ? (
        <Card>
          <p className="text-sm font-medium mb-1 text-green">Backend configurado ✓</p>
          <p className="text-xs text-muted">
            A URL do proxy está definida. O fluxo de conexão pode ser iniciado a partir daqui assim que o widget do
            agregador for integrado.
          </p>
        </Card>
      ) : (
        <Card className="border-warn/30">
          <p className="text-sm font-medium mb-2 text-warn">Precisa de um backend para funcionar</p>
          <p className="text-xs text-muted leading-relaxed mb-3">
            Este app é 100% estático (GitHub Pages), então não pode guardar as chaves secretas do banco/agregador com
            segurança. A sincronização automática exige um pequeno servidor intermediário que guarda o segredo e conversa
            com o agregador.
          </p>
          <div className="rounded-xl bg-bg p-3 text-xs text-muted space-y-2">
            <p className="font-medium text-txt">Como habilitar</p>
            <p>1. Crie uma conta em um agregador de Open Finance (ex.: Pluggy ou Belvo).</p>
            <p>2. Suba um proxy (Cloudflare Worker / Vercel Function) que guarde o segredo e exponha:</p>
            <p className="font-mono text-[11px] text-txt pl-3">POST /connect-token<br />GET /transactions/:itemId</p>
            <p>3. Defina a variável de ambiente no build:</p>
            <p className="font-mono text-[11px] text-txt pl-3">VITE_BANK_PROXY_URL=https://seu-proxy…</p>
            <p>O código cliente já está pronto em <span className="font-mono text-[11px] text-txt">src/services/bankApi.ts</span>.</p>
          </div>
          <p className="text-[11px] text-muted mt-3">
            Enquanto isso, a aba <span className="text-txt font-medium">Importar extrato</span> já traz seus lançamentos
            sem precisar de servidor.
          </p>
        </Card>
      )}
    </>
  )
}
