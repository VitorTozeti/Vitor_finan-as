import { TooltipProps } from 'recharts'
import { formatCurrency } from '../utils/finance'

// Central chart palette so every page reads as one system.
// Brand green + warm accent lead; the rest are tuned to sit on the dark surface.
export const CHART_COLORS = [
  '#1FD98A',
  '#FFB454',
  '#4E9AF1',
  '#B98CE0',
  '#5CD0B3',
  '#E37EC1',
  '#F5A623',
  '#7A8CFF',
  '#13B571',
  '#FF5A66'
]

// Semantic single colors shared with the design tokens.
export const BRAND_GREEN = '#1FD98A'
export const BRAND_ACCENT = '#FFB454'

export const AXIS_TICK = { fontSize: 11, fill: '#889389' } as const
export const GRID_STROKE = 'rgba(255,255,255,0.06)'

export const TOOLTIP_STYLE = {
  background: '#161D19',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  fontSize: 12,
  boxShadow: '0 8px 24px rgba(0,0,0,0.45)'
} as const

/** Shared money tooltip with a small color swatch per series. */
export function MoneyTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2">
      {label != null && <p className="text-[11px] text-muted mb-1">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted">{entry.name}</span>
          <span className="ml-auto font-semibold text-txt">{formatCurrency(Number(entry.value ?? 0))}</span>
        </div>
      ))}
    </div>
  )
}

/** Reusable linearGradient defs for area fills keyed by id. */
export function AreaGradient({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={0.35} />
      <stop offset="100%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  )
}

export interface PeriodOption<T extends string> {
  value: T
  label: string
}

/** Segmented pill selector used across Charts / Simulator. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange
}: {
  options: PeriodOption<T>[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-xl bg-bg border border-white/10 p-0.5 gap-0.5">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
            value === o.value ? 'bg-green text-bg shadow-glow' : 'text-muted hover:text-txt'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Compact stat tile for KPI rows. */
export function StatTile({
  label,
  value,
  hint,
  tone = 'default'
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'green' | 'danger' | 'accent'
}) {
  const toneClass =
    tone === 'green'
      ? 'text-green'
      : tone === 'danger'
        ? 'text-danger'
        : tone === 'accent'
          ? 'text-accent'
          : 'text-txt'
  return (
    <div className="rounded-xl bg-bg p-3">
      <p className="text-[11px] text-muted mb-1">{label}</p>
      <p className={`font-display text-base font-bold ${toneClass}`}>{value}</p>
      {hint && <p className="text-[10px] text-muted mt-0.5">{hint}</p>}
    </div>
  )
}
