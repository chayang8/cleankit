import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { parseConfigText } from './config.js'
import { HOME } from './safety.js'

const parse = (value: unknown) => parseConfigText(JSON.stringify(value), '/cfg.json')

describe('parseConfigText', () => {
  it('accepts a target, expands ~ and defaults the mode to contents', () => {
    const result = parse({
      targets: [{ id: 'sbt', label: 'sbt cache', group: 'dev', recovery: 'refetched', paths: ['~/.sbt'] }],
    })
    expect(result.warnings).toEqual([])
    expect(result.targets).toHaveLength(1)
    expect(result.targets[0].mode).toBe('contents')
    expect(result.targets[0].paths).toEqual([path.join(HOME, '.sbt')])
  })

  it('resolves relative paths so they cannot mean the current directory', () => {
    const result = parse({ targets: [{ id: 'x', label: 'x', group: 'dev', paths: ['rel/dir'] }] })
    expect(path.isAbsolute(result.targets[0].paths[0])).toBe(true)
  })

  it('reports invalid JSON instead of throwing', () => {
    const result = parseConfigText('{ nope', '/cfg.json')
    expect(result.targets).toEqual([])
    expect(result.warnings[0]).toContain('invalid JSON')
  })

  it('rejects a file without a targets array', () => {
    expect(parse({ target: [] }).warnings[0]).toContain('expected { "targets": [...] }')
  })

  it('names the offending entry and keeps the valid ones', () => {
    const result = parse({
      targets: [
        { id: 'good', label: 'good', group: 'dev', paths: ['~/x'] },
        { id: 'bad', label: 'bad', group: 'nonsense', paths: ['~/y'] },
      ],
    })
    expect(result.targets.map((target) => target.id)).toEqual(['good'])
    expect(result.warnings[0]).toContain('targets[1] (bad) group must be one of')
  })

  it('refuses advisory targets — those are built in and never deleted', () => {
    const result = parse({ targets: [{ id: 'a', label: 'a', group: 'advisory', paths: ['~/x'] }] })
    expect(result.targets).toEqual([])
    expect(result.warnings[0]).toContain('cannot be advisory')
  })

  it('requires a non-empty string path array', () => {
    expect(parse({ targets: [{ id: 'a', label: 'a', group: 'dev', paths: [] }] }).warnings[0]).toContain(
      'non-empty array of string paths',
    )
    expect(parse({ targets: [{ id: 'a', label: 'a', group: 'dev', paths: [7] }] }).warnings[0]).toContain(
      'non-empty array of string paths',
    )
  })

  it('rejects a bad mode', () => {
    const result = parse({ targets: [{ id: 'a', label: 'a', group: 'dev', mode: 'nuke', paths: ['~/x'] }] })
    expect(result.warnings[0]).toContain('mode must be self or contents')
  })
})
