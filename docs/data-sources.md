# Data Sources

Every provider is a replaceable interface returning a classified `DataEnvelope`.

## Singapore weather — data.gov.sg (NEA)

- **Endpoints:** `https://api.data.gov.sg/v1/environment/{air-temperature,
  rainfall, wind-speed, wind-direction, relative-humidity}` (keyless, documented).
- **Normalisation:** nearest station to the Tuas monitoring point per dataset;
  rainfall (5-min mm total) is converted to an approximate mm/hr.
- **Attribution:** data.gov.sg / NEA. **Limitation:** island-wide station data is
  attributed by station, not relabelled as Tuas-specific.
- **Enable:** `ENABLE_LIVE_WEATHER=true` + Live Mode.

## Marine — Open-Meteo Marine

- **Endpoint:** `https://marine-api.open-meteo.com/v1/marine` (keyless).
- **Fields:** wave height/direction/period, wind-wave, swell height/direction;
  trend derived from upcoming hourly wave heights.
- **Limitation:** it is a **forecast**, labelled as such, and must not be used for
  navigation.
- **Enable:** `ENABLE_LIVE_MARINE=true` + Live Mode.

## Lightning — NEA Lightning Observation (data.gov.sg)

- **Endpoint:** `https://api-open.data.gov.sg/v2/real-time/api/weather?api=lightning`
  (keyless, documented, ~2-minute updates). Dataset:
  `https://data.gov.sg/datasets/d_08238953fe0f6dd13f10714ebfbcb9f9/view`.
- **Normalisation:** each record's `item.readings[]` lists recent cloud-to-cloud
  / cloud-to-ground strikes with a string lat/lon. We compute the recent strike
  count and the nearest-strike distance (haversine) to the Tuas monitoring
  point. An empty `readings` array is a valid "0 strikes" reading, not an error.
- **Limitation:** detection efficiency is ~90–95% when all sensors are up — it
  does not catch every event; confidence reflects that.
- **Enable:** `ENABLE_LIVE_LIGHTNING=true` + Live Mode (on by default).

## AIS vessels — AISStream

- **Mode:** `AIS_PROVIDER_MODE=demo | aisstream`.
- **Live:** a long-running collector (`scripts/ais-collector.ts`) holds the
  websocket, filters the Tuas bounding box, keeps a limited current snapshot and
  writes `data/ais-snapshot.json`. The app reads that snapshot; a serverless
  function cannot maintain the socket itself.
- **Limitations:** positions can be sparse, delayed or spoofed. The AIS key is
  used only by the collector and never reaches the browser.

## Maritime disruptions

- Disabled by default (`ENABLE_LIVE_DISRUPTIONS=false`). A production
  implementation should use a documented, citation-bearing source (Claude web
  search with citations, GDELT, or official advisories) and map each item to the
  `Disruption` shape with title, source, timestamps, location, summary, severity,
  Tuas relevance, source reliability, confidence, URL/citation and data status.
- **Limitation:** not every article mentioning Singapore is an active incident;
  the risk engine applies recency decay and relevance weighting.

## Claude API

- Server-only; model read from `ANTHROPIC_MODEL` (no hardcoded default). When
  absent, the assistant serves a deterministic, clearly-labelled offline summary.
