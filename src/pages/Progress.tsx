import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { TrendChart, type TrendPoint } from "../components/TrendChart";
import { Loading, Page, Segmented } from "../components/ui";
import { db } from "../db/local";
import { EXERCISES, SESSIONS, exerciseById } from "../plan/plan";

type Metric = "total" | "best";

export default function Progress() {
  const [exerciseId, setExerciseId] = useState(EXERCISES[0].id);
  const [metric, setMetric] = useState<Metric>("total");

  const data = useLiveQuery(async () => {
    const [measurements, sessions, sets, runs] = await Promise.all([
      db.measurements.toArray(),
      db.performedSessions.where("status").equals("done").toArray(),
      db.performedSets.toArray(),
      db.hiitRuns.toArray(),
    ]);
    return { measurements, sessions, sets, runs };
  }, []);
  if (!data) return <Loading />;

  const dateOf = new Map(data.sessions.map((s) => [s.id, s.date]));
  const measure = (type: "peso" | "cintura"): TrendPoint[] =>
    data.measurements.filter((m) => m.type === type).map((m) => ({ date: m.date, value: m.value }));

  const ex = exerciseById(exerciseId)!;
  const bySession = new Map<string, number[]>();
  for (const s of data.sets) {
    if (s.exerciseId !== exerciseId || !dateOf.has(s.performedSessionId)) continue;
    bySession.set(s.performedSessionId, [...(bySession.get(s.performedSessionId) ?? []), s.value]);
  }
  const exercisePoints: TrendPoint[] = [...bySession].map(([sessionId, values]) => ({
    date: dateOf.get(sessionId)!,
    value: metric === "total" ? values.reduce((a, b) => a + b, 0) : Math.max(...values),
  }));

  const hiitPoints: TrendPoint[] = data.runs
    .filter((r) => dateOf.has(r.performedSessionId))
    .map((r) => ({ date: dateOf.get(r.performedSessionId)!, value: r.roundsDone }));

  const seconds = ex.target.kind === "seconds";
  const side = ex.unilateral ? `/${ex.unilateral}` : "";

  return (
    <Page title="Evolução">
      <div className="space-y-3">
        <TrendChart title="Peso" unit="kg" decimals={1} points={measure("peso")} emptyHint="Registre o peso em Mais › Medidas." />
        <TrendChart title="Cintura" unit="cm" decimals={1} points={measure("cintura")} emptyHint="Registre a cintura em Mais › Medidas." />

        <div className="bg-surface space-y-2 rounded-2xl p-3">
          <label className="block text-sm text-zinc-400" htmlFor="exercise">
            Exercício
          </label>
          <select
            id="exercise"
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
            className="bg-surface-2 min-h-14 w-full rounded-2xl px-3 text-base font-semibold"
          >
            {SESSIONS.filter((s) => s.type !== "hiit").map((s) => (
              <optgroup key={s.id} label={`${s.name} · ${s.focus}`}>
                {EXERCISES.filter((e) => e.sessionId === s.id).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <Segmented
            value={metric}
            onChange={setMetric}
            options={[
              { value: "total", label: "Total da sessão" },
              { value: "best", label: "Melhor série" },
            ]}
          />
        </div>
        <TrendChart
          title={ex.name}
          unit={`${seconds ? "s" : "reps"}${side}`}
          points={exercisePoints}
          emptyHint="Sem sessões concluídas com este exercício."
        />

        <TrendChart title="HIIT" unit="rodadas" points={hiitPoints} emptyHint="Sem sessões de HIIT concluídas." />
      </div>
    </Page>
  );
}
