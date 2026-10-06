import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/local";
import { SETTINGS_ID, type Game, type Measurement, type PerformedSession, type Settings } from "../db/types";
import { currentCycleWeek, defaultSettings, isDeloadWeek } from "../domain/cycle";
import { dateSP } from "../domain/time";
import { useNow } from "./useNow";

export interface AppData {
  nowMs: number;
  today: string;
  sessions: PerformedSession[];
  games: Game[];
  measurements: Measurement[];
  settings: Settings;
  cycleWeek: number;
  deload: boolean;
}

// Dados que quase toda tela usa. undefined enquanto o IndexedDB carrega.
export function useAppData(): AppData | undefined {
  const nowMs = useNow();
  const today = dateSP(nowMs);
  const data = useLiveQuery(async () => {
    const [sessions, games, measurements, settings] = await Promise.all([
      db.performedSessions.toArray(),
      db.games.toArray(),
      db.measurements.toArray(),
      db.settings.get(SETTINGS_ID),
    ]);
    return { sessions, games, measurements, settings };
  }, []);
  if (!data) return undefined;
  const settings = data.settings ?? defaultSettings(today);
  const cycleWeek = currentCycleWeek(settings, today);
  return {
    nowMs,
    today,
    sessions: data.sessions,
    games: data.games,
    measurements: data.measurements,
    settings,
    cycleWeek,
    deload: isDeloadWeek(cycleWeek, settings.deloadEvery),
  };
}
