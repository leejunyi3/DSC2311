# Tuas Mega Port Resilience Control Tower

An AI-assisted resilience monitor for container flows through the Tuas Mega Port,
built for a university Digital Supply Chain assignment on autonomous supply-chain
orchestration. It monitors live, near-live, cached, estimated and simulated
signals, computes operational risk with **deterministic TypeScript**, and uses
the Anthropic Claude API to *explain* those numbers and compare mitigation
options for **human approval** — it never invents the numbers.

> **Student prototype.** It does not provide official port instructions,
> navigation advice or safety-certified operational information, and it has **no
> access to official PSA/MPA berth, crane, queue or waiting-time data**.

---

## Project purpose

Give a Senior Regional Logistics Planner one screen that: retrieves and validates
relevant signals, checks data freshness/reliability, calculates transparent risk,
explains the main drivers, quantifies inventory and safety-stock impact, compares
responses (wait / reroute / emergency replenishment), and recommends actions that
always require human authorisation.

## Main features

- Professional dark **control-tower dashboard** with six KPI cards.
- **Deterministic risk, congestion, confidence and inventory engines** (all
  numbers computed in code; unit-tested).
- **Interactive vessel map** (React Leaflet + OpenStreetMap) with a project
  geofence, motion-coded vessels and a tile-failure fallback.
- **Risk / vessel-density / weather-marine charts** (Recharts) with 6h/24h/7d
  filters.
- **Filterable disruption panel** with severity, source and status filters.
- **What-If simulator** with transparent formulas and an option-comparison table.
- **AI Resilience Assistant** (Claude) grounded in a single server-computed
  snapshot, with strict tools, a tool-loop limit and a safe audit trail. Works
  offline with a deterministic, clearly-labelled summary when no key is set.
- **Data diagnostics** and a full **methodology** page.
- **Live / Degraded / Demo** modes, with every data point classified LIVE,
  CACHED, ESTIMATED, SIMULATED or UNAVAILABLE.

## Architecture summary

```
User Browser
  → Next.js Dashboard & Chat Interface
  → Server API & Claude Tool Orchestrator
  → Normalised Data Provider Layer
  → Weather / Lightning / Marine / AIS / Disruption Sources
  → Cache & Deterministic Risk Engine
  → Claude Explanation & Recommendation
  → Human Planner Decision
```

Numerical calculations happen in deterministic code **before** Claude sees them.
See [docs/architecture.md](docs/architecture.md).

## Requirements

- **Node.js 20+** (the AIS collector needs Node 22+ for the global WebSocket, or
  install `ws`).

## Installation

```bash
npm install
cp .env.example .env.local   # optional — Demo Mode works with NO keys
npm run dev                  # http://localhost:3000
```

The app **starts in Demo Mode with zero API keys**. Verify by running with no
`.env.local` at all.

## Environment variables

All are optional for Demo Mode. Configured server-side only — **no keys ever
reach the browser**.

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Enables the live Claude assistant. |
| `ANTHROPIC_MODEL` | **No default** — required to enable the assistant; the app errors clearly if missing when the assistant is used. |
| `ENABLE_ANTHROPIC_WEB_SEARCH` | Reserved toggle for Claude web search. |
| `AIS_PROVIDER_MODE` | `demo` or `aisstream`. |
| `AISSTREAM_API_KEY` | AISStream key, used only by the collector. |
| `ENABLE_LIVE_WEATHER/_LIGHTNING/_MARINE/_DISRUPTIONS` | Per-feed live toggles. |
| `CACHE_TTL_SECONDS` | Cache retention (default 300). |
| `DEMO_SCENARIO` | Default scenario id. |
| `DEMO_SEED` | Seed for deterministic demo data. |
| `REDIS_URL`, `DATABASE_URL` | Optional; unused in Demo Mode. |

## Live, Degraded and Demo modes

- **Demo** — deterministic seeded fixtures; every value labelled *Simulated Demo
  Data*. Four scenarios (normal, thunderstorm, regional disruption, pharmaceutical
  crisis).
- **Live** — public keyless sources are used where enabled (data.gov.sg weather,
  NEA lightning, Open-Meteo marine). AIS needs a free AISStream key + the
  collector; disruptions need a documented source — until configured those report
  UNAVAILABLE rather than fabricating data.
- **Degraded** — activates automatically when a live source fails: recent cache is
  shown as CACHED, confidence drops, the failed source is named, and failures are
  never hidden or silently replaced with simulated data.

## API configuration / activation

- **Claude assistant**: set `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`.
- **Live weather/marine**: keyless; set `ENABLE_LIVE_WEATHER=true` /
  `ENABLE_LIVE_MARINE=true` and switch to Live Mode.
- **Lightning / disruptions**: complete the provider (`fetchLiveLightning` /
  `fetchLiveDisruptions`) against a confirmed documented endpoint, add its Zod
  schema, and enable the toggle. See [docs/data-sources.md](docs/data-sources.md).

## AIS collector setup

A persistent AIS feed needs a long-running process (not a serverless function):

```bash
AIS_PROVIDER_MODE=aisstream AISSTREAM_API_KEY=... npm run ais:collect
```

It filters the Tuas bounding box, keeps a limited current snapshot, and writes
`data/ais-snapshot.json`, which the app reads in Live Mode.

## Test / build commands

```bash
npm run lint     # eslint (next lint)
npm run test     # vitest unit tests
npm run build    # next production build (also typechecks)
npm run test:e2e # playwright (run `npx playwright install` first)
```

## Deployment

See [docs/deployment.md](docs/deployment.md). In short: deploy the Next.js app to
any Node 20+ host (Vercel/Node server), set env vars server-side, and run the AIS
collector separately if live vessels are required.

## Known limitations

- No official PSA berth/crane/queue/waiting-time data; congestion is an AIS-based
  **estimate**.
- AIS can be sparse, delayed or spoofed; marine data is a **forecast**, not for
  navigation.
- The in-process cache is per-instance (best-effort) in serverless deployments.
- Live AIS needs a free AISStream key + the collector; the live disruption feed
  ships as an interface + demo fallback (needs a documented source).

## Project disclaimer

This student prototype supports supply-chain decision-making but does not provide
official port instructions, navigation advice or safety-certified operational
information. It does not represent PSA, MPA or any shipping company.
