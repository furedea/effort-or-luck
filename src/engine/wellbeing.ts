import type { Stat } from "./facts";
import type { Life } from "./life";
import {
  BROKE_BELOW_YEN,
  DIFFICULTY,
  FINAL_YEAR_RESEARCH_DRIFT,
  HEALTH_PER_OVERLOAD_HOUR,
  HEALTHY_WORKLOAD_WEEKLY_HOURS,
  MIND_PER_JOB_HOUR,
  MIND_WHEN_BROKE_WEEKLY,
  SLEEP_LOSS,
  SPARE_TIME,
  STAT_SHOCK,
  WEEKLY_DRIFT,
} from "./parameters";

// How health, peace of mind, relationships, research, and study move, and when the year ends.

const STATS: readonly Stat[] = ["health", "mind", "social", "research", "study"];
const MAX_STAT = 100;

interface PeriodLoad {
  readonly weeks: number;
  readonly finalYear: boolean;
  readonly taken: readonly { readonly statsPerWeek?: Readonly<Partial<Record<Stat, number>>> }[];
  readonly jobHours: number;
  readonly extraWorkHours: number;
  /** Hours beyond the free hours, taken from sleep. */
  readonly shortHours: number;
  /** Hours left free in the week, which rest health and mind a little. */
  readonly spareHours: number;
}

/** Moves every stat for a period of living, then ends the year if one reached zero. */
export function liveThroughPeriod(life: Life, load: PeriodLoad): void {
  if (life.over) return;
  const { weeks, finalYear, taken, jobHours, extraWorkHours, shortHours, spareHours } = load;
  const change: Record<Stat, number> = { ...WEEKLY_DRIFT };
  if (finalYear) change.research = FINAL_YEAR_RESEARCH_DRIFT;
  const { driftFactor } = DIFFICULTY[life.difficulty];
  for (const stat of STATS) change[stat] *= weeks * driftFactor;
  for (const activity of taken) {
    for (const stat of STATS) change[stat] += (activity.statsPerWeek?.[stat] ?? 0) * weeks;
  }
  const weeklyLoad = (jobHours + extraWorkHours) / weeks;
  change.health -=
    Math.max(0, weeklyLoad - HEALTHY_WORKLOAD_WEEKLY_HOURS) * HEALTH_PER_OVERLOAD_HOUR * weeks;
  const sleep = sleepCost(shortHours / weeks);
  change.health -= sleep.health * weeks;
  change.mind -= sleep.mind * weeks;
  const spare = Math.min(spareHours / weeks, SPARE_TIME.maxHours) * SPARE_TIME.perHour * weeks;
  change.health += spare;
  change.mind += spare;
  change.mind -= jobHours * MIND_PER_JOB_HOUR;
  if (life.money < BROKE_BELOW_YEN) change.mind -= MIND_WHEN_BROKE_WEEKLY * weeks;
  shift(life, change);
}

/** What a week's hours taken from sleep cost in health and mind. */
export function sleepCost(weeklyHours: number): { health: number; mind: number } {
  const { lightHours, healthPerLightHour, healthPerHeavyHour, mindPerHour } = SLEEP_LOSS;
  const light = Math.min(weeklyHours, lightHours);
  const heavy = Math.max(0, weeklyHours - lightHours);
  const round = (value: number) => Number(value.toFixed(2));
  return {
    health: round(light * healthPerLightHour + heavy * healthPerHeavyHour),
    mind: round(weeklyHours * mindPerHour),
  };
}

/** A sudden change to stats, such as falling ill or getting an offer. */
export function shock(life: Life, kind: keyof typeof STAT_SHOCK): void {
  if (life.over) return;
  shift(life, STAT_SHOCK[kind]);
}

/** Moves stats by the given amounts, as a small choice does. */
export function nudge(life: Life, change: Readonly<Partial<Record<Stat, number>>>): void {
  if (life.over) return;
  shift(life, change);
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
