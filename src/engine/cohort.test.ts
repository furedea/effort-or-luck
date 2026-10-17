import { alwaysChoose, autoLive, pickNear } from "./choice";
import {
  advance,
  canChoose,
  chooseForAll,
  COHORT_SIZE,
  isOver,
  replayYear,
  startCohort,
  turnSummary,
  type Cohort,
} from "./cohort";
import type { Effort } from "./facts";
import type { Life } from "./life";
import { SCENE_COUNT } from "./scenes";

function withoutRng({ rng: _, ...rest }: Life) {
  return rest;
}

function playYear(want: Effort): Cohort {
  let cohort = startCohort(2026);
  while (!isOver(cohort)) {
    if (cohort.scenes.some((scene) => scene?.options.length)) cohort = chooseForAll(cohort, want);
    cohort = advance(cohort);
  }
  return cohort;
}

describe("starting the 100 selves", () => {
  it("creates 100 lives sorted by allowance, then regional before metro", () => {
    const { lives, seeds } = startCohort(7);

    expect(lives).toHaveLength(COHORT_SIZE);
    expect(lives.map((life) => life.seed)).toEqual(seeds);
    const order = lives.map((life) => [life.allowance, Number(life.metro)] as const);
    expect(order).toEqual(order.toSorted(([a, x], [b, y]) => a - b || x - y));
  });

  it("opens on the first scene for everyone", () => {
    const cohort = startCohort(7);

    expect(cohort.step).toBe(0);
    expect(cohort.scenes.every((scene) => scene?.facts.id === "intro")).toBe(true);
  });
});

describe("a shared choice", () => {
  it.each([0, 1, 2] as const)(
    "gives each self the year autoLive gives when always wanting %i",
    (want) => {
      const cohort = playYear(want);

      expect(cohort.step).toBe(SCENE_COUNT);
      for (const life of cohort.lives) {
        expect(withoutRng(life)).toEqual(withoutRng(autoLive(life.seed, alwaysChoose(want))));
      }
    },
  );

  it("marks as blocked exactly the selves who wanted an option they could not afford", () => {
    let cohort = startCohort(46);
    while (!cohort.scenes.some((scene) => scene?.facts.id === "march"))
      cohort = advance(chooseForAll(cohort, 2));

    const before = cohort;
    const after = chooseForAll(before, 2);

    before.scenes.forEach((scene, i) => {
      if (!scene?.options.length) return;
      const taken = pickNear(scene.options, 2).effort;
      const wantedMore = scene.options.some((o) => o.effort > taken && o.shortfall !== null);
      expect(after.turn?.blocked.has(i)).toBe(wantedMore);
    });
  });

  it("reports that everyone able to take the option did", () => {
    let cohort = startCohort(46);
    cohort = advance(cohort);
    const able = canChoose(cohort, 2);

    const summary = turnSummary(chooseForAll(cohort, 2));

    expect(summary.did).toBe(able.count);
    expect(summary.did + summary.blocked + summary.absent).toBe(able.active);
  });
});

describe("the end of the year", () => {
  it("replays the same seeds with the most and the least effort", () => {
    const cohort = playYear(1);

    const { most, least } = replayYear(cohort);

    expect(most.map(withoutRng)).toEqual(
      cohort.seeds.map((seed) => withoutRng(autoLive(seed, alwaysChoose(2)))),
    );
    expect(least.map(withoutRng)).toEqual(
      cohort.seeds.map((seed) => withoutRng(autoLive(seed, alwaysChoose(0)))),
    );
  });
});
