import { useRef, useState, ReactNode } from 'react'
import Header from '../components/Header'
import { Card, Modal, pushToast, ConfirmDialog } from '../components/Primitives'
import { useStore } from '../store/useStore'
import { exportAsJson, exportTransactionsAsCsv, parseImportedJson } from '../utils/exportImport'
import { parseAmountInput } from '../utils/finance'
import CategoryManager from '../components/CategoryManager'
import RecurringRulesManager from '../components/RecurringRulesManager'
import { Download, Upload, Trash2, Check, Palette, Brush } from 'lucide-react'
import { THEMES, DEFAULT_THEME, CUSTOM_THEME_ID } from '../data/themes'

/** Small uppercase group label used to visually section the settings list. */
function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wide text-muted px-1 mb-1.5">{children}</p>
}

const DEFAULT_CUSTOM = { bg: '#141414', primary: '#22D68A', accent: '#FFB454' }

export default function Settings() {
  const { state, updateSettings, clearDemoData, resetAll, importData } = useStore()
  const [income, setIncome] = useState(String(state.settings.mainIncome))
  const [payDay, setPayDay] = useState(String(state.settings.payDay))
  const [confirmClearDemo, setConfirmClearDemo] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [customColors, setCustomColors] = useState(state.settings.customPalette ?? DEFAULT_CUSTOM)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function saveIncome() {
    const numeric = parseAmountInput(income)
    const day = parseInt(payDay, 10)
    if (!numeric || numeric <= 0) {
      pushToast('Informe uma renda válida', 'error')
      return
    }
    if (!day || day < 1 || day > 31) {
      pushToast('Informe um dia válido (1-31)', 'error')
      return
    }
    updateSettings({ mainIncome: numeric, payDay: day })
    pushToast('Configurações salvas')
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseImportedJson(String(reader.result))
      if (parsed !== null) {
        importData(parsed)
      } else {
        pushToast('Arquivo não é um JSON válido', 'error')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const hasDemoData = state.transactions.some(t => t.id.startsWith('demo-'))
  const activeTheme = state.settings.theme ?? DEFAULT_THEME
  const isCustomActive = activeTheme === CUSTOM_THEME_ID

  function applyCustom() {
    updateSettings({ theme: CUSTOM_THEME_ID, customPalette: customColors })
    pushToast('Paleta personalizada aplicada')
    setCustomOpen(false)
  }

  return (
    <div className="pb-28">
      <Header title="Configurações" subtitle="Personalize seu GreenFinance" />
      <div className="px-5 space-y-6">
        <div className="space-y-4">
          <SectionLabel>Aparência</SectionLabel>
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <Palette size={16} className="text-green" />
              <p className="text-sm font-medium">Tema visual</p>
            </div>
            <p className="text-xs text-muted mb-4">Escolha a paleta de cores do app. Muda na hora.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {THEMES.map(t => {
                const selected = t.id === activeTheme
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      updateSettings({ theme: t.id })
                      pushToast(`Tema "${t.label}" aplicado`)
                    }}
                    className={`relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                      selected ? 'border-green shadow-glow bg-surface' : 'border-line/10 bg-bg hover:border-line/20'
                    }`}
                  >
                    {/* Live palette preview */}
                    <div
                      className="h-11 w-11 shrink-0 rounded-lg border border-line/10 overflow-hidden grid grid-cols-2 grid-rows-2"
                      style={{ background: t.swatch.bg }}
                    >
                      <span style={{ background: t.swatch.green }} />
                      <span style={{ background: t.swatch.accent }} />
                      <span style={{ background: t.swatch.txt }} />
                      <span style={{ background: t.swatch.bg }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        {t.label}
                        {t.light && <span className="text-[9px] uppercase tracking-wide text-muted">claro</span>}
                      </p>
                      <p className="text-[11px] text-muted leading-snug">{t.description}</p>
                    </div>
                    {selected && (
                      <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-green flex items-center justify-center">
                        <Check size={12} className="text-bg" />
                      </span>
                    )}
                  </button>
                )
              })}

              {/* Custom palette entry point — same tile shape as the presets. */}
              <button
                onClick={() => setCustomOpen(true)}
                className={`relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                  isCustomActive ? 'border-green shadow-glow bg-surface' : 'border-line/10 bg-bg hover:border-line/20'
                }`}
              >
                <div
                  className="h-11 w-11 shrink-0 rounded-lg border border-line/10 overflow-hidden grid grid-cols-2 grid-rows-2"
                  style={{ background: customColors.bg }}
                >
                  <span style={{ background: customColors.primary }} />
                  <span style={{ background: customColors.accent }} />
                  <span style={{ background: customColors.bg }} />
                  <span style={{ background: customColors.bg }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    <Brush size={12} /> Personalizada
                  </p>
                  <p className="text-[11px] text-muted leading-snug">Escolha suas próprias cores.</p>
                </div>
                {isCustomActive && (
                  <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-green flex items-center justify-center">
                    <Check size={12} className="text-bg" />
                  </span>
                )}
              </button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <SectionLabel>Finanças</SectionLabel>
          <Card>
            <p className="text-sm font-medium mb-3">Renda mensal</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Salário / renda principal</label>
                <input
                  inputMode="decimal"
                  value={income}
                  onChange={e => setIncome(e.target.value)}
                  className="w-full rounded-xl bg-bg border border-line/10 px-4 py-2.5 text-sm outline-none focus:border-green"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Dia de pagamento</label>
                <input
                  inputMode="numeric"
                  value={payDay}
                  onChange={e => setPayDay(e.target.value)}
                  className="w-full rounded-xl bg-bg border border-line/10 px-4 py-2.5 text-sm outline-none focus:border-green"
                />
                <p className="text-[11px] text-muted mt-1.5">
                  Se cair em fim de semana ou feriado, consideramos o dia útil anterior.
                </p>
              </div>
              <button onClick={saveIncome} className="w-full rounded-xl bg-green py-3 font-semibold text-bg text-sm">
                Salvar
              </button>
            </div>
          </Card>

          <CategoryManager />

          <RecurringRulesManager />
        </div>

        <div className="space-y-4">
          <SectionLabel>Dados</SectionLabel>
          <Card>
            <p className="text-sm font-medium mb-1">Dados e privacidade</p>
            <p className="text-xs text-muted mb-4">
              Seus dados financeiros são armazenados localmente neste dispositivo e não são enviados a servidores externos.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => exportAsJson(state)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-line/5 py-2.5 text-xs font-medium"
              >
                <Download size={14} /> Exportar JSON
              </button>
              <button
                onClick={() => exportTransactionsAsCsv(state.transactions, state.categories)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-line/5 py-2.5 text-xs font-medium"
              >
                <Download size={14} /> Exportar CSV
              </button>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-line/5 py-2.5 text-xs font-medium"
            >
              <Upload size={14} /> Importar backup (JSON)
            </button>
            <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImport} className="hidden" />
          </Card>

          {hasDemoData && (
            <Card>
              <p className="text-sm font-medium mb-1">Dados de demonstração</p>
              <p className="text-xs text-muted mb-3">
                Alguns dados fictícios foram incluídos para você conhecer o app. Você pode removê-los quando quiser.
              </p>
              <button
                onClick={() => setConfirmClearDemo(true)}
                className="w-full rounded-xl bg-line/5 py-2.5 text-xs font-medium"
              >
                Limpar dados de demonstração
              </button>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <SectionLabel>Zona de risco</SectionLabel>
          <Card>
            <button
              onClick={() => setConfirmReset(true)}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-danger/10 text-danger py-2.5 text-xs font-medium"
            >
              <Trash2 size={14} /> Apagar todos os dados
            </button>
          </Card>
        </div>
      </div>

      <Modal open={customOpen} onClose={() => setCustomOpen(false)} title="Paleta personalizada">
        <div className="space-y-4">
          <p className="text-xs text-muted -mt-1">
            Escolha 3 cores-base e o app monta o resto da paleta (fundo de cartões, tons escuros, texto) automaticamente.
          </p>
          {[
            { key: 'bg' as const, label: 'Fundo' },
            { key: 'primary' as const, label: 'Cor principal' },
            { key: 'accent' as const, label: 'Cor de destaque' }
          ].map(f => (
            <div key={f.key} className="flex items-center justify-between">
              <label className="text-sm font-medium">{f.label}</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted uppercase">{customColors[f.key]}</span>
                <input
                  type="color"
                  value={customColors[f.key]}
                  onChange={e => setCustomColors(c => ({ ...c, [f.key]: e.target.value }))}
                  className="h-9 w-12 rounded-lg border border-line/10 bg-transparent cursor-pointer"
                />
              </div>
            </div>
          ))}

          <div>
            <p className="text-xs font-medium text-muted mb-1.5">Preview</p>
            <div
              className="rounded-xl border border-line/10 p-4 flex items-center justify-between"
              style={{ background: customColors.bg }}
            >
              <span className="text-sm font-semibold" style={{ color: customColors.primary }}>
                Saldo disponível
              </span>
              <span className="text-xs font-semibold rounded-full px-2.5 py-1" style={{ background: customColors.accent, color: customColors.bg }}>
                Destaque
              </span>
            </div>
          </div>

          <button
            onClick={applyCustom}
            className="w-full rounded-xl bg-green py-3.5 font-semibold text-bg active:scale-95 transition-transform"
          >
            Aplicar paleta
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmClearDemo}
        title="Limpar dados de demonstração?"
        onCancel={() => setConfirmClearDemo(false)}
        onConfirm={() => {
          clearDemoData()
          pushToast('Dados de demonstração removidos')
          setConfirmClearDemo(false)
        }}
      />

      <ConfirmDialog
        open={confirmReset}
        title="Apagar todos os dados?"
        description="Essa ação é permanente e não pode ser desfeita."
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetAll()
          pushToast('Todos os dados foram apagados')
          setConfirmReset(false)
        }}
      />
    </div>
  )
}
