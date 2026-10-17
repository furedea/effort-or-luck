import { choose, outcome, pickNear, sceneAt } from "./engine/choice";
import type { Effort, LogFact } from "./engine/facts";
import { makeLife } from "./engine/life";
import { SCENE_COUNT } from "./engine/scenes";
import prototypeLives from "./fixtures/prototype_lives.json";

// Lives recorded scene by scene from the prototype engine (career_engine.js), with seeds
// picked so every scene branch, shortfall reason, and missed choice appears. Only results
// are compared; the wording has been rewritten since.
const WANT: Record<string, Effort> = { most: 2, middle: 1, least: 0 };
const OFFER_MONTH = { december: "12月", may: "5月" } as const;

type LogSummary = { kind: LogFact["kind"]; option?: string; offers?: number };

// Prototype log lines, most specific first.
const PROTOTYPE_LOG: readonly (readonly [RegExp, LogSummary])[] = [
  [/最終面接(を全部|に)対面で受けられなかった/, { kind: "missed", option: "allFace" }],
  [/最終面接に一社も対面で行けなかった/, { kind: "missed", option: "oneFace" }],
  [/最終面接を受ける時間がなかった/, { kind: "missed", option: "allOnline" }],
  [/20 社に出す時間がなかった/, { kind: "missed", option: "entryTwenty" }],
  [/8 社に出す時間がなかった/, { kind: "missed", option: "entryEight" }],
  [/対面インターンに行けなかった/, { kind: "missed", option: "attend" }],
  [/面接の練習をする時間がなかった/, { kind: "missed", option: "practice" }],
  [/ES を 5 社書く時間がなかった/, { kind: "missed", option: "esFive" }],
  [/ES を書く時間がなかった/, { kind: "missed", option: "esTwo" }],
  [/^仕送り /, { kind: "profile" }],
  [/^奨学金 /, { kind: "scholarship" }],
  [/対面インターンに行った/, { kind: "faceIntern" }],
  [/どこも通らなかった/, { kind: "internAllFailed" }],
  [/熱を出した/, { kind: "sick" }],
  [/早期選考で内定/, { kind: "earlyOffer" }],
  [/仕送りが減った/, { kind: "allowanceCut" }],
  [/バイト先が閉店した/, { kind: "shopClosed" }],
];

function summarizePrototypeLog(line: string): LogSummary {
  const june = line.match(/^6月1日，内定(?: (\d+) 社|なし)$/);
  if (june) return { kind: "june", offers: Number(june[1] ?? 0) };
  const match = PROTOTYPE_LOG.find(([pattern]) => pattern.test(line));
  if (!match) throw new Error(`unknown prototype log line: ${line}`);
  return match[1];
}

function summarizeLog(fact: LogFact): LogSummary {
  if (fact.kind === "missed") return { kind: fact.kind, option: fact.option };
  if (fact.kind === "june") return { kind: fact.kind, offers: fact.offers };
  return { kind: fact.kind };
}

function replay(seed: number, want: Effort) {
  const life = makeLife(seed);
  const scenes = [];
  for (let index = 0; index < SCENE_COUNT; index++) {
    const scene = sceneAt(life, index);
    if (!scene) continue;
    const options = scene.options.map((o) => ({
      effort: o.effort,
      total: o.total,
      ok: o.shortfall === null,
    }));
    if (!scene.options.length) {
      scenes.push({ id: scene.facts.id, options });
      continue;
    }
    const option = pickNear(scene.options, want);
    const result = choose(life, scene, option, want);
    scenes.push({ id: scene.facts.id, options, chosen: option.effort, results: result ? 1 : 0 });
  }
  return {
    scenes,
    log: life.log.map(summarizeLog),
    offers: life.offers.map((month) => OFFER_MONTH[month]),
    money: life.money,
    outcome: outcome(life),
  };
}

function expectedFrom(recorded: (typeof prototypeLives)[number]) {
  return {
    scenes: recorded.scenes.map((scene) => {
      const options = scene.options.map((o) => ({ effort: o.effort, total: o.total, ok: o.ok }));
      if (!("chosen" in scene)) return { id: scene.id, options };
      const chosen = scene.options.find((o) => o.label === scene.chosen)?.effort;
      return { id: scene.id, options, chosen, results: scene.results?.length ?? 0 };
    }),
    log: recorded.log.map(summarizePrototypeLog),
    offers: recorded.offers,
    money: recorded.money,
    outcome: recorded.outcome,
  };
}

describe("the engine reproduces prototype lives for the same seed and choices", () => {
  it.each(prototypeLives.map((life) => [`seed ${life.seed}, ${life.policy}`, life] as const))(
    "%s",
    (_, recorded) => {
      expect(replay(recorded.seed, WANT[recorded.policy] ?? 1)).toEqual(expectedFrom(recorded));
    },
  );
});
