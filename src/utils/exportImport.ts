import { AppState, Transaction } from '../types'

export function exportAsJson(state: AppState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `greenfinance-backup-${new Date().toISOString().slice(0, 10)}.json`)
}

export function exportTransactionsAsCsv(transactions: Transaction[]) {
  const header = ['Data', 'Tipo', 'Valor', 'Descrição', 'Categoria', 'Forma de pagamento', 'Observação']
  const rows = transactions.map(t => [
    t.date,
    t.type === 'expense' ? 'Gasto' : 'Entrada',
    t.amount.toFixed(2),
    t.description,
    t.categoryId,
    t.paymentMethod ?? '',
    t.note ?? ''
  ])
  const csv = [header, ...rows].map(r => r.map(escapeCsv).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `greenfinance-transacoes-${new Date().toISOString().slice(0, 10)}.csv`)
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function parseImportedJson(text: string): AppState | null {
  try {
    const data = JSON.parse(text)
    if (data && typeof data === 'object' && Array.isArray(data.transactions) && data.settings) {
      return data as AppState
    }
    return null
  } catch {
    return null
  }
}
