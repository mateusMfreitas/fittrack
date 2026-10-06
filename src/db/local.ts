import Dexie, { type Table } from "dexie";
import type { Change } from "../../shared/collections";
import type { Game, HiitRun, Measurement, PerformedSession, PerformedSet, Settings } from "./types";

export interface OutboxEntry extends Change {
  key: string; // `${collection}:${id}` — escritas seguidas no mesmo registro se sobrepõem
}

export class LocalDB extends Dexie {
  performedSessions!: Table<PerformedSession, string>;
  performedSets!: Table<PerformedSet, string>;
  hiitRuns!: Table<HiitRun, string>;
  measurements!: Table<Measurement, string>;
  games!: Table<Game, string>;
  settings!: Table<Settings, string>;
  outbox!: Table<OutboxEntry, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super("fittrack");
    this.version(1).stores({
      performedSessions: "id, date, templateId, status",
      performedSets: "id, performedSessionId, exerciseId, createdAt",
      hiitRuns: "id, performedSessionId",
      measurements: "id, date, type",
      games: "id, date, type",
      settings: "id",
      outbox: "key",
      meta: "key",
    });
  }
}

export const db = new LocalDB();
