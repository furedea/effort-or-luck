import { alwaysChoose, autoLive, pickNear } from "./choice";
import {
  advance,
  advanceFor,
  chooseAndAdvance,
  chooseForAll,
  COHORT_SIZE,
  isOver,
  replayYear,
  revealByAllowance,
  startCohort,
  usualEffort,
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

describe("playing as one self", () => {
  function cohortWithEarlyOffer(): { cohort: Cohort; player: number } {
    for (let base = 1; ; base++) {
      let cohort = startCohort(base);
      while (!cohort.scenes.some((scene) => scene?.facts.id === "feb"))
        cohort = advance(chooseForAll(cohort, 2));
      const player = cohort.lives.findIndex((life) => life.offers.includes("december"));
      if (player >= 0) return { cohort, player };
    }
  }

  it("skips months the self no longer takes part in, still living them for the others", () => {
    const { cohort, player } = cohortWithEarlyOffer();
    const stopped = chooseForAll(cohort, 0);

    const next = advanceFor(stopped, player);

    expect(next.scenes[player]?.facts.id).toBe("june");
    const others = next.lives.filter((life, i) => i !== player && !life.done);
    const usual = usualEffort(next.lives[player]!);
    expect(
      others.every((life) => life.efforts.march !== undefined && life.efforts.march <= usual),
    ).toBe(true);
  });

  it("lets the others choose when only they have options this month", () => {
    const { cohort } = cohortWithEarlyOffer();
    const player = cohort.lives.findIndex((life) => !life.offers.length);

    const next = advanceFor(cohort, player);

    const holders = next.lives.filter((life) => life.offers.includes("december"));
    expect(holders.length).toBeGreaterThan(0);
    expect(holders.every((life) => life.efforts.feb !== undefined)).toBe(true);
  });

  it("moves straight to the self's next month after a choice, carrying its result", () => {
    let cohort = startCohort(3);
    const player = 0;
    while (cohort.scenes[player]?.facts.id !== "autumn")
      cohort = advanceFor(chooseForAll(cohort, 1), player);

    const { cohort: next, result } = chooseAndAdvance(cohort, player, 0);

    expect(result).toEqual({ kind: "saved", amount: expect.any(Number) });
    expect(next.scenes[player]?.facts.id).toBe("early");
    expect(next.lives[player]?.efforts.autumn).toBe(0);
  });

  it("takes the rounded average of the self's choices as its usual effort", () => {
    const life = startCohort(1).lives[0]!;
    Object.assign(life.efforts, { summerEs: 2, summerIntern: 1, autumn: 2 });

    expect(usualEffort(life)).toBe(2);
  });
});

describe("the reveal", () => {
  it("counts, for each allowance, how many selves had an offer", () => {
    const cohort = playYear(1);

    const rows = revealByAllowance(cohort.lives, cohort.allowanceRanks);

    expect(rows.map((row) => row.amount)).toEqual([0, 30_000, 70_000, 120_000]);
    expect(rows.reduce((sum, row) => sum + row.members.length, 0)).toBe(COHORT_SIZE);
    for (const row of rows) {
      const offered = row.members.filter((i) => cohort.lives[i]!.offers.length > 0).length;
      expect(row.offered).toBe(offered);
      expect(row.members.every((i) => cohort.lives[i]!.allowance <= row.amount)).toBe(true);
    }
  });
});

describe("selves held back by money or time", () => {
  it("remembers everyone blocked in any month of the year", () => {
    let cohort = startCohort(46);
    const seen = new Set<number>();
    while (!isOver(cohort)) {
      if (cohort.scenes.some((scene) => scene?.options.length)) {
        cohort = chooseForAll(cohort, 2);
        for (const i of cohort.turn?.blocked ?? []) seen.add(i);
      }
      cohort = advance(cohort);
    }

    expect(seen.size).toBeGreaterThan(0);
    expect([...cohort.everBlocked].sort((a, b) => a - b)).toEqual([...seen].sort((a, b) => a - b));
  });
});
