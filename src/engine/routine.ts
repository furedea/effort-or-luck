import { weekOfMonthStart, WEEKS } from "./calendar";
import type { RoutineKey, Stat } from "./facts";
import type { Life } from "./life";
import { DAY_HOURS, WAGE_YEN_PER_HOUR, WEEKEND_FRIENDS_FACTOR } from "./parameters";
import { isWeekend } from "./timetable";

// What a self can do on a day of the week. Costs and effects are assumptions, listed on the
// sources page; effects accumulate day by day.

export interface RoutineSpec {
  readonly key: RoutineKey;
  /** Job hunting, time for oneself, or extra paid work. */
  readonly kind: "job" | "life" | "work";
  readonly dayMoney: number;
  readonly dayPay: number;
  /** Weeks in which the routine is open: from `from` up to but not including `until`. */
  readonly from: number;
  readonly until: number;
  /** Held only on weekdays, such as company information sessions. */
  readonly weekdayOnly: boolean;
  /** Effect on Saturday and Sunday relative to a weekday. */
  readonly weekendFactor: number;
  readonly statsPerDay: Readonly<Partial<Record<Stat, number>>>;
  readonly prepPerDay: number;
  readonly documentPrepPerDay: number;
  readonly inviteBonusPerDay: number;
}

const DEFAULTS = {
  dayMoney: 0,
  dayPay: 0,
  from: 0,
  until: WEEKS,
  weekdayOnly: false,
  weekendFactor: 1,
  statsPerDay: {},
  prepPerDay: 0,
  documentPrepPerDay: 0,
  inviteBonusPerDay: 0,
} as const;

function routine(spec: Partial<RoutineSpec> & Pick<RoutineSpec, "key" | "kind">): RoutineSpec {
  return { ...DEFAULTS, ...spec };
}

/** Every routine in a fixed order, used to encode timetables in shared links. */
export const ROUTINES: readonly RoutineSpec[] = [
  routine({ key: "selfAnalysis", kind: "job", prepPerDay: 0.15 }),
  routine({
    key: "infoSessions",
    kind: "job",
    weekdayOnly: true,
    prepPerDay: 0.1,
    inviteBonusPerDay: 0.003,
  }),
  routine({
    key: "interviewPractice",
    kind: "job",
    weekdayOnly: true,
    from: weekOfMonthStart(6),
    prepPerDay: 0.25,
  }),
  routine({
    key: "jobCourse",
    kind: "job",
    weekdayOnly: true,
    dayMoney: 2500,
    until: weekOfMonthStart(10),
    prepPerDay: 0.25,
  }),
  routine({ key: "longIntern", kind: "job", until: weekOfMonthStart(10), prepPerDay: 0.12 }),
  routine({ key: "certification", kind: "life", dayMoney: 800, documentPrepPerDay: 0.08 }),
  routine({
    key: "friends",
    kind: "life",
    weekendFactor: WEEKEND_FRIENDS_FACTOR,
    statsPerDay: { mind: 0.9, social: 1.4 },
    prepPerDay: 0.05,
  }),
  routine({ key: "sns", kind: "life", statsPerDay: { mind: 0.4 }, inviteBonusPerDay: 0.003 }),
  routine({ key: "research", kind: "life", statsPerDay: { research: 1.8 } }),
  routine({ key: "rest", kind: "life", statsPerDay: { health: 1.2, mind: 0.3 } }),
  routine({ key: "extraWork", kind: "work", dayPay: DAY_HOURS * WAGE_YEN_PER_HOUR }),
];

export function routineOf(key: RoutineKey): RoutineSpec {
  const spec = ROUTINES.find((routine) => routine.key === key);
  if (!spec) throw new Error(`unknown routine ${key}`);
  return spec;
}

/** Whether the routine is open in `week`. */
export function isOpen(spec: RoutineSpec, week: number): boolean {
  return week >= spec.from && week < spec.until;
}

/** Whether the routine can be placed on `day` of `week`. */
export function fitsDay(spec: RoutineSpec, week: number, day: number): boolean {
  return isOpen(spec, week) && !(spec.weekdayOnly && isWeekend(day));
}

/** How strongly the routine works on `day`. */
export function dayFactor(spec: RoutineSpec, day: number): number {
  return isWeekend(day) ? spec.weekendFactor : 1;
}

/** Applies a day of the routine's effects other than stats, scaled by `factor`. */
export function practise(life: Life, spec: RoutineSpec, factor: number): void {
  life.prep += spec.prepPerDay * factor;
  life.documentPrep += spec.documentPrepPerDay * factor;
  life.inviteBonus += spec.inviteBonusPerDay * factor;
}
