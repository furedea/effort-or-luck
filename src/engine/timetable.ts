import type { RoutineKey } from "./facts";

// A week's timetable: one routine, or nothing, for each day from Monday to Sunday.

export const DAYS = 7;
export type Timetable = readonly (RoutineKey | null)[];
export const EMPTY_TIMETABLE: Timetable = Array.from({ length: DAYS }, () => null);

const SATURDAY = 5;

export function isWeekend(day: number): boolean {
  return day >= SATURDAY;
}

/** The timetable with `key` (or nothing) on `day`. */
export function withDay(timetable: Timetable, day: number, key: RoutineKey | null): Timetable {
  return timetable.map((current, d) => (d === day ? key : current));
}
