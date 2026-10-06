import { Router } from "express";
import { z } from "zod";
import { COLLECTIONS, type Change, type SyncResponse } from "../shared/collections";
import type { DB } from "./db";

const changeSchema = z.object({
  collection: z.enum(COLLECTIONS),
  id: z.string().min(1).max(200),
  updatedAt: z.number().int().nonnegative(),
  deleted: z.boolean(),
  data: z.record(z.string(), z.unknown()).nullable(),
});

const requestSchema = z.object({
  cursor: z.number().int().nonnegative(),
  changes: z.array(changeSchema).max(50_000),
});

interface Row {
  collection: Change["collection"];
  id: string;
  data: string | null;
  updated_at: number;
  deleted: number;
  seq: number;
}

const toChange = (r: Row): Change => ({
  collection: r.collection,
  id: r.id,
  updatedAt: r.updated_at,
  deleted: r.deleted === 1,
  data: r.data ? JSON.parse(r.data) : null,
});

export function createSync(db: DB) {
  const getRow = db.prepare("SELECT * FROM records WHERE collection = ? AND id = ?");
  const maxSeq = db.prepare("SELECT COALESCE(MAX(seq), 0) AS seq FROM records");
  const upsert = db.prepare(`
    INSERT INTO records (collection, id, data, updated_at, deleted, seq)
    VALUES (@collection, @id, @data, @updated_at, @deleted, @seq)
    ON CONFLICT (collection, id) DO UPDATE SET
      data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted, seq = excluded.seq
  `);
  const since = db.prepare("SELECT * FROM records WHERE seq > ? ORDER BY seq");

  // Last-write-wins por updatedAt. Mudança recusada devolve a versão do servidor,
  // mesmo que o cliente já tenha passado do seq dela.
  const run = db.transaction((cursor: number, changes: Change[]): SyncResponse => {
    let seq = (maxSeq.get() as { seq: number }).seq;
    const rejected: Row[] = [];
    for (const c of changes) {
      const existing = getRow.get(c.collection, c.id) as Row | undefined;
      if (existing && existing.updated_at > c.updatedAt) {
        rejected.push(existing);
        continue;
      }
      if (existing && existing.updated_at === c.updatedAt && existing.deleted === Number(c.deleted)) continue;
      seq += 1;
      upsert.run({
        collection: c.collection,
        id: c.id,
        data: c.deleted || !c.data ? null : JSON.stringify(c.data),
        updated_at: c.updatedAt,
        deleted: c.deleted ? 1 : 0,
        seq,
      });
    }
    const rows = since.all(cursor) as Row[];
    const seen = new Set(rows.map((r) => `${r.collection}:${r.id}`));
    for (const r of rejected) if (!seen.has(`${r.collection}:${r.id}`)) rows.push(r);
    return { cursor: seq, changes: rows.map(toChange) };
  });

  const router = Router();
  router.post("/", (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Payload de sincronização inválido." });
      return;
    }
    res.json(run(parsed.data.cursor, parsed.data.changes));
  });
  return router;
}
