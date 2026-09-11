# Contributing to CleanKit

CleanKit deletes files off people's machines. That shapes every rule below.

## Setup

```bash
npm install
npm run build
node dist/cli.js scan
```

## Before opening a pull request

```bash
npm run typecheck
npm test
node dist/cli.js clean --dry-run   # sanity-check your target on a real machine
```

## Adding a cleanup target

1. Add an entry to `TARGETS` in `src/targets.ts`.
2. Write `recovery` honestly. If the data is gone for good, start the string with `GONE` — the CLI highlights those in yellow.
3. Prefer `mode: 'contents'` over `'self'`: emptying a cache directory is safer than removing the directory an app expects to exist.
4. Add a test.

For anything that needs logic — version comparison, staleness, grouping — add a scanner to `src/heavy.ts` that returns a `Finding`, and keep the decision logic in a pure exported function so it can be tested without touching a filesystem.

## Rules

- **Allowlist only.** Never add a heuristic that deletes "whatever is big". If a pile needs human judgement, add it as an `advisory` finding with the command a person should run.
- **Never widen the safety guards** in `src/safety.ts` to make a target work. If a target needs a protected directory, the target is wrong.
- **No runtime dependencies.** Dev dependencies for tests and types only.
- **No network calls, no telemetry.**
- Match the surrounding code style; the repo has no formatter config on purpose.

## Reporting bugs

Include the command you ran, the output (`--no-mascot` keeps it compact), your macOS and Node versions. If CleanKit deleted something it should not have, say so first — that is the highest-priority bug class in this project.
