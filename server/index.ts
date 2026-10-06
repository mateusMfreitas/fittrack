import path from "node:path";
import { createApp } from "./app";
import { scheduleBackups } from "./backup";
import { openDatabase } from "./db";

const PORT = Number(process.env.PORT ?? 3000);
const DATABASE_PATH = process.env.DATABASE_PATH ?? "./data/fittrack.db";
const BACKUP_PATH = process.env.BACKUP_PATH;
const BACKUP_RETENTION_DAYS = Math.max(1, Number(process.env.BACKUP_RETENTION_DAYS ?? 14));
const passwordHash = process.env.APP_PASSWORD_HASH ?? "";
const production = process.env.NODE_ENV === "production";

if (!passwordHash.startsWith("scrypt:")) {
  console.error('APP_PASSWORD_HASH ausente ou inválido. Gere com: npm run hash-password -- "sua-senha"');
  process.exit(1);
}

const db = openDatabase(DATABASE_PATH);
const app = createApp({
  db,
  passwordHash,
  secureCookie: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : production,
  staticDir: path.resolve("dist"),
});

if (BACKUP_PATH) scheduleBackups(db, BACKUP_PATH, BACKUP_RETENTION_DAYS);

app.listen(PORT, () => console.log(`fittrack ouvindo na porta ${PORT}`));
