import { dateOf, FINAL_STRETCH_FROM } from "./calendar";
import type { RoutineKey } from "./facts";
import { isActive, monthlyIncomeYen, weekBudget, type Life } from "./life";
import { areAlternatives, isAvailable, practise, routineOf, type RoutineSpec } from "./routine";
import { liveThroughPeriod } from "./wellbeing";

// One week: a booked one-off comes first, then the timetable in the order it was set. Hours
// beyond the week's free hours come out of sleep and cost health; a routine the self cannot pay
// for is dropped that week. Booked hours rest the last routines that week instead of cutting
// further into sleep, unless the player chose to cut sleep for them. Allowance and scholarship minus living costs move savings at the start
// of each month, so savings grow only through part-time work.

export interface WeekOutcome {
  readonly budget: number;
  readonly taken: readonly RoutineSpec[];
  /** Routines in the timetable the self could not pay for this week. */
  readonly dropped: readonly RoutineKey[];
  /** Routines skipped because hours were lost this week, such as to illness. */
  readonly skipped: readonly RoutineKey[];
  readonly hours: number;
  /** Hours beyond the free hours, taken from sleep. */
  readonly shortHours: number;
  readonly paid: number;
  /** Money earned from paid routines such as extra work or a paid internship. */
  readonly earned: number;
}

/** What the timetable would take and give this week, without changing the life. */
export function planWeek(
  life: Life,
  week: number,
  timetable: readonly RoutineKey[],
  cutsSleep = false,
): WeekOutcome {
  const budget = weekBudget(life);
  const oneOffHours = life.oneOff.weeks > 0 ? life.oneOff.hours / life.oneOff.weeks : 0;
  let hours = oneOffHours;
  let paid = 0;
  const taken: RoutineSpec[] = [];
  const dropped: RoutineKey[] = [];
  for (const key of new Set(timetable)) {
    const spec = routineOf(key);
    if (!isAvailable(spec, week, life)) continue;
    if (taken.some((other) => areAlternatives(spec, other))) continue;
    if (paid + spec.weeklyMoney > life.money) {
      dropped.push(key);
      continue;
    }
    taken.push(spec);
    hours += spec.weeklyHours;
    paid += spec.weeklyMoney;
  }
  // Hours lost to illness or family leave no time for the last routines; they are skipped rather
  // than squeezed out of sleep. Booked hours do the same, down to the hours the timetable alone
  // takes, so sleep the player already gave up stays given up.
  const skipped: RoutineKey[] = [];
  const limit = restLimit(life, budget, hours - oneOffHours, cutsSleep);
  while (hours > limit && taken.length) {
    const last = taken.pop()!;
    skipped.unshift(last.key);
    hours -= last.weeklyHours;
    paid -= last.weeklyMoney;
  }
  const earned = taken.reduce((sum, spec) => sum + spec.weeklyPay, 0);
  const shortHours = Math.max(0, hours - budget);
  return { budget, taken, dropped, skipped, hours, shortHours, paid, earned };
}

/** The hours the week may take before its last routines rest. */
function restLimit(life: Life, budget: number, routineHours: number, cutsSleep: boolean): number {
  if (life.lostWeeks > 0) return budget;
  const booked = life.oneOff.weeks > 0 && life.oneOff.hours > 0;
  if (booked && !cutsSleep) return Math.max(budget, routineHours);
  return Number.POSITIVE_INFINITY;
}

/** Rest cannot happen in hours taken from sleep, so its effect shrinks by the hours over. */
function restedFor(spec: RoutineSpec, shortHours: number): Pick<RoutineSpec, "statsPerWeek"> {
  if (spec.key !== "rest" || shortHours <= 0) return spec;
  const share = Math.max(0, spec.weeklyHours - shortHours) / spec.weeklyHours;
  const stats = Object.entries(spec.statsPerWeek).map(([stat, amount]) => [stat, amount * share]);
  return { statsPerWeek: Object.fromEntries(stats) };
}

/** Lives one week by the timetable: pays, earns, practises, and moves the stats. */
export function liveWeek(
  life: Life,
  week: number,
  timetable: readonly RoutineKey[],
  cutsSleep = false,
): WeekOutcome | null {
  if (!isActive(life)) return null;
  const outcome = planWeek(life, week, timetable, cutsSleep);
  const monthly = dateOf(week).weekOfMonth === 1 ? monthlyIncomeYen(life) : 0;
  life.money = Math.max(0, life.money + monthly + outcome.earned - outcome.paid);
  for (const spec of outcome.taken) practise(life, spec);
  const oneOffHours = life.oneOff.weeks > 0 ? life.oneOff.hours / life.oneOff.weeks : 0;
  const hoursOf = (kind: "job" | "work") =>
    outcome.taken
      .filter((spec) => spec.kind === kind)
      .reduce((sum, spec) => sum + spec.weeklyHours, 0);
  liveThroughPeriod(life, {
    weeks: 1,
    finalYear: week >= FINAL_STRETCH_FROM,
    taken: outcome.taken.map((spec) => restedFor(spec, outcome.shortHours)),
    jobHours: hoursOf("job") + oneOffHours,
    extraWorkHours: hoursOf("work"),
    shortHours: outcome.shortHours,
    spareHours: Math.max(0, outcome.budget - outcome.hours),
  });
  if (life.oneOff.weeks > 0) {
    life.oneOff = { hours: life.oneOff.hours - oneOffHours, weeks: life.oneOff.weeks - 1 };
  }
  if (life.lostWeeks > 0) life.lostWeeks -= 1;
  return outcome;
}
