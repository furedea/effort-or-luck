import type { LogFact, OfferMonth, Stat } from "./facts";
import {
  ALLOWANCE_DISTRIBUTION,
  DAY_HOURS,
  DIFFICULTY,
  METRO_SHARE,
  MONTHLY_EXPENSE_YEN,
  SCHOLARSHIP_ALLOWANCE_LIMIT_YEN,
  SCHOLARSHIP_YEN,
  STARTING_MONEY_YEN,
  STARTING_STATS,
  TRIP_YEN,
  WAGE_YEN_PER_HOUR,
  WEEKS_PER_MONTH,
  type Difficulty,
} from "./parameters";
import { createRng, pickWeighted, type Rng } from "./random";
import { DAYS } from "./timetable";

type InternKind = "none" | "face" | "online";

/** One self's state through the year. Events and weeks advance it in place. */
export interface Life {
  readonly seed: number;
  readonly rng: Rng;
  readonly difficulty: Difficulty;
  readonly metro: boolean;
  readonly scholarship: number;
  allowance: number;
  money: number;
  /** Preparation for interviews; raises most pass chances. */
  prep: number;
  /** Preparation for written screening; raises document pass chances. */
  documentPrep: number;
  /** Extra chance of being invited to early selection. */
  inviteBonus: number;
  /** Hours lost each week to illness, a trip home, or deadlines, for `lostWeeks` more weeks. */
  lostWeekly: number;
  lostWeeks: number;
  /** Hours of a one-off choice, such as an internship, spread over its remaining weeks. */
  oneOff: { hours: number; weeks: number };
  internApplications: number;
  intern: InternKind;
  invited: boolean;
  entries: number;
  finals: { readonly face: number; readonly online: number };
  done: boolean;
  stats: Record<Stat, number>;
  /** The stat that reached zero and ended the year, if any. */
  over: Stat | null;
  readonly offers: OfferMonth[];
  readonly log: LogFact[];
}

export function makeLife(seed: number, difficulty: Difficulty = "normal"): Life {
  const rng = createRng(seed);
  const allowance = pickWeighted(rng, ALLOWANCE_DISTRIBUTION);
  const metro = rng() < METRO_SHARE;
  return {
    seed,
    rng,
    difficulty,
    metro,
    scholarship: allowance < SCHOLARSHIP_ALLOWANCE_LIMIT_YEN ? SCHOLARSHIP_YEN : 0,
    allowance,
    money: STARTING_MONEY_YEN,
    prep: 0,
    documentPrep: 0,
    inviteBonus: 0,
    lostWeekly: 0,
    lostWeeks: 0,
    oneOff: { hours: 0, weeks: 0 },
    internApplications: 0,
    intern: "none",
    invited: false,
    entries: 0,
    finals: { face: 0, online: 0 },
    done: false,
    stats: startingStats(difficulty),
    over: null,
    offers: [],
    log: [],
  };
}

function startingStats(difficulty: Difficulty): Record<Stat, number> {
  const { statShift } = DIFFICULTY[difficulty];
  const stats = { ...STARTING_STATS } as Record<Stat, number>;
  for (const stat of Object.keys(stats) as Stat[]) stats[stat] += statShift;
  return stats;
}

/** Part-time hours a month needed to cover living costs. */
function partTimeHours(life: Life): number {
  const shortYen = Math.max(0, MONTHLY_EXPENSE_YEN - life.allowance - life.scholarship);
  return Math.ceil(shortYen / WAGE_YEN_PER_HOUR);
}

/** Days a week of part-time work living costs require, fixed in the timetable. */
export function partTimeDays(life: Life): number {
  return Math.min(DAYS, Math.round(partTimeHours(life) / WEEKS_PER_MONTH / DAY_HOURS));
}

/** Days a week left after the part-time work living costs require. */
export function freeDays(life: Life): number {
  return DAYS - partTimeDays(life);
}

/** Hours the self can divide this week, after any hours lost. */
export function weekBudget(life: Life): number {
  const lost = life.lostWeeks > 0 ? life.lostWeekly : 0;
  return Math.max(0, freeDays(life) * DAY_HOURS - lost);
}

/** Loses `weekly` hours each week for the next `weeks` weeks. */
export function loseHours(life: Life, weekly: number, weeks: number): void {
  life.lostWeekly = weekly;
  life.lostWeeks = weeks;
}

export function tripYen(life: Life): number {
  return life.metro ? TRIP_YEN.metro : TRIP_YEN.regional;
}

/** Whether the self is still living the year: not stopped by choice and not ended by a stat. */
export function isActive(life: Life): boolean {
  return !life.done && life.over === null;
}
