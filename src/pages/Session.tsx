import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Checklist } from "../components/Checklist";
import { RestTimer } from "../components/RestTimer";
import { Stepper } from "../components/Stepper";
import { Banner, Button, Card, Loading, Page, cx } from "../components/ui";
import { db } from "../db/local";
import {
  deleteSession,
  finishSession,
  markSet,
  repeatAll,
  toggleChecklist,
  undoLastMark,
} from "../db/repo";
import type { PerformedSession, PerformedSet } from "../db/types";
import { sessionAlerts } from "../domain/alerts";
import { effectiveSets } from "../domain/cycle";
import {
  exerciseHistory,
  prefill,
  progressionSuggestion,
  type Progression,
  type SetValues,
} from "../domain/progression";
import { useAppData, type AppData } from "../hooks/useAppData";
import { primeAudio, vibrate } from "../hooks/useBeep";
import { useWakeLock } from "../hooks/useWakeLock";
import {
  COOLDOWN,
  WARMUP,
  exercisesOf,
  sessionById,
  targetLabel,
  type ExerciseTemplate,
  type SessionTemplate,
} from "../plan/plan";
import { HiitPanel } from "./Hiit";

export default function SessionPage() {
  const { id = "" } = useParams();
  // `started` vem junto com a sessão para a tela já abrir com o aquecimento recolhido,
  // sem o conteúdo pular depois de rolar até o exercício atual.
  const loaded = useLiveQuery(
    async () => ({
      session: await db.performedSessions.get(id),
      started:
        (await db.performedSets.where("performedSessionId").equals(id).count()) +
          (await db.hiitRuns.where("performedSessionId").equals(id).count()) >
        0,
    }),
    [id],
  );
  const app = useAppData();

  if (!loaded || !app) return <Loading />;
  const session = loaded.session;
  const template = session && sessionById(session.templateId);
  if (!session || !template) return <Navigate to="/" replace />;
  if (session.status === "done") return <Navigate to={`/historico/${session.id}`} replace />;

  return <ActiveSession session={session} template={template} app={app} started={loaded.started} />;
}

function ActiveSession({
  session,
  template,
  app,
  started,
}: {
  session: PerformedSession;
  template: SessionTemplate;
  app: AppData;
  // Já tem série ou HIIT registrado: o aquecimento recolhe para o exercício atual caber na tela.
  started: boolean;
}) {
  const navigate = useNavigate();
  useWakeLock(true);

  const alerts = sessionAlerts(template.id, {
    nowMs: app.nowMs,
    sessions: app.sessions.filter((s) => s.id !== session.id),
    games: app.games,
  });

  const [note, setNote] = useState(session.note);
  const finish = async () => {
    await finishSession(session.id, note);
    navigate("/", { replace: true });
  };
  const discard = async () => {
    if (!window.confirm("Descartar esta sessão e as séries marcadas?")) return;
    await deleteSession(session.id);
    navigate("/", { replace: true });
  };

  const [bottomBar, setBottomBar] = useState<React.ReactNode>(null);

  return (
    <>
      <Page title={`${template.name} · ${template.focus}`} subtitle={<Elapsed startedAt={session.startedAt} />} back="/">
        <div className="space-y-3">
          {alerts.map((a) => (
            <Banner key={a.message} tone="warn">
              {a.message}
            </Banner>
          ))}
          {app.deload && template.type !== "hiit" && (
            <Banner tone="info">Semana de redução: séries alvo pela metade.</Banner>
          )}

          <Checklist
            title="Aquecimento"
            items={WARMUP}
            checked={session.warmupChecked}
            onToggle={(i) => void toggleChecklist(session.id, "warmupChecked", i)}
            collapsed={started}
          />

          {template.type === "hiit" ? (
            <HiitPanel session={session} app={app} />
          ) : (
            <StrengthPanel session={session} template={template} deload={app.deload} setBottomBar={setBottomBar} />
          )}

          <div id="pos-treino" className="scroll-mt-20 space-y-3">
            <Checklist
              title="Pós-treino"
              items={COOLDOWN}
              checked={session.cooldownChecked}
              onToggle={(i) => void toggleChecklist(session.id, "cooldownChecked", i)}
            />
            <Card>
              <label className="text-sm text-zinc-400" htmlFor="note">
                Observação (opcional)
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl bg-zinc-950 p-3 outline-none focus:ring-2 focus:ring-lime-400"
              />
              <Button variant="primary" big className="mt-3 w-full" onClick={() => void finish()}>
                Finalizar sessão
              </Button>
              <Button variant="ghostDanger" className="mt-1 w-full" onClick={() => void discard()}>
                Descartar sessão
              </Button>
            </Card>
          </div>
        </div>
      </Page>
      {bottomBar && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
          <div className="mx-auto flex max-w-lg gap-2 p-2">{bottomBar}</div>
        </div>
      )}
    </>
  );
}

function Elapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  return <>{Math.max(0, Math.floor((now - startedAt) / 60_000))} min de sessão</>;
}

// ---------- Força / potência ----------

interface Rest {
  endsAt: number;
  totalSec: number;
}

function StrengthPanel({
  session,
  template,
  deload,
  setBottomBar,
}: {
  session: PerformedSession;
  template: SessionTemplate;
  deload: boolean;
  setBottomBar: (node: React.ReactNode) => void;
}) {
  const exercises = useMemo(() => exercisesOf(template.id), [template.id]);
  const allSets = useLiveQuery(
    () => db.performedSets.where("exerciseId").anyOf(exercises.map((e) => e.id)).toArray(),
    [exercises],
  );

  const [manualId, setManualId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<SetValues>>>({});
  const [rest, setRest] = useState<Rest | null>(null);

  const current = useMemo(
    () => (allSets ?? []).filter((s) => s.performedSessionId === session.id),
    [allSets, session.id],
  );
  const doneOf = (ex: ExerciseTemplate) => current.filter((s) => s.exerciseId === ex.id);
  const targetOf = (ex: ExerciseTemplate) => effectiveSets(ex, deload);
  const firstOpen = exercises.find((ex) => doneOf(ex).length < targetOf(ex));
  const activeId = manualId ?? firstOpen?.id ?? null;

  const totalTarget = exercises.reduce((n, ex) => n + targetOf(ex), 0);
  const totalDone = exercises.reduce((n, ex) => n + Math.min(doneOf(ex).length, targetOf(ex)), 0);
  const hasHistory = (allSets ?? []).some((s) => s.performedSessionId !== session.id);

  // Ao trocar de exercício (ou terminar todos), traz o próximo passo para a tela.
  const scrolled = useRef<string | null>(null);
  useEffect(() => {
    if (!allSets) return;
    const target = activeId ? `ex-${activeId}` : "pos-treino";
    if (scrolled.current === target) return;
    const first = scrolled.current === null;
    scrolled.current = target;
    // Ao abrir: só rola se a sessão já tinha séries (retomada); do zero, começa no aquecimento.
    if (first && current.length === 0) return;
    document.getElementById(target)?.scrollIntoView({ behavior: first ? "auto" : "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, allSets]);

  const undo = async () => {
    await undoLastMark(session.id);
    setRest(null);
    setManualId(null);
  };

  const hasSets = current.length > 0;
  useEffect(() => {
    if (!rest && !hasSets) {
      setBottomBar(null);
      return;
    }
    setBottomBar(
      <>
        {rest ? (
          <RestTimer
            endsAt={rest.endsAt}
            totalSec={rest.totalSec}
            onAdd={(sec) => setRest({ endsAt: rest.endsAt + sec * 1000, totalSec: rest.totalSec + sec })}
            onClose={() => setRest(null)}
          />
        ) : (
          <div className="flex flex-1 items-center px-2 text-sm text-zinc-400">
            {totalDone}/{totalTarget} séries
          </div>
        )}
        {hasSets && (
          <Button onClick={() => void undo()} className="shrink-0" aria-label="Desfazer última marcação">
            ↩ Desfazer
          </Button>
        )}
      </>,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rest, hasSets, totalDone, totalTarget]);
  useEffect(() => () => setBottomBar(null), [setBottomBar]);

  if (!allSets) return <Loading />;

  const mark = async (ex: ExerciseTemplate, setNumber: number, values: SetValues) => {
    primeAudio();
    vibrate(30);
    await markSet(session.id, ex.id, setNumber, values);
    const exerciseDone = setNumber >= targetOf(ex);
    const sessionDone = exerciseDone && exercises.every((e) => e.id === ex.id || doneOf(e).length >= targetOf(e));
    setRest(sessionDone ? null : { endsAt: Date.now() + ex.restSec * 1000, totalSec: ex.restSec });
    if (exerciseDone) setManualId(null);
  };

  const repeat = async () => {
    if (!window.confirm("Marcar todas as séries que faltam com os valores da última vez?")) return;
    await repeatAll(session.id, deload);
    setRest(null);
    setManualId(null);
  };

  return (
    <div className="space-y-3">
      {hasHistory && totalDone < totalTarget && (
        <Button className="w-full" onClick={() => void repeat()}>
          ⟳ Repetir tudo igual à última vez
        </Button>
      )}

      {exercises.map((ex) => {
        const done = doneOf(ex).sort((a, b) => a.setNumber - b.setNumber);
        const history = exerciseHistory(ex.id, allSets, session.id);
        const setNumber = done.length + 1;
        const key = `${ex.id}:${setNumber}`;
        const values = { ...prefill(ex, setNumber, history[0], current), ...drafts[key] };
        return (
          <ExerciseCard
            key={ex.id}
            ex={ex}
            target={targetOf(ex)}
            done={done}
            last={history[0]}
            suggestion={progressionSuggestion(ex, history)}
            active={activeId === ex.id}
            values={values}
            onChange={(patch) => setDrafts((d) => ({ ...d, [key]: { ...d[key], ...patch } }))}
            onOpen={() => setManualId(ex.id)}
            onMark={() => void mark(ex, setNumber, values)}
          />
        );
      })}
    </div>
  );
}

const unitOf = (ex: ExerciseTemplate) => (ex.target.kind === "seconds" ? "s" : "reps");

function summarize(ex: ExerciseTemplate, sets: PerformedSet[]): string {
  const values = sets.map((s) => s.value).join(" · ");
  const first = sets[0];
  const extras = [first?.variation, first && first.extraLoad > 0 ? `+${first.extraLoad} kg` : null].filter(Boolean);
  return `${values}${ex.target.kind === "seconds" ? " s" : ""}${extras.length ? ` — ${extras.join(", ")}` : ""}`;
}

function progressionText(ex: ExerciseTemplate, p: Progression): string {
  if (p.kind === "variation") return `Topo da faixa em duas sessões seguidas: experimente a variação "${p.next}".`;
  return ex.target.kind === "seconds"
    ? "Topo da faixa em duas sessões seguidas: aumente o tempo ou a carga."
    : "Topo da faixa em duas sessões seguidas: aumente a carga.";
}

function ExerciseCard({
  ex,
  target,
  done,
  last,
  suggestion,
  active,
  values,
  onChange,
  onOpen,
  onMark,
}: {
  ex: ExerciseTemplate;
  target: number;
  done: PerformedSet[];
  last: PerformedSet[] | undefined;
  suggestion: Progression | null;
  active: boolean;
  values: SetValues;
  onChange: (patch: Partial<SetValues>) => void;
  onOpen: () => void;
  onMark: () => void;
}) {
  const complete = done.length >= target;
  const setNumber = done.length + 1;
  const dots = Array.from({ length: Math.max(target, done.length) }, (_, i) => i < done.length);

  const header = (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className={cx("truncate text-lg font-bold", complete && !active && "text-zinc-400")}>{ex.name}</div>
        <div className="text-sm text-zinc-400">{targetLabel(ex, target)}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1" aria-label={`${done.length} de ${target} séries`}>
        {complete && !active ? (
          <span className="text-accent text-xl font-bold">✓</span>
        ) : (
          dots.map((on, i) => (
            <span key={i} className={cx("h-3 w-3 rounded-full", on ? "bg-accent" : "bg-zinc-700")} />
          ))
        )}
      </div>
    </div>
  );

  if (!active) {
    return (
      <button
        type="button"
        id={`ex-${ex.id}`}
        onClick={onOpen}
        className="bg-surface block w-full scroll-mt-20 rounded-2xl p-4 text-left active:bg-zinc-800"
      >
        {header}
        {done.length > 0 && <div className="mt-1 text-sm text-zinc-500">Hoje: {summarize(ex, done)}</div>}
      </button>
    );
  }

  return (
    <Card id={`ex-${ex.id}`} className="ring-accent/60 scroll-mt-20 space-y-3 ring-2">
      {header}

      <div className="space-y-1 text-sm">
        {last && <div className="text-zinc-400">Última vez: {summarize(ex, last)}</div>}
        {done.length > 0 && <div className="text-zinc-300">Hoje: {summarize(ex, done)}</div>}
      </div>
      {suggestion && <Banner tone="info">{progressionText(ex, suggestion)}</Banner>}

      {ex.variations.length > 0 && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Variação">
          {ex.variations.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={values.variation === v}
              onClick={() => onChange({ variation: v })}
              className={cx(
                "min-h-11 rounded-full px-4 text-sm font-semibold",
                values.variation === v ? "bg-accent text-zinc-950" : "bg-surface-2 text-zinc-300",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      <Stepper
        label={ex.target.kind === "seconds" ? "Tempo" : "Reps"}
        unit={`${unitOf(ex)}${ex.unilateral ? `/${ex.unilateral}` : ""}`}
        value={values.value}
        step={ex.target.kind === "seconds" ? 5 : 1}
        onChange={(value) => onChange({ value })}
      />
      <Stepper label="Carga" unit="kg" value={values.extraLoad} decimals={1} trimZeros step={1} onChange={(extraLoad) => onChange({ extraLoad })} />

      <Button variant="primary" big className="w-full" onClick={onMark}>
        ✓ {complete ? `Série extra (${setNumber})` : `Marcar série ${setNumber} de ${target}`}
      </Button>
    </Card>
  );
}
