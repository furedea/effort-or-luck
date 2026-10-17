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
  type Cohort,
} from "./cohort";
import type { Life } from "./life";
import { followPlans } from "./long_run";
import { autoLive, leastPolicy, mostPolicy, type Policy } from "./plan";
import { SCENE_COUNT } from "./scenes";

function withoutRng({ rng: _, ...rest }: Life) {
  return rest;
}

/** Plays a year as the self at `player`, choosing each period's plan with `policy`. */
function playYear(seed: number, player: number, policy: Policy): Cohort {
  let cohort = startCohort(seed);
  while (!isOver(cohort)) {
    const scene = cohort.scenes[player];
    const life = cohort.lives[player];
    cohort =
      scene?.period && life
        ? chooseAndAdvance(cohort, player, policy(life, scene)).cohort
        : advanceFor(cohort, player);
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

describe("a shared plan", () => {
  it.each([
    ["most", mostPolicy],
    ["least", leastPolicy],
  ] as const)("gives each self the year its plans give it alone (%s)", (_, policy) => {
    const cohort = playYear(2026, 0, policy);

    expect(cohort.step).toBe(SCENE_COUNT);
    for (const life of cohort.lives) {
      expect(withoutRng(life)).toEqual(withoutRng(autoLive(life.seed, followPlans(cohort.plans))));
    }
  });

  it("marks as blocked exactly the selves who could not pay for part of it", () => {
    let cohort = startCohort(46);
    while (!cohort.scenes.some((scene) => scene?.period)) cohort = advance(cohort);
    const plan = mostPolicy(cohort.lives[0]!, cohort.scenes[0]!);

    const after = chooseForAll(cohort, plan);

    after.turn?.allocations.forEach((allocation, i) => {
      expect(after.turn?.blocked.has(i)).toBe((allocation?.dropped.length ?? 0) > 0);
    });
  });

  it("remembers everyone blocked in any period of the year", () => {
    let cohort = startCohort(46);
    const seen = new Set<number>();
    while (!isOver(cohort)) {
      const index = cohort.scenes.findIndex((scene) => scene?.period);
      if (index >= 0) {
        cohort = chooseForAll(cohort, mostPolicy(cohort.lives[index]!, cohort.scenes[index]!));
        for (const i of cohort.turn?.blocked ?? []) seen.add(i);
      }
      cohort = advance(cohort);
    }

    expect([...cohort.everBlocked].sort((a, b) => a - b)).toEqual([...seen].sort((a, b) => a - b));
  });

  it("reports the player's own allocation", () => {
    let cohort = startCohort(3);
    while (!cohort.scenes[0]?.period) cohort = advance(cohort);
    const plan = mostPolicy(cohort.lives[0]!, cohort.scenes[0]);

    const { allocation } = chooseAndAdvance(cohort, 0, plan);

    expect(allocation?.taken.length).toBeGreaterThan(0);
  });
});

describe("playing as one self", () => {
  it("lets the others live on to June after the self's year has ended early", () => {
    const seed = Array.from({ length: 200 }, (_, k) => k + 1).find(
      (k) => playYear(k, 0, mostPolicy).lives[0]?.over,
    );
    const cohort = playYear(seed ?? 1, 0, mostPolicy);

    expect(cohort.lives[0]?.over).not.toBeNull();
    expect(cohort.lives.some((life) => life.log.some((fact) => fact.kind === "june"))).toBe(true);
  });
});

describe("the end of the year", () => {
  it("replays the same seeds putting the most and the least into job hunting", () => {
    const cohort = playYear(9, 0, mostPolicy);

    const { most, least } = replayYear(cohort);

    expect(most.map(withoutRng)).toEqual(
      cohort.seeds.map((seed) => withoutRng(autoLive(seed, mostPolicy))),
    );
    expect(least.map(withoutRng)).toEqual(
      cohort.seeds.map((seed) => withoutRng(autoLive(seed, leastPolicy))),
    );
  });

  it("counts, for each allowance, how many selves had an offer", () => {
    const cohort = playYear(11, 0, mostPolicy);

    const rows = revealByAllowance(cohort.lives, cohort.allowanceRanks);

    expect(rows.map((row) => row.amount)).toEqual([0, 30_000, 70_000, 120_000]);
    expect(rows.reduce((sum, row) => sum + row.members.length, 0)).toBe(COHORT_SIZE);
    for (const row of rows) {
      expect(row.offered).toBe(
        row.members.filter((i) => cohort.lives[i]!.offers.length > 0).length,
      );
    }
  });
});
