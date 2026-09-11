# CleanKit 🫧

**Find out what is eating your disk, then get it back.** CleanKit scans the caches, duplicate installs and dead build artifacts that pile up on a developer Mac, shows exactly what it would delete, and only deletes after you say so.

Sudsy, the soap bubble, supervises.

```
  o   .-~~~~~-.   °
    /` .     . `\
  ~|    ^    ^   |~    < sniffing around...
   |  `  \___/  `|
    \  `     `  /
     `-.,___,.-`
     ~  "  "  "  ~

Duplicate installs
  Superseded editor extensions       11 GB  43 items  the newest version of each extension is kept
  Old gvm package sets                14 GB   7 items  rebuilt by go get

Big, but your call
  Ollama models                       15 GB   1 item  re-pulled with ollama pull
    run yourself: ollama list, then: ollama rm <model>

  Total reclaimable 29 GB
```

## Install

From npm:

```bash
npm install -g @chayang8/cleankit
cleankit
```

From source:

```bash
git clone https://github.com/chayang8/cleankit.git
cd cleankit
npm install
npm run build
npm link          # optional: puts `cleankit` on your PATH
```

Node 20+. No runtime dependencies.

## Use

```bash
cleankit                       # scan and report. Deletes nothing.
cleankit scan --html=out.html  # same, plus a shareable HTML report
cleankit clean                 # show the plan, ask, then delete
cleankit clean --dry-run       # run every safety check, delete nothing
cleankit clean --only=dev,bulk # limit to some groups
```

| Option | Meaning |
| --- | --- |
| `--only=a,b` | Groups: `dev`, `xcode`, `system`, `bulk`, `advisory` |
| `--stale-days=N` | How long a project must be idle before its `node_modules` counts as stale (default 90) |
| `--root=a,b` | Where to hunt for `node_modules`, `.DS_Store` and cold projects (default `~/Developer`, `~/Projects`, `~/src`) |
| `--html=FILE` | Write a self-contained HTML report |
| `--dry-run` | With `clean`: every guard runs, nothing is unlinked |
| `-y, --yes` | Skip the confirmation prompt |
| `--no-mascot` | No Sudsy |

## What it looks at

**Deleted automatically (after confirmation)**

- **Dev caches** — npm, pnpm, yarn, bun, Homebrew, pip, cargo, Gradle
- **Duplicate installs** — superseded VS Code / Cursor / Windsurf extension versions (editors are supposed to prune these and often don't), old gvm package sets
- **Xcode junk** — DerivedData, archives, iOS DeviceSupport, simulator caches
- **Stale `node_modules`** — only in projects with no git or manifest activity for 90+ days
- **Trash, user logs, `.DS_Store`**

**Reported only, never deleted** — the "Big, but your call" group. Ollama models, Android system images and AVDs, the Docker virtual disk, cold project folders. CleanKit prints the command that removes each one and leaves it to you.

## Safety

- Only an **allowlist** of known cache paths is ever considered. There is no "delete the biggest thing" mode.
- Every path is re-validated **immediately before deletion** — the scan may be minutes old and a directory could have been swapped for a symlink since.
- Paths are resolved with `realpath` first, so a symlink pointing out of `$HOME` is rejected rather than followed.
- `$HOME` itself, `Documents`, `Desktop`, `Downloads`, `Pictures`, `Music`, `Movies`, `Library`, `.ssh`, `.gnupg`, `.aws` and `.config` are **hard-blocked**, even if a target definition names them.
- A path that fails a guard is skipped and reported; it never aborts the run.
- `clean` requires a typed `yes` on a TTY, or an explicit `--yes`.

Everything is local. CleanKit makes no network calls and sends no telemetry.

## Adding a target

Most cleanup targets are pure data in `src/targets.ts`:

```ts
{
  id: 'deno',
  group: 'dev',
  label: 'Deno cache',
  recovery: 'refetched on next run',
  mode: 'contents',
  paths: [home('Library', 'Caches', 'deno')],
}
```

Anything needing logic (version comparison, staleness) goes in `src/heavy.ts` as a scanner returning a `Finding`. Add a test in the matching `*.test.ts`.

## Development

```bash
npm test          # 36 unit tests
npm run typecheck
npm run build
```

## License

[MIT](LICENSE)
