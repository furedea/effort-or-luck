import type { Boost, LogFact, LostReason, OfferMonth, RoutineKey, Stat } from "./facts";
import {
  ALLOWANCE_DISTRIBUTION,
  DIFFICULTY,
  METRO_SHARE,
  MONTHLY_EXPENSE_YEN,
  SCHOLARSHIP_ALLOWANCE_LIMIT_YEN,
  SCHOLARSHIP_YEN,
  STARTING_MONEY_YEN,
  STARTING_STATS,
  TRIP_YEN,
  WAGE_YEN_PER_HOUR,
  WEEKLY_HOURS,
  WEEKS_PER_MONTH,
  type Difficulty,
} from "./parameters";
import { createRng, pickWeighted, type Rng } from "./random";

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
  /** Pass-rate raises from limited-time preparation, per selection stage. */
  boosts: Record<Boost, number>;
  /** Whether the self passed the long internship's selection, which opens its tile. */
  longInternAccepted: boolean;
  /** Whether the self applied to the long internship, so its result comes the week after. */
  longInternApplied: boolean;
  /** Hours lost each week to illness or a trip home while any such weeks remain. */
  lost: HourLoss | null;
  /**
   * Hours of a one-off choice, such as an internship, spread over its remaining weeks, and the
   * timetable followed meanwhile instead of the usual one, when the player set one.
   */
  oneOff: { hours: number; weeks: number; timetable: readonly RoutineKey[] | null };
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
    boosts: { internEs: 0, early: 0, entryEs: 0, final: 0 },
    longInternAccepted: false,
    longInternApplied: false,
    lost: null,
    oneOff: { hours: 0, weeks: 0, timetable: null },
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

/** Savings gained (or, when negative, lost) each month from allowance and scholarship after living costs. */
export function monthlyIncomeYen(life: Life): number {
  return life.allowance + life.scholarship - MONTHLY_EXPENSE_YEN;
}

/** Hours of part-time work a week that would cover the living costs. */
export function neededWorkHours(life: Life): number {
  return Math.ceil(Math.max(0, -monthlyIncomeYen(life)) / WEEKS_PER_MONTH / WAGE_YEN_PER_HOUR);
}

/** Hours the self can divide this week, after any hours lost. */
export function weekBudget(life: Life): number {
  return Math.max(0, WEEKLY_HOURS - (life.lost?.weekly ?? 0));
}

/** Hours lost each week for a number of weeks, and why. */
export interface HourLoss {
  readonly weekly: number;
  readonly weeks: number;
  readonly reason: LostReason;
}

/** Loses `weekly` hours each week for the next `weeks` weeks. */
export function loseHours(life: Life, loss: HourLoss): void {
  life.lost = loss;
}

export function tripYen(life: Life): number {
  return life.metro ? TRIP_YEN.metro : TRIP_YEN.regional;
}

/** Whether the self is still living the year: not stopped by choice and not ended by a stat. */
export function isActive(life: Life): boolean {
  return !life.done && life.over === null;
}
