# Deployment

## Prerequisites

- Node.js 20+ (22+ if you run the AIS collector with the global WebSocket).
- Environment variables set **server-side** (never in client/build-exposed vars).

## Build & run (Node server)

```bash
npm install
npm run build
npm run start        # serves the production build on PORT (default 3000)
```

## Vercel / serverless

- Deploy as a standard Next.js App Router project.
- Set env vars in the platform’s server-side settings.
- Routes that use the Anthropic SDK or providers already declare
  `runtime = "nodejs"`.
- Note the in-process cache is per-instance; add `REDIS_URL` + a Redis-backed
  cache if you need cross-instance Degraded-Mode continuity.

## AIS collector (separate process)

A persistent AIS feed cannot run inside a serverless function. Run the collector
on a small always-on Node host:

```bash
AIS_PROVIDER_MODE=aisstream AISSTREAM_API_KEY=... npm run ais:collect
```

It writes `data/ais-snapshot.json`; deploy the app with read access to that path,
or adapt the collector to write to shared storage / Redis and the AIS provider to
read from there.

## Enabling the assistant

Set `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`. Without `ANTHROPIC_MODEL` the app
raises a clear configuration error when the assistant is used (no model default is
hardcoded). Without a key, the assistant serves deterministic offline summaries.

## Post-deploy checks

- Load `/dashboard` in Demo Mode — six KPI cards, map, charts populate.
- Switch scenarios in the header — all panels update from one dataset.
- Open `/diagnostics` — feed health and connectivity render.
- `/api/health` returns connectivity + assistant-enabled flag (no secrets).
