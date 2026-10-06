import { SESSIONS, sessionById } from "../plan/plan";
import type { Game, PerformedSession } from "../db/types";
import { addDays, dateSP, formatDate, spToMs } from "./time";
import { championshipGames } from "./week";

export interface Alert {
  kind: "48h" | "consecutive";
  message: string;
}

const H48 = 48 * 3_600_000;
// Jogo sem horário cadastrado: assume-se à noite.
export const DEFAULT_GAME_TIME = "19:00";

export const gameMs = (g: Game) => spToMs(g.date, g.time ?? DEFAULT_GAME_TIME);

// Alertas ao sugerir/abrir uma sessão. Só valem para sessões pesadas de perna (Dia 3 e Dia 4).
export function sessionAlerts(
  templateId: string,
  ctx: { nowMs: number; sessions: PerformedSession[]; games: Game[] },
): Alert[] {
  const template = sessionById(templateId);
  if (!template?.legLoad) return [];
  const alerts: Alert[] = [];

  for (const g of championshipGames(ctx.games)) {
    const delta = gameMs(g) - ctx.nowMs;
    if (Math.abs(delta) < H48) {
      const when = `${formatDate(g.date)}${g.time ? ` às ${g.time}` : ""}`;
      alerts.push({
        kind: "48h",
        message:
          delta >= 0
            ? `Jogo de campeonato (${g.modality}) em ${when}: menos de 48 h até o jogo.`
            : `Jogo de campeonato (${g.modality}) em ${when}: menos de 48 h desde o jogo.`,
      });
    }
  }

  const today = dateSP(ctx.nowMs);
  const yesterday = addDays(today, -1);
  const otherLeg = SESSIONS.filter((s) => s.legLoad && s.id !== templateId);
  for (const other of otherLeg) {
    const hit = ctx.sessions.find(
      (s) => s.templateId === other.id && (s.date === today || s.date === yesterday),
    );
    if (hit) {
      alerts.push({
        kind: "consecutive",
        message: `${other.name} foi feito ${hit.date === today ? "hoje" : "ontem"}: evite ${other.name} e ${template.name} em dias consecutivos.`,
      });
    }
  }
  return alerts;
}
