// The 100 selves living one year together: every choice is attempted by all of them.
// Lives still advance in place, so each transition returns a new Cohort and the previous
// one must not be used again.
import { alwaysChoose, autoLive, choose, pickNear, sceneAt, type Scene } from "./choice";
import type { Effort, ResultFact } from "./facts";
import { makeLife, type Life } from "./life";
import { ALLOWANCE_DISTRIBUTION } from "./parameters";
import { SCENE_COUNT } from "./scenes";

export const COHORT_SIZE = 100;
const SEED_STRIDE = 7919;

export interface Cohort {
  /** Seeds aligned with `lives`, so the same selves can be replayed with other choices. */
  readonly seeds: readonly number[];
  readonly lives: readonly Life[];
  /** Each self's starting allowance as an index into the allowance distribution. */
  readonly allowanceRanks: readonly number[];
  /** Index of the current scene; SCENE_COUNT once the year is over. */
  readonly step: number;
  /** The current scene for each self, or null for a self who skips it. */
  readonly scenes: readonly (Scene | null)[];
  /** What happened when the shared choice was made this month; null before choosing. */
  readonly turn: Turn | null;
}

export interface Turn {
  readonly want: Effort;
  readonly taken: readonly (Effort | null)[];
  readonly results: readonly (ResultFact | undefined)[];
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

/** Every self with options attempts `want`; those who cannot afford it take the nearest below. */
export function chooseForAll(cohort: Cohort, want: Effort): Cohort {
  const taken: (Effort | null)[] = cohort.lives.map(() => null);
  const results: (ResultFact | undefined)[] = cohort.lives.map(() => undefined);
  const blocked = new Set<number>();
  cohort.scenes.forEach((scene, i) => {
    const life = cohort.lives[i];
    if (!life || !scene?.options.length) return;
    const option = pickNear(scene.options, want);
    results[i] = choose(life, scene, option, want);
    taken[i] = option.effort;
    const wantedMore = scene.options.some(
      (o) => o.effort > option.effort && o.effort <= want && o.shortfall !== null,
    );
    if (wantedMore) blocked.add(i);
  });
  return { ...cohort, turn: { want, taken, results, blocked } };
}

export interface YearEnd {
  readonly most: readonly Life[];
  readonly least: readonly Life[];
}

/** The same selves, with the same luck, always choosing the most or the least effort. */
export function replayYear(cohort: Cohort): YearEnd {
  return {
    most: cohort.seeds.map((seed) => autoLive(seed, alwaysChoose(2))),
    least: cohort.seeds.map((seed) => autoLive(seed, alwaysChoose(0))),
  };
}

function load(base: Pick<Cohort, "seeds" | "lives" | "allowanceRanks">, from: number): Cohort {
  for (let step = from; step < SCENE_COUNT; step++) {
    const scenes = base.lives.map((life) => sceneAt(life, step));
    if (scenes.some((scene) => scene !== null)) return { ...base, step, scenes, turn: null };
  }
  return { ...base, step: SCENE_COUNT, scenes: base.lives.map(() => null), turn: null };
}

/** The effort a self usually chose: the rounded average of its choices so far, else the middle. */
export function usualEffort(life: Life): Effort {
  const efforts = Object.values(life.efforts);
  if (!efforts.length) return 1;
  const average = Math.round(
    efforts.reduce<number>((sum, effort) => sum + effort, 0) / efforts.length,
  );
  return Math.max(-1, Math.min(2, average)) as Effort;
}

/**
 * Moves to the next month the self at `player` takes part in. Whenever others still have a
 * choice the self did not make, they choose the self's usual effort.
 */
export function advanceFor(cohort: Cohort, player: number): Cohort {
  let next = cohort;
  do {
    next = advance(settleOthers(next, player));
  } while (!isOver(next) && !next.scenes[player]);
  return next;
}

/** Everyone attempts `want`, then the year moves to the self's next month. */
export function chooseAndAdvance(
  cohort: Cohort,
  player: number,
  want: Effort,
): { cohort: Cohort; result: ResultFact | undefined } {
  const chosen = chooseForAll(cohort, want);
  return { cohort: advanceFor(chosen, player), result: chosen.turn?.results[player] };
}

function settleOthers(cohort: Cohort, player: number): Cohort {
  const self = cohort.lives[player];
  const undecided = !cohort.turn && cohort.scenes.some((scene) => scene?.options.length);
  return self && undecided ? chooseForAll(cohort, usualEffort(self)) : cohort;
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
