import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** Process-name fragments that mean an editor is holding its extensions open. */
const EDITOR_PROCESSES: { match: string; name: string }[] = [
  { match: 'Visual Studio Code.app', name: 'VS Code' },
  { match: 'Code - Insiders.app', name: 'VS Code Insiders' },
  { match: 'Cursor.app', name: 'Cursor' },
  { match: 'Windsurf.app', name: 'Windsurf' },
  { match: 'VSCodium.app', name: 'VSCodium' },
]

/**
 * Editors that appear to be running right now.
 *
 * Removing an extension directory out from under a live editor leaves its
 * extension host confused until the next restart — recoverable, but alarming
 * enough to be worth a warning first. A failure to enumerate processes returns
 * an empty list: this is advice, not a guard, and must never block a run.
 */
export async function runningEditors(): Promise<string[]> {
  let output: string
  try {
    const result = await run('ps', ['-axco', 'command='], { maxBuffer: 4 * 1024 * 1024 })
    output = result.stdout
  } catch {
    try {
      const result = await run('ps', ['-ax'], { maxBuffer: 8 * 1024 * 1024 })
      output = result.stdout
    } catch {
      return []
    }
  }

  const found = new Set<string>()
  for (const { match, name } of EDITOR_PROCESSES) {
    // `ps -axco command=` prints just the executable name ("Code", "Cursor"),
    // so match on that as well as the full bundle path from the fallback.
    const executable = match.replace(/\.app$/, '')
    if (output.includes(match) || output.includes(executable)) found.add(name)
  }
  return [...found]
}
