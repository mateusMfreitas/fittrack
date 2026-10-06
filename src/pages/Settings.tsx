import { useRef, useState } from "react";
import { Stepper } from "../components/Stepper";
import { useSyncStatus } from "../components/SyncBadge";
import { Banner, Button, Card, Loading, Page, Segmented } from "../components/ui";
import { saveSettings } from "../db/repo";
import { countRows, exportData, importData, parseBackup } from "../domain/backup";
import { hiitPhaseFor } from "../domain/cycle";
import { weekStart } from "../domain/time";
import { useAppData } from "../hooks/useAppData";
import { logout } from "../sync/auth";
import { syncNow } from "../sync/syncEngine";

export default function Settings() {
  const app = useAppData();
  const sync = useSyncStatus();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: "info" | "warn"; text: string } | null>(null);
  if (!app) return <Loading />;

  const phase = hiitPhaseFor(app.cycleWeek, app.settings.hiitPhase);

  const doExport = async () => {
    const backup = await exportData();
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `fittrack-${app.today}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ tone: "info", text: `Exportados ${countRows(backup)} registros.` });
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      const n = countRows(backup);
      if (!window.confirm(`Importar ${n} registros? Isso SUBSTITUI todos os dados atuais, neste aparelho e no servidor.`)) return;
      await importData(backup);
      setMessage({ tone: "info", text: `Importados ${n} registros.` });
    } catch (err) {
      setMessage({ tone: "warn", text: err instanceof Error ? err.message : "Falha ao importar." });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const doLogout = async () => {
    const warn =
      sync.pending > 0
        ? `Há ${sync.pending} alterações ainda não enviadas ao servidor, que serão PERDIDAS. Sair mesmo assim?`
        : "Sair? Os dados deste aparelho são apagados (continuam no servidor).";
    if (window.confirm(warn)) await logout();
  };

  return (
    <Page title="Configurações" back="/mais">
      <div className="space-y-3">
        {message && <Banner tone={message.tone}>{message.text}</Banner>}

        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Ciclo</h2>
          <Stepper
            label="Semana"
            value={app.cycleWeek}
            min={1}
            max={99}
            onChange={(cycleWeek) => void saveSettings({ cycleWeek, cycleWeekAnchor: weekStart(app.today) })}
          />
          <p className="text-sm text-zinc-400">
            Avança sozinha a cada segunda-feira.{" "}
            {app.deload ? "Esta é uma semana de redução (séries pela metade)." : ""}
          </p>
          <div>
            <div className="mb-1 text-sm text-zinc-400">Semana de redução a cada</div>
            <Segmented
              value={app.settings.deloadEvery}
              onChange={(deloadEvery) => void saveSettings({ deloadEvery })}
              options={[
                { value: 5, label: "5 semanas" },
                { value: 6, label: "6 semanas" },
              ]}
            />
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Fase do HIIT</h2>
          <Segmented
            value={app.settings.hiitPhase}
            onChange={(hiitPhase) => void saveSettings({ hiitPhase })}
            options={[
              { value: "auto", label: "Auto" },
              { value: 1, label: "20/40" },
              { value: 2, label: "30/30" },
              { value: 3, label: "30/30 +" },
            ]}
          />
          <p className="text-sm text-zinc-400">
            Agora: {phase.roundsMin}–{phase.roundsMax} rodadas de {phase.workSec} s forte / {phase.restSec} s leve.
            Auto segue a semana do ciclo (1–2, 3–4, 5 em diante).
          </p>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Dados</h2>
          <p className="text-sm text-zinc-400">
            {sync.state === "auth"
              ? "Sessão expirada: entre de novo para sincronizar."
              : sync.pending > 0
                ? `${sync.pending} alterações aguardando envio.`
                : "Tudo sincronizado com o servidor."}
            {sync.lastSyncAt ? ` Último sync às ${new Date(sync.lastSyncAt).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}.` : ""}
          </p>
          <Button className="w-full" onClick={() => void syncNow()}>
            Sincronizar agora
          </Button>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => void doExport()}>
              Exportar
            </Button>
            <Button className="flex-1" onClick={() => fileRef.current?.click()}>
              Importar
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void doImport(e.target.files?.[0])}
          />
        </Card>

        <Button variant="danger" className="w-full" onClick={() => void doLogout()}>
          Sair deste aparelho
        </Button>
      </div>
    </Page>
  );
}
