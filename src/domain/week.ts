import { SESSIONS, SKIPPABLE_SESSION_ID, sessionById, type SessionTemplate } from "../plan/plan";
import type { Game, PerformedSession } from "../db/types";
import { addDays, diffDays, weekDates, weekStart } from "./time";

export interface WeekContext {
  today: string;
  sessions: PerformedSession[];
  games: Game[];
}

const inWeek = (date: string, ref: string) => weekStart(date) === weekStart(ref);

// Só jogos de campeonato entram nas regras; treino e brincadeira são apenas atividade.
export const championshipGames = (games: Game[]) => games.filter((g) => g.type === "campeonato");

// Semana com dois jogos de campeonato: Dia 2 dispensado.
export function skippedSessionIds(games: Game[], weekRef: string): string[] {
  const count = championshipGames(games).filter((g) => inWeek(g.date, weekRef)).length;
  return count >= 2 ? [SKIPPABLE_SESSION_ID] : [];
}

export function doneTemplateIds(sessions: PerformedSession[], weekRef: string): Set<string> {
  return new Set(sessions.filter((s) => s.status === "done" && inWeek(s.date, weekRef)).map((s) => s.templateId));
}

export function remainingSessions(ctx: WeekContext, weekRef: string = ctx.today): SessionTemplate[] {
  const done = doneTemplateIds(ctx.sessions, weekRef);
  const skipped = skippedSessionIds(ctx.games, weekRef);
  return SESSIONS.filter((s) => !done.has(s.id) && !skipped.includes(s.id)).sort((a, b) => a.order - b.order);
}

export function sessionInProgress(sessions: PerformedSession[]): PerformedSession | undefined {
  return sessions.filter((s) => s.status === "in_progress").sort((a, b) => b.startedAt - a.startedAt)[0];
}

export type Suggestion =
  | { kind: "continue"; session: PerformedSession; template: SessionTemplate }
  | { kind: "next"; template: SessionTemplate }
  | { kind: "rest" };

// Sugestão do dia: próxima sessão ainda não feita na semana.
export function suggestToday(ctx: WeekContext): Suggestion {
  const current = sessionInProgress(ctx.sessions);
  const currentTemplate = current && sessionById(current.templateId);
  if (current && currentTemplate) return { kind: "continue", session: current, template: currentTemplate };
  const next = remainingSessions(ctx)[0];
  return next ? { kind: "next", template: next } : { kind: "rest" };
}

export interface DayPlan {
  date: string;
  done: PerformedSession[];
  inProgress: PerformedSession | null;
  planned: SessionTemplate | null;
  games: Game[];
}

function legConflict(date: string, games: Game[], legDates: Set<string>): boolean {
  const nearGame = championshipGames(games).some((g) => Math.abs(diffDays(g.date, date)) <= 1);
  return nearGame || legDates.has(addDays(date, -1));
}

// Os 7 dias da semana de `weekRef`: o que foi feito, os jogos e uma projeção das sessões
// que faltam. A projeção de hoje é sempre a sugestão do dia; nos dias seguintes, Dia 3 e
// Dia 4 são empurrados para longe de jogo de campeonato e um do outro.
export function planWeek(ctx: WeekContext, weekRef: string = ctx.today): DayPlan[] {
  const dates = weekDates(weekRef);
  const days: DayPlan[] = dates.map((date) => ({
    date,
    done: ctx.sessions.filter((s) => s.status === "done" && s.date === date),
    inProgress: null,
    planned: null,
    games: ctx.games.filter((g) => g.date === date).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")),
  }));
  if (dates[6] < ctx.today) return days;

  const remaining = remainingSessions(ctx, weekRef);
  const legDates = new Set(
    ctx.sessions.filter((s) => sessionById(s.templateId)?.legLoad).map((s) => s.date),
  );

  const current = sessionInProgress(ctx.sessions);
  for (const day of days) {
    if (day.date < ctx.today) continue;
    const isToday = day.date === ctx.today;
    if (isToday && current) {
      day.inProgress = current;
      const i = remaining.findIndex((s) => s.id === current.templateId);
      if (i >= 0) remaining.splice(i, 1);
      continue;
    }
    if (day.done.length > 0) continue;
    const next = remaining[0];
    if (!next) break;
    if (!isToday && next.legLoad && legConflict(day.date, ctx.games, legDates)) continue;
    day.planned = next;
    if (next.legLoad) legDates.add(day.date);
    remaining.shift();
  }
  return days;
}
