import type { ActivitySpec } from "./activities";
import type { ActivityKey, SceneFacts } from "./facts";
import { makeLife, periodBudget, type Life } from "./life";
import { EXTRA_WORK_WEEKLY_HOURS, WAGE_YEN_PER_HOUR } from "./parameters";
import { buildScene, SCENE_COUNT, type PeriodDraft } from "./scenes";
import { liveThroughPeriod } from "./wellbeing";

// Dividing a period's time: chosen activities are fitted in the order they were picked; hours
// beyond the budget are bought back from part-time work and paid from savings; an activity the
// self cannot pay for is dropped; hours left over go to part-time work.

export interface Scene {
  readonly facts: SceneFacts;
  readonly period: (PeriodDraft & { readonly budget: number }) | null;
}

/** An ordered choice of activities for one period. */
export type Plan = readonly ActivityKey[];

export interface Allocation {
  readonly taken: readonly ActivitySpec[];
  /** Chosen activities the self could not pay for. */
  readonly dropped: readonly ActivityKey[];
  readonly hours: number;
  /** Hours beyond the budget, bought back by working less part-time. */
  readonly shortHours: number;
  /** Savings spent: activity costs plus the wages of part-time hours given up. */
  readonly paid: number;
  readonly extraWorkHours: number;
  /** Money earned: extra part-time work plus pay from activities. */
  readonly earned: number;
}

export type Policy = (life: Life, scene: Scene) => Plan;

/** The middle way skips extras that cost more than this. */
const MIDDLE_SPENDING_LIMIT_YEN = 30_000;

/** The scene at `index` for this life, or null when the life skips it. */
export function sceneAt(life: Life, index: number): Scene | null {
  const draft = buildScene(life, index);
  if (!draft) return null;
  if (!draft.period) return { facts: draft.facts, period: null };
  return {
    facts: draft.facts,
    period: { ...draft.period, budget: periodBudget(life, draft.period.weeks) },
  };
}

/** What `plan` would take and give this life over the scene's period, without changing it. */
export function allocate(life: Life, scene: Scene, plan: Plan): Allocation {
  const period = scene.period;
  const taken: ActivitySpec[] = [];
  const dropped: ActivityKey[] = [];
  if (!period)
    return summarize(taken, dropped, { hours: 0, shortHours: 0, paid: 0, leftover: 0, weeks: 0 });
  const byKey = new Map(period.activities.map((activity) => [activity.key, activity]));
  const groups = new Set<string>();
  let hours = 0;
  let shortHours = 0;
  let paid = 0;
  for (const key of new Set(plan)) {
    const activity = byKey.get(key);
    if (!activity || (activity.group && groups.has(activity.group))) continue;
    const over =
      Math.max(0, hours + activity.hours - period.budget) - Math.max(0, hours - period.budget);
    const cost = activity.money + over * WAGE_YEN_PER_HOUR;
    if (paid + cost > life.money) {
      dropped.push(key);
      continue;
    }
    taken.push(activity);
    if (activity.group) groups.add(activity.group);
    hours += activity.hours;
    shortHours += over;
    paid += cost;
  }
  const leftover = Math.max(0, period.budget - hours);
  return summarize(taken, dropped, { hours, shortHours, paid, leftover, weeks: period.weeks });
}

/** Lives the scene's period by `plan`: pays, earns, applies each activity, and moves the stats. */
export function carryOut(life: Life, scene: Scene, plan: Plan): Allocation {
  const allocation = allocate(life, scene, plan);
  const period = scene.period;
  if (!period) return allocation;
  life.money += allocation.earned - allocation.paid;
  for (const activity of allocation.taken) activity.apply?.(life);
  for (const activity of allocation.dropped)
    life.log.push({ kind: "dropped", period: period.id, activity });
  const jobHours = allocation.taken
    .filter((activity) => activity.kind === "job")
    .reduce((sum, activity) => sum + activity.hours, 0);
  liveThroughPeriod(life, {
    weeks: period.weeks,
    fourthYear: period.fourthYear,
    taken: allocation.taken,
    jobHours,
    extraWorkHours: allocation.extraWorkHours,
  });
  return allocation;
}

/** Every job-hunting activity, the most effortful alternative first, and nothing for oneself. */
export const mostPolicy: Policy = (_, scene) =>
  activitiesOf(scene)
    .filter(isJobHunting)
    .map((activity) => activity.key);

/** Nothing for job hunting; time goes to oneself. */
export const leastPolicy: Policy = (_, scene) =>
  activitiesOf(scene)
    .filter((activity) => activity.kind === "life")
    .map((activity) => activity.key);

/**
 * Job hunting until about half the period's time is used, leaving out paid extras such as
 * courses, then time for oneself. Alternatives in a group are kept, so a self who cannot pay
 * for the first falls back to the next.
 */
export const middlePolicy: Policy = (life, scene) => {
  const half = (scene.period?.budget ?? 0) / 2;
  const groups = new Set<string>();
  const chosen: ActivityKey[] = [];
  let hours = 0;
  for (const activity of activitiesOf(scene).filter(isJobHunting)) {
    if (!activity.group && activity.money > MIDDLE_SPENDING_LIMIT_YEN) continue;
    if (activity.group && groups.has(activity.group)) {
      chosen.push(activity.key);
      continue;
    }
    if (hours + activity.hours > half) continue;
    chosen.push(activity.key);
    if (activity.group) groups.add(activity.group);
    hours += activity.hours;
  }
  return [...chosen, ...leastPolicy(life, scene)];
};

/** Lives a whole year from `seed`, letting `policy` divide every period. */
export function autoLive(seed: number, policy: Policy): Life {
  const life = makeLife(seed);
  for (let index = 0; index < SCENE_COUNT; index++) {
    const scene = sceneAt(life, index);
    if (scene?.period) carryOut(life, scene, policy(life, scene));
  }
  return life;
}

function activitiesOf(scene: Scene): readonly ActivitySpec[] {
  return scene.period?.activities ?? [];
}

/** Job-hunting activities a policy may pick; stopping the hunt is the player's own decision. */
function isJobHunting(activity: ActivitySpec): boolean {
  return activity.kind === "job" && activity.key !== "stopHunting";
}

function summarize(
  taken: readonly ActivitySpec[],
  dropped: readonly ActivityKey[],
  totals: { hours: number; shortHours: number; paid: number; leftover: number; weeks: number },
): Allocation {
  const extraWorkHours = Math.min(totals.leftover, EXTRA_WORK_WEEKLY_HOURS * totals.weeks);
  const pays = taken.reduce((sum, activity) => sum + activity.pays, 0);
  return {
    taken,
    dropped,
    hours: totals.hours,
    shortHours: totals.shortHours,
    paid: totals.paid,
    extraWorkHours,
    earned: extraWorkHours * WAGE_YEN_PER_HOUR + pays,
  };
}
