// The 100 selves living one year together: every plan is attempted by all of them.
// Lives still advance in place, so each transition returns a new Cohort and the previous
// one must not be used again.
import type { PeriodId } from "./facts";
import { makeLife, type Life } from "./life";
import { ALLOWANCE_DISTRIBUTION } from "./parameters";
import {
  autoLive,
  carryOut,
  leastPolicy,
  middlePolicy,
  mostPolicy,
  sceneAt,
  type Allocation,
  type Plan,
  type Scene,
} from "./plan";
import { SCENE_COUNT } from "./scenes";

export const COHORT_SIZE = 100;
const SEED_STRIDE = 7919;

export interface Cohort {
  /** Seeds aligned with `lives`, so the same selves can be replayed with other plans. */
  readonly seeds: readonly number[];
  readonly lives: readonly Life[];
  /** Each self's starting allowance as an index into the allowance distribution. */
  readonly allowanceRanks: readonly number[];
  /** Index of the current scene; SCENE_COUNT once the year is over. */
  readonly step: number;
  /** The current scene for each self, or null for a self who skips it. */
  readonly scenes: readonly (Scene | null)[];
  /** What happened when the shared plan was carried out this period; null before that. */
  readonly turn: Turn | null;
  /** The plan everyone attempted in each period so far. */
  readonly plans: Readonly<Partial<Record<PeriodId, Plan>>>;
  /** Selves who, in some period, could not pay for part of the plan everyone attempted. */
  readonly everBlocked: ReadonlySet<number>;
}

interface Turn {
  readonly plan: Plan;
  readonly allocations: readonly (Allocation | null)[];
  readonly blocked: ReadonlySet<number>;
}

export function startCohort(baseSeed: number): Cohort {
  const lives = Array.from({ length: COHORT_SIZE }, (_, i) =>
    makeLife((baseSeed + i * SEED_STRIDE) >>> 0),
  );
  lives.sort((a, b) => a.allowance - b.allowance || Number(a.metro) - Number(b.metro));
  const amounts: readonly number[] = ALLOWANCE_DISTRIBUTION.map(([amount]) => amount);
  return load(
    {
      seeds: lives.map((life) => life.seed),
      lives,
      allowanceRanks: lives.map((life) => amounts.indexOf(life.allowance)),
      plans: {},
      everBlocked: new Set(),
    },
    0,
  );
}

export function isOver(cohort: Cohort): boolean {
  return cohort.step >= SCENE_COUNT;
}

export function advance(cohort: Cohort): Cohort {
  return load(cohort, cohort.step + 1);
}

/** Every self in a period attempts `plan`; whatever a self cannot pay for is dropped. */
export function chooseForAll(cohort: Cohort, plan: Plan): Cohort {
  const allocations = cohort.lives.map((life, i) => {
    const scene = cohort.scenes[i];
    return scene?.period ? carryOut(life, scene, plan) : null;
  });
  const blocked = new Set(
    allocations.flatMap((allocation, i) => (allocation?.dropped.length ? [i] : [])),
  );
  const period = cohort.scenes.find((scene) => scene?.period)?.period?.id;
  const plans = period ? { ...cohort.plans, [period]: plan } : cohort.plans;
  const everBlocked = new Set([...cohort.everBlocked, ...blocked]);
  return { ...cohort, plans, everBlocked, turn: { plan, allocations, blocked } };
}

/**
 * Moves to the next scene the self at `player` takes part in. Periods the self sits out are
 * still lived by the others, who divide their time the middle way.
 */
export function advanceFor(cohort: Cohort, player: number): Cohort {
  let next = cohort;
  do {
    next = advance(settleOthers(next));
  } while (!isOver(next) && !next.scenes[player]);
  return next;
}

/** Everyone attempts `plan`, then the year moves to the self's next scene. */
export function chooseAndAdvance(
  cohort: Cohort,
  player: number,
  plan: Plan,
): { cohort: Cohort; allocation: Allocation | null } {
  const chosen = chooseForAll(cohort, plan);
  return {
    cohort: advanceFor(chosen, player),
    allocation: chosen.turn?.allocations[player] ?? null,
  };
}

export interface YearEnd {
  readonly most: readonly Life[];
  readonly least: readonly Life[];
}

/** The same selves, with the same luck, always putting the most or the least into job hunting. */
export function replayYear(cohort: Cohort): YearEnd {
  return {
    most: cohort.seeds.map((seed) => autoLive(seed, mostPolicy)),
    least: cohort.seeds.map((seed) => autoLive(seed, leastPolicy)),
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

function settleOthers(cohort: Cohort): Cohort {
  if (cohort.turn) return cohort;
  cohort.scenes.forEach((scene, i) => {
    const life = cohort.lives[i];
    if (life && scene?.period) carryOut(life, scene, middlePolicy(life, scene));
  });
  return cohort;
}

function load(
  base: Pick<Cohort, "seeds" | "lives" | "allowanceRanks" | "plans" | "everBlocked">,
  from: number,
): Cohort {
  for (let step = from; step < SCENE_COUNT; step++) {
    const scenes = base.lives.map((life) => sceneAt(life, step));
    if (scenes.some((scene) => scene !== null)) return { ...base, step, scenes, turn: null };
  }
  return { ...base, step: SCENE_COUNT, scenes: base.lives.map(() => null), turn: null };
}
