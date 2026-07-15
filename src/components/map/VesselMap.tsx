"use client";

import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polygon,
  Circle,
  Popup,
  Tooltip as LTooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { DashboardSnapshot } from "@/types/snapshot";
import type { VesselMotion } from "@/types";
import {
  MONITORING_GEOFENCE,
  TUAS_MONITOR_POINT,
  GEOFENCE_DISCLAIMER,
  STATIONARY_VESSEL_NOTE,
} from "@/lib/constants/geo";

const MOTION_STYLE: Record<VesselMotion, { color: string; radius: number }> = {
  normal: { color: "#22d3ee", radius: 5 },
  slow: { color: "#f59e0b", radius: 6 },
  stationary: { color: "#ef4444", radius: 7 },
};

export default function VesselMap({ snapshot }: { snapshot: DashboardSnapshot }) {
  const [tileError, setTileError] = useState(false);
  const vessels = snapshot.vessels.data?.vessels ?? [];
  const lightning = snapshot.lightning.data;

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-base-600">
      <MapContainer
        center={[TUAS_MONITOR_POINT.lat, TUAS_MONITOR_POINT.lon]}
        zoom={12}
        className="h-full w-full"
        scrollWheelZoom={false}
        attributionControl
      >
        {!tileError && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            eventHandlers={{ tileerror: () => setTileError(true) }}
          />
        )}

        {/* Approximate monitoring geofence (not an official boundary). */}
        <Polygon
          positions={MONITORING_GEOFENCE.map(([lat, lon]) => [lat, lon])}
          pathOptions={{ color: "#38bdf8", weight: 1.5, fillOpacity: 0.05, dashArray: "6 4" }}
        >
          <LTooltip sticky>{GEOFENCE_DISCLAIMER}</LTooltip>
        </Polygon>

        {/* Lightning proximity overlay */}
        {lightning?.nearestKm != null && lightning.recentCount > 0 && (
          <Circle
            center={[TUAS_MONITOR_POINT.lat, TUAS_MONITOR_POINT.lon]}
            radius={lightning.nearestKm * 1000}
            pathOptions={{ color: "#f59e0b", weight: 1, fillOpacity: 0.04 }}
          >
            <LTooltip>
              Nearest lightning ≈ {lightning.nearestKm.toFixed(1)} km ·{" "}
              {lightning.recentCount} recent
            </LTooltip>
          </Circle>
        )}

        {/* Vessels */}
        {vessels.map((v) => {
          const style = MOTION_STYLE[v.motion];
          return (
            <CircleMarker
              key={v.mmsi}
              center={[v.lat, v.lon]}
              radius={style.radius}
              pathOptions={{
                color: style.color,
                fillColor: style.color,
                fillOpacity: 0.7,
                weight: 1,
              }}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-bold">{v.name}</p>
                  <p>MMSI: {v.mmsi}</p>
                  <p>Type: {v.vesselType}</p>
                  <p>Speed: {v.speedKnots} kt</p>
                  <p>Course: {v.courseDegrees ?? "—"}°</p>
                  <p>Heading: {v.headingDegrees ?? "—"}°</p>
                  <p>Status: {snapshot.vessels.status}</p>
                  {v.motion === "stationary" && (
                    <p className="mt-1 italic text-amber-700">
                      {STATIONARY_VESSEL_NOTE}
                    </p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {tileError && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-base-800/70">
          <p className="rounded bg-base-700 px-3 py-1.5 text-xs text-slate-300">
            Base map tiles unavailable — showing geofence and vessels only.
          </p>
        </div>
      )}
    </div>
  );
}
