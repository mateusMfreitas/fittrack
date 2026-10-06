import type { Measurement, MeasurementType } from "../db/types";
import { diffDays } from "./time";

export const MEASURE_INTERVAL_DAYS: Record<MeasurementType, number> = { peso: 7, cintura: 14 };

export function lastMeasurement(measurements: Measurement[], type: MeasurementType): Measurement | undefined {
  return measurements
    .filter((m) => m.type === type)
    .sort((a, b) => (a.date === b.date ? b.updatedAt - a.updatedAt : b.date.localeCompare(a.date)))[0];
}

export function isMeasurePending(measurements: Measurement[], type: MeasurementType, today: string): boolean {
  const last = lastMeasurement(measurements, type);
  if (!last) return true;
  return diffDays(today, last.date) >= MEASURE_INTERVAL_DAYS[type];
}

export function pendingMeasures(measurements: Measurement[], today: string): MeasurementType[] {
  return (["peso", "cintura"] as const).filter((t) => isMeasurePending(measurements, t, today));
}
