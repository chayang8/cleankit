import { describe, expect, it } from 'vitest'
import { renderHtmlReport } from './report.js'
import type { Finding } from './scan.js'

const finding = (overrides: Partial<Finding>): Finding => ({
  targetId: 'npm',
  group: 'dev',
  label: 'npm cache',
  recovery: 'refetched on next install',
  entries: [{ path: '/tmp/x', bytes: 1024 * 1024 }],
  bytes: 1024 * 1024,
  ...overrides,
})

describe('renderHtmlReport', () => {
  it('totals only what CleanKit would delete, and counts advisories apart', () => {
    const html = renderHtmlReport([
      finding({ bytes: 2 * 1024 * 1024 * 1024 }),
      finding({ group: 'advisory', targetId: 'ollama-models', bytes: 9 * 1024 * 1024 * 1024 }),
    ])
    expect(html).toContain('<strong>2.0 GB</strong> reclaimable')
    expect(html).toContain('9.0 GB more needs your judgement')
  })

  it('prints the manual command for advisory findings', () => {
    const html = renderHtmlReport([finding({ group: 'advisory', advice: 'ollama rm <model>' })])
    expect(html).toContain('ollama rm &lt;model&gt;')
  })

  it('escapes paths and labels', () => {
    const html = renderHtmlReport([
      finding({ label: '<script>alert(1)</script>', entries: [{ path: '/tmp/a&b', bytes: 1 }] }),
    ])
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('/tmp/a&amp;b')
  })

  it('is a standalone page with no external references', () => {
    const html = renderHtmlReport([finding({})])
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).not.toMatch(/<script|https?:\/\//)
  })
})
