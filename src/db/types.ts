export interface SyncFields {
  id: string;
  updatedAt: number;
}

export interface PerformedSession extends SyncFields {
  templateId: string;
  date: string; // YYYY-MM-DD em America/Sao_Paulo
  startedAt: number;
  finishedAt: number | null;
  durationMin: number | null;
  note: string;
  status: "in_progress" | "done";
  warmupChecked: number[];
  cooldownChecked: number[];
}

export interface PerformedSet extends SyncFields {
  performedSessionId: string;
  exerciseId: string;
  setNumber: number;
  // Repetições ou segundos, conforme o alvo do exercício (por lado, se unilateral).
  value: number;
  extraLoad: number; // kg
  variation: string | null;
  createdAt: number;
}

export interface HiitRun extends SyncFields {
  performedSessionId: string;
  roundsDone: number;
  workSec: number;
  restSec: number;
}

export type MeasurementType = "peso" | "cintura";

export interface Measurement extends SyncFields {
  date: string;
  type: MeasurementType;
  value: number;
}

export type GameType = "campeonato" | "treino" | "brincadeira";
export type GameModality = "futsal" | "society";

export interface Game extends SyncFields {
  date: string;
  time: string | null; // HH:mm
  modality: GameModality;
  type: GameType;
}

export interface Settings extends SyncFields {
  cycleWeek: number;
  // Segunda-feira da semana em que cycleWeek foi definido; a semana avança sozinha.
  cycleWeekAnchor: string;
  deloadEvery: 5 | 6;
  hiitPhase: "auto" | 1 | 2 | 3;
}

export const SETTINGS_ID = "settings";
