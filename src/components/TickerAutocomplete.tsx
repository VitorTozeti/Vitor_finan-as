import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { searchTickers, searchLocal, TickerEntry } from '../utils/tickers'

const KIND_TONE: Record<string, string> = {
  'Ação': 'text-green',
  ETF: 'text-accent',
  FII: 'text-accent',
  'FII/ETF': 'text-accent'
}

/** Autocomplete for B3 tickers. Shows instant local matches from the committed
 * catalog and merges in live brapi results (debounced) so any listed ticker is
 * findable. Calls onPick with the chosen entry; also keeps the raw text in sync
 * via onTextChange so free-typed tickers still work. */
export default function TickerAutocomplete({
  value,
  onPick,
  onTextChange,
  onSubmit,
  placeholder = 'Buscar por código ou nome (ex: PETR4, Vale)'
}: {
  value: string
  onPick: (entry: TickerEntry) => void
  onTextChange: (text: string) => void
  /** Called when the user presses Enter with free text (no pick required). */
  onSubmit?: (text: string) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<TickerEntry[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => setQuery(value), [value])

  // Debounced search: local results show immediately, live results merge in.
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    setResults(searchLocal(q))
    setLoading(true)
    const handle = setTimeout(() => {
      searchTickers(q)
        .then(setResults)
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(handle)
  }, [query])

  // Close the dropdown on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          value={query}
          onChange={e => {
            const v = e.target.value.toUpperCase()
            setQuery(v)
            onTextChange(v)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Enter' && onSubmit) {
              e.preventDefault()
              setOpen(false)
              onSubmit(query.trim())
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-xl bg-bg border border-line/10 pl-9 pr-9 py-2.5 text-sm outline-none focus:border-green"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              onTextChange('')
              setResults([])
            }}
            aria-label="Limpar"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-txt"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl bg-bg2 border border-line/10 shadow-soft">
          {results.length === 0 && !loading && (
            <p className="px-3 py-3 text-xs text-muted">Nenhum ativo encontrado.</p>
          )}
          {results.map(r => (
            <button
              type="button"
              key={r.ticker}
              onClick={() => {
                setQuery(r.ticker)
                onTextChange(r.ticker)
                onPick(r)
                setOpen(false)
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-line/5 border-b border-line/5 last:border-0"
            >
              <span className="font-semibold text-sm w-16 shrink-0">{r.ticker}</span>
              <span className="text-xs text-muted truncate flex-1">{r.name}</span>
              <span className={`text-[10px] font-medium shrink-0 ${KIND_TONE[r.kind] ?? 'text-muted'}`}>{r.kind}</span>
            </button>
          ))}
          {loading && <p className="px-3 py-2 text-[11px] text-muted">Buscando no mercado…</p>}
        </div>
      )}
    </div>
  )
}
