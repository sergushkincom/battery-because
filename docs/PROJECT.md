# Because — project passport

Because is a console for owners and operators of grid-scale battery storage in Europe.

**Promise:** every number comes with a reason.

An algorithm trades a battery across day-ahead, intraday and balancing markets. The product shows the state and the reason, not a bare revenue figure. A number without a reason scares people. A number with a reason builds trust.

## Who it is for

One product, two working modes, the same book.

| Person | What they need | Theme |
|---|---|---|
| Battery owner, fund analyst, municipal portfolio manager | Am I earning, and if not, why? How does that compare with the plan and with the market? Can I report it and plan maintenance without an email chain? | Light, the default |
| Operator | What needs me now, and what did the system do alone? Approve, reject, or override, and leave a trace. | Dark when the role is Operator; the header toggle keeps either theme |

The role switcher changes the landing screen and the wording. It does not change the numbers.

## Problems and goals

The owner hands the battery to an algorithm and gets a revenue number back. The goals of v1:

- Answer "am I earning, and if not, why?"
- Compare the result with the plan and with a market benchmark.
- Explain a change in revenue as a factor breakdown, in plain language, with the figures behind it.
- Make autonomy explicit: the system acts, a person must approve, or the system never acts alone.
- Keep an approval queue and an audit log.
- Let someone schedule maintenance without email.
- Show where a new asset is in go-live.
- Export an investor, board, or internal report as PDF or CSV.
- Give the operator a queue that starts with actions.

## Product principles

- Explain why revenue is what it is. Named states, never a confidence percentage.
- Show where the system acts and where a human decides. Acts alone, needs approval, or never alone.
- Every action leaves an audit trail: actor, reason, and a state (executed, approved, rejected, expired, reverted, failed).

## Screens

| Screen | Route | What it is for |
|---|---|---|
| Portfolio | `/` | Period revenue, versus plan, versus the market benchmark, and a one-line reason on each figure. Asset table with a named state. |
| Assets | `/assets` | The same assets as a filterable grid, with footer totals. |
| Markets | `/markets` | Day-ahead and intraday prices, plus capacity prices, for one country on the 15-minute clock. |
| Asset day | `/assets/[id]` | What the battery did on one day: revenue calendar, 15-minute dispatch, state of charge, reserves, availability, weather, and the day story. |
| Why | `/assets/[id]/why` | Why revenue changed. A bridge that builds left to right, each bar tied to its driver, and plain-language sentences. Suggested questions only; there is no free chat. |
| Control | `/assets/[id]/control` | Autonomy matrix, pending approvals, a maintenance window with its forecast impact, and time-boxed overrides. |
| Audit log | `/log` and `/assets/[id]/log` | Chronological trace, filterable, exportable as CSV. |
| Reports | `/reports` and `/reports/[period]` | Month or quarter, for an investor, a board, or internal use. PDF, CSV, and a copyable summary. |
| Attention | `/ops` | Operator default. Approvals, alerts, assets under plan, then what the system already did. |
| Go-live | `/assets/[id]/journey` | Onboarding stepper. Tajo Sur is blocked at prequalification, waiting on the DSO. |

Shareable state lives in the URL: role, portfolio, period, locale, and date.

## Data

All data is seeded mock data. There is no live market feed and no environment variable.

- Seed `20261119`. The book is 90 days and **ends 19 Nov 2026**. Demo clock starts at 14:05 Europe/Berlin that day. Intervals after 14:00 are marked delayed.
- Resolution is 15 minutes. Prices exist for DE, PL, IT, ES and PT. Display is in the asset's zone.
- Portfolios: Kestrel Fund I (Lechfeld 1, Oderbruch, Puglia Nord, Tajo Sur) and Stadtwerk Elbe (Elbmarsch, Havelland). Tajo Sur is not trading.
- Money is integer euro cents. Energy is kWh, power is kW, prices are €/MWh. Formatting toggles `en-GB` and `de-DE`.
- Prices follow weather regimes. Dispatch respects state of charge, efficiency, the daily cycle cap, and outages.
- The week of 13–19 Nov 2026 is cloudy and windy, so spreads are flat. Lechfeld 1 has an inverter fault on 17–18 Nov. That is the "why did revenue fall?" story.
- Explanations are rule-based templates in `lib/explain`. `explain()` returns the bridge and the sentences together, so a model can replace the templates later. Tests require the bridge to sum to actual minus baseline, and every number in the sentences to come from that computation.
- Approvals, rule edits, overrides, maintenance windows, and the manager's note are stored in this browser. **Reset demo** restores the seed.

## Design system

Dense B2B console. Not a marketing page.

- Type: IBM Plex Sans for the interface, IBM Plex Mono for money, power, and time. Tabular figures. Body 13px.
- Colour: navy for actions, amber for attention. Charge is blue (cyan), discharge is amber. Price up and price down are labelled as well as coloured. No mint.
- Radius 6px on cards, 4px on controls. Opaque surfaces, 1px borders. No blur, no glass, no gradient on the chrome.
- No Geist.
- Light theme for owners. Dark theme for operators. Both are complete.
- References, restyled onto these tokens: shadcn/ui (component primitives), ReUI (data grid, filters, timeline, trace), Twenty (density and the app shell), affectUI (named states and approve / reject).

## Stack, scripts, checks

Next.js 16.4.6 (patched), TypeScript strict, Tailwind CSS, Recharts, react-pdf. Vitest for the book and the explainer. Playwright for smoke (screens, CSV, PDF, skip link). Deploy target is Vercel, with no env vars.

```bash
npm i
npm run data    # writes lib/mock/data/summary.json; the app also generates in memory
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run check:names
```

GitHub Actions runs the name check, lint, typecheck, unit tests, `npm run data`, the production build, and Playwright.

## Status

v1 is the prototype on this branch.

Done:

- Portfolio, asset day, why-bridge, autonomy and approvals, maintenance window, audit log, reports (PDF and CSV), operator queue, go-live stepper, markets.
- The Why bridge builds one bar at a time from the left, with a thin connector drawing in between neighbours. Hover or keyboard focus on a bar or its driver row highlights the pair. Reduced motion shows the finished chart at once.
- Light and dark themes, EN/DE number formats, keyboard skip link, empty and error states, stale-data state ("Data delayed — last telemetry 14:05").
- Seeded book, explainer, and tests that the explanation numbers match the computed data.
- README, screenshots, and a short GIF of the timeline and the "why revenue changed" flow.
- CI, MIT license (Denys Sergushkin / sergushkincom).

The live URL in the README (`https://battery-because.vercel.app`) is a placeholder. v1 is not deployed.

## Known gaps / next ideas

- Maintenance start and end use `datetime-local`, so the clock follows the browser locale. A US browser shows 12-hour AM/PM instead of 24-hour Europe/Berlin.
- Data grid, filters, timeline, and approval trace follow the ReUI and affectUI patterns but are built on these tokens. The free registry blocks were not imported, so the console would not pick up a second theme.
- Questions are a fixed set of intents. An LLM can sit behind `explain()` later; it is not wired up.
- No real market data, no multi-user auth, no email alerts.
- The market benchmark is energy arbitrage with perfect hindsight, then 80%. It does not include capacity revenue, so a capacity-heavy day can sit "above market" and still miss the plan.

## Rules

- License: MIT. Copyright 2026 Denys Sergushkin (sergushkincom).
- Never name the real company this concept is inspired by. Never name an optimiser brand outside the competitor table in the README. CI enforces that with `npm run check:names`.
- One change per PR.
- The owner merges. Agents open the PR and stop.
