import { Category } from '../types'

// Parses bank/card statement exports (OFX and CSV) fully in the browser — no
// server, no bank password. This is the practical "connect your bank" path for
// a static app: the user exports a statement from their bank app and imports it
// here. Every parsed transaction is shown for review before anything is saved.

export interface ParsedStatementTx {
  date: string // ISO yyyy-mm-dd
  amount: number // always positive; direction is in `type`
  type: 'income' | 'expense'
  description: string
  categoryId: string
  fitid?: string
  /** True when the amount's format was genuinely ambiguous (e.g. "1.234"
   * could mean 1234 or 1,234) and a best-effort guess was made — surfaced so
   * the review screen can flag the row for a manual check. */
  ambiguousAmount?: boolean
}

export interface ParseResult {
  transactions: ParsedStatementTx[]
  format: 'OFX' | 'CSV'
  warnings: string[]
}

export type DateFormatHint = 'auto' | 'dmy' | 'mdy'

export interface ParseOptions {
  dateFormat?: DateFormatHint
}

// Lightweight keyword → category guessing, using the app's own category ids.
const CATEGORY_KEYWORDS: { id: string; words: string[] }[] = [
  { id: 'alimentacao', words: ['mercado', 'supermerc', 'ifood', 'restaur', 'padaria', 'lanch', 'food', 'pao', 'acai', 'bar '] },
  { id: 'transporte', words: ['uber', '99', 'posto', 'combust', 'gasolina', 'onibus', 'metro', 'passagem', 'estacion', '99app'] },
  { id: 'assinaturas', words: ['netflix', 'spotify', 'amazon prime', 'disney', 'youtube', 'assinatura', 'hbo', 'apple.com'] },
  { id: 'saude', words: ['farmac', 'drogaria', 'hospital', 'clinic', 'medic', 'psic', 'dentist'] },
  { id: 'casa', words: ['aluguel', 'condomin', 'luz', 'energia', 'agua', 'gas', 'internet', 'vivo', 'claro', 'tim', 'enel'] },
  { id: 'faculdade', words: ['faculdade', 'universi', 'mensalidade', 'curso', 'escola'] },
  { id: 'lazer', words: ['cinema', 'show', 'viagem', 'hotel', 'ingresso', 'game', 'steam', 'playstation', 'xbox'] },
  { id: 'compras', words: ['shopping', 'loja', 'magazine', 'americanas', 'mercadolivre', 'aliexpress', 'shein', 'renner', 'riachuelo'] }
]

// Boilerplate prefixes several Brazilian banks prepend to the real merchant
// name (e.g. "COMPRA CARTAO - PADARIA DO ZE"). Stripping them both improves
// keyword-category matching and makes the description more readable.
const DESCRIPTION_PREFIXES = [
  /^compra\s+cart[aã]o\s*[-:]?\s*/i,
  /^compra\s*[-:]?\s*/i,
  /^pix\s+enviado\s*[-:]?\s*/i,
  /^pix\s+recebido\s*[-:]?\s*/i,
  /^pagamento\s+efetuado\s*[-:]?\s*/i,
  /^ted\s*[-:]?\s*/i,
  /^doc\s*[-:]?\s*/i
]

