// Plano de treino (seed). Para mudar o plano, edite este arquivo e faça redeploy.
// Os ids são referenciados pelos registros já gravados: não renomeie ids existentes.

export type SessionType = "forca" | "hiit" | "potencia";

export type Target =
  | { kind: "reps"; min: number; max: number }
  | { kind: "seconds"; min: number; max: number }
  | { kind: "max" };

export interface SessionTemplate {
  id: string;
  name: string;
  focus: string;
  type: SessionType;
  order: number;
  // Sessões pesadas de perna: entram na regra das 48 h e na de dias consecutivos.
  legLoad: boolean;
}

export interface ExerciseTemplate {
  id: string;
  sessionId: string;
  name: string;
  sets: number;
  target: Target;
  // Texto do lado ("perna", "lado") quando o alvo é por lado.
  unilateral: false | "perna" | "lado";
  restSec: number;
  // Em ordem crescente de dificuldade.
  variations: string[];
  order: number;
}

const FLEXAO = ["joelhos", "padrão", "pés elevados", "com mochila"];
const PERNAS = ["sem carga", "mochila", "descida lenta"];

const REST_FORCA = 90;
const REST_CURTO = 60;

export const SESSIONS: SessionTemplate[] = [
  { id: "d1", name: "Dia 1", focus: "Superiores e core", type: "forca", order: 1, legLoad: false },
  { id: "d2", name: "Dia 2", focus: "HIIT", type: "hiit", order: 2, legLoad: false },
  { id: "d3", name: "Dia 3", focus: "Inferiores", type: "forca", order: 3, legLoad: true },
  { id: "d4", name: "Dia 4", focus: "Potência", type: "potencia", order: 4, legLoad: true },
];

const reps = (min: number, max = min): Target => ({ kind: "reps", min, max });
const secs = (s: number): Target => ({ kind: "seconds", min: s, max: s });

type Ex = Omit<ExerciseTemplate, "sessionId" | "order">;

const byDay: Record<string, Ex[]> = {
  d1: [
    { id: "flexao", name: "Flexão", sets: 4, target: reps(8, 12), unilateral: false, restSec: REST_FORCA, variations: FLEXAO },
    { id: "remada", name: "Remada", sets: 4, target: reps(10, 12), unilateral: false, restSec: REST_FORCA, variations: [] },
    { id: "flexao-pike", name: "Flexão pike", sets: 3, target: reps(8, 10), unilateral: false, restSec: REST_FORCA, variations: [] },
    { id: "barra", name: "Barra / puxada", sets: 3, target: { kind: "max" }, unilateral: false, restSec: REST_FORCA, variations: [] },
    { id: "mergulho", name: "Mergulho", sets: 3, target: reps(10, 12), unilateral: false, restSec: REST_FORCA, variations: [] },
    { id: "rosca", name: "Rosca", sets: 3, target: reps(12), unilateral: false, restSec: REST_CURTO, variations: [] },
    { id: "prancha-frontal", name: "Prancha frontal", sets: 3, target: secs(40), unilateral: false, restSec: REST_CURTO, variations: [] },
  ],
  d3: [
    { id: "bulgaro", name: "Agachamento búlgaro", sets: 4, target: reps(8, 10), unilateral: "perna", restSec: REST_FORCA, variations: PERNAS },
    { id: "afundo-lateral", name: "Afundo lateral", sets: 3, target: reps(10), unilateral: "lado", restSec: REST_FORCA, variations: PERNAS },
    { id: "ponte-unilateral", name: "Ponte unilateral", sets: 3, target: reps(12), unilateral: "lado", restSec: REST_CURTO, variations: PERNAS },
    { id: "ponte-deslizando", name: "Ponte deslizando", sets: 3, target: reps(10), unilateral: false, restSec: REST_CURTO, variations: [] },
    { id: "panturrilha", name: "Panturrilha", sets: 3, target: reps(15), unilateral: "lado", restSec: REST_CURTO, variations: PERNAS },
    { id: "prancha-lateral", name: "Prancha lateral", sets: 3, target: secs(30), unilateral: "lado", restSec: REST_CURTO, variations: [] },
  ],
  d4: [
    { id: "salto-vertical", name: "Salto vertical", sets: 4, target: reps(6), unilateral: false, restSec: REST_CURTO, variations: [] },
    { id: "skater", name: "Skater", sets: 4, target: reps(8), unilateral: "lado", restSec: REST_CURTO, variations: [] },
    { id: "deslocamento-lateral", name: "Deslocamento lateral", sets: 6, target: secs(15), unilateral: false, restSec: REST_CURTO, variations: [] },
    { id: "levantar-rapido", name: "Levantar rápido", sets: 4, target: reps(6), unilateral: false, restSec: REST_CURTO, variations: [] },
  ],
};

export const EXERCISES: ExerciseTemplate[] = Object.entries(byDay).flatMap(([sessionId, list]) =>
  list.map((ex, i) => ({ ...ex, sessionId, order: i + 1 })),
);

export const WARMUP: string[] = [
  "Polichinelo ou corrida leve (2 min)",
  "Mobilidade de ombros e quadril",
  "Agachamento livre × 10",
  "Série leve do primeiro exercício",
];

export const COOLDOWN: string[] = [
  "Caminhada leve e respiração (2 min)",
  "Alongamento: posterior de coxa e quadríceps",
  "Alongamento: panturrilha e glúteo",
  "Alongamento: peitoral e ombros",
];

export const HIIT_EXERCISES: string[] = ["Burpee", "Mountain climber", "Corrida estacionária"];

export interface HiitPhase {
  id: 1 | 2 | 3;
  label: string;
  workSec: number;
  restSec: number;
  roundsMin: number;
  roundsMax: number;
}

export const HIIT_PHASES: HiitPhase[] = [
  { id: 1, label: "Semanas 1–2", workSec: 20, restSec: 40, roundsMin: 8, roundsMax: 10 },
  { id: 2, label: "Semanas 3–4", workSec: 30, restSec: 30, roundsMin: 8, roundsMax: 10 },
  { id: 3, label: "Semana 5+", workSec: 30, restSec: 30, roundsMin: 10, roundsMax: 12 },
];

// Sessão que é dispensada em semana com dois jogos de campeonato.
export const SKIPPABLE_SESSION_ID = "d2";

export const sessionById = (id: string) => SESSIONS.find((s) => s.id === id);
export const exerciseById = (id: string) => EXERCISES.find((e) => e.id === id);
export const exercisesOf = (sessionId: string) =>
  EXERCISES.filter((e) => e.sessionId === sessionId).sort((a, b) => a.order - b.order);

export function targetLabel(ex: ExerciseTemplate, sets = ex.sets): string {
  const side = ex.unilateral ? `/${ex.unilateral}` : "";
  const t = ex.target;
  if (t.kind === "max") return `${sets} × máx`;
  const unit = t.kind === "seconds" ? " s" : "";
  const range = t.min === t.max ? `${t.max}` : `${t.min}–${t.max}`;
  return `${sets} × ${range}${unit}${side}`;
}
