import { useCallback, useEffect, useMemo, useState } from 'react'
import { Mascot } from './components/Mascot'
import { OPERATIONS, OPERATIONS_BY_ID, runPipeline, stats, type Operation, type OperationId } from './lib/clean'

const SAMPLE = `  Hello   “world” —  this   is  CleanKit.​
  Hello   “world” —  this   is  CleanKit.​

<p>Pasted&nbsp;from a website</p>
Café  crème`

const STORAGE_KEY = 'cleankit:pipeline'

const GROUPS = ['Whitespace', 'Characters', 'Lines', 'Case', 'Format'] as const

function loadPipeline(): OperationId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return ['trimLines', 'collapseWhitespace', 'removeZeroWidth', 'normalizeQuotes']
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is OperationId => typeof id === 'string' && OPERATIONS_BY_ID.has(id as OperationId))
  } catch {
    return []
  }
}

export default function App() {
  const [input, setInput] = useState(SAMPLE)
  const [pipeline, setPipeline] = useState<OperationId[]>(loadPipeline)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pipeline))
  }, [pipeline])

  const result = useMemo(() => runPipeline(input, pipeline), [input, pipeline])
  const before = useMemo(() => stats(input), [input])
  const after = useMemo(() => stats(result.output), [result.output])

  const toggle = useCallback((id: OperationId) => {
    setPipeline((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))
  }, [])

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(result.output)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }, [result.output])

  const download = useCallback(() => {
    const blob = new Blob([result.output], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'cleaned.txt'
    link.click()
    URL.revokeObjectURL(url)
  }, [result.output])

  const grouped = useMemo(() => {
    const map = new Map<Operation['group'], Operation[]>()
    for (const group of GROUPS) map.set(group, [])
    for (const op of OPERATIONS) map.get(op.group)!.push(op)
    return map
  }, [])

  return (
    <>
      <Mascot />

      <header className="header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">🥟</span>
          <div>
            <h1>CleanKit</h1>
            <p className="tagline">Messy text in, clean text out. Nothing ever leaves your browser.</p>
          </div>
        </div>
        <a className="ghost-button" href="https://github.com/OWNER/cleankit" target="_blank" rel="noreferrer">
          Star on GitHub
        </a>
      </header>

      <main className="layout">
        <section className="panel" aria-labelledby="tools-heading">
          <div className="panel-head">
            <h2 id="tools-heading">Tools</h2>
            <button className="link-button" onClick={() => setPipeline([])} disabled={pipeline.length === 0}>
              Clear all
            </button>
          </div>
          <p className="hint">
            Steps run top to bottom in the order you switch them on
            {pipeline.length > 0 ? ` (${pipeline.length} active).` : '.'}
          </p>

          {GROUPS.map((group) => (
            <fieldset key={group} className="group">
              <legend>{group}</legend>
              {grouped.get(group)!.map((op) => {
                const index = pipeline.indexOf(op.id)
                return (
                  <label key={op.id} className={`tool ${index >= 0 ? 'is-active' : ''}`} title={op.description}>
                    <input type="checkbox" checked={index >= 0} onChange={() => toggle(op.id)} />
                    <span className="tool-label">{op.label}</span>
                    {index >= 0 && <span className="tool-order">{index + 1}</span>}
                  </label>
                )
              })}
            </fieldset>
          ))}
        </section>

        <section className="panel editor" aria-labelledby="input-heading">
          <div className="panel-head">
            <h2 id="input-heading">Input</h2>
            <div className="actions">
              <button className="link-button" onClick={() => setInput(SAMPLE)}>Sample</button>
              <button className="link-button" onClick={() => setInput('')} disabled={input === ''}>Clear</button>
            </div>
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            spellCheck={false}
            placeholder="Paste your messy text here…"
            aria-label="Input text"
          />
          <p className="stats">
            {before.characters} chars · {before.words} words · {before.lines} lines
          </p>
        </section>

        <section className="panel editor" aria-labelledby="output-heading">
          <div className="panel-head">
            <h2 id="output-heading">Output</h2>
            <div className="actions">
              <button className="link-button" onClick={copy} disabled={result.output === ''}>
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button className="link-button" onClick={download} disabled={result.output === ''}>Download</button>
            </div>
          </div>
          <textarea value={result.output} readOnly spellCheck={false} aria-label="Cleaned output" />
          <p className={`stats ${result.error ? 'is-error' : ''}`} role={result.error ? 'alert' : undefined}>
            {result.error
              ? result.error
              : `${after.characters} chars · ${after.words} words · ${after.lines} lines · ${
                  before.characters - after.characters
                } removed`}
          </p>
        </section>
      </main>

      <footer className="footer">
        <span>MIT licensed · 100% client-side · no tracking, no uploads</span>
        <a href="https://github.com/OWNER/cleankit/blob/main/CONTRIBUTING.md" target="_blank" rel="noreferrer">
          Contribute a tool
        </a>
      </footer>
    </>
  )
}
