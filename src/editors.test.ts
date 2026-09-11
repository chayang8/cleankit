import { describe, expect, it } from 'vitest'
import { runningEditors } from './editors.js'

describe('runningEditors', () => {
  it('returns a list of names without throwing, whatever ps reports', async () => {
    const editors = await runningEditors()
    expect(Array.isArray(editors)).toBe(true)
    expect(editors.every((name) => typeof name === 'string')).toBe(true)
  })

  it('never reports the same editor twice', async () => {
    const editors = await runningEditors()
    expect(new Set(editors).size).toBe(editors.length)
  })
})
