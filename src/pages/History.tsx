import { useLiveQuery } from "dexie-react-hooks";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Button, Card, Loading, Page } from "../components/ui";
import { db } from "../db/local";
import { deleteSession } from "../db/repo";
import type { PerformedSet } from "../db/types";
import { formatDate, formatDateLong } from "../domain/time";
import { COOLDOWN, WARMUP, exerciseById, exercisesOf, sessionById } from "../plan/plan";

export function History() {
  const data = useLiveQuery(async () => {
    const sessions = (await db.performedSessions.where("status").equals("done").toArray()).sort((a, b) =>
      a.date === b.date ? b.startedAt - a.startedAt : b.date.localeCompare(a.date),
    );
    const sets = await db.performedSets.toArray();
    const runs = await db.hiitRuns.toArray();
    return { sessions, sets, runs };
  }, []);
  if (!data) return <Loading />;

  return (
    <Page title="Histórico" subtitle={`${data.sessions.length} sessões`}>
      {data.sessions.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">Nenhuma sessão concluída ainda.</p>
      ) : (
        <ul className="space-y-2">
          {data.sessions.map((s) => {
            const t = sessionById(s.templateId);
            const count = data.sets.filter((x) => x.performedSessionId === s.id).length;
            const run = data.runs.find((r) => r.performedSessionId === s.id);
            return (
              <li key={s.id}>
                <Link to={`/historico/${s.id}`} className="bg-surface flex min-h-16 items-center gap-3 rounded-2xl px-4 py-2 active:bg-zinc-800">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">
                      {t?.name ?? s.templateId} <span className="font-normal text-zinc-400">· {t?.focus}</span>
                    </div>
                    <div className="truncate text-sm text-zinc-400">
                      {formatDateLong(s.date)}
                      {s.durationMin ? ` · ${s.durationMin} min` : ""}
                      {run ? ` · ${run.roundsDone} rodadas` : count > 0 ? ` · ${count} séries` : ""}
                    </div>
                  </div>
                  <span aria-hidden className="text-zinc-500">
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}

const setText = (s: PerformedSet, seconds: boolean) =>
  `${s.value}${seconds ? " s" : ""}${s.extraLoad > 0 ? ` (+${s.extraLoad} kg)` : ""}`;

export function HistoryDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const data = useLiveQuery(async () => {
    const session = await db.performedSessions.get(id);
    const sets = await db.performedSets.where("performedSessionId").equals(id).toArray();
    const run = (await db.hiitRuns.where("performedSessionId").equals(id).toArray())[0];
    return { session, sets, run };
  }, [id]);
  if (!data) return <Loading />;
  const { session, sets, run } = data;
  if (!session) return <Navigate to="/historico" replace />;
  const template = sessionById(session.templateId);

  // Inclui exercícios que saíram do plano mas têm séries gravadas.
  const planned = exercisesOf(session.templateId).map((e) => e.id);
  const ids = [...planned, ...new Set(sets.map((s) => s.exerciseId).filter((x) => !planned.includes(x)))];

  const remove = async () => {
    if (!window.confirm("Apagar esta sessão do histórico?")) return;
    await deleteSession(session.id);
    navigate("/historico", { replace: true });
  };

  return (
    <Page
      title={`${template?.name ?? session.templateId} · ${template?.focus ?? ""}`}
      subtitle={`${formatDateLong(session.date)} ${formatDate(session.date, true).slice(-4)}${session.durationMin ? ` · ${session.durationMin} min` : ""}`}
      back="/historico"
    >
      <div className="space-y-3">
        {session.note && <Card className="text-zinc-200">📝 {session.note}</Card>}

        {run && (
          <Card>
            <div className="text-lg font-bold">HIIT</div>
            <div className="text-zinc-300">
              {run.roundsDone} rodadas · {run.workSec} s forte / {run.restSec} s leve
            </div>
          </Card>
        )}

        {ids.map((exId) => {
          const ex = exerciseById(exId);
          const list = sets.filter((s) => s.exerciseId === exId).sort((a, b) => a.setNumber - b.setNumber);
          const seconds = ex?.target.kind === "seconds";
          const variations = [...new Set(list.map((s) => s.variation).filter(Boolean))];
          return (
            <Card key={exId}>
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-bold">{ex?.name ?? exId}</div>
                {variations.length > 0 && <div className="text-sm text-zinc-400">{variations.join(", ")}</div>}
              </div>
              {list.length === 0 ? (
                <div className="text-sm text-zinc-500">Não registrado</div>
              ) : (
                <ol className="mt-2 flex flex-wrap gap-2">
                  {list.map((s) => (
                    <li key={s.id} className="bg-surface-2 rounded-xl px-3 py-1.5 text-sm font-semibold tabular-nums">
                      {setText(s, seconds)}
                    </li>
                  ))}
                </ol>
              )}
              {ex?.unilateral && list.length > 0 && <div className="mt-1 text-xs text-zinc-500">por {ex.unilateral}</div>}
            </Card>
          );
        })}

        <p className="text-sm text-zinc-500">
          Aquecimento {session.warmupChecked.length}/{WARMUP.length} · Pós-treino {session.cooldownChecked.length}/
          {COOLDOWN.length}
        </p>

        <Button variant="danger" className="w-full" onClick={() => void remove()}>
          Apagar sessão
        </Button>
      </div>
    </Page>
  );
}
