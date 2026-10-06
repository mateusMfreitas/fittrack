import type { Collection } from "../../shared/collections";
import { exercisesOf } from "../plan/plan";
import { defaultSettings, effectiveSets } from "../domain/cycle";
import { exerciseHistory, prefill, type SetValues } from "../domain/progression";
import { dateSP } from "../domain/time";
import { db } from "./local";
import {
  SETTINGS_ID,
  type Game,
  type HiitRun,
  type Measurement,
  type PerformedSession,
  type PerformedSet,
  type Settings,
} from "./types";

type Op =
  | { collection: Collection; record: { id: string } & Record<string, unknown> }
  | { collection: Collection; deleteId: string };

const listeners = new Set<() => void>();
export function onLocalWrite(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let lastStamp = 0;
export function nextStamp(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

export function uid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Toda escrita grava no IndexedDB e entra na fila de sincronização na mesma transação.
export async function write(ops: Op[], stamp: number | null = null): Promise<void> {
  if (ops.length === 0) return;
  await db.transaction("rw", db.tables, async () => {
    for (const op of ops) {
      if ("record" in op) {
        const updatedAt = stamp ?? nextStamp();
        const record = { ...op.record, updatedAt };
        await db.table(op.collection).put(record);
        await db.outbox.put({
          key: `${op.collection}:${record.id}`,
          collection: op.collection,
          id: record.id,
          updatedAt,
          deleted: false,
          data: record,
        });
      } else {
        const updatedAt = stamp ?? nextStamp();
        await db.table(op.collection).delete(op.deleteId);
        await db.outbox.put({
          key: `${op.collection}:${op.deleteId}`,
          collection: op.collection,
          id: op.deleteId,
          updatedAt,
          deleted: true,
          data: null,
        });
      }
    }
  });
  listeners.forEach((fn) => fn());
}

// ---------- Sessões ----------

export async function startSession(templateId: string): Promise<PerformedSession> {
  const open = await db.performedSessions.where("status").equals("in_progress").toArray();
  const same = open.find((s) => s.templateId === templateId);
  if (same) return same;
  const now = Date.now();
  const session: PerformedSession = {
    id: uid(),
    updatedAt: 0,
    templateId,
    date: dateSP(now),
    startedAt: now,
    finishedAt: null,
    durationMin: null,
    note: "",
    status: "in_progress",
    warmupChecked: [],
    cooldownChecked: [],
  };
  await write([{ collection: "performedSessions", record: { ...session } }]);
  return session;
}

export async function updateSession(id: string, patch: Partial<PerformedSession>): Promise<void> {
  const session = await db.performedSessions.get(id);
  if (!session) return;
  await write([{ collection: "performedSessions", record: { ...session, ...patch } }]);
}

export async function toggleChecklist(id: string, list: "warmupChecked" | "cooldownChecked", index: number) {
  const session = await db.performedSessions.get(id);
  if (!session) return;
  const cur = session[list];
  const next = cur.includes(index) ? cur.filter((i) => i !== index) : [...cur, index];
  await updateSession(id, { [list]: next });
}

export async function finishSession(id: string, note: string): Promise<void> {
  const session = await db.performedSessions.get(id);
  if (!session) return;
  const finishedAt = Date.now();
  await updateSession(id, {
    status: "done",
    finishedAt,
    durationMin: Math.max(1, Math.round((finishedAt - session.startedAt) / 60_000)),
    note: note.trim(),
  });
}

export async function deleteSession(id: string): Promise<void> {
  const sets = await db.performedSets.where("performedSessionId").equals(id).toArray();
  const runs = await db.hiitRuns.where("performedSessionId").equals(id).toArray();
  await write([
    ...sets.map((s) => ({ collection: "performedSets" as const, deleteId: s.id })),
    ...runs.map((r) => ({ collection: "hiitRuns" as const, deleteId: r.id })),
    { collection: "performedSessions", deleteId: id },
  ]);
}

// ---------- Séries ----------

const setId = (sessionId: string, exerciseId: string, setNumber: number) =>
  `${sessionId}:${exerciseId}:${setNumber}`;

export async function markSet(
  sessionId: string,
  exerciseId: string,
  setNumber: number,
  values: SetValues,
): Promise<void> {
  const set: PerformedSet = {
    id: setId(sessionId, exerciseId, setNumber),
    updatedAt: 0,
    performedSessionId: sessionId,
    exerciseId,
    setNumber,
    ...values,
    createdAt: nextStamp(),
  };
  await write([{ collection: "performedSets", record: { ...set } }]);
}

// Desfaz a última marcação (ou o último "repetir tudo igual", que é uma marcação só).
export async function undoLastMark(sessionId: string): Promise<number> {
  const sets = await db.performedSets.where("performedSessionId").equals(sessionId).toArray();
  if (sets.length === 0) return 0;
  const last = Math.max(...sets.map((s) => s.createdAt));
  const batch = sets.filter((s) => s.createdAt === last);
  await write(batch.map((s) => ({ collection: "performedSets" as const, deleteId: s.id })));
  return batch.length;
}

// Marca todas as séries que faltam com os valores da última vez.
export async function repeatAll(sessionId: string, deload: boolean): Promise<number> {
  const session = await db.performedSessions.get(sessionId);
  if (!session) return 0;
  const exercises = exercisesOf(session.templateId);
  const all = await db.performedSets
    .where("exerciseId")
    .anyOf(exercises.map((e) => e.id))
    .toArray();
  const current = all.filter((s) => s.performedSessionId === sessionId);
  const createdAt = nextStamp();
  const added: PerformedSet[] = [];
  for (const ex of exercises) {
    const last = exerciseHistory(ex.id, all, sessionId)[0];
    for (let n = 1; n <= effectiveSets(ex, deload); n++) {
      if (current.some((s) => s.exerciseId === ex.id && s.setNumber === n)) continue;
      const set: PerformedSet = {
        id: setId(sessionId, ex.id, n),
        updatedAt: 0,
        performedSessionId: sessionId,
        exerciseId: ex.id,
        setNumber: n,
        ...prefill(ex, n, last, current),
        createdAt,
      };
      current.push(set);
      added.push(set);
    }
  }
  await write(added.map((s) => ({ collection: "performedSets" as const, record: { ...s } })));
  return added.length;
}

// ---------- HIIT ----------

export async function saveHiitRun(sessionId: string, run: Pick<HiitRun, "roundsDone" | "workSec" | "restSec">) {
  // Um registro por sessão: refazer o timer sobrescreve.
  await write([
    { collection: "hiitRuns", record: { id: `hiit:${sessionId}`, performedSessionId: sessionId, ...run } },
  ]);
}

// ---------- Medidas e jogos ----------

export async function addMeasurement(m: Pick<Measurement, "date" | "type" | "value">) {
  await write([{ collection: "measurements", record: { id: uid(), ...m } }]);
}
export const deleteMeasurement = (id: string) => write([{ collection: "measurements", deleteId: id }]);

export async function addGame(g: Pick<Game, "date" | "time" | "modality" | "type">) {
  await write([{ collection: "games", record: { id: uid(), ...g } }]);
}
export const deleteGame = (id: string) => write([{ collection: "games", deleteId: id }]);

// ---------- Configuração ----------

export async function ensureSettings(): Promise<void> {
  if (await db.settings.get(SETTINGS_ID)) return;
  await write([{ collection: "settings", record: { ...defaultSettings(dateSP()) } }], 0);
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const cur = (await db.settings.get(SETTINGS_ID)) ?? defaultSettings(dateSP());
  await write([{ collection: "settings", record: { ...cur, ...patch, id: SETTINGS_ID } }]);
}

export async function clearLocalData(): Promise<void> {
  await db.transaction("rw", db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
}

