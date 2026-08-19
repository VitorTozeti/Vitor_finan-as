// Extracts text from a PDF file entirely in the browser using pdf.js — no
// server, no upload. Bank statement PDFs lose their column layout when text is
// pulled out, so we reconstruct visual lines by grouping text items that share
// (approximately) the same vertical position and ordering them left-to-right.
// The resulting line strings feed parseStatementLines() in statementImport.ts.

import * as pdfjsLib from 'pdfjs-dist'
// Vite resolves this to a hashed URL for the worker bundle.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

interface TextItemLike {
  str: string
  transform: number[]
}

/** Returns the statement as an array of reconstructed text lines, in reading
 * order across all pages. */
export async function extractPdfLines(file: File): Promise<string[]> {
  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const lines: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    // Bucket text items by their (rounded) y position so items on the same
    // visual row group together. Rounding to a 2px grid absorbs sub-pixel
    // baseline jitter without merging distinct rows.
    const rows = new Map<number, { x: number; str: string }[]>()
    for (const raw of content.items as unknown[]) {
      const item = raw as TextItemLike
      if (!item.str || !item.transform) continue
      const x = item.transform[4]
      const y = Math.round(item.transform[5] / 2) * 2
      if (!rows.has(y)) rows.set(y, [])
      rows.get(y)!.push({ x, str: item.str })
    }

    // Top-to-bottom (larger y is higher on the page), left-to-right within a row.
    const ys = [...rows.keys()].sort((a, b) => b - a)
    for (const y of ys) {
      const parts = rows.get(y)!.sort((a, b) => a.x - b.x)
      const line = parts
        .map(p => p.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (line) lines.push(line)
    }
  }

  await pdf.destroy()
  return lines
}
