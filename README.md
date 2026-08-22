# CleanKit 🧹

**Messy text in, clean text out.** A single-page, privacy-first text and data cleaner — and a friendly mascot that follows your cursor while you work.

Everything runs in your browser. No accounts, no uploads, no telemetry. Your text never leaves your machine.

## Features

- **Whitespace** — trim lines, collapse repeated spaces/tabs/nbsp, drop empty lines
- **Characters** — remove zero-width and invisible characters, straighten curly quotes, normalize dashes and ellipses, NFC normalization, strip HTML, remove accents
- **Lines** — deduplicate, sort
- **Case** — lower, UPPER, Title Case, slugify
- **Format** — pretty-print JSON, minify JSON, CSV → JSON
- **Composable pipeline** — toggle tools on and they run in the order you picked them, with numbered badges
- **Live stats** — characters, words, lines and how many characters were removed
- **Copy / download** the result in one click; your pipeline is remembered in `localStorage`
- **Broomy**, a cursor-following mascot that blinks, leans into turns and squishes when it hurries (disabled under `prefers-reduced-motion`)

## Quick start

```bash
git clone https://github.com/OWNER/cleankit.git
cd cleankit
npm install
npm run dev
```

Open the printed URL. That's it — one page, no backend.

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the unit tests |
| `npm run typecheck` | Type-check without emitting |

## Deploy

The build is fully static — drop `dist/` on any host.

A GitHub Actions workflow (`.github/workflows/deploy.yml`) publishes to GitHub Pages on every push to `main`. Enable **Settings → Pages → Source: GitHub Actions** once, and the workflow sets `BASE_PATH` to your repository name automatically.

## Adding a tool

Every cleaner is a pure `(input: string) => string` function. To add one, edit `src/lib/clean.ts`:

1. Write the function.
2. Add its id to the `OperationId` union.
3. Add an entry to the `OPERATIONS` array with a `label`, `description` and `group`.
4. Add a test in `src/lib/clean.test.ts`.

The UI builds itself from that array — no component changes needed.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
