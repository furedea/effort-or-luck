// The 100 selves living one year together, week by week: every timetable and every choice the
// player makes is attempted by all of them. Lives advance in place, so each transition returns a
// new Cohort and the previous one must not be used again.
import { WEEKS } from "./calendar";
import { eventAt, OPTION_EFFORT, type Event } from "./events";
import type { OptionKey } from "./facts";
import { makeLife, type Life } from "./life";
import { ALLOWANCE_DISTRIBUTION, type Difficulty } from "./parameters";
import { EMPTY_TIMETABLE, type Timetable } from "./timetable";
import { liveWeek, type WeekOutcome } from "./week";
import { autoLive, leastPolicy, meet, mostPolicy, type Choice, type Decision } from "./year";

export const COHORT_SIZE = 100;
const SEED_STRIDE = 7919;
const MIDDLE_CHOICE: Choice = { key: null, want: 1 };

export interface Cohort {
  /** Seeds aligned with `lives`, so the same selves can be replayed with other decisions. */
  readonly seeds: readonly number[];
  readonly difficulty: Difficulty;
  readonly lives: readonly Life[];
  /** Each self's starting allowance as an index into the allowance distribution. */
  readonly allowanceRanks: readonly number[];
  /** The current week; WEEKS while the results are shown, beyond it once the year is over. */
  readonly week: number;
  /** Each self's event this week, or null when there is none or it has been met. */
  readonly events: readonly (Event | null)[];
  readonly timetable: Timetable;
  readonly decisions: readonly Decision[];
  /** What the last week took and gave each self; null for selves not living the year. */
  readonly lastWeek: readonly (WeekOutcome | null)[];
  /** Selves who, in some week, could not pay for part of what everyone attempted. */
  readonly everBlocked: ReadonlySet<number>;
}

export function startCohort(baseSeed: number, difficulty: Difficulty = "normal"): Cohort {
  const lives = Array.from({ length: COHORT_SIZE }, (_, i) =>
    makeLife((baseSeed + i * SEED_STRIDE) >>> 0, difficulty),
  );
  lives.sort((a, b) => a.allowance - b.allowance || Number(a.metro) - Number(b.metro));
  const amounts: readonly number[] = ALLOWANCE_DISTRIBUTION.map(([amount]) => amount);
  return {
    seeds: lives.map((life) => life.seed),
    difficulty,
    lives,
    allowanceRanks: lives.map((life) => amounts.indexOf(life.allowance)),
    week: 0,
    events: lives.map((life) => eventAt(life, 0)),
    timetable: EMPTY_TIMETABLE,
    decisions: [],
    lastWeek: lives.map(() => null),
    everBlocked: new Set(),
  };
}

export function isOver(cohort: Cohort): boolean {
  return cohort.week > WEEKS;
}

/** Sets the timetable everyone follows from this week on. */
export function setTimetable(cohort: Cohort, timetable: Timetable): Cohort {
  return {
    ...cohort,
    timetable,
    decisions: [...cohort.decisions, { week: cohort.week, kind: "timetable", timetable }],
  };
}

/** The player takes `option` at this week's event; everyone else with an event attempts it too. */
export function choose(cohort: Cohort, option: OptionKey): Cohort {
  const others: Choice = { key: option, want: OPTION_EFFORT[option] };
  meetAll(cohort, others);
  return {
    ...cohort,
    events: cohort.events.map(() => null),
    decisions: [...cohort.decisions, { week: cohort.week, kind: "choice", option }],
  };
}

/** Lives this week for everyone, meeting any event still open the middle way, then moves on. */
export function step(cohort: Cohort): Cohort {
  if (isOver(cohort)) return cohort;
  meetAll(cohort, MIDDLE_CHOICE);
  if (cohort.week >= WEEKS)
    return { ...cohort, week: WEEKS + 1, events: cohort.lives.map(() => null) };
  const lastWeek = cohort.lives.map((life) => liveWeek(life, cohort.week, cohort.timetable));
  const blocked = lastWeek.flatMap((outcome, i) => (outcome?.dropped.length ? [i] : []));
  const week = cohort.week + 1;
  return {
    ...cohort,
    week,
    events: cohort.lives.map((life) => eventAt(life, week)),
    lastWeek,
    everBlocked: new Set([...cohort.everBlocked, ...blocked]),
  };
}

export interface YearEnd {
  readonly most: readonly Life[];
  readonly least: readonly Life[];
}

/** The same selves, with the same luck, always putting the most or the least into job hunting. */
export function replayYear(cohort: Cohort): YearEnd {
  return {
    most: cohort.seeds.map((seed) => autoLive(seed, mostPolicy, cohort.difficulty)),
    least: cohort.seeds.map((seed) => autoLive(seed, leastPolicy, cohort.difficulty)),
  };
}

interface AllowanceRow {
  readonly amount: number;
  /** Indices of the selves who started with this allowance. */
  readonly members: readonly number[];
  readonly offered: number;
}

/** The selves grouped by starting allowance, with how many held an offer. */
export function revealByAllowance(
  lives: readonly Life[],
  ranks: readonly number[],
): AllowanceRow[] {
  return ALLOWANCE_DISTRIBUTION.map(([amount], rank) => {
    const members = ranks.flatMap((r, i) => (r === rank ? [i] : []));
    const offered = members.filter((i) => (lives[i]?.offers.length ?? 0) > 0).length;
    return { amount, members, offered };
  });
}

/** Meets every open event that offers options by `choice`. Events are cleared by the caller. */
function meetAll(cohort: Cohort, choice: Choice): void {
  cohort.events.forEach((event, i) => {
    const life = cohort.lives[i];
    if (life && event?.options.length) meet(life, event, choice);
  });
}
