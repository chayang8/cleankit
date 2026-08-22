import { describe, expect, it } from 'vitest'
import { OPERATIONS_BY_ID, parseCsv, runPipeline, stats } from './clean'

const run = (id: Parameters<typeof runPipeline>[1][number], input: string) =>
  OPERATIONS_BY_ID.get(id)!.run(input)

describe('whitespace', () => {
  it('trims each line', () => {
    expect(run('trimLines', '  a  \n\t b\t')).toBe('a\nb')
  })

  it('collapses runs of spaces, tabs and nbsp', () => {
    expect(run('collapseWhitespace', 'a \t   b')).toBe('a b')
  })

  it('removes whitespace-only lines', () => {
    expect(run('removeEmptyLines', 'a\n\n  \nb')).toBe('a\nb')
  })
})

describe('characters', () => {
  it('removes zero-width characters and BOM', () => {
    expect(run('removeZeroWidth', 'a​b﻿c­d')).toBe('abcd')
  })

  it('straightens curly quotes', () => {
    expect(run('normalizeQuotes', '“hi” ‘there’')).toBe('"hi" \'there\'')
  })

  it('normalizes dashes and ellipsis', () => {
    expect(run('normalizeDashes', 'a—b…')).toBe('a-b...')
  })

  it('strips tags and decodes entities', () => {
    expect(run('stripHtml', '<p>a&nbsp;&amp;&nbsp;b</p>')).toBe('a & b')
  })

  it('removes accents', () => {
    expect(run('removeAccents', 'Café crème')).toBe('Cafe creme')
  })
})

describe('lines', () => {
  it('dedupes ignoring surrounding whitespace', () => {
    expect(run('dedupeLines', 'a\n a \nb\na')).toBe('a\nb')
  })

  it('sorts lines', () => {
    expect(run('sortLines', 'c\na\nb')).toBe('a\nb\nc')
  })
})

describe('case', () => {
  it('title-cases words after quotes and brackets', () => {
    expect(run('titleCase', 'hello "wide" (world)')).toBe('Hello "Wide" (World)')
  })

  it('slugifies', () => {
    expect(run('slugify', '  Café & Crème— Deluxe!  ')).toBe('cafe-creme-deluxe')
  })
})

describe('format', () => {
  it('formats and minifies JSON', () => {
    expect(run('formatJson', '{"a":1}')).toBe('{\n  "a": 1\n}')
    expect(run('minifyJson', '{\n  "a": 1\n}')).toBe('{"a":1}')
  })

  it('converts CSV with quoted fields to JSON', () => {
    const csv = 'name,note\n"Ada","says ""hi"", loudly"\n'
    expect(JSON.parse(run('csvToJson', csv))).toEqual([{ name: 'Ada', note: 'says "hi", loudly' }])
  })

  it('parses embedded newlines inside quotes', () => {
    expect(parseCsv('a,b\n"line1\nline2",2')).toEqual([
      ['a', 'b'],
      ['line1\nline2', '2'],
    ])
  })
})

describe('runPipeline', () => {
  it('applies operations in order', () => {
    const result = runPipeline('  B  \n  a  \n  a  ', ['trimLines', 'dedupeLines', 'sortLines'])
    expect(result).toEqual({ output: 'a\nB', error: null })
  })

  it('reports which step failed and keeps partial output', () => {
    const result = runPipeline('  not json  ', ['trimLines', 'formatJson', 'uppercase'])
    expect(result.output).toBe('not json')
    expect(result.error).toMatch(/^Format JSON: /)
  })

  it('is a no-op with no operations selected', () => {
    expect(runPipeline('x', [])).toEqual({ output: 'x', error: null })
  })
})

describe('stats', () => {
  it('counts characters, words and lines', () => {
    expect(stats('one two\nthree')).toEqual({ characters: 13, words: 3, lines: 2 })
  })

  it('reports zero for empty input', () => {
    expect(stats('')).toEqual({ characters: 0, words: 0, lines: 0 })
  })
})
