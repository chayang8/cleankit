# CleanKit 🫧

**Find out what is eating your disk, then get it back — without guessing what is safe to delete.**

CleanKit scans the caches, duplicate installs and dead build artifacts that pile up on a developer Mac, tells you what each pile costs *and what you lose by removing it*, then deletes only what you approve. Sudsy, the soap bubble, supervises.

```
  o   .-~~~~~-.   °
    /` .     . `\
  ~|    ^    ^   |~    < sniffing around...
   |  `  \___/  `|
    \  `     `  /
     `-.,___,.-`
     ~  "  "  "  ~

Duplicate installs
  Superseded editor extensions      11 GB  43 items  the newest version of each extension is kept
  Old gvm package sets              14 GB   7 items  rebuilt by go get

Big, but your call
  Ollama models                     15 GB    1 item  re-pulled with ollama pull
    run yourself: ollama list, then: ollama rm <model>

  Total reclaimable 29 GB
```

## Why this and not a disk visualiser

A treemap tells you a folder is 14 GB. It cannot tell you whether deleting it costs you thirty seconds or a week.

- **Every line says what you lose.** `refetched on next install` is a shrug. `GONE — re-archive needed to resymbolicate old crash logs` is a decision. CleanKit prints the difference and highlights the second kind.
- **It separates "I will delete this" from "only you can judge this."** Model weights, Docker's virtual disk, an old project folder — CleanKit reports those, prints the command that removes them, and never touches them itself.
- **Allowlist, not heuristics.** There is no "delete the biggest thing" mode and nothing guesses. Every automatic target is a literal path in [`src/targets.ts`](src/targets.ts) — a 150-line file you can read in full before trusting it.
- **It knows where the junk actually hides.** Superseded editor extension versions are usually the single largest reclaimable pile on a busy machine (12 GB on the author's), because editors are supposed to prune them and quietly don't. Finding them needs an understanding of the `publisher.name-version-platform` layout, so no generic cleaner catches them.
- **It covers the stack you actually use.** Node, Python, Rust, Go, Java, Ruby, PHP, .NET, Dart/Flutter, Xcode, JetBrains, and the browser binaries test runners download. A target whose paths do not exist on your machine simply never appears — no Xcode means no Xcode section, not a wall of zeroes.
- **It is extensible without a pull request.** Drop a `~/.cleankitrc.json` in place and your own cache paths join the scan, with the same safety guards applied.
- **Zero runtime dependencies.** Node builtins only. A tool with permission to delete your files should not drag in a supply chain.
- **No network, no telemetry, no account.** Your paths stay on your machine.

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

Node 20+. Built for macOS; cache paths for the XDG layout (`~/.cache/…`) are included too, so most of the `dev` group works on Linux. Without `npm link`, run `node dist/cli.js` anywhere the docs say `cleankit`.

## Use

Start here. The first command deletes nothing, so it is always safe to run:

```bash
cleankit                              # scan everything, report, delete nothing
cleankit scan --html=~/report.html    # same, plus a shareable HTML page
cleankit clean --dry-run              # run every safety check, delete nothing
cleankit clean                        # show the plan, ask, then delete
```

### Reading the report

| Column | Meaning |
| --- | --- |
| Label | What the pile is |
| Size | Allocated bytes, the same number the disk reports |
| Items | How many paths would be removed |
| Last column | What you lose. Yellow `GONE …` means it does not come back |
| `run yourself:` | An advisory finding. CleanKit will not delete it; this is the command that does |

**Total reclaimable** counts only what `clean` would actually remove. Advisory findings are excluded so the number never overstates what you get.

### Working one group at a time

```bash
cleankit clean --only=bulk        # duplicate installs — usually the biggest win
cleankit clean --only=dev         # package manager caches, all refetchable
cleankit scan  --only=advisory    # the big piles you decide about yourself
```

| Group | Contains |
| --- | --- |
| `dev` | Package manager caches and regenerable build output — see the table below |
| `xcode` | DerivedData, archives, iOS/watchOS DeviceSupport, simulator caches |
| `system` | Trash, user logs, app updater downloads, `.DS_Store` |
| `bulk` | Superseded VS Code / Cursor / Windsurf extension versions, old gvm package sets |
| `advisory` | Ollama models, Android system images and AVDs, Docker's virtual disk, cold project folders — **reported only** |

### What `dev` covers

| Stack | Cleaned |
| --- | --- |
| JavaScript | npm, pnpm, yarn, bun, Deno, node-gyp headers, Electron & electron-builder |
| Testing | Playwright, Puppeteer and Cypress browser binaries |
| Python | pip, uv, poetry, pipenv |
| Rust / Go | cargo registry cache, Go build cache |
| JVM | Gradle caches and daemon, Maven repository |
| Apple | CocoaPods, Carthage |
| Other | Dart/Flutter pub, NuGet, Composer, RubyGems & Bundler, Homebrew |
| Editors | JetBrains caches and logs, VS Code workspace cache |
| Projects | Stale `node_modules`, and stale build output — `target/`, `.next/`, `.nuxt/`, `.svelte-kit/`, `dist/`, `build/`, `.dart_tool/`, `__pycache__`, `.turbo` |

Build output is only reported when the project's marker file is beside it (`target/` next to `Cargo.toml`, `dist/` next to `package.json`) **and** the project has been idle past `--stale-days`. A `dist` folder with no manifest beside it is somebody's data, and is left alone.

### All options

| Option | Meaning |
| --- | --- |
| `--only=a,b` | Limit to groups (above) |
| `--stale-days=N` | How long a project must be idle before its `node_modules` counts as stale (default 90) |
| `--root=a,b` | Where to hunt for `node_modules`, `.DS_Store` and cold projects (default `~/Developer`, `~/Projects`, `~/src`) |
| `--html=FILE` | Write a self-contained HTML report |
| `--dry-run` | With `clean`: every guard runs, nothing is unlinked |
| `-y`, `--yes` | Skip the confirmation prompt — for cron and CI |
| `--no-mascot` | No Sudsy. Pipe-friendly |
| `-h`, `--help` / `-v`, `--version` | |

A leading `~` is expanded by CleanKit itself, so `--root=~/code` works even though the shell leaves it alone after `=`.

### A first run, end to end

```bash
cleankit                                # 1. see the whole picture
cleankit clean --only=bulk --dry-run    # 2. rehearse: which paths, which guards
cleankit clean --only=bulk              # 3. type `yes` when asked
cleankit scan --only=advisory           # 4. work through the rest by hand
```

**Quit your editor before cleaning the `bulk` group.** It removes superseded extension versions, and an editor holding those open can end up with a confused extension host until you restart it. The newest version of every extension is always kept.

## Safety

CleanKit deletes files. These are the guarantees that make that acceptable:

- **Allowlist only.** Known cache paths, named in source. No size-based heuristics, ever.
- **Re-validated immediately before deletion.** A scan may be minutes old; a directory could have been swapped for a symlink since. Every path is checked again at the moment of removal, not when it was found.
- **Symlinks are resolved, not followed.** Paths go through `realpath` first, so a link pointing out of `$HOME` is rejected rather than chased.
- **Hard-blocked, even if a target names them:** `$HOME` itself, `Documents`, `Desktop`, `Downloads`, `Pictures`, `Music`, `Movies`, `Library`, `.ssh`, `.gnupg`, `.aws`, `.config`.
- **One bad path never aborts the run.** It is skipped and reported.
- **`clean` requires a typed `yes`** on a terminal, or an explicit `--yes`. `--dry-run` exercises every guard and removes nothing.
- **Advisory findings are never deleted**, by any flag combination.

## Adding your own targets

Two ways, depending on whether you want to share it.

**Just for you** — create `~/.cleankitrc.json` (or `~/.config/cleankit/config.json`):

```json
{
  "targets": [
    {
      "id": "sbt",
      "label": "sbt cache",
      "group": "dev",
      "recovery": "refetched on next build",
      "paths": ["~/.sbt", "~/.ivy2/cache"]
    }
  ]
}
```

`mode` defaults to `contents` (empty the directory, keep it). Every safety guard still applies — a config file cannot talk CleanKit into deleting `~/Documents`, and `group: "advisory"` is rejected because advisory findings are built in. A malformed entry is reported by name and the rest of the file still loads.

**For everyone** — send a pull request. Most targets are pure data in `src/targets.ts`:

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

Anything needing logic — version comparison, staleness, grouping — goes in `src/heavy.ts` as a scanner returning a `Finding`, with the decision logic in a pure exported function so it can be tested without a filesystem. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

```bash
npm test          # 49 unit tests, including the safety guards
npm run typecheck
npm run build
```

Layout: `targets.ts` + `config.ts` (what to look at) → `scan.ts` / `heavy.ts` (measure it) → `cli.ts` (report it) → `clean.ts` + `safety.ts` (remove it, carefully) → `report.ts` (HTML) → `mascot.ts` (Sudsy).

## License

[MIT](LICENSE)
