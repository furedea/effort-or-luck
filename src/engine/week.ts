import { FINAL_STRETCH_FROM } from "./calendar";
import type { RoutineKey } from "./facts";
import { isActive, weekBudget, weeklyIncomeYen, type Life } from "./life";
import { isOpen, practise, routineOf, type RoutineSpec } from "./routine";
import { liveThroughPeriod } from "./wellbeing";

// One week: a booked one-off comes first, then the timetable in the order it was set. Hours
// beyond the week's free hours come out of sleep and cost health; a routine the self cannot pay
// for is dropped that week. Allowance and scholarship minus living costs move savings every week,
// so savings grow only through part-time work.

export interface WeekOutcome {
  readonly budget: number;
  readonly taken: readonly RoutineSpec[];
  /** Routines in the timetable the self could not pay for this week. */
  readonly dropped: readonly RoutineKey[];
  readonly hours: number;
  /** Hours beyond the free hours, taken from sleep. */
  readonly shortHours: number;
  readonly paid: number;
  /** Money earned from paid routines such as extra work or a paid internship. */
  readonly earned: number;
}

/** What the timetable would take and give this week, without changing the life. */
export function planWeek(life: Life, week: number, timetable: readonly RoutineKey[]): WeekOutcome {
  const budget = weekBudget(life);
  const oneOffHours = life.oneOff.weeks > 0 ? life.oneOff.hours / life.oneOff.weeks : 0;
  let hours = oneOffHours;
  let paid = 0;
  const taken: RoutineSpec[] = [];
  const dropped: RoutineKey[] = [];
  for (const key of new Set(timetable)) {
    const spec = routineOf(key);
    if (!isOpen(spec, week)) continue;
    if (paid + spec.weeklyMoney > life.money) {
      dropped.push(key);
      continue;
    }
    taken.push(spec);
    hours += spec.weeklyHours;
    paid += spec.weeklyMoney;
  }
  const earned = taken.reduce((sum, spec) => sum + spec.weeklyPay, 0);
  const shortHours = Math.max(0, hours - budget);
  return { budget, taken, dropped, hours, shortHours, paid, earned };
}

/** Lives one week by the timetable: pays, earns, practises, and moves the stats. */
export function liveWeek(
  life: Life,
  week: number,
  timetable: readonly RoutineKey[],
): WeekOutcome | null {
  if (!isActive(life)) return null;
  const outcome = planWeek(life, week, timetable);
  life.money = Math.max(0, life.money + weeklyIncomeYen(life) + outcome.earned - outcome.paid);
  for (const spec of outcome.taken) practise(life, spec);
  const oneOffHours = life.oneOff.weeks > 0 ? life.oneOff.hours / life.oneOff.weeks : 0;
  const hoursOf = (kind: "job" | "work") =>
    outcome.taken
      .filter((spec) => spec.kind === kind)
      .reduce((sum, spec) => sum + spec.weeklyHours, 0);
  liveThroughPeriod(life, {
    weeks: 1,
    fourthYear: week >= FINAL_STRETCH_FROM,
    taken: outcome.taken,
    jobHours: hoursOf("job") + oneOffHours,
    extraWorkHours: hoursOf("work"),
    shortHours: outcome.shortHours,
  });
  if (life.oneOff.weeks > 0) {
    life.oneOff = { hours: life.oneOff.hours - oneOffHours, weeks: life.oneOff.weeks - 1 };
  }
  if (life.lostWeeks > 0) life.lostWeeks -= 1;
  return outcome;
}
