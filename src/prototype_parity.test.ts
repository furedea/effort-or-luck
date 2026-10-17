import {
  describeLog,
  describeResult,
  describeScene,
  optionLabel,
  shortfallReason,
} from "./copy/scenes";
import { choose, outcome, pickNear, sceneAt } from "./engine/choice";
import type { Effort } from "./engine/facts";
import { makeLife } from "./engine/life";
import { SCENE_COUNT } from "./engine/scenes";
import prototypeLives from "./fixtures/prototype_lives.json";

// Lives recorded scene by scene from the prototype engine (career_engine.js), with seeds
// picked so every scene branch, shortfall reason, and missed-choice message appears.
const WANT: Record<string, Effort> = { most: 2, middle: 1, least: 0 };
const OFFER_MONTH = { december: "12月", may: "5月" } as const;

function replay(seed: number, want: Effort) {
  const life = makeLife(seed);
  const scenes = [];
  for (let index = 0; index < SCENE_COUNT; index++) {
    const scene = sceneAt(life, index);
    if (!scene) continue;
    const text = describeScene(scene);
    const entry: Record<string, unknown> = {
      id: scene.facts.id,
      when: text.when,
      lines: text.lines,
      stats: text.stats,
      options: scene.options.map((option) => ({
        label: optionLabel(scene.facts, option.key),
        effort: option.effort,
        total: option.total,
        ok: option.shortfall === null,
        reason: shortfallReason(option.shortfall),
      })),
    };
    if (text.next) entry["next"] = text.next;
    if (scene.options.length) {
      const option = pickNear(scene.options, want);
      entry["chosen"] = optionLabel(scene.facts, option.key);
      const result = choose(life, scene, option, want);
      entry["results"] = result ? [describeResult(result)] : [];
    }
    scenes.push(entry);
  }
  return {
    scenes,
    log: life.log.map(describeLog),
    offers: life.offers.map((month) => OFFER_MONTH[month]),
    money: life.money,
    outcome: outcome(life),
  };
}

describe("the port reproduces prototype lives for the same seed and choices", () => {
  it.each(prototypeLives.map((life) => [`seed ${life.seed}, ${life.policy}`, life] as const))(
    "%s",
    (_, expected) => {
      const { seed, policy, ...recorded } = expected;
      expect(replay(seed, WANT[policy] ?? 1)).toEqual(recorded);
    },
  );
});
