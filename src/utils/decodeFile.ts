export type TextEncodingChoice = 'auto' | 'utf-8' | 'windows-1252'

/** Decodes a File's bytes as text, preferring UTF-8 but falling back to
 * Windows-1252 (a practical superset of ISO-8859-1/Latin-1) when the bytes
 * aren't valid UTF-8. Many Brazilian bank exports (older Itaú, Bradesco,
 * Banco do Brasil, Caixa, or any CSV saved by Excel) use Latin-1/Windows-1252
 * — reading those as UTF-8 doesn't throw, it just silently mangles accented
 * characters, so we sniff first with a `fatal` decoder instead of guessing
 * from the extension. */
export async function decodeFileText(file: File, choice: TextEncodingChoice = 'auto'): Promise<string> {
  const buffer = await file.arrayBuffer()
  if (choice === 'utf-8') return new TextDecoder('utf-8').decode(buffer)
  if (choice === 'windows-1252') return new TextDecoder('windows-1252').decode(buffer)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('windows-1252').decode(buffer)
  }
}
