# Risk Methodology (Summary)

The full, authoritative thresholds live in `src/lib/risk/risk-config.ts`. This
note summarises the method for the assistant and the Methodology page.

## Overall resilience risk

```
Overall Risk = Weather×0.30 + Estimated Congestion×0.30
             + Maritime Disruption×0.20 + Cargo Exposure×0.15
             + Data Quality Penalty×0.05      (clamped 0–100)
```

Categories: 0–24 Low, 25–49 Moderate, 50–74 High, 75–100 Critical.

## Weather sub-model

Normalised rainfall, wind, lightning (worse of proximity/recent-count) and wave
height, renormalised across whichever inputs are available. Thresholds are
project assumptions, **not** official port-shutdown limits.

## Estimated Tuas congestion

```
Estimated Congestion = Normalised Density×0.40 + Slow-Moving Ratio×0.35
                     + Apparently Stationary Ratio×0.25
```

This is an AIS-based analytical estimate, not official PSA berth, queue or
waiting-time data. Stationary vessels are never automatically called blockages.

## Maritime disruption

Severity × relevance × source reliability × exponential recency decay
(36-hour half-life), with a small corroboration bonus. The worst active
disruption drives the component.

## Confidence (separate from risk)

Derived from source reliability, freshness, geographic relevance, feed
availability, source agreement and live-vs-cached/estimated/simulated status.
Confidence is never computed as `100 − risk`.
