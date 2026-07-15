"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppMode, DemoScenarioId } from "@/types";

interface AppState {
  /** User-selected mode toggle: demo or live. */
  mode: AppMode;
  scenario: DemoScenarioId;
  setMode: (m: AppMode) => void;
  setScenario: (s: DemoScenarioId) => void;
}

const AppStateContext = createContext<AppState | null>(null);

const MODE_KEY = "tuas.mode";
const SCENARIO_KEY = "tuas.scenario";

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>("demo");
  const [scenario, setScenarioState] =
    useState<DemoScenarioId>("pharmaceutical-crisis");

  // Restore persisted selection after mount (avoids hydration mismatch).
  useEffect(() => {
    const m = window.localStorage.getItem(MODE_KEY);
    const s = window.localStorage.getItem(SCENARIO_KEY);
    if (m === "demo" || m === "live") setModeState(m);
    if (
      s === "normal-operations" ||
      s === "thunderstorm" ||
      s === "regional-disruption" ||
      s === "pharmaceutical-crisis"
    ) {
      setScenarioState(s);
    }
  }, []);

  const value = useMemo<AppState>(
    () => ({
      mode,
      scenario,
      setMode: (m) => {
        setModeState(m);
        window.localStorage.setItem(MODE_KEY, m);
      },
      setScenario: (s) => {
        setScenarioState(s);
        window.localStorage.setItem(SCENARIO_KEY, s);
      },
    }),
    [mode, scenario],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
