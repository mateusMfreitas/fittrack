import { COLLECTIONS, type Collection } from "../../shared/collections";
import { db } from "../db/local";
import { write } from "../db/repo";

type Row = { id: string } & Record<string, unknown>;

export interface BackupFile {
  app: "fittrack";
  schemaVersion: 1;
  exportedAt: string;
  data: Record<Collection, Row[]>;
}

export async function exportData(): Promise<BackupFile> {
  const data = {} as Record<Collection, Row[]>;
  for (const c of COLLECTIONS) data[c] = (await db.table(c).toArray()) as Row[];
  return { app: "fittrack", schemaVersion: 1, exportedAt: new Date().toISOString(), data };
}

export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("O arquivo não é um JSON válido.");
  }
  const file = raw as Partial<BackupFile>;
  if (!file || file.app !== "fittrack" || typeof file.data !== "object" || file.data === null) {
    throw new Error("O arquivo não é um backup do FitTrack.");
  }
  if (file.schemaVersion !== 1) throw new Error(`Versão de backup não suportada: ${file.schemaVersion}.`);
  const data = {} as Record<Collection, Row[]>;
  for (const c of COLLECTIONS) {
    const rows = (file.data as Record<string, unknown>)[c] ?? [];
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== "object" || typeof r.id !== "string")) {
      throw new Error(`Dados inválidos em "${c}".`);
    }
    data[c] = rows as Row[];
  }
  return { app: "fittrack", schemaVersion: 1, exportedAt: String(file.exportedAt ?? ""), data };
}

export const countRows = (b: BackupFile) => COLLECTIONS.reduce((n, c) => n + b.data[c].length, 0);

// Substitui todos os dados pelos do backup. Passa pela fila de sync, então vale para o servidor também.
export async function importData(backup: BackupFile): Promise<void> {
  const ops: Parameters<typeof write>[0] = [];
  for (const c of COLLECTIONS) {
    const incoming = new Set(backup.data[c].map((r) => r.id));
    const existing = (await db.table(c).toCollection().primaryKeys()) as string[];
    for (const id of existing) if (!incoming.has(id)) ops.push({ collection: c, deleteId: id });
    for (const record of backup.data[c]) ops.push({ collection: c, record });
  }
  await write(ops);
}
