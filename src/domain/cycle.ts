import { HIIT_PHASES, type ExerciseTemplate, type HiitPhase } from "../plan/plan";
import type { Settings } from "../db/types";
import { SETTINGS_ID } from "../db/types";
import { diffDays, weekStart } from "./time";

export function defaultSettings(today: string): Settings {
  // updatedAt 0: se já existir configuração no servidor, ela sempre vence a padrão.
  return {
    id: SETTINGS_ID,
    updatedAt: 0,
    cycleWeek: 1,
    cycleWeekAnchor: weekStart(today),
    deloadEvery: 5,
    hiitPhase: "auto",
  };
}

export function currentCycleWeek(settings: Settings, today: string): number {
  const weeks = Math.floor(diffDays(weekStart(today), settings.cycleWeekAnchor) / 7);
  return Math.max(1, settings.cycleWeek + weeks);
}

// Semana de redução: a cada `deloadEvery` semanas do ciclo.
export function isDeloadWeek(cycleWeek: number, deloadEvery: number): boolean {
  return cycleWeek % deloadEvery === 0;
}

export function effectiveSets(ex: ExerciseTemplate, deload: boolean): number {
  return deload ? Math.ceil(ex.sets / 2) : ex.sets;
}

export function hiitPhaseFor(cycleWeek: number, override: Settings["hiitPhase"] = "auto"): HiitPhase {
  const id = override !== "auto" ? override : cycleWeek <= 2 ? 1 : cycleWeek <= 4 ? 2 : 3;
  return HIIT_PHASES.find((p) => p.id === id)!;
}
