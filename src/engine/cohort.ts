// The 100 selves living one year together: every choice is attempted by all of them.
// Lives still advance in place, so each transition returns a new Cohort and the previous
// one must not be used again.
import { alwaysChoose, autoLive, choose, pickNear, sceneAt, type Scene } from "./choice";
import type { Effort, ResultFact, SceneFacts } from "./facts";
import { freeHours, makeLife, type Life } from "./life";
import { ALLOWANCE_DISTRIBUTION } from "./parameters";
import { SCENE_COUNT } from "./scenes";

export const COHORT_SIZE = 100;
const SEED_STRIDE = 7919;
const BROKE_BELOW_YEN = 10_000;
const BUSY_BELOW_HOURS = 20;

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

export type SceneTag =
  | "passed"
  | "failed"
  | "none"
  | "calm"
  | "allowanceCut"
  | "shopClosed"
  | "sick"
  | "invite"
  | "notInvited"
  | "offer"
  | "final"
  | "noFinal";

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

/** The scene whose options are offered: the focused self's, else the first self's that has any. */
export function optionScene(cohort: Cohort, focus: number): Scene | null {
  const own = cohort.scenes[focus];
  if (own?.options.length) return own;
  return cohort.scenes.find((scene) => scene?.options.length) ?? null;
}

export function currentFacts(cohort: Cohort): SceneFacts | null {
  return cohort.scenes.find((scene) => scene !== null)?.facts ?? null;
}

/** How many selves with options would actually take `effort` if it were chosen. */
export function canChoose(cohort: Cohort, effort: Effort): { count: number; active: number } {
  const active = cohort.scenes.filter((scene) => scene?.options.length);
  const count = active.filter(
    (scene) => scene && pickNear(scene.options, effort).effort === effort,
  ).length;
  return { count, active: active.length };
}

export function turnSummary(cohort: Cohort): { did: number; blocked: number; absent: number } {
  const active = cohort.scenes.filter((scene) => scene?.options.length).length;
  const turn = cohort.turn;
  if (!turn) return { did: 0, blocked: 0, absent: active };
  const did = turn.taken.filter((effort) => effort === turn.want).length;
  return { did, blocked: turn.blocked.size, absent: active - did - turn.blocked.size };
}

export function ledger(lives: readonly Life[]): { offered: number; broke: number; busy: number } {
  return {
    offered: lives.filter((life) => life.offers.length > 0).length,
    broke: lives.filter((life) => life.money < BROKE_BELOW_YEN).length,
    busy: lives.filter((life) => freeHours(life) < BUSY_BELOW_HOURS).length,
  };
}

/** Categories of what happened this month, for summarizing the 100 selves. */
export function sceneTags(facts: SceneFacts): readonly SceneTag[] {
  switch (facts.id) {
    case "summerIntern":
      return [facts.result];
    case "autumn":
      return facts.invited ? [facts.event.kind, "invite"] : [facts.event.kind];
    case "early":
      return [facts.result];
    case "feb":
      return [facts.hasOffer ? "offer" : "none"];
    case "finals":
      return [facts.finals ? "final" : "noFinal"];
    default:
      return [];
  }
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
