// The year before graduation, week by week: from the first week of April to the end of May of
// the following year, with the result on June 1st. No school year is named, so the same calendar
// fits bachelor's, master's, and doctoral students.

export const WEEKS = 60;
const WEEKS_PER_MONTH = 52 / 12;
/** Calendar month of the first week (April). */
const FIRST_MONTH = 4;

export interface WeekDate {
  /** Calendar month, 1–12. */
  readonly month: number;
  /** Week within the month, starting at 1. */
  readonly weekOfMonth: number;
  /** Whether this is the second time the month comes round (the following April or May). */
  readonly following: boolean;
}

export function dateOf(week: number): WeekDate {
  const monthsSinceStart = Math.floor(week / WEEKS_PER_MONTH);
  const monthStart = Math.ceil(monthsSinceStart * WEEKS_PER_MONTH);
  return {
    month: ((FIRST_MONTH - 1 + monthsSinceStart) % 12) + 1,
    weekOfMonth: week - monthStart + 1,
    following: monthsSinceStart >= 12,
  };
}

/** The first week of the given months since the start (0 = April). */
export function weekOfMonthStart(monthsSinceStart: number): number {
  return Math.ceil(monthsSinceStart * WEEKS_PER_MONTH);
}

/** Weeks of the events that limited-time preparation leads up to. */
export const EVENT_WEEKS = {
  internEs: weekOfMonthStart(2),
  early: weekOfMonthStart(8) + 1,
  entries: weekOfMonthStart(11),
  finals: weekOfMonthStart(12) + 2,
} as const;

/** From January on, the final year's research load grows. */
export const FINAL_STRETCH_FROM = weekOfMonthStart(9);
