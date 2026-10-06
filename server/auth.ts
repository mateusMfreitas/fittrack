import crypto from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import type { DB } from "./db";
import { verifyPassword } from "./password";

const COOKIE = "ft_session";
const SESSION_MS = 365 * 24 * 3_600_000;
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export interface AuthOptions {
  db: DB;
  passwordHash: string;
  secureCookie: boolean;
}

export function createAuth({ db, passwordHash, secureCookie }: AuthOptions) {
  const failures = new Map<string, { count: number; resetAt: number }>();

  const isValid = (token: string | undefined): boolean => {
    if (!token) return false;
    const row = db.prepare("SELECT expires_at FROM sessions WHERE token_hash = ?").get(sha256(token)) as
      | { expires_at: number }
      | undefined;
    return !!row && row.expires_at > Date.now();
  };

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (isValid(req.cookies?.[COOKIE])) return next();
    res.status(401).json({ error: "Não autenticado." });
  };

  const router = Router();

  router.post("/login", (req, res) => {
    const ip = req.ip ?? "unknown";
    const now = Date.now();
    const entry = failures.get(ip);
    if (entry && entry.resetAt <= now) failures.delete(ip);
    if ((failures.get(ip)?.count ?? 0) >= MAX_FAILURES) {
      res.status(429).json({ error: "Muitas tentativas. Tente de novo em alguns minutos." });
      return;
    }

    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!verifyPassword(password, passwordHash)) {
      const cur = failures.get(ip) ?? { count: 0, resetAt: now + WINDOW_MS };
      cur.count += 1;
      failures.set(ip, cur);
      res.status(401).json({ error: "Senha incorreta." });
      return;
    }

    failures.delete(ip);
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
    const token = crypto.randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)").run(
      sha256(token),
      now,
      now + SESSION_MS,
    );
    res.cookie(COOKIE, token, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: "lax",
      maxAge: SESSION_MS,
      path: "/",
    });
    res.json({ ok: true });
  });

  router.post("/logout", (req, res) => {
    const token = req.cookies?.[COOKIE];
    if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
    res.clearCookie(COOKIE, { path: "/" });
    res.json({ ok: true });
  });

  router.get("/me", requireAuth, (_req, res) => {
    res.json({ ok: true });
  });

  return { router, requireAuth };
}
