import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { formatClock } from "../components/RestTimer";
import { Stepper } from "../components/Stepper";
import { Button, Card, Loading, cx } from "../components/ui";
import { db } from "../db/local";
import { saveHiitRun } from "../db/repo";
import type { PerformedSession } from "../db/types";
import { hiitPhaseFor } from "../domain/cycle";
import type { AppData } from "../hooks/useAppData";
import { beep, primeAudio, vibrate } from "../hooks/useBeep";
import { HIIT_EXERCISES } from "../plan/plan";

type Phase = "prep" | "work" | "rest";

interface Run {
  phase: Phase;
  round: number;
  endsAt: number;
  pausedLeftMs: number | null;
}

const PREP_SEC = 5;
const exerciseFor = (round: number) => HIIT_EXERCISES[(round - 1) % HIIT_EXERCISES.length];

// Timer de HIIT dentro da sessão do Dia 2.
export function HiitPanel({ session, app }: { session: PerformedSession; app: AppData }) {
  const phase = hiitPhaseFor(app.cycleWeek, app.settings.hiitPhase);
  const loaded = useLiveQuery(async () => {
    const runs = await db.hiitRuns.toArray();
    return {
      saved: runs.find((r) => r.performedSessionId === session.id),
      previous: runs.filter((r) => r.performedSessionId !== session.id).sort((a, b) => b.updatedAt - a.updatedAt)[0],
    };
  }, [session.id]);

  const [config, setConfig] = useState<{ rounds: number; workSec: number; restSec: number } | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [, setTick] = useState(0);
  const lastBeep = useRef("");

  // Configuração inicial: tempos da fase; rodadas da última vez, dentro da faixa da fase.
  useEffect(() => {
    if (!loaded || config) return;
    const lastRounds = loaded.previous?.roundsDone ?? phase.roundsMin;
    setConfig({
      rounds: Math.min(phase.roundsMax, Math.max(phase.roundsMin, lastRounds)),
      workSec: phase.workSec,
      restSec: phase.restSec,
    });
  }, [loaded, config, phase]);

  const finish = (roundsDone: number) => {
    if (!config) return;
    setRun(null);
    beep(660, 800);
    vibrate([300, 100, 300, 100, 300]);
    void saveHiitRun(session.id, { roundsDone, workSec: config.workSec, restSec: config.restSec });
  };

  useEffect(() => {
    if (!run || run.pausedLeftMs !== null || !config) return;
    const t = setInterval(() => {
      const now = Date.now();
      if (now < run.endsAt) {
        const secLeft = Math.ceil((run.endsAt - now) / 1000);
        const mark = `${run.phase}:${run.round}:${secLeft}`;
        if (secLeft <= 3 && lastBeep.current !== mark) {
          lastBeep.current = mark;
          beep(660, 100);
        }
        setTick((x) => x + 1);
        return;
      }
      // Avança quantas fases tiverem passado (a aba pode ter ficado em segundo plano).
      let next: Run = run;
      while (now >= next.endsAt) {
        if (next.phase === "prep") {
          next = { ...next, phase: "work", round: 1, endsAt: next.endsAt + config.workSec * 1000 };
        } else if (next.phase === "work") {
          if (next.round >= config.rounds) return finish(config.rounds);
          next = { ...next, phase: "rest", endsAt: next.endsAt + config.restSec * 1000 };
        } else {
          next = { ...next, phase: "work", round: next.round + 1, endsAt: next.endsAt + config.workSec * 1000 };
        }
      }
      beep(next.phase === "work" ? 1040 : 520, 350);
      vibrate(next.phase === "work" ? [250, 80, 250] : 250);
      setRun(next);
    }, 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, config]);

  if (!loaded || !config) return <Loading />;

  const start = () => {
    primeAudio();
    setRun({ phase: "prep", round: 0, endsAt: Date.now() + PREP_SEC * 1000, pausedLeftMs: null });
    // O card do timer troca de tamanho ao começar: traz para o meio da tela.
    requestAnimationFrame(() => document.getElementById("hiit-timer")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };
  const togglePause = () => {
    if (!run) return;
    if (run.pausedLeftMs === null) setRun({ ...run, pausedLeftMs: run.endsAt - Date.now() });
    else setRun({ ...run, endsAt: Date.now() + run.pausedLeftMs, pausedLeftMs: null });
  };
  const stop = () => {
    if (!run) return;
    const roundsDone = run.phase === "prep" ? 0 : run.phase === "work" ? run.round - 1 : run.round;
    if (roundsDone === 0) return setRun(null);
    finish(roundsDone);
  };

  if (run) {
    const paused = run.pausedLeftMs !== null;
    const leftSec = (paused ? run.pausedLeftMs! : run.endsAt - Date.now()) / 1000;
    const work = run.phase === "work";
    const upcoming = run.phase === "prep" ? 1 : run.round + 1;
    return (
      <section
        id="hiit-timer"
        className={cx(
          "rounded-2xl p-4 text-center transition-colors",
          work ? "bg-accent text-zinc-950" : run.phase === "rest" ? "bg-sky-900" : "bg-surface",
        )}
      >
        <div className="text-sm font-semibold tracking-widest uppercase opacity-80">
          {run.phase === "prep" ? "Prepare-se" : `Rodada ${run.round} de ${config.rounds}`}
        </div>
        <div className="mt-1 text-4xl font-black">
          {run.phase === "prep" ? "Vai começar" : work ? "FORTE" : "LEVE"}
        </div>
        <div className="my-2 text-8xl leading-none font-black tabular-nums" role="timer">
          {formatClock(leftSec)}
        </div>
        <div className="min-h-14 text-xl font-bold">
          {work ? (
            exerciseFor(run.round)
          ) : upcoming <= config.rounds ? (
            <span className="opacity-90">A seguir: {exerciseFor(upcoming)}</span>
          ) : (
            <span className="opacity-90">Última recuperação</span>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <Button big className="flex-1 !bg-zinc-950 !text-zinc-100" onClick={togglePause}>
            {paused ? "▶ Continuar" : "⏸ Pausar"}
          </Button>
          <Button big className="!bg-zinc-950 !text-zinc-100" onClick={stop}>
            Encerrar
          </Button>
        </div>
      </section>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">Timer de HIIT</h2>
        <span className="text-sm text-zinc-400">
          {phase.label}: {phase.roundsMin}–{phase.roundsMax} rodadas {phase.workSec}/{phase.restSec}
        </span>
      </div>

      {loaded.saved && (
        <div className="bg-accent/15 text-accent rounded-xl px-3 py-2 text-sm font-semibold" role="status">
          ✓ {loaded.saved.roundsDone} rodadas registradas ({loaded.saved.workSec}/{loaded.saved.restSec})
        </div>
      )}

      <Stepper label="Rodadas" value={config.rounds} min={1} max={30} onChange={(rounds) => setConfig({ ...config, rounds })} />
      <Stepper label="Forte" unit="s" value={config.workSec} min={5} max={120} step={5} onChange={(workSec) => setConfig({ ...config, workSec })} />
      <Stepper label="Leve" unit="s" value={config.restSec} min={0} max={120} step={5} onChange={(restSec) => setConfig({ ...config, restSec })} />

      <p className="text-sm text-zinc-400">Alternando: {HIIT_EXERCISES.join(" → ")}</p>

      <Button variant="primary" big className="w-full" onClick={start}>
        ▶ {loaded.saved ? "Refazer timer" : "Iniciar HIIT"}
      </Button>
    </Card>
  );
}
