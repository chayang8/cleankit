# Contributing to CleanKit

Thanks for helping out. CleanKit is deliberately small and dependency-light — keep it that way and almost any change is welcome.

## Setup

```bash
npm install
npm run dev
```

## Before opening a pull request

```bash
npm run typecheck
npm test
npm run build
```

## Adding a cleaning tool

Tools live in `src/lib/clean.ts` and are pure `(input: string) => string` functions.

1. Write the function next to the other operations.
2. Add its id to the `OperationId` union.
3. Register it in `OPERATIONS` with a `label`, a one-sentence `description` and a `group`.
4. Add a test case in `src/lib/clean.test.ts` — including an edge case (empty input, already-clean input).

The tool list in the UI is generated from `OPERATIONS`, so there is nothing else to wire up.

## Ground rules

- **No network calls.** CleanKit is client-side only; a tool that phones home will not be merged.
- **No new runtime dependencies** unless there is no reasonable alternative.
- Keep operations pure and order-independent where possible.
- Match the existing code style — the repo has no formatter config on purpose; just look at the neighbours.

## Reporting bugs

Include the input text (or a minimal version of it), which tools were enabled and in what order, and what you expected.
