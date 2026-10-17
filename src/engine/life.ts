import type { LogFact, OfferMonth, Stat } from "./facts";
import {
  ALLOWANCE_DISTRIBUTION,
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
} from "./parameters";
import { createRng, pickWeighted, type Rng } from "./random";

type InternKind = "none" | "face" | "online";

/** One self's state through the year. Scenes and allocations advance it in place. */
export interface Life {
  readonly seed: number;
  readonly rng: Rng;
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
  /** Hours lost in the current period to illness, a trip home, or deadlines. */
  lostHours: number;
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

export function makeLife(seed: number): Life {
  const rng = createRng(seed);
  const allowance = pickWeighted(rng, ALLOWANCE_DISTRIBUTION);
  const metro = rng() < METRO_SHARE;
  return {
    seed,
    rng,
    metro,
    scholarship: allowance < SCHOLARSHIP_ALLOWANCE_LIMIT_YEN ? SCHOLARSHIP_YEN : 0,
    allowance,
    money: STARTING_MONEY_YEN,
    prep: 0,
    documentPrep: 0,
    inviteBonus: 0,
    lostHours: 0,
    internApplications: 0,
    intern: "none",
    invited: false,
    entries: 0,
    finals: { face: 0, online: 0 },
    done: false,
    stats: { ...STARTING_STATS },
    over: null,
    offers: [],
    log: [],
  };
}

/** Part-time hours a month needed to cover living costs. */
export function partTimeHours(life: Life): number {
  const shortYen = Math.max(0, MONTHLY_EXPENSE_YEN - life.allowance - life.scholarship);
  return Math.ceil(shortYen / WAGE_YEN_PER_HOUR);
}

export function weeklyPartTimeHours(life: Life): number {
  return Math.round(partTimeHours(life) / WEEKS_PER_MONTH);
}

/** Free hours a week after the part-time work living costs require. */
export function weeklyFreeHours(life: Life): number {
  return Math.max(0, WEEKLY_HOURS - weeklyPartTimeHours(life));
}

/** Hours the self can divide among activities over `weeks`. */
export function periodBudget(life: Life, weeks: number): number {
  return Math.max(0, weeklyFreeHours(life) * weeks - life.lostHours);
}

export function tripYen(life: Life): number {
  return life.metro ? TRIP_YEN.metro : TRIP_YEN.regional;
}

/** Whether the self is still living the year: not stopped by choice and not ended by a stat. */
export function isActive(life: Life): boolean {
  return !life.done && life.over === null;
}
