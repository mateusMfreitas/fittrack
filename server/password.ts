import crypto from "node:crypto";

// Formato "scrypt:<salt hex>:<hash hex>": sem "$", para não quebrar em arquivos .env/compose.
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEYLEN);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== KEYLEN) return false;
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), KEYLEN);
  return crypto.timingSafeEqual(actual, expected);
}
