/**
 * Pure text-cleaning operations.
 *
 * Every operation is a pure `(input: string) => string` function so it can be
 * unit-tested in isolation and composed in any order. Adding a new tool means
 * adding one entry to `OPERATIONS` — nothing else in the app needs to change.
 */

export type OperationId =
  | 'trimLines'
  | 'collapseWhitespace'
  | 'removeEmptyLines'
  | 'removeZeroWidth'
  | 'normalizeQuotes'
  | 'normalizeDashes'
  | 'normalizeUnicode'
  | 'stripHtml'
  | 'removeAccents'
  | 'dedupeLines'
  | 'sortLines'
  | 'lowercase'
  | 'uppercase'
  | 'titleCase'
  | 'slugify'
  | 'formatJson'
  | 'minifyJson'
  | 'csvToJson'

export interface Operation {
  id: OperationId
  label: string
  description: string
  group: 'Whitespace' | 'Characters' | 'Lines' | 'Case' | 'Format'
  run: (input: string) => string
}

/** Invisible characters that get pasted in from Word, PDFs and LLM output. */
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g

const SMART_QUOTES: Record<string, string> = {
  '‘': "'",
  '’': "'",
  '‚': "'",
  '‛': "'",
  '“': '"',
  '”': '"',
  '„': '"',
  '‟': '"',
  '‹': "'",
  '›': "'",
  '«': '"',
  '»': '"',
}

const trimLines = (s: string) =>
  s
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, '').replace(/^[ \t]+/g, ''))
    .join('\n')

const collapseWhitespace = (s: string) =>
  s
    .split('\n')
    .map((line) => line.replace(/[ \t\u00A0]+/g, ' ').trim())
    .join('\n')

const removeEmptyLines = (s: string) =>
  s
    .split('\n')
    .filter((line) => line.trim() !== '')
    .join('\n')

const removeZeroWidth = (s: string) => s.replace(ZERO_WIDTH, '')

const normalizeQuotes = (s: string) =>
  s.replace(/[‘’‚‛“”„‟‹›«»]/g, (c) => SMART_QUOTES[c] ?? c)

const normalizeDashes = (s: string) => s.replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\u2026/g, '...')

/** NFC keeps text visually identical while making equal-looking strings compare equal. */
const normalizeUnicode = (s: string) => s.normalize('NFC')

const stripHtml = (s: string) =>
  s
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")

const removeAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const dedupeLines = (s: string) => {
  const seen = new Set<string>()
  return s
    .split('\n')
    .filter((line) => {
      const key = line.trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .join('\n')
}

const sortLines = (s: string) => s.split('\n').sort((a, b) => a.localeCompare(b)).join('\n')

const lowercase = (s: string) => s.toLowerCase()
const uppercase = (s: string) => s.toUpperCase()

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s"'(\[{])(\p{L})/gu, (_m, lead: string, ch: string) => lead + ch.toUpperCase())

const slugify = (s: string) =>
  removeAccents(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

const formatJson = (s: string) => JSON.stringify(JSON.parse(s), null, 2)
const minifyJson = (s: string) => JSON.stringify(JSON.parse(s))

/** Minimal RFC4180-ish parser: handles quoted fields, escaped quotes and embedded newlines. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      // Swallow the \n of a \r\n pair.
      if (char === '\r' && input[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

const csvToJson = (s: string) => {
  const rows = parseCsv(s)
  if (rows.length === 0) return '[]'
  const [header, ...body] = rows
  const records = body.map((cells) =>
    Object.fromEntries(header.map((key, i) => [key.trim() || `column_${i + 1}`, cells[i] ?? ''])),
  )
  return JSON.stringify(records, null, 2)
}

export const OPERATIONS: Operation[] = [
  {
    id: 'trimLines',
    label: 'Trim lines',
    description: 'Remove leading and trailing spaces on every line.',
    group: 'Whitespace',
    run: trimLines,
  },
  {
    id: 'collapseWhitespace',
    label: 'Collapse whitespace',
    description: 'Squash runs of spaces, tabs and non-breaking spaces into one space.',
    group: 'Whitespace',
    run: collapseWhitespace,
  },
  {
    id: 'removeEmptyLines',
    label: 'Remove empty lines',
    description: 'Drop lines that contain nothing but whitespace.',
    group: 'Whitespace',
    run: removeEmptyLines,
  },
  {
    id: 'removeZeroWidth',
    label: 'Remove invisible characters',
    description: 'Strip zero-width spaces, joiners, BOM and soft hyphens.',
    group: 'Characters',
    run: removeZeroWidth,
  },
  {
    id: 'normalizeQuotes',
    label: 'Straighten quotes',
    description: 'Convert curly quotes and guillemets to plain " and \'.',
    group: 'Characters',
    run: normalizeQuotes,
  },
  {
    id: 'normalizeDashes',
    label: 'Normalize dashes',
    description: 'Convert en/em dashes to - and ellipsis to three dots.',
    group: 'Characters',
    run: normalizeDashes,
  },
  {
    id: 'normalizeUnicode',
    label: 'Normalize Unicode (NFC)',
    description: 'Make visually identical text compare equal.',
    group: 'Characters',
    run: normalizeUnicode,
  },
  {
    id: 'removeAccents',
    label: 'Remove accents',
    description: 'Café becomes Cafe.',
    group: 'Characters',
    run: removeAccents,
  },
  {
    id: 'stripHtml',
    label: 'Strip HTML',
    description: 'Remove tags and decode common entities.',
    group: 'Characters',
    run: stripHtml,
  },
  {
    id: 'dedupeLines',
    label: 'Remove duplicate lines',
    description: 'Keep the first occurrence of each line.',
    group: 'Lines',
    run: dedupeLines,
  },
  {
    id: 'sortLines',
    label: 'Sort lines',
    description: 'Sort alphabetically, locale-aware.',
    group: 'Lines',
    run: sortLines,
  },
  { id: 'lowercase', label: 'lowercase', description: 'Everything lower case.', group: 'Case', run: lowercase },
  { id: 'uppercase', label: 'UPPERCASE', description: 'Everything upper case.', group: 'Case', run: uppercase },
  { id: 'titleCase', label: 'Title Case', description: 'Capitalize the first letter of each word.', group: 'Case', run: titleCase },
  { id: 'slugify', label: 'Slugify', description: 'URL-safe kebab-case slug.', group: 'Case', run: slugify },
  { id: 'formatJson', label: 'Format JSON', description: 'Pretty-print JSON with 2-space indent.', group: 'Format', run: formatJson },
  { id: 'minifyJson', label: 'Minify JSON', description: 'Collapse JSON to a single line.', group: 'Format', run: minifyJson },
  { id: 'csvToJson', label: 'CSV to JSON', description: 'Turn the first row into keys and emit JSON records.', group: 'Format', run: csvToJson },
]

export const OPERATIONS_BY_ID = new Map(OPERATIONS.map((op) => [op.id, op]))

export interface CleanResult {
  output: string
  error: string | null
}

/**
 * Run the selected operations in the order the user picked them. If one throws
 * (bad JSON, for example) the pipeline stops and reports which step failed —
 * the text produced up to that point is still returned.
 */
export function runPipeline(input: string, ids: OperationId[]): CleanResult {
  let output = input
  for (const id of ids) {
    const op = OPERATIONS_BY_ID.get(id)
    if (!op) continue
    try {
      output = op.run(output)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { output, error: `${op.label}: ${message}` }
    }
  }
  return { output, error: null }
}

export interface TextStats {
  characters: number
  words: number
  lines: number
}

export function stats(text: string): TextStats {
  const trimmed = text.trim()
  return {
    characters: text.length,
    words: trimmed === '' ? 0 : trimmed.split(/\s+/).length,
    lines: text === '' ? 0 : text.split('\n').length,
  }
}
