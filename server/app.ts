import cookieParser from "cookie-parser";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { createAuth } from "./auth";
import type { DB } from "./db";
import { createSync } from "./sync";

export interface AppOptions {
  db: DB;
  passwordHash: string;
  secureCookie: boolean;
  staticDir?: string;
}

// Arquivos que o navegador precisa revalidar sempre para a PWA atualizar.
const NO_CACHE = new Set(["index.html", "sw.js", "registerSW.js", "manifest.webmanifest"]);

export function createApp({ db, passwordHash, secureCookie, staticDir }: AppOptions) {
  const app = express();
  app.set("trust proxy", 1); // atrás do Traefik
  app.disable("x-powered-by");
  app.use(express.json({ limit: "20mb" }));
  app.use(cookieParser());

  const auth = createAuth({ db, passwordHash, secureCookie });
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/auth", auth.router);
  app.use("/api/sync", auth.requireAuth, createSync(db));
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Rota não encontrada." });
  });

  if (staticDir && fs.existsSync(staticDir)) {
    app.use(
      express.static(staticDir, {
        setHeaders(res, file) {
          const name = path.basename(file);
          if (NO_CACHE.has(name)) res.setHeader("Cache-Control", "no-cache");
          else if (file.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        },
      }),
    );
    // Fallback do SPA
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  return app;
}
