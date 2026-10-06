import cron from "node-cron";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";
import type { DB } from "./db";

const PREFIX = "fittrack-";

const todayLocal = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

// Um arquivo por dia: fittrack-YYYY-MM-DD.db.gz (rodar de novo no mesmo dia sobrescreve).
export async function runBackup(db: DB, dir: string, retentionDays: number): Promise<string> {
  const date = todayLocal();
  const tmpPath = path.join(dir, `${PREFIX}${date}.db.tmp`);
  const finalPath = path.join(dir, `${PREFIX}${date}.db.gz`);
  fs.mkdirSync(dir, { recursive: true });
  try {
    await db.backup(tmpPath);
    await pipeline(fs.createReadStream(tmpPath), zlib.createGzip({ level: 9 }), fs.createWriteStream(finalPath));
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }

  // Mantém os backups mais recentes. Nomes ISO ordenam cronologicamente.
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(PREFIX) && f.endsWith(".db.gz"))
    .sort();
  for (const f of files.slice(0, Math.max(0, files.length - retentionDays))) {
    fs.rmSync(path.join(dir, f), { force: true });
  }
  return finalPath;
}

export function scheduleBackups(db: DB, dir: string, retentionDays: number): void {
  cron.schedule(
    "30 3 * * *",
    () => {
      runBackup(db, dir, retentionDays)
        .then((file) => console.log(`backup_done ${file}`))
        .catch((err) => console.error("backup_failed", err));
    },
    { timezone: "America/Sao_Paulo" },
  );
}
