import type { Change } from "../../shared/collections";
import { db } from "../db/local";
import { onLocalWrite } from "../db/repo";
import { api, HttpError, NetworkError } from "./api";

export type SyncState = "idle" | "syncing" | "offline" | "auth" | "error";
export interface SyncStatus {
  state: SyncState;
  lastSyncAt: number | null;
}

let status: SyncStatus = { state: "idle", lastSyncAt: null };
const subscribers = new Set<() => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  subscribers.forEach((fn) => fn());
}

export const getSyncStatus = () => status;
export function subscribeSync(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

const CURSOR = "cursor";

// Aplica mudanças do servidor sem atropelar escritas locais mais novas ainda na fila.
export async function applyRemote(changes: Change[], sent: Change[], cursor: number): Promise<void> {
  await db.transaction("rw", db.tables, async () => {
    for (const s of sent) {
      const key = `${s.collection}:${s.id}`;
      const pending = await db.outbox.get(key);
      if (pending && pending.updatedAt === s.updatedAt) await db.outbox.delete(key);
    }
    for (const c of changes) {
      const key = `${c.collection}:${c.id}`;
      const pending = await db.outbox.get(key);
      if (pending) {
        if (pending.updatedAt > c.updatedAt) continue;
        await db.outbox.delete(key);
      }
      if (c.deleted || !c.data) await db.table(c.collection).delete(c.id);
      else await db.table(c.collection).put(c.data);
    }
    await db.meta.put({ key: CURSOR, value: cursor });
  });
}

let running: Promise<void> | null = null;
let again = false;

async function runOnce(): Promise<void> {
  setStatus({ state: "syncing" });
  try {
    const sent: Change[] = (await db.outbox.toArray()).map(({ key: _key, ...change }) => change);
    const cursor = ((await db.meta.get(CURSOR))?.value as number | undefined) ?? 0;
    const res = await api.sync({ cursor, changes: sent });
    await applyRemote(res.changes, sent, res.cursor);
    setStatus({ state: "idle", lastSyncAt: Date.now() });
  } catch (err) {
    if (err instanceof NetworkError) setStatus({ state: "offline" });
    else if (err instanceof HttpError && err.status === 401) setStatus({ state: "auth" });
    else {
      console.error("sync_failed", err);
      setStatus({ state: "error" });
    }
  }
}

export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await runOnce();
    } while (again && status.state === "idle");
    running = null;
  })();
  return running;
}

let started = false;

export function startSync(): void {
  if (started) return;
  started = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  onLocalWrite(() => {
    clearTimeout(timer);
    timer = setTimeout(syncNow, 2000);
  });
  window.addEventListener("online", () => void syncNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow();
  });
  setInterval(() => {
    if (document.visibilityState === "visible") void syncNow();
  }, 60_000);
  void syncNow();
}
