import { z } from "zod";

/**
 * Zod schemas for RAW external provider responses. Every external payload is
 * parsed through one of these before it is normalised. We deliberately keep
 * these permissive on optional fields (providers omit fields when a sensor is
 * offline) but strict on the shape we depend on.
 *
 * NOTE: these describe the *documented* public shapes of data.gov.sg (NEA) and
 * Open-Meteo Marine. They are used by the provider layer (build step 7). Fields
 * we do not consume are intentionally omitted rather than invented.
 */

// ── data.gov.sg realtime weather (v1 reading endpoints) ────────────────
// Shared shape used by air-temperature / rainfall / wind-speed / humidity.
const neaStationSchema = z.object({
  id: z.string(),
  device_id: z.string().optional(),
  name: z.string(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
});

const neaReadingItemSchema = z.object({
  timestamp: z.string(),
  readings: z.array(
    z.object({
      station_id: z.string(),
      value: z.number(),
    }),
  ),
});

export const neaEnvironmentReadingSchema = z.object({
  metadata: z
    .object({
      stations: z.array(neaStationSchema).optional(),
      reading_type: z.string().optional(),
      reading_unit: z.string().optional(),
    })
    .optional(),
  items: z.array(neaReadingItemSchema),
  api_info: z.object({ status: z.string() }).optional(),
});

export type NeaEnvironmentReading = z.infer<typeof neaEnvironmentReadingSchema>;

// ── data.gov.sg 2-hour forecast ────────────────────────────────────────
export const neaTwoHourForecastSchema = z.object({
  area_metadata: z
    .array(
      z.object({
        name: z.string(),
        label_location: z.object({
          latitude: z.number(),
          longitude: z.number(),
        }),
      }),
    )
    .optional(),
  items: z.array(
    z.object({
      update_timestamp: z.string().optional(),
      timestamp: z.string().optional(),
      valid_period: z
        .object({ start: z.string(), end: z.string() })
        .optional(),
      forecasts: z.array(
        z.object({ area: z.string(), forecast: z.string() }),
      ),
    }),
  ),
});

export type NeaTwoHourForecast = z.infer<typeof neaTwoHourForecastSchema>;

// ── data.gov.sg NEA Lightning Observation (v2 real-time weather) ───────
// GET https://api-open.data.gov.sg/v2/real-time/api/weather?api=lightning
// Each record's item.readings[] lists recent strikes with a string lat/lon.
export const neaLightningSchema = z.object({
  code: z.number().optional(),
  errorMsg: z.string().optional(),
  data: z.object({
    records: z.array(
      z.object({
        datetime: z.string().optional(),
        updatedTimestamp: z.string().optional(),
        item: z.object({
          type: z.string().optional(),
          isStationData: z.boolean().optional(),
          readings: z.array(
            z.object({
              location: z.object({
                latitude: z.string(),
                longitude: z.string(),
              }),
              datetime: z.string().optional(),
              text: z.string().optional(),
              type: z.string().optional(),
            }),
          ),
        }),
      }),
    ),
  }),
});

export type NeaLightning = z.infer<typeof neaLightningSchema>;

// ── Open-Meteo Marine ──────────────────────────────────────────────────
export const openMeteoMarineSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string().optional(),
  current: z
    .object({
      time: z.string(),
      wave_height: z.number().nullable().optional(),
      wave_direction: z.number().nullable().optional(),
      wave_period: z.number().nullable().optional(),
      wind_wave_height: z.number().nullable().optional(),
      swell_wave_height: z.number().nullable().optional(),
      swell_wave_direction: z.number().nullable().optional(),
    })
    .optional(),
  hourly: z
    .object({
      time: z.array(z.string()),
      wave_height: z.array(z.number().nullable()).optional(),
      wave_direction: z.array(z.number().nullable()).optional(),
      wave_period: z.array(z.number().nullable()).optional(),
    })
    .optional(),
});

export type OpenMeteoMarine = z.infer<typeof openMeteoMarineSchema>;

// ── AISStream (normalised subset of PositionReport messages) ───────────
// AISStream delivers JSON messages over a websocket. We validate only the
// fields we normalise; the raw message carries far more we deliberately drop.
export const aisStreamPositionSchema = z.object({
  MetaData: z.object({
    MMSI: z.number(),
    ShipName: z.string().optional(),
    latitude: z.number(),
    longitude: z.number(),
    time_utc: z.string().optional(),
  }),
  Message: z.object({
    PositionReport: z
      .object({
        Sog: z.number().optional(),
        Cog: z.number().optional(),
        TrueHeading: z.number().optional(),
      })
      .optional(),
  }),
});

export type AisStreamPosition = z.infer<typeof aisStreamPositionSchema>;

// ── GDELT DOC 2.0 (maritime disruption news) ───────────────────────────
// Keyless open news API. artlist mode returns thin article metadata; severity,
// location and relevance are DERIVED heuristically (news ≠ confirmed incident).
export const gdeltDocSchema = z.object({
  articles: z
    .array(
      z.object({
        url: z.string(),
        title: z.string(),
        seendate: z.string().optional(),
        domain: z.string().optional(),
        language: z.string().optional(),
        sourcecountry: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
});

export type GdeltDoc = z.infer<typeof gdeltDocSchema>;
