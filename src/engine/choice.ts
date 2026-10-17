import type { Effort, ResultFact, SceneFacts, Shortfall } from "./facts";
import { freeHours, makeLife, type Life } from "./life";
import { WAGE_YEN_PER_HOUR } from "./parameters";
import { buildScene, SCENE_COUNT, type OptionSpec } from "./scenes";

export interface PricedOption extends OptionSpec {
  /** Hours beyond the free time, bought back from part-time work at the hourly wage. */
  readonly shortHours: number;
  readonly total: number;
  /** null when the life can afford the option. */
  readonly shortfall: Shortfall | null;
}

export interface Scene {
  readonly facts: SceneFacts;
  readonly options: readonly PricedOption[];
}

type Policy = (scene: Scene) => { readonly option: PricedOption; readonly want: Effort };

/** The scene at `index` with options priced for this life, or null when the life skips it. */
export function sceneAt(life: Life, index: number): Scene | null {
  const draft = buildScene(life, index);
  if (!draft) return null;
  return { facts: draft.facts, options: draft.options.map((option) => price(life, option)) };
}

export function price(life: Life, option: OptionSpec): PricedOption {
  const shortHours = Math.max(0, option.hours - freeHours(life));
  const total = option.money + shortHours * WAGE_YEN_PER_HOUR;
  const shortfall = total <= life.money ? null : shortHours > 0 ? "time" : "money";
  return { ...option, shortHours, total, shortfall };
}

/**
 * Pays for and applies `option`. When the life wanted more than it took, records the
 * unaffordable option nearest above the one taken.
 */
export function choose(
  life: Life,
  scene: Scene,
  option: PricedOption,
  want: Effort,
): ResultFact | undefined {
  life.money -= option.total;
  const missed = scene.options
    .filter(
      (o) => o.effort > option.effort && o.effort <= want && o.shortfall !== null && o.blockable,
    )
    .sort((a, b) => a.effort - b.effort)[0];
  if (missed) life.log.push({ kind: "missed", scene: scene.facts, option: missed.key });
  life.efforts[scene.facts.id] = option.effort;
  return option.apply?.(life);
}

/** The affordable option closest to `want` from below, else the cheapest-effort affordable one. */
export function pickNear(options: readonly PricedOption[], want: Effort): PricedOption {
  const affordable = options.filter((o) => o.shortfall === null);
  const below = affordable.filter((o) => o.effort <= want).sort((a, b) => b.effort - a.effort)[0];
  const fallback = affordable.toSorted((a, b) => a.effort - b.effort)[0];
  const picked = below ?? fallback;
  if (!picked) throw new Error("every scene with options offers one that costs nothing");
  return picked;
}

export function alwaysChoose(want: Effort): Policy {
  return (scene) => ({ option: pickNear(scene.options, want), want });
}

/** Lives a whole year from `seed`, letting `policy` make every choice. */
export function autoLive(seed: number, policy: Policy): Life {
  const life = makeLife(seed);
  for (let index = 0; index < SCENE_COUNT; index++) {
    const scene = sceneAt(life, index);
    if (!scene || !scene.options.length) continue;
    const { option, want } = policy(scene);
    choose(life, scene, option, want);
  }
  return life;
}
