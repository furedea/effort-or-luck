import { FINAL_STRETCH_FROM } from "./calendar";
import type { RoutineKey, Stat } from "./facts";
import { isActive, partTimeDays, type Life } from "./life";
import { DAY_HOURS, WAGE_YEN_PER_HOUR } from "./parameters";
import { dayFactor, fitsDay, practise, routineOf, type RoutineSpec } from "./routine";
import { DAYS, type Timetable } from "./timetable";
import { liveThroughPeriod } from "./wellbeing";

// One week, day by day. Part-time work living costs require takes fixed days; hours lost and a
// booked one-off then take the latest free days; the timetable fills the rest. A one-off longer
// than the free days is bought back from part-time days and paid from savings; a routine the
// self cannot pay for is dropped that day.

/** Days of the week part-time work takes, in the order they are needed. */
const PART_TIME_ORDER: readonly number[] = [5, 2, 4, 0, 3, 1, 6];

export type DayOutcome =
  | { readonly kind: "partTime" | "event" | "lost" | "idle" }
  | { readonly kind: "routine"; readonly spec: RoutineSpec; readonly factor: number }
  | { readonly kind: "dropped"; readonly key: RoutineKey };

export interface WeekOutcome {
  readonly days: readonly DayOutcome[];
  readonly taken: readonly RoutineSpec[];
  /** Routines in the timetable the self could not pay for this week. */
  readonly dropped: readonly RoutineKey[];
  /** One-off hours beyond the free days, bought back from part-time work. */
  readonly shortHours: number;
  readonly paid: number;
  /** Money earned from part-time work beyond what living costs require. */
  readonly earned: number;
  readonly rested: boolean;
}

/** Days of the week the part-time work living costs require takes. */
export function partTimeDaysOf(life: Life): number[] {
  return PART_TIME_ORDER.slice(0, partTimeDays(life));
}

/** What the timetable would take and give this week, without changing the life. */
export function planWeek(life: Life, week: number, timetable: Timetable): WeekOutcome {
  const days: DayOutcome[] = Array.from({ length: DAYS }, () => ({ kind: "idle" }));
  const partTime = partTimeDaysOf(life);
  for (const day of partTime) days[day] = { kind: "partTime" };
  // Hours lost and one-offs avoid a planned rest day while other days are free.
  const free = latestFirst()
    .filter((day) => !partTime.includes(day))
    .toSorted((a, b) => Number(timetable[a] === "rest") - Number(timetable[b] === "rest"));
  const lostDays = life.lostWeeks > 0 ? daysFor(life.lostWeekly) : 0;
  const oneOffHours = weeklyOneOffHours(life);
  const freeHours = Math.max(0, free.length - lostDays) * DAY_HOURS;
  const shortHours = Math.max(0, oneOffHours - freeHours);
  for (const day of free.slice(0, lostDays)) days[day] = { kind: "lost" };
  const eventDays = [...free.slice(lostDays), ...partTime.toReversed()].slice(
    0,
    daysFor(oneOffHours),
  );
  for (const day of eventDays) days[day] = { kind: "event" };

  let paid = shortHours * WAGE_YEN_PER_HOUR;
  for (let day = 0; day < DAYS; day++) {
    const key = timetable[day];
    if (!key || days[day]?.kind !== "idle") continue;
    const spec = routineOf(key);
    if (!fitsDay(spec, week, day)) continue;
    if (paid + spec.dayMoney > life.money) {
      days[day] = { kind: "dropped", key };
      continue;
    }
    paid += spec.dayMoney;
    days[day] = { kind: "routine", spec, factor: dayFactor(spec, day) };
  }
  const taken = days.flatMap((d) => (d.kind === "routine" ? [d.spec] : []));
  return {
    days,
    taken,
    dropped: days.flatMap((d) => (d.kind === "dropped" ? [d.key] : [])),
    shortHours,
    paid,
    earned: taken.reduce((sum, spec) => sum + spec.dayPay, 0),
    rested: taken.some((spec) => spec.key === "rest"),
  };
}

/** Lives one week by the timetable: pays, earns, practises, and moves the stats. */
export function liveWeek(life: Life, week: number, timetable: Timetable): WeekOutcome | null {
  if (!isActive(life)) return null;
  const outcome = planWeek(life, week, timetable);
  life.money = Math.max(0, life.money + outcome.earned - outcome.paid);
  const gains: Partial<Record<Stat, number>> = {};
  let jobDays = 0;
  for (const day of outcome.days) {
    if (day.kind !== "routine") continue;
    practise(life, day.spec, day.factor);
    if (day.spec.kind === "job") jobDays += 1;
    for (const [stat, amount] of Object.entries(day.spec.statsPerDay) as [Stat, number][]) {
      gains[stat] = (gains[stat] ?? 0) + amount * day.factor;
    }
  }
  const oneOffHours = weeklyOneOffHours(life);
  liveThroughPeriod(life, {
    weeks: 1,
    fourthYear: week >= FINAL_STRETCH_FROM,
    gains,
    jobHours: jobDays * DAY_HOURS + oneOffHours,
    rested: outcome.rested,
  });
  if (life.oneOff.weeks > 0) {
    life.oneOff = { hours: life.oneOff.hours - oneOffHours, weeks: life.oneOff.weeks - 1 };
  }
  if (life.lostWeeks > 0) life.lostWeeks -= 1;
  return outcome;
}

function weeklyOneOffHours(life: Life): number {
  return life.oneOff.weeks > 0 ? life.oneOff.hours / life.oneOff.weeks : 0;
}

/** Whole days needed for `hours`. */
function daysFor(hours: number): number {
  return Math.ceil(hours / DAY_HOURS - 1e-9);
}

/** Days from Sunday back to Monday. */
function latestFirst(): number[] {
  return Array.from({ length: DAYS }, (_, i) => DAYS - 1 - i);
}
