import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/db/local";
import {
  addMeasurement,
  clearLocalData,
  deleteSession,
  ensureSettings,
  finishSession,
  markSet,
  repeatAll,
  startSession,
  undoLastMark,
} from "../src/db/repo";
import { exportData, importData, parseBackup } from "../src/domain/backup";
import { applyRemote } from "../src/sync/syncEngine";

beforeEach(async () => {
  await clearLocalData();
});

const v = (value: number) => ({ value, extraLoad: 0, variation: "padrão" });

describe("repositório local", () => {
  it("grava cada série na hora e enfileira para o sync", async () => {
    const s = await startSession("d1");
    await markSet(s.id, "flexao", 1, v(12));
    expect(await db.performedSets.count()).toBe(1);
    const keys = (await db.outbox.toArray()).map((o) => o.key).sort();
    expect(keys).toEqual([`performedSessions:${s.id}`, `performedSets:${s.id}:flexao:1`].sort());
  });

  it("retoma a sessão em andamento em vez de criar outra", async () => {
    const a = await startSession("d1");
    const b = await startSession("d1");
    expect(b.id).toBe(a.id);
    expect(await db.performedSessions.count()).toBe(1);
  });

  it("desfaz a última marcação", async () => {
    const s = await startSession("d1");
    await markSet(s.id, "flexao", 1, v(12));
    await markSet(s.id, "flexao", 2, v(11));
    expect(await undoLastMark(s.id)).toBe(1);
    const left = await db.performedSets.toArray();
    expect(left.map((x) => x.setNumber)).toEqual([1]);
    expect((await db.outbox.get(`performedSets:${s.id}:flexao:2`))?.deleted).toBe(true);
  });

  it("repetir tudo igual usa os valores da última sessão e desfaz de uma vez", async () => {
    const first = await startSession("d4");
    await markSet(first.id, "salto-vertical", 1, { value: 7, extraLoad: 0, variation: null });
    await markSet(first.id, "salto-vertical", 2, { value: 6, extraLoad: 0, variation: null });
    await finishSession(first.id, "ok");

    const second = await startSession("d4");
    expect(second.id).not.toBe(first.id);
    await markSet(second.id, "salto-vertical", 1, { value: 8, extraLoad: 0, variation: null });
    const added = await repeatAll(second.id, false);
    // d4: 4 + 4 + 6 + 4 séries, menos a que já estava marcada
    expect(added).toBe(17);
    const mine = await db.performedSets.where("performedSessionId").equals(second.id).toArray();
    const salto = mine.filter((x) => x.exerciseId === "salto-vertical").sort((a, b) => a.setNumber - b.setNumber);
    expect(salto.map((x) => x.value)).toEqual([8, 6, 6, 6]);
    expect(await undoLastMark(second.id)).toBe(17);
    expect(await db.performedSets.where("performedSessionId").equals(second.id).count()).toBe(1);
  });

  it("semana de redução: repetir tudo marca metade das séries", async () => {
    const s = await startSession("d4");
    expect(await repeatAll(s.id, true)).toBe(2 + 2 + 3 + 2);
  });

  it("finaliza com duração e apaga sessão com as séries", async () => {
    const s = await startSession("d1");
    await markSet(s.id, "flexao", 1, v(12));
    await finishSession(s.id, "  boa  ");
    const done = await db.performedSessions.get(s.id);
    expect(done).toMatchObject({ status: "done", note: "boa" });
    expect(done!.durationMin).toBeGreaterThanOrEqual(1);
    await deleteSession(s.id);
    expect(await db.performedSessions.count()).toBe(0);
    expect(await db.performedSets.count()).toBe(0);
  });
});

describe("sync no cliente", () => {
  it("configuração padrão nunca vence a do servidor", async () => {
    await ensureSettings();
    const pending = await db.outbox.get("settings:settings");
    expect(pending?.updatedAt).toBe(0);
  });

  it("mudança remota não atropela escrita local mais nova", async () => {
    await addMeasurement({ date: "2026-10-06", type: "peso", value: 80 });
    const local = (await db.measurements.toArray())[0];
    await applyRemote(
      [{ collection: "measurements", id: local.id, updatedAt: local.updatedAt - 10, deleted: false, data: { ...local, value: 70 } }],
      [],
      5,
    );
    expect((await db.measurements.get(local.id))?.value).toBe(80);
    expect(await db.outbox.count()).toBe(1);
    expect((await db.meta.get("cursor"))?.value).toBe(5);
  });

  it("confirma o que foi enviado e aplica deleção remota", async () => {
    await addMeasurement({ date: "2026-10-06", type: "peso", value: 80 });
    const local = (await db.measurements.toArray())[0];
    const sent = (await db.outbox.toArray()).map(({ key: _k, ...c }) => c);
    await applyRemote([], sent, 1);
    expect(await db.outbox.count()).toBe(0);
    await applyRemote(
      [{ collection: "measurements", id: local.id, updatedAt: local.updatedAt + 1, deleted: true, data: null }],
      [],
      2,
    );
    expect(await db.measurements.count()).toBe(0);
  });
});

describe("backup", () => {
  it("exporta e importa substituindo os dados", async () => {
    await addMeasurement({ date: "2026-10-01", type: "peso", value: 81 });
    const s = await startSession("d1");
    await markSet(s.id, "flexao", 1, v(12));
    const file = parseBackup(JSON.stringify(await exportData()));

    await addMeasurement({ date: "2026-10-08", type: "peso", value: 79 });
    const extra = (await db.measurements.toArray()).find((m) => m.value === 79)!;
    await importData(file);
    expect(await db.measurements.count()).toBe(1);
    expect(await db.performedSets.count()).toBe(1);
    expect((await db.outbox.get(`measurements:${extra.id}`))?.deleted).toBe(true);
  });

  it("recusa arquivo que não é backup", () => {
    expect(() => parseBackup("{")).toThrow();
    expect(() => parseBackup('{"app":"outro"}')).toThrow();
    expect(() => parseBackup('{"app":"fittrack","schemaVersion":1,"data":{"games":[{"x":1}]}}')).toThrow();
  });
});
