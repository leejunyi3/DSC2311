# Data Limitations

The project does **not** have confirmed access to official PSA operational data.

The system must never:

- Claim to have official PSA operational data.
- Invent berth occupancy, berth allocation, crane availability or yard capacity.
- Invent exact vessel queue lengths or port waiting times.
- Describe AIS vessel density as official berth congestion.
- Claim to represent PSA, MPA or a shipping company.

## What the system actually has

- **Weather / lightning / marine**: public forecasts and observations, tied to
  the nearest suitable station or forecast region — island-wide readings are
  labelled as such, not as Tuas-specific.
- **AIS vessel positions**: live via AISStream (when keyed) or deterministic
  demo data. Positions can be sparse, delayed or spoofed.
- **Maritime disruptions**: third-party news / advisories, each with a source,
  timestamp, reliability and confidence. Not every article mentioning Singapore
  is an active incident.

## Consequence for recommendations

Because there is no official berth / crane / queue / waiting-time feed, every
congestion figure is an **estimate**, and every recommendation is conditional on
a human planner confirming the real operational picture.
