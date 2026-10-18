import { EVENT_WEEKS, weekOfMonthStart, WEEKS } from "./calendar";
import type { Boost, RoutineKey, Stat } from "./facts";
import type { Life } from "./life";
import { WAGE_YEN_PER_HOUR } from "./parameters";

// What a self can do every week. Hours, costs, and effects are assumptions, listed on the
// sources page; effects accumulate week by week.

export interface RoutineSpec {
  readonly key: RoutineKey;
  /** Job hunting, study, time for oneself, or part-time work. */
  readonly kind: "job" | "study" | "life" | "work";
  readonly weeklyHours: number;
  readonly weeklyMoney: number;
  readonly weeklyPay: number;
  /** Weeks in which the routine is open: from `from` up to but not including `until`. */
  readonly from: number;
  readonly until: number;
  readonly statsPerWeek: Readonly<Partial<Record<Stat, number>>>;
  readonly prepPerWeek: number;
  readonly documentPrepPerWeek: number;
  readonly inviteBonusPerWeek: number;
  readonly boostsPerWeek: Readonly<Partial<Record<Boost, number>>>;
  /** Open only to a self accepted into it, such as the long internship. */
  readonly needsAcceptance: boolean;
}

const ALL_YEAR = { from: 0, until: WEEKS } as const;
const NONE = {
  statsPerWeek: {},
  prepPerWeek: 0,
  documentPrepPerWeek: 0,
  inviteBonusPerWeek: 0,
  boostsPerWeek: {},
  needsAcceptance: false,
};

function routine(
  spec: Partial<RoutineSpec> & Pick<RoutineSpec, "key" | "kind" | "weeklyHours">,
): RoutineSpec {
  return { weeklyMoney: 0, weeklyPay: 0, ...ALL_YEAR, ...NONE, ...spec };
}

/**
 * Preparation for one event, open for `weeks` weeks up to it: 4 hours a week that raise that
 * event's pass rate a little each week.
 */
function limited(
  key: RoutineKey,
  eventWeek: number,
  weeks: number,
  boostsPerWeek: Partial<Record<Boost, number>>,
): RoutineSpec {
  return routine({
    key,
    kind: "job",
    weeklyHours: 4,
    from: eventWeek - weeks,
    until: eventWeek,
    boostsPerWeek,
  });
}

function roundPay(hours: number): number {
  return Math.round((hours * WAGE_YEN_PER_HOUR) / 1_000) * 1_000;
}

/** Every routine in a fixed order, used to encode timetables in shared links. */
export const ROUTINES: readonly RoutineSpec[] = [
  routine({ key: "selfAnalysis", kind: "job", weeklyHours: 5, prepPerWeek: 0.375 }),
  routine({
    key: "infoSessions",
    kind: "job",
    weeklyHours: 6,
    prepPerWeek: 0.3,
    inviteBonusPerWeek: 0.009,
  }),
  routine({
    key: "interviewPractice",
    kind: "job",
    weeklyHours: 4,
    from: weekOfMonthStart(6),
    prepPerWeek: 0.5,
  }),
  routine({
    key: "jobCourse",
    kind: "job",
    weeklyHours: 4,
    weeklyMoney: 5000,
    until: weekOfMonthStart(10),
    prepPerWeek: 0.5,
  }),
  routine({
    key: "longIntern",
    kind: "job",
    weeklyHours: 16,
    from: weekOfMonthStart(2),
    until: weekOfMonthStart(10),
    needsAcceptance: true,
    prepPerWeek: 0.25,
  }),
  routine({
    key: "certification",
    kind: "study",
    weeklyHours: 6,
    weeklyMoney: 2000,
    documentPrepPerWeek: 0.16,
  }),
  routine({
    key: "friends",
    kind: "life",
    weeklyHours: 10,
    statsPerWeek: { mind: 1.1, social: 1.75 },
    prepPerWeek: 0.06,
  }),
  routine({
    key: "sns",
    kind: "life",
    weeklyHours: 7,
    statsPerWeek: { mind: 0.56 },
    inviteBonusPerWeek: 0.004,
  }),
  routine({ key: "research", kind: "study", weeklyHours: 10, statsPerWeek: { research: 4.5 } }),
  routine({ key: "rest", kind: "life", weeklyHours: 10, statsPerWeek: { health: 2.4, mind: 0.6 } }),
  // Pay is the hourly wage times the hours, rounded to the thousand so savings stay plain amounts.
  routine({ key: "extraWork", kind: "work", weeklyHours: 8, weeklyPay: roundPay(8) }),
  limited("summerEsPrep", EVENT_WEEKS.internEs, 4, { internEs: 0.03 }),
  limited("earlyPrep", EVENT_WEEKS.early, 4, { early: 0.03 }),
  limited("entryPrep", EVENT_WEEKS.entries, 4, { entryEs: 0.02 }),
  limited("finalPrep", EVENT_WEEKS.finals, 6, { final: 0.02 }),
  routine({ key: "moreWork", kind: "work", weeklyHours: 16, weeklyPay: roundPay(16) }),
];

/** Whether the routine is preparation open only in the weeks leading up to one event. */
export function isLimited(spec: RoutineSpec): boolean {
  return Object.keys(spec.boostsPerWeek).length > 0;
}

export function routineOf(key: RoutineKey): RoutineSpec {
  const spec = ROUTINES.find((routine) => routine.key === key);
  if (!spec) throw new Error(`unknown routine ${key}`);
  return spec;
}

/** Whether the routine is open in `week`. */
export function isOpen(spec: RoutineSpec, week: number): boolean {
  return week >= spec.from && week < spec.until;
}

/** Whether `life` can take the routine in `week`: open, and accepted into it if it needs that. */
export function isAvailable(spec: RoutineSpec, week: number, life: Life): boolean {
  return isOpen(spec, week) && (!spec.needsAcceptance || life.longInternAccepted);
}

/** Applies a week of the routine's effects other than stats. */
export function practise(life: Life, spec: RoutineSpec): void {
  life.prep += spec.prepPerWeek;
  life.documentPrep += spec.documentPrepPerWeek;
  life.inviteBonus += spec.inviteBonusPerWeek;
  for (const [boost, amount] of Object.entries(spec.boostsPerWeek) as [Boost, number][]) {
    life.boosts[boost] += amount;
  }
}
