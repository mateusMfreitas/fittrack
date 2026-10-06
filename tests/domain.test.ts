import { describe, expect, it } from "vitest";
import { sessionAlerts } from "../src/domain/alerts";
import { currentCycleWeek, defaultSettings, effectiveSets, hiitPhaseFor, isDeloadWeek } from "../src/domain/cycle";
import { exerciseHistory, prefill, progressionSuggestion } from "../src/domain/progression";
import { pendingMeasures } from "../src/domain/reminders";
import { niceTicks } from "../src/domain/ticks";
import { addDays, dateSP, spToMs, weekDates, weekStart, weekdayIndex } from "../src/domain/time";
import { planWeek, skippedSessionIds, suggestToday } from "../src/domain/week";
import type { Game, Measurement, PerformedSession, PerformedSet } from "../src/db/types";
import { exerciseById } from "../src/plan/plan";

// Semana de referência: segunda 2026-10-05 a domingo 2026-10-11.
const MON = "2026-10-05";

let n = 0;
const session = (templateId: string, date: string, status: PerformedSession["status"] = "done"): PerformedSession => ({
  id: `s${++n}`,
  updatedAt: 1,
  templateId,
  date,
  startedAt: spToMs(date, "18:00"),
  finishedAt: null,
  durationMin: null,
  note: "",
  status,
  warmupChecked: [],
  cooldownChecked: [],
});
const game = (date: string, type: Game["type"], time: string | null = null): Game => ({
  id: `g${++n}`,
  updatedAt: 1,
  date,
  time,
  modality: "futsal",
  type,
});
const sets = (sessionId: string, exerciseId: string, values: number[], at: number, extra: Partial<PerformedSet> = {}) =>
  values.map<PerformedSet>((value, i) => ({
    id: `${sessionId}:${exerciseId}:${i + 1}`,
    updatedAt: 1,
    performedSessionId: sessionId,
    exerciseId,
    setNumber: i + 1,
    value,
    extraLoad: 0,
    variation: "padrão",
    createdAt: at + i,
    ...extra,
  }));

