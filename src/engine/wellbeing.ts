import type { Stat } from "./facts";
import type { Life } from "./life";
import {
  BROKE_BELOW_YEN,
  DIFFICULTY,
  FOURTH_YEAR_RESEARCH_DRIFT,
  MIND_PER_JOB_HOUR,
  MIND_WHEN_BROKE_WEEKLY,
  NO_REST_HEALTH,
  STAT_SHOCK,
  WEEKLY_DRIFT,
} from "./parameters";

// How health, peace of mind, relationships, and research move, and when the year ends.

const STATS: readonly Stat[] = ["health", "mind", "social", "research"];
const MAX_STAT = 100;

interface PeriodLoad {
  readonly weeks: number;
  readonly fourthYear: boolean;
  /** What the period's activities gave each stat in total. */
  readonly gains: Readonly<Partial<Record<Stat, number>>>;
  readonly jobHours: number;
  /** Whether every week of the period had a day of rest. */
  readonly rested: boolean;
}

/** Moves every stat for a period of living, then ends the year if one reached zero. */
export function liveThroughPeriod(life: Life, load: PeriodLoad): void {
  if (life.over) return;
  const { weeks, fourthYear, gains, jobHours, rested } = load;
  const change: Record<Stat, number> = { ...WEEKLY_DRIFT };
  if (fourthYear) change.research = FOURTH_YEAR_RESEARCH_DRIFT;
  const { driftFactor } = DIFFICULTY[life.difficulty];
  for (const stat of STATS) change[stat] *= weeks * driftFactor;
  for (const stat of STATS) change[stat] += gains[stat] ?? 0;
  if (!rested) change.health -= NO_REST_HEALTH * weeks;
  change.mind -= jobHours * MIND_PER_JOB_HOUR;
  if (life.money < BROKE_BELOW_YEN) change.mind -= MIND_WHEN_BROKE_WEEKLY * weeks;
  shift(life, change);
}

/** A sudden change to stats, such as falling ill or getting an offer. */
export function shock(life: Life, kind: keyof typeof STAT_SHOCK): void {
  if (life.over) return;
  shift(life, STAT_SHOCK[kind]);
}

/** Directly lowers research, as a thesis crunch does. */
export function setBack(life: Life, stat: Stat, amount: number): void {
  if (life.over) return;
  shift(life, { [stat]: -amount });
}

function shift(life: Life, change: Partial<Record<Stat, number>>): void {
  for (const stat of STATS) {
    life.stats[stat] = Math.min(MAX_STAT, Math.max(0, life.stats[stat] + (change[stat] ?? 0)));
  }
  const fallen = STATS.find((stat) => life.stats[stat] <= 0);
  if (fallen) {
    life.over = fallen;
    life.log.push({ kind: "over", stat: fallen });
  }
}
