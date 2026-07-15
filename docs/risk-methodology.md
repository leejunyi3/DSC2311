# Risk Methodology (detailed)

Authoritative constants live in `src/lib/risk/risk-config.ts`. This document is
detailed enough to write a technical-flow reflection slide directly from it.

## Why deterministic-first

Every number a planner might act on — overall risk, congestion, confidence,
inventory exposure, costs — is computed by pure TypeScript functions with unit
tests. Claude is only invoked **after** these numbers exist, and it receives them
as fixed context plus tools that return the same values. The model explains and
compares; it cannot compute or alter a figure. This boundary is the core
hallucination control: even a wrong or adversarial model response cannot change
the risk score the dashboard shows.

## Overall risk

```
Overall Risk = Weather×0.30 + Estimated Congestion×0.30
             + Maritime Disruption×0.20 + Cargo Exposure×0.15
             + Data Quality Penalty×0.05        (clamped 0–100)
```

Categories: `0–24 Low`, `25–49 Moderate`, `50–74 High`, `75–100 Critical`.
Component contributions are exposed as “top drivers” so the UI and Claude can
explain *why* the score is what it is.

## Weather sub-model

Normalised rainfall, wind, lightning and wave sub-scores, weighted
0.35 / 0.25 / 0.25 / 0.15 and **renormalised across whichever inputs are
present** so a missing sensor does not drag the score to zero. Lightning takes the
worse of proximity (≤5 km = 100, ≥30 km = 0) and recent-count signals. Thresholds
are project assumptions, not official shutdown limits.

## Estimated Tuas congestion

```
Estimated Congestion = Normalised Density×0.40
                     + Slow-Moving Ratio×0.35
                     + Apparently Stationary Ratio×0.25
```

Density is scored relative to the scenario baseline (0.5×→2× baseline maps
0→100). Slow < 3 kt, stationary < 0.5 kt. It is an **AIS-based analytical
estimate**, never official PSA berth/queue/waiting data, and a stationary vessel
is never automatically called a blockage (it may be legitimately anchored or
berthed).

## Maritime disruption

Each disruption scores `severity × max(routeRelevance, locationRelevance) ×
sourceReliability × recencyDecay`, where recency halves every 36 hours, plus a
capped corroboration bonus. The **worst active disruption** drives the component,
so many small stale items cannot sum to a false critical.

## Cargo exposure

Base exposure by cargo class + cold-chain bonus + criticality bonus, optionally
blended with the simulator’s inventory-exposure score. Encodes the project
cargo-priority policy (pharma/cold-chain first).

## Confidence (separate from risk)

```
per-source = reliability × statusFactor × freshnessFactor × geoRelevance
score = mean(available sources) × (available/total) × max(agreement, 0.6)
```

`statusFactor`: LIVE 1.0, CACHED 0.7, ESTIMATED 0.6, SIMULATED 0.5, UNAVAILABLE
0. Classes: `≤39 Low`, `≤69 Medium`, else High. Confidence and risk are distinct;
confidence is **never** `100 − risk`.

## Freshness

Age is compared to each feed’s expected window: `≤1×` FRESH, `≤2×` RECENT, `≤4×`
STALE, beyond EXPIRED. The confidence discount factor decays linearly to 0 at
`4×` expected.

## Simulator formulas

```
Delay Days = Delay Hours ÷ 24
Remaining Coverage = Safety Stock Days − Effective Delay Days
Coverage Gap = max(0, Effective Delay Days − Safety Stock Days)
Shortage Units = Coverage Gap × Daily Demand
Inventory Exposure = 100 if SS ≤ 0 and delay > 0
                     else min(100, Delay ÷ max(SS, 0.25) × 100)
Shortage Cost = Shortage Units × Unit Shortage Cost
Total Cost = Rerouting + Shortage + Emergency Replenishment
```

Option comparison builds wait / reroute / emergency options, runs the inventory
engine on each, and applies the cargo-priority policy: for cold-chain cargo it
avoids options that leave **critical** cold-chain exposure whenever a less-exposed
option exists, even at higher cost; if none protect the cold chain it escalates
rather than silently picking the cheapest. High-impact recommendations always set
`requiresHumanApproval`.
