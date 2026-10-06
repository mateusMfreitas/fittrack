// Datas no fuso America/Sao_Paulo. Datas de calendário são strings YYYY-MM-DD.
export const TZ = "America/Sao_Paulo";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function spParts(ms: number) {
  const p: Record<string, number> = {};
  for (const { type, value } of partsFmt.formatToParts(new Date(ms))) {
    if (type !== "literal") p[type] = Number(value);
  }
  return p;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function dateSP(ms: number = Date.now()): string {
  const p = spParts(ms);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

// Instante (ms) de uma data/hora de parede em São Paulo.
export function spToMs(date: string, time = "00:00"): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const p = spParts(guess);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return guess - (wall - guess);
}

const toUTC = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export function addDays(date: string, n: number): string {
  return new Date(toUTC(date) + n * 86_400_000).toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(a) - toUTC(b)) / 86_400_000);
}

// 0 = segunda ... 6 = domingo
export function weekdayIndex(date: string): number {
  return (new Date(toUTC(date)).getUTCDay() + 6) % 7;
}

export function weekStart(date: string): string {
  return addDays(date, -weekdayIndex(date));
}

export function weekDates(date: string): string[] {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const WEEKDAYS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const WEEKDAYS_LONG = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export function formatDate(date: string, withYear = false): string {
  const [y, m, d] = date.split("-");
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
}

export function formatDateLong(date: string): string {
  return `${WEEKDAYS_LONG[weekdayIndex(date)]}, ${formatDate(date)}`;
}
