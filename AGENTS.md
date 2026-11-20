# Agents

Read [docs/PROJECT.md](docs/PROJECT.md) before changing this repo. It is the passport: promise, audiences, principles, screens, seeded book, and design system. Do not re-explain the product from scratch, and do not invent a second visual language.

## Rules

- MIT license. Copyright stays Denys Sergushkin (sergushkincom).
- Never name the real company this concept is inspired by. Never name an optimiser brand outside the competitor table in the README. `npm run check:names` fails the build if one appears anywhere else. Do not add those names to docs, UI, tests, or commit messages.
- One change per PR. Open the PR. The owner merges.
- Mock data only. No env vars and no external market APIs. Explanation numbers must match the computed book; extend the tests in `tests/invariants.test.ts` when you change the bridge or the sentences.
- Keep the look in the passport: IBM Plex Sans and Mono, navy and amber, charge blue and discharge amber, 6px radius, opaque surfaces. No blur, no Geist, no mint.

## Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run check:names
npm run build
npm run test:e2e
```

`npm run data` rewrites the summary JSON. The running app generates the same seed in memory.

## When behaviour changes

Update **Status** and **Known gaps / next ideas** in `docs/PROJECT.md` in the same PR. If a screen, route, or principle changes, update that section of the passport too.