function cleanDescription(raw: string): string {
  let s = raw.trim()
  if (!s) return s
  for (const re of DESCRIPTION_PREFIXES) {
    const stripped = s.replace(re, '').trim()
    if (stripped) s = stripped
  }
  // Title-case all-caps merchant strings ("PADARIA DO ZE" -> "Padaria Do Ze")
  // so they read better and match lowercase keyword lists more reliably.
  if (s === s.toUpperCase() && /[A-ZÀ-Ú]/.test(s)) {
    s = s.toLowerCase().replace(/(^|\s)([a-zà-ú])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
  }
  return s
}

function guessCategory(description: string, type: 'income' | 'expense', categories: Category[]): string {
  if (type === 'income') return categories.find(c => c.id === 'outros')?.id ?? categories[0]?.id ?? 'outros'
  const lower = description.toLowerCase()
  for (const rule of CATEGORY_KEYWORDS) {
    if (categories.some(c => c.id === rule.id) && rule.words.some(w => lower.includes(w))) return rule.id
  }
  return categories.find(c => c.id === 'outros')?.id ?? categories[0]?.id ?? 'outros'
}

interface AmountParseResult {
  value: number
  ambiguous: boolean
}

/** Parses a pt-BR / en number that may look like "1.234,56", "-50,00" or
 * "12.5". A lone dot followed by exactly 3 digits ("1.234") is ambiguous —
 * it could be 1234 (thousands grouping, whole Reais) or 1.234 (decimal) — so
 * that case is flagged via `ambiguous` for the caller to surface. */
function parseAmountDetailed(raw: string): AmountParseResult {
  let s = raw.replace(/[^0-9.,-]/g, '').trim()
  if (!s) return { value: NaN, ambiguous: false }
  const neg = s.startsWith('-') || /\(.*\)/.test(raw)
  s = s.replace(/-/g, '')
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  let ambiguous = false
  if (hasComma && hasDot) {
    // Assume '.' thousands, ',' decimal (pt-BR)
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    s = s.replace(',', '.')
  } else if (hasDot) {
    const parts = s.split('.')
    if (parts.length === 2 && parts[1].length === 3) {
      // Looks like a thousands-grouped whole amount (e.g. "1.234" = 1234)
      // rather than a decimal — best guess, flagged as ambiguous.
      s = parts.join('')
      ambiguous = true
    }
  }
  const value = parseFloat(s)
  if (isNaN(value)) return { value: NaN, ambiguous: false }
  return { value: neg ? -value : value, ambiguous }
}

/** Parses a pt-BR/en amount string, discarding the ambiguity flag. Exported
 * for callers that only need the numeric value. */
export function parseAmount(raw: string): number {
  return parseAmountDetailed(raw).value
}

function ofxTag(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}>([^<\r\n]*)`, 'i'))
  return m ? m[1].trim() : undefined
}

function parseOfxDate(raw: string | undefined): string | null {
  if (!raw || raw.length < 8) return null
  const y = raw.slice(0, 4)
  const mo = raw.slice(4, 6)
  const d = raw.slice(6, 8)
  if (!/^\d{8}/.test(raw)) return null
  return `${y}-${mo}-${d}`
}

function parseOfx(text: string, categories: Category[]): ParseResult {
  const warnings: string[] = []
  const transactions: ParsedStatementTx[] = []
  const blocks = text.split(/<STMTTRN>/i).slice(1)
  for (const block of blocks) {
    const amountRaw = ofxTag(block, 'TRNAMT')
    const dateRaw = ofxTag(block, 'DTPOSTED')
    const memo = ofxTag(block, 'MEMO') || ofxTag(block, 'NAME') || 'Lançamento'
    const fitid = ofxTag(block, 'FITID')
    const amountResult = amountRaw ? parseAmountDetailed(amountRaw) : { value: NaN, ambiguous: false }
    const date = parseOfxDate(dateRaw)
    if (isNaN(amountResult.value) || !date) continue
    const type: 'income' | 'expense' = amountResult.value >= 0 ? 'income' : 'expense'
    const description = cleanDescription(decodeEntities(memo))
    transactions.push({
      date,
      amount: Math.abs(amountResult.value),
      type,
      description,
      categoryId: guessCategory(description, type, categories),
      fitid,
      ambiguousAmount: amountResult.ambiguous
    })
  }
  if (transactions.length === 0) warnings.push('Nenhuma transação encontrada no arquivo OFX.')
  return { transactions, format: 'OFX', warnings }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim()
}

function detectDelimiter(headerLine: string): string {
  const semis = (headerLine.match(/;/g) || []).length
  const commas = (headerLine.match(/,/g) || []).length
  return semis > commas ? ';' : ','
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else inQuotes = !inQuotes
    } else if (ch === delim && !inQuotes) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map(s => s.trim())
}

function findColumn(headers: string[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase()
    if (patterns.some(p => p.test(h))) return i
  }
  return -1
}

/** Scans the first few lines for the first one that has both a recognizable
 * date and amount column, skipping any preamble/metadata rows some banks
 * (notably Itaú) put before the real header — e.g. account number, period. */
function findHeaderRowIndex(lines: string[], delim: string, scanWindow = 15): number {
  const limit = Math.min(lines.length, scanWindow)
  for (let i = 0; i < limit; i++) {
    const cols = splitCsvLine(lines[i], delim)
    const dateCol = findColumn(cols, [/data/, /date/])
    const amountCol = findColumn(cols, [/valor/, /amount/, /montante/, /^r\$/])
    if (dateCol !== -1 && amountCol !== -1) return i
  }
  return 0
}

/** Detects statement formats whose sign convention differs from the app's
 * default ("positive = income, negative = expense"). Nubank's credit-card
 * CSV (`date,category,title,amount`) always uses a positive amount for
 * purchases, with no separate direction column. */
function detectsNubankCardCsv(headers: string[]): boolean {
  const norm = headers.map(h => h.trim().toLowerCase())
  return norm.length <= 5 && norm.includes('date') && norm.includes('title') && norm.includes('amount') && !norm.includes('valor')
}

interface DateParseResult {
  date: string | null
  ambiguous: boolean
}

function normalizeCsvDate(raw: string, hint: DateFormatHint): DateParseResult {
  const s = raw.trim()
  const m = s.match(/^(\d{2})[/\-.](\d{2})[/\-.](\d{2,4})/)
  if (m) {
    const g1 = Number(m[1])
    const g2 = Number(m[2])
    const year = m[3].length === 2 ? `20${m[3]}` : m[3]
    let day: number
    let month: number
    let ambiguous = false
    if (hint === 'mdy') {
      month = g1
      day = g2
    } else if (hint === 'dmy') {
      day = g1
      month = g2
    } else if (g2 > 12 && g1 <= 12) {
      // Second group can't be a month (>12) — must be mm/dd (US-style export).
      month = g1
      day = g2
    } else if (g1 > 12 && g2 <= 12) {
      day = g1
      month = g2
    } else {
      // Both groups ≤ 12: genuinely ambiguous. Default to dd/mm (pt-BR).
      day = g1
      month = g2
      ambiguous = g1 !== g2
    }
    return { date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, ambiguous }
  }
  // yyyy-mm-dd
  const iso = s.match(/^(\d{4})[/\-.](\d{2})[/\-.](\d{2})/)
  if (iso) return { date: `${iso[1]}-${iso[2]}-${iso[3]}`, ambiguous: false }
  return { date: null, ambiguous: false }
}

function parseCsv(text: string, categories: Category[], dateFormat: DateFormatHint): ParseResult {
  const warnings: string[] = []
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) return { transactions: [], format: 'CSV', warnings: ['Arquivo CSV vazio ou sem dados.'] }

  const delim = detectDelimiter(lines[0])
  const headerIdx = findHeaderRowIndex(lines, delim)
  const headers = splitCsvLine(lines[headerIdx], delim)
  const dateCol = findColumn(headers, [/data/, /date/])
  const amountCol = findColumn(headers, [/valor/, /amount/, /montante/, /^r\$/])

  if (dateCol === -1 || amountCol === -1) {
    return {
      transactions: [],
      format: 'CSV',
      warnings: ['Não reconheci as colunas de data e valor. Verifique se o CSV tem um cabeçalho com "Data" e "Valor".']
    }
  }
  if (headerIdx > 0) {
    warnings.push(`Ignorei ${headerIdx} linha(s) de cabeçalho/metadado antes da tabela de lançamentos.`)
  }
  const descCol = findColumn(headers, [/descri/, /hist/, /title/, /lan[çc]/, /estabelec/, /memo/, /identific/])
  if (descCol === -1) warnings.push('Coluna de descrição não encontrada — usando um rótulo genérico.')

  const isNubankCard = detectsNubankCardCsv(headers)
  if (isNubankCard) warnings.push('Formato de cartão Nubank detectado — valores positivos foram tratados como gastos.')

  const transactions: ParsedStatementTx[] = []
  let zeroCount = 0
  let ambiguousDateCount = 0
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delim)
    const dateResult = normalizeCsvDate(cols[dateCol] ?? '', dateFormat)
    const amountResult = parseAmountDetailed(cols[amountCol] ?? '')
    if (!dateResult.date || isNaN(amountResult.value)) continue
    if (amountResult.value === 0) {
      zeroCount++
      continue
    }
    if (dateResult.ambiguous) ambiguousDateCount++
    const rawDescription = descCol >= 0 ? cols[descCol] || 'Lançamento' : 'Lançamento'
    const description = cleanDescription(rawDescription) || 'Lançamento'
    const type: 'income' | 'expense' = isNubankCard
      ? amountResult.value >= 0
        ? 'expense'
        : 'income'
      : amountResult.value >= 0
        ? 'income'
        : 'expense'
    transactions.push({
      date: dateResult.date,
      amount: Math.abs(amountResult.value),
      type,
      description,
      categoryId: guessCategory(description, type, categories),
      ambiguousAmount: amountResult.ambiguous
    })
  }
  if (zeroCount > 0) warnings.push(`${zeroCount} linha(s) com valor zero foram ignoradas.`)
  if (ambiguousDateCount > 0 && dateFormat === 'auto') {
    warnings.push(
      `Não deu para confirmar se ${ambiguousDateCount} data(s) são DD/MM ou MM/DD — assumi DD/MM. Use o seletor de formato de data se as datas parecerem erradas.`
    )
  }
  if (transactions.length === 0) warnings.push('Nenhuma linha válida encontrada no CSV.')
  return { transactions, format: 'CSV', warnings }
}

export function parseStatement(text: string, filename: string, categories: Category[], opts: ParseOptions = {}): ParseResult {
  const isOfx = /\.ofx$/i.test(filename) || /<OFX>|<STMTTRN>/i.test(text)
  return isOfx ? parseOfx(text, categories) : parseCsv(text, categories, opts.dateFormat ?? 'auto')
}
