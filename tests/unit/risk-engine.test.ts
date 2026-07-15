import { describe, it, expect } from "vitest";
import {
  calculateResilienceRisk,
  categoriseRisk,
  calculateWeatherRisk,
  calculateDisruptionRisk,
  calculateCargoExposure,
  scoreDisruption,
} from "@/lib/risk/risk-engine";
import type { DisruptionRiskItem, WeatherRiskInput } from "@/types";

describe("risk category boundaries", () => {
  it("maps scores to the documented bands", () => {
    expect(categoriseRisk(0)).toBe("Low");
    expect(categoriseRisk(24)).toBe("Low");
    expect(categoriseRisk(25)).toBe("Moderate");
    expect(categoriseRisk(49)).toBe("Moderate");
    expect(categoriseRisk(50)).toBe("High");
    expect(categoriseRisk(74)).toBe("High");
    expect(categoriseRisk(75)).toBe("Critical");
    expect(categoriseRisk(100)).toBe("Critical");
  });
});

describe("weather sub-model", () => {
  it("renormalises across only the available inputs", () => {
    const input: WeatherRiskInput = {
      rainfallMmPerHr: 15, // midpoint of 0..30 => 50
      windSpeedKnots: null,
      lightningNearestKm: null,
      lightningRecentCount: null,
      waveHeightM: null,
    };
    expect(calculateWeatherRisk(input)).toBeCloseTo(50, 5);
  });

  it("returns 0 when no weather inputs are available", () => {
    expect(
      calculateWeatherRisk({
        rainfallMmPerHr: null,
        windSpeedKnots: null,
        lightningNearestKm: null,
        lightningRecentCount: null,
        waveHeightM: null,
      }),
    ).toBe(0);
  });

  it("scores close lightning as high risk", () => {
    const near = calculateWeatherRisk({
      rainfallMmPerHr: null,
      windSpeedKnots: null,
      lightningNearestKm: 3, // inside danger radius
      lightningRecentCount: null,
      waveHeightM: null,
    });
    expect(near).toBe(100);
  });
});

describe("maritime disruption sub-model", () => {
  it("decays old reports via recency half-life", () => {
    const base: DisruptionRiskItem = {
      id: "d1",
      severity: "critical",
      routeRelevance: 1,
      locationRelevance: 1,
      sourceReliability: 1,
      ageHours: 0,
      supportingSources: 1,
    };
    const fresh = scoreDisruption(base);
    const aged = scoreDisruption({ ...base, ageHours: 36 }); // one half-life
    expect(fresh).toBe(100);
    expect(aged).toBeCloseTo(50, 0);
  });

  it("takes the worst active disruption", () => {
    const items: DisruptionRiskItem[] = [
      {
        id: "a",
        severity: "low",
        routeRelevance: 0.5,
        locationRelevance: 0.5,
        sourceReliability: 1,
        ageHours: 0,
        supportingSources: 1,
      },
      {
        id: "b",
        severity: "high",
        routeRelevance: 1,
        locationRelevance: 1,
        sourceReliability: 1,
        ageHours: 0,
        supportingSources: 1,
      },
    ];
    expect(calculateDisruptionRisk(items)).toBe(75);
    expect(calculateDisruptionRisk([])).toBe(0);
  });
});

describe("cargo exposure sub-model", () => {
  it("adds cold-chain and criticality bonuses", () => {
    // pharma 70 + coldChain 15 + critical 25 = 110 -> clamp 100
    expect(
      calculateCargoExposure({
        cargoClass: "pharmaceuticals",
        coldChain: true,
        inventoryExposureScore: null,
        criticality: "critical",
      }),
    ).toBe(100);
  });

  it("blends in the simulator inventory exposure when present", () => {
    // general 25 + standard 5 = 30 base; blend 60% base + 40% of 80 = 18 + 32 = 50
    expect(
      calculateCargoExposure({
        cargoClass: "general",
        coldChain: false,
        inventoryExposureScore: 80,
        criticality: "standard",
      }),
    ).toBe(50);
  });
});

describe("overall resilience risk", () => {
  it("combines weighted components deterministically", () => {
    const result = calculateResilienceRisk({
      weather: {
        rainfallMmPerHr: 15, // -> 50
        windSpeedKnots: null,
        lightningNearestKm: null,
        lightningRecentCount: null,
        waveHeightM: null,
      },
      congestionScore: 40,
      disruptions: [],
      cargo: {
        cargoClass: "general",
        coldChain: false,
        inventoryExposureScore: null,
        criticality: "standard", // base 25 + 5 = 30
      },
      dataConfidence: 80, // penalty 20
      previousOverall: 30,
    });

    // 50*.30 + 40*.30 + 0*.20 + 30*.15 + 20*.05 = 15 + 12 + 0 + 4.5 + 1 = 32.5
    expect(result.overall).toBe(32.5);
    expect(result.category).toBe("Moderate");
    expect(result.components.weather).toBe(50);
    expect(result.components.cargo).toBe(30);
    expect(result.components.dataQualityPenalty).toBe(20);
    expect(result.delta).toBe(2.5);
    expect(result.drivers[0]?.component).toBe("weather");
    expect(result.drivers).toHaveLength(3);
  });

  it("clamps into 0–100", () => {
    const result = calculateResilienceRisk({
      weather: {
        rainfallMmPerHr: 100,
        windSpeedKnots: 100,
        lightningNearestKm: 0,
        lightningRecentCount: 100,
        waveHeightM: 10,
      },
      congestionScore: 100,
      disruptions: [
        {
          id: "x",
          severity: "critical",
          routeRelevance: 1,
          locationRelevance: 1,
          sourceReliability: 1,
          ageHours: 0,
          supportingSources: 5,
        },
      ],
      cargo: {
        cargoClass: "pharmaceuticals",
        coldChain: true,
        inventoryExposureScore: 100,
        criticality: "critical",
      },
      dataConfidence: 0,
      previousOverall: null,
    });
    expect(result.overall).toBeLessThanOrEqual(100);
    expect(result.overall).toBeGreaterThanOrEqual(90);
    expect(result.category).toBe("Critical");
    expect(result.delta).toBeNull();
  });
});
