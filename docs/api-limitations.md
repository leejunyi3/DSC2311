# API & Data Limitations

## No official PSA/MPA operational data

The project has **no confirmed access** to official PSA information about berth
occupancy, berth allocation, crane availability, yard capacity, exact vessel queue
lengths, exact port waiting times or customs clearance times. The system therefore
never claims such data, never invents it, and never describes AIS vessel density
as official berth congestion. It uses the term **Estimated Tuas Congestion** with
a mandatory disclaimer.

## Per-source limitations

- **Weather:** nearest-station approximation; rainfall mm/hr is derived from a
  5-minute total.
- **Marine:** forecast only; not for navigation.
- **Lightning:** does not detect every event; live endpoint must be confirmed.
- **AIS:** sparse/delayed/spoofable; live needs a long-running collector.
- **Disruptions:** third-party text; recency and relevance weighted; live disabled
  by default.

## Rate limits & reliability

- `safeFetchJson` applies timeouts (default 8s), limited retries (default 2) with
  exponential backoff, treats HTTP 429 as retryable rate-limiting, and does not
  retry non-retryable 4xx.
- Only http/https absolute URLs are permitted (no unrestricted server-side
  fetching).

## Caching

- The cache is an in-process TTL map. In serverless deployments it is
  per-instance and best-effort; a shared Redis (via `REDIS_URL`) would be needed
  for cross-instance Degraded-Mode continuity.

## Modes

- Demo Mode requires no keys and is fully deterministic.
- Live Mode uses public keyless sources where enabled; unconfigured feeds report
  UNAVAILABLE rather than fabricating data.
- Degraded Mode serves recent CACHED data with reduced confidence and never hides
  the failure.
