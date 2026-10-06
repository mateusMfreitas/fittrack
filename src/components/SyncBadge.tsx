import { useLiveQuery } from "dexie-react-hooks";
import { useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { db } from "../db/local";
import { getSyncStatus, subscribeSync, syncNow } from "../sync/syncEngine";
import { cx } from "./ui";

export function useSyncStatus() {
  const status = useSyncExternalStore(subscribeSync, getSyncStatus);
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  return { ...status, pending };
}

export function SyncBadge() {
  const { state, pending } = useSyncStatus();
  const base = "flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium";

  if (state === "auth") {
    return (
      <Link to="/login" className={cx(base, "bg-amber-400/15 text-amber-200")}>
        Entrar para sincronizar
      </Link>
    );
  }

  const [dot, text] =
    state === "syncing"
      ? ["bg-sky-400", "Sincronizando…"]
      : state === "offline"
        ? ["bg-zinc-500", pending > 0 ? `Offline · ${pending} a enviar` : "Offline"]
        : state === "error"
          ? ["bg-rose-400", "Erro ao sincronizar"]
          : pending > 0
            ? ["bg-amber-400", `${pending} a enviar`]
            : ["bg-accent", "Sincronizado"];

  return (
    <button type="button" onClick={() => void syncNow()} className={cx(base, "bg-surface text-zinc-300")}>
      <span className={cx("h-2 w-2 rounded-full", dot)} />
      {text}
    </button>
  );
}
