import { alwaysChoose, autoLive } from "./choice";
import { advanceFor, chooseAndAdvance, isOver, startCohort } from "./cohort";
import type { SceneId } from "./facts";
import { longRunByAllowance, LONG_RUN_SEEDS } from "./long_run";
import { ALLOWANCE_DISTRIBUTION } from "./parameters";

const EVERY_SCENE: readonly SceneId[] = [
  "summerEs",
  "summerIntern",
  "autumn",
  "jan",
  "feb",
  "march",
  "finals",
];

describe("the long-run offer rate", () => {
  it("equals always choosing an effort when every month wants that effort", () => {
    const rates = longRunByAllowance(() => 1);

    const direct = ALLOWANCE_DISTRIBUTION.map(([amount]) => {
      const lives = LONG_RUN_SEEDS.map((seed) => autoLive(seed, alwaysChoose(1))).filter(
        (life) => life.log[0]?.kind === "profile" && life.log[0].allowance === amount,
      );
      return lives.filter((life) => life.offers.length).length / lives.length;
    });
    expect(rates).toEqual(direct);
  });
});

describe("a cohort's shared choices", () => {
  it("remember the effort wanted in each month, including months the player sat out", () => {
    let cohort = startCohort(11);
    const player = 0;
    while (!isOver(cohort)) {
      const scene = cohort.scenes[player]!;
      cohort = scene.options.length
        ? chooseAndAdvance(cohort, player, scene.options.find((o) => o.shortfall === null)!.effort)
            .cohort
        : advanceFor(cohort, player);
    }

    expect(Object.keys(cohort.wants).sort()).toEqual([...EVERY_SCENE].sort());
  });
});
