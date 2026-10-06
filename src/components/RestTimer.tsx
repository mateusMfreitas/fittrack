import { useEffect, useRef, useState } from "react";
import { beep, vibrate } from "../hooks/useBeep";

export const formatClock = (totalSec: number) => {
  const s = Math.max(0, Math.ceil(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Cronômetro de descanso. Baseado no instante final, então não atrasa em segundo plano.
export function RestTimer({
  endsAt,
  totalSec,
  onAdd,
  onClose,
}: {
  endsAt: number;
  totalSec: number;
  onAdd: (sec: number) => void;
  onClose: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const signalled = useRef<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const left = (endsAt - now) / 1000;
  const over = left <= 0;

  useEffect(() => {
    if (over && signalled.current !== endsAt) {
      signalled.current = endsAt;
      beep(1040, 400);
      vibrate([200, 100, 200]);
    }
  }, [over, endsAt]);

  const pct = Math.min(100, Math.max(0, (1 - left / totalSec) * 100));

  return (
    <div className="bg-surface relative flex min-h-14 flex-1 items-center gap-2 overflow-hidden rounded-2xl pr-1 pl-4" role="timer">
      <div className="bg-accent/20 absolute inset-y-0 left-0" style={{ width: `${pct}%` }} />
      <div className="relative flex-1">
        <div className="text-xs text-zinc-400">{over ? "Descanso concluído" : "Descanso"}</div>
        <div className={`text-2xl leading-none font-bold tabular-nums ${over ? "text-accent" : ""}`}>
          {over ? "Vamos!" : formatClock(left)}
        </div>
      </div>
      {!over && (
        <button
          type="button"
          onClick={() => onAdd(15)}
          className="relative h-12 rounded-xl px-3 text-sm font-semibold text-zinc-200 active:bg-zinc-700"
        >
          +15 s
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        className="relative h-12 rounded-xl px-3 text-sm font-semibold text-zinc-200 active:bg-zinc-700"
      >
        {over ? "OK" : "Pular"}
      </button>
    </div>
  );
}
