import { writeFile } from 'node:fs/promises'
import { bytes } from './format.js'
import { tildify } from './safety.js'
import type { Finding } from './scan.js'
import { GROUP_LABELS, type Group } from './targets.js'

const GROUP_ORDER: Group[] = ['bulk', 'dev', 'xcode', 'system', 'advisory']

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )

/** Sudsy, the same soap bubble the CLI draws in ASCII, as inline SVG. */
const MASCOT = `<svg viewBox="0 0 100 104" width="148" height="154" aria-hidden="true">
  <defs>
    <radialGradient id="suds" cx="34%" cy="28%" r="78%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity=".95"/>
      <stop offset="38%" stop-color="#bfe9ff" stop-opacity=".85"/>
      <stop offset="72%" stop-color="#8ea8fb" stop-opacity=".9"/>
      <stop offset="100%" stop-color="#6a5df0" stop-opacity=".95"/>
    </radialGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff" stop-opacity=".9"/>
      <stop offset="50%" stop-color="#fff" stop-opacity=".15"/>
      <stop offset="100%" stop-color="#fff" stop-opacity=".7"/>
    </linearGradient>
  </defs>
  <ellipse cx="50" cy="97" rx="20" ry="4" fill="#6a5df0" opacity=".16"/>
  <circle cx="15" cy="20" r="5.5" fill="url(#suds)" opacity=".75"/>
  <circle cx="84" cy="20" r="4.5" fill="url(#suds)" opacity=".7"/>
  <ellipse cx="40" cy="88" rx="7.5" ry="5" fill="url(#suds)"/>
  <ellipse cx="60" cy="88" rx="7.5" ry="5" fill="url(#suds)"/>
  <ellipse cx="13" cy="62" rx="5" ry="7.4" fill="url(#suds)" transform="rotate(14 13 62)"/>
  <ellipse cx="87" cy="62" rx="5" ry="7.4" fill="url(#suds)" transform="rotate(-14 87 62)"/>
  <circle cx="50" cy="52" r="34" fill="url(#suds)"/>
  <circle cx="50" cy="52" r="33" fill="none" stroke="url(#rim)" stroke-width="2"/>
  <ellipse cx="35" cy="34" rx="11" ry="7" fill="#fff" opacity=".7" transform="rotate(-32 35 34)"/>
  <ellipse cx="40" cy="52" rx="4" ry="4.4" fill="#2b2d5c"/>
  <ellipse cx="60" cy="52" rx="4" ry="4.4" fill="#2b2d5c"/>
  <circle cx="41.4" cy="50.4" r="1.4" fill="#fff"/>
  <circle cx="61.4" cy="50.4" r="1.4" fill="#fff"/>
  <ellipse cx="30" cy="59" rx="4.2" ry="3" fill="#7fd0f7" opacity=".55"/>
  <ellipse cx="70" cy="59" rx="4.2" ry="3" fill="#7fd0f7" opacity=".55"/>
  <path d="M44 60q6 5 12 0" fill="none" stroke="#2b2d5c" stroke-width="2.4" stroke-linecap="round"/>
</svg>`

function findingRow(finding: Finding): string {
  const paths = finding.entries
    .slice()
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 12)
    .map((entry) => `<li><code>${escape(tildify(entry.path))}</code><span>${bytes(entry.bytes)}</span></li>`)
    .join('')
  const more =
    finding.entries.length > 12
      ? `<li class="more">+ ${finding.entries.length - 12} more</li>`
      : ''

  return `<details class="finding${finding.group === 'advisory' ? ' advisory' : ''}">
    <summary>
      <span class="label">${escape(finding.label)}</span>
      <span class="size">${bytes(finding.bytes)}</span>
      <span class="note">${escape(finding.recovery)}</span>
    </summary>
    ${finding.advice ? `<p class="advice">Run yourself: <code>${escape(finding.advice)}</code></p>` : ''}
    <ul class="paths">${paths}${more}</ul>
  </details>`
}

/**
 * Renders a scan as a single self-contained HTML page: no scripts, no external
 * assets, safe to hand to someone else or keep as a before/after record.
 */
export function renderHtmlReport(findings: Finding[], scannedAt = new Date()): string {
  const reclaimable = findings
    .filter((finding) => finding.group !== 'advisory')
    .reduce((sum, finding) => sum + finding.bytes, 0)
  const advisory = findings
    .filter((finding) => finding.group === 'advisory')
    .reduce((sum, finding) => sum + finding.bytes, 0)

  const sections = GROUP_ORDER.map((group) => {
    const inGroup = findings.filter((finding) => finding.group === group)
    if (inGroup.length === 0) return ''
    const rows = inGroup
      .slice()
      .sort((a, b) => b.bytes - a.bytes)
      .map(findingRow)
      .join('')
    return `<section><h2>${escape(GROUP_LABELS[group])}</h2>${rows}</section>`
  }).join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CleanKit report — ${bytes(reclaimable)} reclaimable</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #f6f7fb; --panel: #fff; --border: #e3e6ef; --text: #1a1d29;
    --muted: #6b7189; --accent: #5b5bd6; --warn: #c2410c;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0f1117; --panel: #171a23; --border: #262b38; --text: #e8eaf2;
            --muted: #9aa1b8; --accent: #8b8bf5; --warn: #fb923c; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px 20px 56px; background: var(--bg); color: var(--text);
         font: 15px/1.55 ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .wrap { max-width: 880px; margin: 0 auto; }
  header { display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
           padding: 20px 24px; border: 1px solid var(--border); border-radius: 18px;
           background: var(--panel); margin-bottom: 24px; }
  h1 { margin: 0; font-size: 22px; letter-spacing: -0.02em; }
  .totals { margin: 6px 0 0; color: var(--muted); font-size: 14px; }
  .totals strong { color: var(--accent); font-size: 17px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em;
       color: var(--muted); margin: 28px 0 8px; }
  .finding { border: 1px solid var(--border); border-radius: 12px; background: var(--panel);
             margin-bottom: 8px; padding: 12px 14px; }
  .finding.advisory { border-style: dashed; }
  summary { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; cursor: pointer; }
  .label { font-weight: 600; }
  .size { font-variant-numeric: tabular-nums; color: var(--accent); font-weight: 600; }
  .note { grid-column: 1 / -1; color: var(--muted); font-size: 13px; }
  .advice { margin: 10px 0 0; font-size: 13px; color: var(--warn); }
  code { font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
  .paths { list-style: none; margin: 10px 0 0; padding: 0; }
  .paths li { display: flex; justify-content: space-between; gap: 16px; padding: 4px 0;
              border-top: 1px solid var(--border); color: var(--muted); }
  .paths span { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .more { justify-content: flex-start; font-style: italic; }
  footer { margin-top: 28px; color: var(--muted); font-size: 12px; text-align: center; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    ${MASCOT}
    <div>
      <h1>CleanKit report</h1>
      <p class="totals"><strong>${bytes(reclaimable)}</strong> reclaimable automatically${
        advisory > 0 ? ` · ${bytes(advisory)} more needs your judgement` : ''
      }</p>
      <p class="totals">Scanned ${escape(scannedAt.toLocaleString())}</p>
    </div>
  </header>
  ${sections}
  <footer>Generated by CleanKit — a snapshot of the scan, taken before anything was removed.</footer>
</div>
</body>
</html>
`
}

export async function writeHtmlReport(file: string, findings: Finding[]): Promise<void> {
  await writeFile(file, renderHtmlReport(findings), 'utf8')
}
