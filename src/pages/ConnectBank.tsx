import { useRef, useState } from 'react'
import Header from '../components/Header'
import { Card, pushToast } from '../components/Primitives'
import { useStore } from '../store/useStore'
import { formatCurrency } from '../utils/finance'
import { parseStatement, parseStatementLines, ParsedStatementTx, DateFormatHint } from '../utils/statementImport'
import { extractPdfLines } from '../utils/pdfExtract'
import { decodeFileText, TextEncodingChoice } from '../utils/decodeFile'
import { isBankSyncConfigured, createConnectToken, fetchBankTransactions } from '../services/bankApi'
import {
  Upload,
  FileText,
  ArrowLeftRight,
  Trash2,
  Link2,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  AlertTriangle
} from 'lucide-react'

type Tab = 'import' | 'sync'

export default function ConnectBank() {
  const { state, addTransactionsBulk } = useStore()
  const [tab, setTab] = useState<Tab>('import')
  const [rows, setRows] = useState<ParsedStatementTx[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [format, setFormat] = useState<'OFX' | 'CSV' | 'PDF' | null>(null)
  const [encoding, setEncoding] = useState<TextEncodingChoice>('auto')
  const [dateFormat, setDateFormat] = useState<DateFormatHint>('auto')
  const [parsing, setParsing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function runParse(file: File, enc: TextEncodingChoice, fmt: DateFormatHint) {
    setParsing(true)
    try {
      const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf'
      const result = isPdf
        ? parseStatementLines(await extractPdfLines(file), state.categories)
        : parseStatement(await decodeFileText(file, enc), file.name, state.categories, { dateFormat: fmt })
      setRows(result.transactions)
      setWarnings(result.warnings)
      setFormat(result.format)
      if (result.transactions.length > 0) {
        pushToast(`${result.transactions.length} lançamento(s) lidos do arquivo`)
      } else {
        pushToast('Nenhum lançamento reconhecido', 'error')
      }
    } catch {
      setRows([])
      setWarnings(['Não foi possível ler este arquivo. Confira se ele não está protegido por senha e tente novamente.'])
      setFormat(null)
      pushToast('Falha ao ler o arquivo', 'error')
    } finally {
      setParsing(false)
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setSelectedFile(file)
    runParse(file, encoding, dateFormat)
    e.target.value = ''
  }

  function handleEncodingChange(value: TextEncodingChoice) {
    setEncoding(value)
    if (selectedFile) runParse(selectedFile, value, dateFormat)
  }

  function handleDateFormatChange(value: DateFormatHint) {
    setDateFormat(value)
    if (selectedFile) runParse(selectedFile, encoding, value)
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
        date: r.date,
        fitid: r.fitid
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
    setSelectedFile(null)
    setFormat(null)
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
              tab === 'import' ? 'bg-green text-bg' : 'bg-line/5 text-muted'
            }`}
          >
            Importar extrato
          </button>
          <button
            onClick={() => setTab('sync')}
            className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
              tab === 'sync' ? 'bg-green text-bg' : 'bg-line/5 text-muted'
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
                <li>No app/site do seu banco, baixe o extrato como <span className="text-txt font-medium">PDF</span>, <span className="text-txt font-medium">OFX</span> ou <span className="text-txt font-medium">CSV</span>.</li>
                <li>Selecione o arquivo abaixo.</li>
                <li>Confira os lançamentos e importe.</li>
              </ol>
              <p className="text-[11px] text-muted mb-3">
                O extrato do <span className="text-txt font-medium">Itaú</span> em PDF funciona aqui — a leitura de PDF é
                automática, mas confira sempre os lançamentos antes de importar.
              </p>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={parsing}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-green py-3 text-sm font-semibold text-bg disabled:opacity-60"
              >
                <Upload size={16} /> {parsing ? 'Lendo arquivo…' : 'Selecionar arquivo (.pdf / .ofx / .csv)'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.ofx,.csv,.txt,text/csv,application/x-ofx,application/pdf"
                onChange={handleFile}
                className="hidden"
              />
              {fileName && (
                <p className="text-[11px] text-muted mt-2 flex items-center gap-1.5">
                  <FileText size={12} /> {fileName}
                </p>
              )}
            </Card>

            {selectedFile && format !== 'PDF' && (
              <Card>
                <p className="text-sm font-medium mb-3">Se algo saiu errado</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-muted mb-1.5">
                      Acentos estranhos? Troque a codificação do arquivo
                    </label>
                    <select
                      value={encoding}
                      onChange={e => handleEncodingChange(e.target.value as TextEncodingChoice)}
                      className="w-full rounded-lg bg-bg border border-line/10 px-2 py-1.5 text-xs outline-none focus:border-green"
                    >
                      <option value="auto">Automático</option>
                      <option value="utf-8">UTF-8</option>
                      <option value="windows-1252">Latin-1 / Windows-1252 (bancos mais antigos)</option>
                    </select>
                  </div>
                  {format === 'CSV' && (
                    <div>
                      <label className="block text-[11px] font-medium text-muted mb-1.5">
                        Datas erradas? Troque o formato
                      </label>
                      <select
                        value={dateFormat}
                        onChange={e => handleDateFormatChange(e.target.value as DateFormatHint)}
                        className="w-full rounded-lg bg-bg border border-line/10 px-2 py-1.5 text-xs outline-none focus:border-green"
                      >
                        <option value="auto">Automático</option>
                        <option value="dmy">DD/MM/AAAA (Brasil)</option>
                        <option value="mdy">MM/DD/AAAA (EUA)</option>
                      </select>
                    </div>
                  )}
                </div>
              </Card>
            )}

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
                      {r.ambiguousAmount && (
                        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-warn">
                          <AlertTriangle size={12} /> Valor ambíguo — confira se está correto.
                        </p>
                      )}
                      <select
                        value={r.categoryId}
                        onChange={e => setRowCategory(idx, e.target.value)}
                        className="mt-2 w-full rounded-lg bg-bg border border-line/10 px-2 py-1.5 text-xs outline-none focus:border-green"
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

        {tab === 'sync' && (
          <OpenFinancePanel
            onTransactions={synced => {
              // Reaproveita a mesma tela de revisão da importação de extrato.
              setRows(synced)
              setWarnings([])
              setFormat('OFX')
              setFileName('Open Finance')
              setSelectedFile(null)
              setTab('import')
              if (synced.length > 0) {
                pushToast(`${synced.length} lançamento(s) trazidos do banco`)
              } else {
                pushToast('Nenhum lançamento novo encontrado', 'error')
              }
            }}
          />
        )}
      </div>
    </div>
  )
}

// URL do SDK web do Pluggy Connect. Confirme a versão atual na documentação do
// Pluggy; ele expõe o global `window.PluggyConnect`.
const PLUGGY_CONNECT_SDK = 'https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js'

/** Carrega o script do Pluggy Connect uma única vez. */
function loadPluggyConnect(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any
    if (w.PluggyConnect) return resolve(w.PluggyConnect)
    const existing = document.getElementById('pluggy-connect-sdk')
    if (existing) {
      existing.addEventListener('load', () => resolve(w.PluggyConnect))
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar o Pluggy')))
      return
    }
    const script = document.createElement('script')
    script.id = 'pluggy-connect-sdk'
    script.src = PLUGGY_CONNECT_SDK
    script.onload = () => resolve(w.PluggyConnect)
    script.onerror = () => reject(new Error('Falha ao carregar o Pluggy'))
    document.body.appendChild(script)
  })
}

function OpenFinancePanel({ onTransactions }: { onTransactions: (rows: ParsedStatementTx[]) => void }) {
  const configured = isBankSyncConfigured()
  const [connecting, setConnecting] = useState(false)

  async function handleConnect() {
    setConnecting(true)
    try {
      const token = await createConnectToken()
      if (!token) {
        pushToast('Não foi possível iniciar a conexão. Confira o proxy.', 'error')
        setConnecting(false)
        return
      }
      const PluggyConnect = await loadPluggyConnect()
      const pluggy = new PluggyConnect({
        connectToken: token,
        includeSandbox: true, // mostra bancos de teste; remova em produção
        onSuccess: async (itemData: any) => {
          const itemId = itemData?.item?.id
          if (!itemId) {
            pushToast('Conexão sem item válido', 'error')
            setConnecting(false)
            return
          }
          const rows = await fetchBankTransactions(itemId)
          onTransactions(rows ?? [])
          setConnecting(false)
        },
        onError: () => {
          pushToast('Não foi possível conectar a conta', 'error')
          setConnecting(false)
        },
        onClose: () => setConnecting(false)
      })
      pluggy.init()
    } catch {
      pushToast('Falha ao abrir o Pluggy', 'error')
      setConnecting(false)
    }
  }

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
              Conecta sua conta via um agregador (Pluggy) e traz os lançamentos sozinho.
            </p>
          </div>
        </div>
      </Card>

      {configured ? (
        <Card>
          <p className="text-sm font-medium mb-1 text-green">Backend configurado ✓</p>
          <p className="text-xs text-muted mb-3">
            Toque abaixo para escolher seu banco (ex.: Itaú), autorizar pelo Open Finance e trazer os lançamentos para a
            tela de revisão.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-green py-3 text-sm font-semibold text-bg disabled:opacity-60"
          >
            <Link2 size={16} /> {connecting ? 'Abrindo conexão…' : 'Conectar minha conta'}
          </button>
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
