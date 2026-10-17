import type { Effort, LogFact, OfferMonth, SceneId } from "./facts";
import {
  ALLOWANCE_DISTRIBUTION,
  METRO_SHARE,
  MONTHLY_EXPENSE_YEN,
  MONTHLY_HOURS,
  SCHOLARSHIP_ALLOWANCE_LIMIT_YEN,
  SCHOLARSHIP_YEN,
  STARTING_MONEY_YEN,
  TRIP_YEN,
  WAGE_YEN_PER_HOUR,
} from "./parameters";
import { createRng, pickWeighted, type Rng } from "./random";

type InternKind = "none" | "face" | "online";

/** One self's state through the year. Scenes and choices advance it in place. */
export interface Life {
  readonly seed: number;
  readonly rng: Rng;
  readonly metro: boolean;
  readonly scholarship: number;
  allowance: number;
  money: number;
  prep: number;
  /** Hours this month lost to illness, a trip home, or deadlines. */
  lostHours: number;
  internApplications: number;
  intern: InternKind;
  invited: boolean;
  entries: number;
  finals: { readonly face: number; readonly online: number };
  done: boolean;
  readonly offers: OfferMonth[];
  readonly log: LogFact[];
  readonly efforts: Partial<Record<SceneId, Effort>>;
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
    lostHours: 0,
    internApplications: 0,
    intern: "none",
    invited: false,
    entries: 0,
    finals: { face: 0, online: 0 },
    done: false,
    offers: [],
    log: [],
    efforts: {},
  };
}

export function partTimeHours(life: Life): number {
  const shortYen = Math.max(0, MONTHLY_EXPENSE_YEN - life.allowance - life.scholarship);
  return Math.ceil(shortYen / WAGE_YEN_PER_HOUR);
}

export function freeHours(life: Life): number {
  return Math.max(0, MONTHLY_HOURS - partTimeHours(life) - life.lostHours);
}

export function tripYen(life: Life): number {
  return life.metro ? TRIP_YEN.metro : TRIP_YEN.regional;
}
