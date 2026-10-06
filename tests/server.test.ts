import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { runBackup } from "../server/backup";
import { openDatabase, type DB } from "../server/db";
import { hashPassword, verifyPassword } from "../server/password";
import type { Change } from "../shared/collections";

const PASSWORD = "senha-de-teste";
const passwordHash = hashPassword(PASSWORD);

let db: DB;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(":memory:");
  app = createApp({ db, passwordHash, secureCookie: false });
});

async function loggedIn() {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ password: PASSWORD }).expect(200);
  return agent;
}

const change = (id: string, updatedAt: number, value: number, deleted = false): Change => ({
  collection: "measurements",
  id,
  updatedAt,
  deleted,
  data: deleted ? null : { id, updatedAt, date: "2026-10-06", type: "peso", value },
});

describe("senha", () => {
  it("hash sem '$' e verificação", () => {
    expect(passwordHash).not.toContain("$");
    expect(verifyPassword(PASSWORD, passwordHash)).toBe(true);
    expect(verifyPassword("errada", passwordHash)).toBe(false);
    expect(verifyPassword(PASSWORD, "lixo")).toBe(false);
  });
});

describe("auth", () => {
  it("bloqueia a API sem login", async () => {
    await request(app).get("/api/auth/me").expect(401);
    await request(app).post("/api/sync").send({ cursor: 0, changes: [] }).expect(401);
  });

  it("login, sessão por cookie httpOnly e logout", async () => {
    const res = await request(app).post("/api/auth/login").send({ password: PASSWORD }).expect(200);
    expect(res.headers["set-cookie"][0]).toMatch(/HttpOnly/i);
    const agent = await loggedIn();
    await agent.get("/api/auth/me").expect(200);
    await agent.post("/api/auth/logout").expect(200);
    await agent.get("/api/auth/me").expect(401);
  });

  it("senha errada e limite de tentativas", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/auth/login").send({ password: "errada" }).expect(401);
    }
    await request(app).post("/api/auth/login").send({ password: PASSWORD }).expect(429);
  });
});

describe("sync", () => {
  it("recusa payload inválido", async () => {
    const agent = await loggedIn();
    await agent.post("/api/sync").send({ cursor: 0, changes: [{ collection: "outra", id: "x" }] }).expect(400);
  });

  it("o que o aparelho A grava chega no aparelho B, e deleção se propaga", async () => {
    const a = await loggedIn();
    const b = await loggedIn();

    const push = await a.post("/api/sync").send({ cursor: 0, changes: [change("m1", 100, 80)] }).expect(200);
    expect(push.body.cursor).toBe(1);

    const pull = await b.post("/api/sync").send({ cursor: 0, changes: [] }).expect(200);
    expect(pull.body.changes).toHaveLength(1);
    expect(pull.body.changes[0].data.value).toBe(80);

    await b.post("/api/sync").send({ cursor: pull.body.cursor, changes: [change("m1", 200, 0, true)] }).expect(200);
    const again = await a.post("/api/sync").send({ cursor: push.body.cursor, changes: [] }).expect(200);
    expect(again.body.changes).toEqual([{ collection: "measurements", id: "m1", updatedAt: 200, deleted: true, data: null }]);

    const idle = await a.post("/api/sync").send({ cursor: again.body.cursor, changes: [] }).expect(200);
    expect(idle.body.changes).toEqual([]);
  });

  it("last-write-wins: mudança mais antiga é recusada e a versão do servidor volta", async () => {
    const agent = await loggedIn();
    const first = await agent.post("/api/sync").send({ cursor: 0, changes: [change("m1", 200, 80)] });
    const res = await agent
      .post("/api/sync")
      .send({ cursor: first.body.cursor, changes: [change("m1", 100, 70)] })
      .expect(200);
    expect(res.body.cursor).toBe(first.body.cursor);
    expect(res.body.changes).toHaveLength(1);
    expect(res.body.changes[0].data.value).toBe(80);
  });

  it("reenvio da mesma mudança não gera novo seq", async () => {
    const agent = await loggedIn();
    const one = await agent.post("/api/sync").send({ cursor: 0, changes: [change("m1", 100, 80)] });
    const two = await agent.post("/api/sync").send({ cursor: one.body.cursor, changes: [change("m1", 100, 80)] });
    expect(two.body).toEqual({ cursor: one.body.cursor, changes: [] });
  });
});

describe("backup", () => {
  it("gera um .db.gz por dia e mantém só os mais recentes", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fittrack-backup-"));
    fs.writeFileSync(path.join(dir, "fittrack-2020-01-01.db.gz"), "x");
    fs.writeFileSync(path.join(dir, "fittrack-2020-01-02.db.gz"), "x");
    const file = await runBackup(db, dir, 2);
    expect(fs.statSync(file).size).toBeGreaterThan(0);
    expect(fs.readdirSync(dir).sort()).toEqual(["fittrack-2020-01-02.db.gz", path.basename(file)]);
    fs.rmSync(dir, { recursive: true });
  });
});
