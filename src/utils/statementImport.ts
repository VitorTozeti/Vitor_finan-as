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
}

export interface ParseResult {
  transactions: ParsedStatementTx[]
  format: 'OFX' | 'CSV'
  warnings: string[]
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

function guessCategory(description: string, type: 'income' | 'expense', categories: Category[]): string {
  if (type === 'income') return categories.find(c => c.id === 'outros')?.id ?? categories[0]?.id ?? 'outros'
  const lower = description.toLowerCase()
  for (const rule of CATEGORY_KEYWORDS) {
    if (categories.some(c => c.id === rule.id) && rule.words.some(w => lower.includes(w))) return rule.id
  }
  return categories.find(c => c.id === 'outros')?.id ?? categories[0]?.id ?? 'outros'
}

/** Parses a pt-BR / en number that may look like "1.234,56", "-50,00" or "12.5". */
export function parseAmount(raw: string): number {
  let s = raw.replace(/[^0-9.,-]/g, '').trim()
  if (!s) return NaN
  const neg = s.startsWith('-') || /\(.*\)/.test(raw)
  s = s.replace(/-/g, '')
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    // Assume '.' thousands, ',' decimal (pt-BR)
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    s = s.replace(',', '.')
  }
  const value = parseFloat(s)
  if (isNaN(value)) return NaN
  return neg ? -value : value
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
    const amount = amountRaw ? parseAmount(amountRaw) : NaN
    const date = parseOfxDate(dateRaw)
    if (isNaN(amount) || !date) continue
    const type: 'income' | 'expense' = amount >= 0 ? 'income' : 'expense'
    transactions.push({
      date,
      amount: Math.abs(amount),
      type,
      description: decodeEntities(memo),
      categoryId: guessCategory(memo, type, categories),
      fitid
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

function normalizeCsvDate(raw: string): string | null {
  const s = raw.trim()
  // dd/mm/yyyy or dd-mm-yyyy
  let m = s.match(/^(\d{2})[/\-.](\d{2})[/\-.](\d{2,4})/)
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${year}-${m[2]}-${m[1]}`
  }
  // yyyy-mm-dd
  m = s.match(/^(\d{4})[/\-.](\d{2})[/\-.](\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

function parseCsv(text: string, categories: Category[]): ParseResult {
  const warnings: string[] = []
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) return { transactions: [], format: 'CSV', warnings: ['Arquivo CSV vazio ou sem dados.'] }

  const delim = detectDelimiter(lines[0])
  const headers = splitCsvLine(lines[0], delim)
  const dateCol = findColumn(headers, [/data/, /date/])
  const amountCol = findColumn(headers, [/valor/, /amount/, /montante/, /^r\$/])
  const descCol = findColumn(headers, [/descri/, /hist/, /title/, /lan[çc]/, /estabelec/, /memo/, /identific/])

  if (dateCol === -1 || amountCol === -1) {
    return {
      transactions: [],
      format: 'CSV',
      warnings: ['Não reconheci as colunas de data e valor. Verifique se o CSV tem um cabeçalho com "Data" e "Valor".']
    }
  }
  if (descCol === -1) warnings.push('Coluna de descrição não encontrada — usando um rótulo genérico.')

  const transactions: ParsedStatementTx[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delim)
    const date = normalizeCsvDate(cols[dateCol] ?? '')
    const amount = parseAmount(cols[amountCol] ?? '')
    if (!date || isNaN(amount) || amount === 0) continue
    const description = descCol >= 0 ? cols[descCol] || 'Lançamento' : 'Lançamento'
    const type: 'income' | 'expense' = amount >= 0 ? 'income' : 'expense'
    transactions.push({
      date,
      amount: Math.abs(amount),
      type,
      description,
      categoryId: guessCategory(description, type, categories)
    })
  }
  if (transactions.length === 0) warnings.push('Nenhuma linha válida encontrada no CSV.')
  return { transactions, format: 'CSV', warnings }
}

export function parseStatement(text: string, filename: string, categories: Category[]): ParseResult {
  const isOfx = /\.ofx$/i.test(filename) || /<OFX>|<STMTTRN>/i.test(text)
  return isOfx ? parseOfx(text, categories) : parseCsv(text, categories)
}
