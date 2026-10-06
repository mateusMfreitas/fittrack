import type { ExerciseTemplate } from "../plan/plan";
import type { PerformedSet } from "../db/types";

export interface SetValues {
  value: number;
  extraLoad: number;
  variation: string | null;
}

export function defaultValues(ex: ExerciseTemplate): SetValues {
  return {
    value: ex.target.kind === "max" ? 5 : ex.target.min,
    extraLoad: 0,
    variation: ex.variations[0] ?? null,
  };
}

// Séries de um exercício agrupadas por sessão, da mais recente para a mais antiga.
export function exerciseHistory(
  exerciseId: string,
  sets: PerformedSet[],
  excludeSessionId?: string,
): PerformedSet[][] {
  const groups = new Map<string, PerformedSet[]>();
  for (const s of sets) {
    if (s.exerciseId !== exerciseId || s.performedSessionId === excludeSessionId) continue;
    const g = groups.get(s.performedSessionId);
    if (g) g.push(s);
    else groups.set(s.performedSessionId, [s]);
  }
  const latest = (g: PerformedSet[]) => Math.max(...g.map((s) => s.createdAt));
  return [...groups.values()]
    .map((g) => g.sort((a, b) => a.setNumber - b.setNumber))
    .sort((a, b) => latest(b) - latest(a));
}

function fromLast(ex: ExerciseTemplate, setNumber: number, last: PerformedSet[] | undefined): SetValues {
  if (!last || last.length === 0) return defaultValues(ex);
  const s = last.find((x) => x.setNumber === setNumber) ?? last[last.length - 1];
  return { value: s.value, extraLoad: s.extraLoad, variation: s.variation };
}

// Pré-preenchimento: a mesma série da última sessão do exercício. Se nesta sessão a série
// anterior saiu do roteiro (outra variação ou carga), a mudança segue para as próximas.
export function prefill(
  ex: ExerciseTemplate,
  setNumber: number,
  last: PerformedSet[] | undefined,
  current: PerformedSet[],
): SetValues {
  const prev = current.find((s) => s.exerciseId === ex.id && s.setNumber === setNumber - 1);
  // Primeira vez no exercício: não há roteiro, então repete a série que acabou de ser feita.
  if (prev && (!last || last.length === 0)) {
    return { value: prev.value, extraLoad: prev.extraLoad, variation: prev.variation };
  }
  const base = fromLast(ex, setNumber, last);
  if (prev) {
    const expected = fromLast(ex, setNumber - 1, last);
    if (prev.variation !== expected.variation) base.variation = prev.variation;
    if (prev.extraLoad !== expected.extraLoad) base.extraLoad = prev.extraLoad;
  }
  return base;
}

export type Progression = { kind: "variation"; next: string } | { kind: "load" };

// Todas as séries no topo da faixa em duas sessões seguidas → próxima variação ou carga.
export function progressionSuggestion(ex: ExerciseTemplate, history: PerformedSet[][]): Progression | null {
  const target = ex.target;
  if (target.kind === "max" || history.length < 2) return null;
  const [a, b] = history;
  const minSets = Math.ceil(ex.sets / 2); // semana de redução tem metade das séries
  const ref = a[0];
  const atTop = (g: PerformedSet[]) =>
    g.length >= minSets &&
    g.every((s) => s.value >= target.max && s.variation === ref.variation && s.extraLoad === ref.extraLoad);
  if (!atTop(a) || !atTop(b)) return null;
  const i = ref.variation ? ex.variations.indexOf(ref.variation) : -1;
  if (i >= 0 && i < ex.variations.length - 1) return { kind: "variation", next: ex.variations[i + 1] };
  return { kind: "load" };
}
