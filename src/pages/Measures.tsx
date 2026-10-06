import { useState } from "react";
import { Stepper } from "../components/Stepper";
import { Button, Card, Loading, Page, SectionTitle } from "../components/ui";
import { addMeasurement, deleteMeasurement } from "../db/repo";
import type { Measurement, MeasurementType } from "../db/types";
import { isMeasurePending, lastMeasurement } from "../domain/reminders";
import { formatDate } from "../domain/time";
import { useAppData } from "../hooks/useAppData";

const CONFIG: Record<MeasurementType, { title: string; unit: string; step: number; fallback: number; every: string }> = {
  peso: { title: "Peso", unit: "kg", step: 0.1, fallback: 75, every: "semanal" },
  cintura: { title: "Cintura", unit: "cm", step: 0.5, fallback: 85, every: "quinzenal" },
};

const fmt = (n: number) => n.toFixed(1).replace(".", ",");

export default function Measures() {
  const app = useAppData();
  if (!app) return <Loading />;
  const recent = [...app.measurements].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt).slice(0, 30);

  return (
    <Page title="Medidas" back="/mais">
      <div className="space-y-3">
        {(["peso", "cintura"] as const).map((type) => (
          <MeasureForm key={type} type={type} measurements={app.measurements} today={app.today} />
        ))}

        <SectionTitle>Últimos registros</SectionTitle>
        {recent.length === 0 && <p className="text-zinc-500">Nenhuma medida registrada.</p>}
        <ul className="space-y-2">
          {recent.map((m) => (
            <li key={m.id} className="bg-surface flex min-h-14 items-center gap-3 rounded-2xl pr-1 pl-4">
              <span className="w-14 text-sm text-zinc-400">{formatDate(m.date)}</span>
              <span className="flex-1 font-semibold">
                {CONFIG[m.type].title}: {fmt(m.value)} {CONFIG[m.type].unit}
              </span>
              <Button
                variant="quiet"
                className="w-12 px-0"
                aria-label="Apagar medida"
                onClick={() => window.confirm("Apagar esta medida?") && void deleteMeasurement(m.id)}
              >
                ✕
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </Page>
  );
}

function MeasureForm({ type, measurements, today }: { type: MeasurementType; measurements: Measurement[]; today: string }) {
  const cfg = CONFIG[type];
  const last = lastMeasurement(measurements, type);
  const pending = isMeasurePending(measurements, type, today);
  const [draft, setDraft] = useState<number | null>(null);
  const [date, setDate] = useState(today);
  const [saved, setSaved] = useState(false);
  const value = draft ?? last?.value ?? cfg.fallback;

  const save = async () => {
    await addMeasurement({ type, date, value });
    setDraft(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">
          {cfg.title} <span className="text-sm font-normal text-zinc-400">· {cfg.every}</span>
        </h2>
        <span className={`text-sm ${pending ? "text-amber-300" : "text-zinc-400"}`}>
          {last ? `Último: ${fmt(last.value)} ${cfg.unit} em ${formatDate(last.date)}` : "Sem registro"}
          {pending && last ? " · pendente" : ""}
        </span>
      </div>
      <Stepper label={cfg.title} unit={cfg.unit} value={value} step={cfg.step} decimals={1} min={1} max={400} onChange={setDraft} />
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value || today)}
          aria-label="Data da medida"
          className="bg-surface-2 min-h-14 rounded-2xl px-3"
        />
        <Button
          variant="primary"
          className="flex-1"
          aria-label={saved ? `${cfg.title} salvo` : `Salvar ${cfg.title.toLowerCase()}`}
          onClick={() => void save()}
        >
          {saved ? "✓ Salvo" : "Salvar"}
        </Button>
      </div>
    </Card>
  );
}
