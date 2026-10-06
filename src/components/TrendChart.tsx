import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { niceTicks } from "../domain/ticks";
import { formatDate } from "../domain/time";
import { Card } from "./ui";

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

// Cores do gráfico: série validada para o fundo escuro; texto e grade usam tons neutros.
const SERIES = "#3987e5";
const SURFACE = "#18181b";
const GRID = "#27272a";
const AXIS_TEXT = "#a1a1aa";

const toMs = (date: string) => Date.parse(`${date}T00:00:00Z`);
const msToDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// Evolução de uma única medida ao longo do tempo.
export function TrendChart({
  title,
  unit,
  points,
  decimals = 0,
  emptyHint,
}: {
  title: string;
  unit: string;
  points: TrendPoint[];
  decimals?: number;
  emptyHint: string;
}) {
  const fmt = (n: number) => n.toFixed(decimals).replace(".", ",");
  const data = [...points].sort((a, b) => a.date.localeCompare(b.date)).map((p) => ({ ...p, x: toMs(p.date) }));
  const last = data[data.length - 1];
  const first = data[0];
  const delta = last && first && data.length > 1 ? last.value - first.value : null;

  const values = data.map((p) => p.value);
  const ticks = data.length > 0 ? niceTicks(Math.min(...values), Math.max(...values), decimals) : [0, 1];

  return (
    <Card>
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {last && (
          <div className="text-right">
            <span className="text-2xl font-bold">{fmt(last.value)}</span>
            <span className="ml-1 text-sm text-zinc-400">{unit}</span>
            {delta !== null && (
              <div className="text-xs text-zinc-400">
                {delta > 0 ? "+" : delta < 0 ? "−" : ""}
                {fmt(Math.abs(delta))} {unit} desde {formatDate(first.date)}
              </div>
            )}
          </div>
        )}
      </div>

      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">{emptyHint}</p>
      ) : (
        <>
          <div className="mt-3 h-48" role="img" aria-label={`Gráfico de ${title.toLowerCase()} com ${data.length} pontos`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="x"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(ms: number) => formatDate(msToDate(ms))}
                  tick={{ fill: AXIS_TEXT, fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                  minTickGap={32}
                  padding={{ left: 8, right: 8 }}
                />
                <YAxis
                  domain={[ticks[0], ticks[ticks.length - 1]]}
                  ticks={ticks}
                  tickFormatter={(v: number) => fmt(v)}
                  tick={{ fill: AXIS_TEXT, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip
                  cursor={{ stroke: AXIS_TEXT, strokeWidth: 1 }}
                  isAnimationActive={false}
                  content={({ active, payload }) => {
                    const p = active ? (payload?.[0]?.payload as (TrendPoint & { x: number }) | undefined) : undefined;
                    if (!p) return null;
                    return (
                      <div className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 shadow-lg">
                        <div className="font-bold text-zinc-100">
                          {fmt(p.value)} {unit}
                        </div>
                        <div className="text-xs text-zinc-400">{formatDate(p.date, true)}</div>
                      </div>
                    );
                  }}
                />
                <Line
                  dataKey="value"
                  type="linear"
                  stroke={SERIES}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  dot={{ r: 4, fill: SERIES, stroke: SURFACE, strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: SERIES, stroke: SURFACE, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-2 text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center text-zinc-400">Ver tabela</summary>
            <table className="w-full tabular-nums">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="py-1 font-normal">Data</th>
                  <th className="py-1 text-right font-normal">
                    {title} ({unit})
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...data].reverse().map((p, i) => (
                  <tr key={`${p.date}-${i}`} className="border-t border-zinc-800">
                    <td className="py-1.5">{formatDate(p.date, true)}</td>
                    <td className="py-1.5 text-right">{fmt(p.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </Card>
  );
}