describe("time", () => {
  it("usa a data de São Paulo, não a UTC", () => {
    expect(dateSP(Date.parse("2026-10-06T01:30:00Z"))).toBe("2026-10-05");
    expect(dateSP(Date.parse("2026-10-06T03:00:00Z"))).toBe("2026-10-06");
  });
  it("converte hora de parede de SP em instante", () => {
    expect(spToMs("2026-10-06", "19:00")).toBe(Date.parse("2026-10-06T22:00:00Z"));
  });
  it("semana começa na segunda", () => {
    expect(weekdayIndex(MON)).toBe(0);
    expect(weekStart("2026-10-11")).toBe(MON);
    expect(weekStart("2026-10-12")).toBe("2026-10-12");
    expect(weekDates("2026-10-07")).toHaveLength(7);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("sugestão do dia", () => {
  it("sugere a próxima sessão ainda não feita na semana", () => {
    const s = suggestToday({ today: "2026-10-07", sessions: [session("d1", MON)], games: [] });
    expect(s).toMatchObject({ kind: "next", template: { id: "d2" } });
  });
  it("sessão da semana passada não conta", () => {
    const s = suggestToday({ today: MON, sessions: [session("d1", "2026-10-04")], games: [] });
    expect(s).toMatchObject({ kind: "next", template: { id: "d1" } });
  });
  it("sessão em andamento tem prioridade", () => {
    const s = suggestToday({ today: MON, sessions: [session("d3", MON, "in_progress")], games: [] });
    expect(s).toMatchObject({ kind: "continue", template: { id: "d3" } });
  });
  it("descanso quando as quatro foram feitas", () => {
    const sessions = ["d1", "d2", "d3", "d4"].map((t, i) => session(t, addDays(MON, i)));
    expect(suggestToday({ today: "2026-10-10", sessions, games: [] }).kind).toBe("rest");
  });
  it("dois jogos de campeonato na semana dispensam o Dia 2", () => {
    const games = [game("2026-10-07", "campeonato"), game("2026-10-10", "campeonato")];
    expect(skippedSessionIds(games, MON)).toEqual(["d2"]);
    const s = suggestToday({ today: "2026-10-06", sessions: [session("d1", MON)], games });
    expect(s).toMatchObject({ kind: "next", template: { id: "d3" } });
  });
  it("treino e brincadeira não alteram a sugestão nem dispensam o Dia 2", () => {
    const sessions = [session("d1", MON)];
    const base = suggestToday({ today: "2026-10-06", sessions, games: [] });
    const games = [game("2026-10-06", "brincadeira"), game("2026-10-07", "treino"), game("2026-10-08", "brincadeira")];
    expect(skippedSessionIds(games, MON)).toEqual([]);
    expect(suggestToday({ today: "2026-10-06", sessions, games })).toEqual(base);
    expect(planWeek({ today: "2026-10-06", sessions, games }).map((d) => d.planned?.id ?? null)).toEqual(
      planWeek({ today: "2026-10-06", sessions, games: [] }).map((d) => d.planned?.id ?? null),
    );
  });
});

describe("alertas", () => {
  const now = spToMs("2026-10-06", "18:00");
  it("alerta Dia 3 na véspera de jogo de campeonato", () => {
    const alerts = sessionAlerts("d3", { nowMs: now, sessions: [], games: [game("2026-10-07", "campeonato")] });
    expect(alerts.map((a) => a.kind)).toEqual(["48h"]);
    expect(sessionAlerts("d4", { nowMs: now, sessions: [], games: [game("2026-10-07", "campeonato")] })).toHaveLength(1);
  });
  it("não alerta Dia 1 e Dia 2", () => {
    const games = [game("2026-10-07", "campeonato")];
    expect(sessionAlerts("d1", { nowMs: now, sessions: [], games })).toEqual([]);
    expect(sessionAlerts("d2", { nowMs: now, sessions: [], games })).toEqual([]);
  });
  it("não alerta com jogo a mais de 48 h", () => {
    const games = [game("2026-10-09", "campeonato", "20:00")];
    expect(sessionAlerts("d3", { nowMs: now, sessions: [], games })).toEqual([]);
  });
  it("brincadeira e treino na véspera não geram alerta", () => {
    const games = [game("2026-10-07", "brincadeira"), game("2026-10-07", "treino")];
    expect(sessionAlerts("d3", { nowMs: now, sessions: [], games })).toEqual([]);
  });
  it("alerta Dia 3 e Dia 4 em dias consecutivos", () => {
    const sessions = [session("d3", "2026-10-05")];
    expect(sessionAlerts("d4", { nowMs: now, sessions, games: [] }).map((a) => a.kind)).toEqual(["consecutive"]);
    expect(sessionAlerts("d3", { nowMs: now, sessions: [session("d4", "2026-10-06")], games: [] })).toHaveLength(1);
    expect(sessionAlerts("d4", { nowMs: now, sessions: [session("d3", "2026-10-04")], games: [] })).toEqual([]);
    expect(sessionAlerts("d4", { nowMs: now, sessions: [session("d1", "2026-10-05")], games: [] })).toEqual([]);
  });
});

describe("semana", () => {
  it("projeta as sessões que faltam e afasta perna de jogo de campeonato", () => {
    const games = [game("2026-10-08", "campeonato")];
    const days = planWeek({ today: MON, sessions: [], games });
    // Seg D1, Ter D2; Qua/Qui/Sex ficam a 1 dia do jogo; Sáb D3; Dom não (consecutivo).
    expect(days.map((d) => d.planned?.id ?? null)).toEqual(["d1", "d2", null, null, null, "d3", null]);
  });
  it("mostra sessões feitas e não planeja nada em semana passada", () => {
    const sessions = [session("d1", "2026-09-28")];
    const days = planWeek({ today: MON, sessions, games: [] }, "2026-09-28");
    expect(days[0].done).toHaveLength(1);
    expect(days.every((d) => d.planned === null)).toBe(true);
  });
});

describe("ciclo", () => {
  it("a semana do ciclo avança sozinha a partir da âncora", () => {
    const s = { ...defaultSettings(MON), cycleWeek: 2 };
    expect(currentCycleWeek(s, "2026-10-11")).toBe(2);
    expect(currentCycleWeek(s, "2026-10-12")).toBe(3);
    expect(currentCycleWeek(s, "2026-10-26")).toBe(5);
  });
  it("fases do HIIT por semana", () => {
    expect(hiitPhaseFor(1)).toMatchObject({ workSec: 20, restSec: 40, roundsMin: 8, roundsMax: 10 });
    expect(hiitPhaseFor(2)).toMatchObject({ workSec: 20, restSec: 40 });
    expect(hiitPhaseFor(3)).toMatchObject({ workSec: 30, restSec: 30, roundsMin: 8 });
    expect(hiitPhaseFor(4)).toMatchObject({ workSec: 30, restSec: 30 });
    expect(hiitPhaseFor(5)).toMatchObject({ workSec: 30, restSec: 30, roundsMin: 10, roundsMax: 12 });
    expect(hiitPhaseFor(1, 3).id).toBe(3);
  });
  it("semana de redução corta as séries pela metade", () => {
    expect(isDeloadWeek(5, 5)).toBe(true);
    expect(isDeloadWeek(6, 5)).toBe(false);
    expect(isDeloadWeek(6, 6)).toBe(true);
    expect(effectiveSets(exerciseById("flexao")!, true)).toBe(2);
    expect(effectiveSets(exerciseById("remada")!, false)).toBe(4);
    expect(effectiveSets(exerciseById("rosca")!, true)).toBe(2);
  });
});

describe("lembretes", () => {
  const m = (type: Measurement["type"], date: string): Measurement => ({ id: `m${++n}`, updatedAt: 1, type, date, value: 80 });
  it("peso semanal e cintura quinzenal", () => {
    expect(pendingMeasures([], MON)).toEqual(["peso", "cintura"]);
    const list = [m("peso", "2026-09-29"), m("cintura", "2026-09-29")];
    expect(pendingMeasures(list, MON)).toEqual([]);
    expect(pendingMeasures(list, "2026-10-06")).toEqual(["peso"]);
    expect(pendingMeasures(list, "2026-10-13")).toEqual(["peso", "cintura"]);
  });
});

describe("pré-preenchimento e progressão", () => {
  const flexao = exerciseById("flexao")!;
  it("sem histórico usa o mínimo da faixa e a primeira variação", () => {
    expect(prefill(flexao, 1, undefined, [])).toEqual({ value: 8, extraLoad: 0, variation: "joelhos" });
  });
  it("usa a mesma série da última sessão", () => {
    const all = [...sets("a", "flexao", [12, 11, 10, 9], 100), ...sets("b", "flexao", [10, 9, 8], 200)];
    const history = exerciseHistory("flexao", all);
    expect(history[0][0].performedSessionId).toBe("b");
    expect(prefill(flexao, 2, history[0], []).value).toBe(9);
    // série 4 não existe na última sessão: usa a última registrada
    expect(prefill(flexao, 4, history[0], []).value).toBe(8);
    expect(exerciseHistory("flexao", all, "b")[0][0].performedSessionId).toBe("a");
  });
  it("primeira vez no exercício: a série seguinte repete a anterior", () => {
    const current = sets("b", "flexao", [10], 200, { variation: "padrão", extraLoad: 3 });
    expect(prefill(flexao, 2, undefined, current)).toEqual({ value: 10, extraLoad: 3, variation: "padrão" });
  });
  it("mudança de variação/carga nesta sessão segue para as próximas séries", () => {
    const last = sets("a", "flexao", [12, 12, 12, 12], 100);
    const current = sets("b", "flexao", [10], 200, { variation: "pés elevados", extraLoad: 2 });
    expect(prefill(flexao, 2, last, current)).toEqual({ value: 12, extraLoad: 2, variation: "pés elevados" });
  });
  it("duas sessões seguidas no topo da faixa sugerem a próxima variação", () => {
    const top = [...sets("a", "flexao", [12, 12, 12, 12], 100), ...sets("b", "flexao", [12, 13, 12, 12], 200)];
    expect(progressionSuggestion(flexao, exerciseHistory("flexao", top))).toEqual({ kind: "variation", next: "pés elevados" });
    const one = [...sets("a", "flexao", [12, 12, 12, 11], 100), ...sets("b", "flexao", [12, 12, 12, 12], 200)];
    expect(progressionSuggestion(flexao, exerciseHistory("flexao", one))).toBeNull();
    expect(progressionSuggestion(flexao, exerciseHistory("flexao", sets("a", "flexao", [12, 12, 12, 12], 100)))).toBeNull();
  });
  it("na última variação ou sem cadeia sugere carga", () => {
    const last = { variation: "com mochila" };
    const all = [...sets("a", "flexao", [12, 12, 12, 12], 100, last), ...sets("b", "flexao", [12, 12, 12, 12], 200, last)];
    expect(progressionSuggestion(flexao, exerciseHistory("flexao", all))).toEqual({ kind: "load" });
    const rosca = exerciseById("rosca")!;
    const r = [...sets("a", "rosca", [12, 12, 12], 100, { variation: null }), ...sets("b", "rosca", [12, 12, 12], 200, { variation: null })];
    expect(progressionSuggestion(rosca, exerciseHistory("rosca", r))).toEqual({ kind: "load" });
  });
});

describe("gráfico", () => {
  it("marcas do eixo: folga mínima, sem repetição e passos redondos", () => {
    expect(niceTicks(75, 75.1, 1)).toEqual([74, 74.5, 75, 75.5, 76, 76.5]);
    expect(niceTicks(78.4, 81.2, 1)).toEqual([78, 79, 80, 81, 82]);
    expect(niceTicks(40, 40, 0)).toEqual([39, 40, 41]);
    expect(niceTicks(24, 46, 0)).toEqual([20, 30, 40, 50]);
    expect(niceTicks(0, 1, 0)).toEqual([0, 1, 2]);
  });
});
