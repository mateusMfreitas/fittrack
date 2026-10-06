// Coleções sincronizadas entre o IndexedDB do aparelho e o servidor.
export const COLLECTIONS = [
  "performedSessions",
  "performedSets",
  "hiitRuns",
  "measurements",
  "games",
  "settings",
] as const;

export type Collection = (typeof COLLECTIONS)[number];

export interface Change {
  collection: Collection;
  id: string;
  updatedAt: number;
  deleted: boolean;
  // Registro completo; null quando deleted.
  data: Record<string, unknown> | null;
}

export interface SyncRequest {
  cursor: number;
  changes: Change[];
}

export interface SyncResponse {
  cursor: number;
  changes: Change[];
}
