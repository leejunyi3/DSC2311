# Cargo Priority Policy (Project Policy)

This ordering is a PROJECT policy for prioritising scarce mitigation capacity.
It is NOT an official PSA berth- or yard-allocation policy.

1. Human safety.
2. Pharmaceutical and medical cold-chain cargo.
3. Mission-critical cargo.
4. Perishable cargo.
5. High-priority customer commitments.
6. General cargo.
7. Cost optimisation.

## How the simulator applies this

- Cold-chain shipments raise cargo-exposure risk and, in the option
  comparison, the engine avoids options that leave **critical** cold-chain
  exposure whenever a less-exposed option exists — even at higher cost.
- Critical shipment criticality and key-account customer priority each bump the
  computed service-level risk one band.
- When every option leaves critical cold-chain exposure, the system does not
  silently pick the cheapest — it escalates for a human decision.
