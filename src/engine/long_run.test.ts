import { makeLife } from "./life";
import { followPlans, longRunByAllowance, LONG_RUN_SEEDS } from "./long_run";
import { ALLOWANCE_DISTRIBUTION } from "./parameters";
import { autoLive, middlePolicy, mostPolicy, sceneAt } from "./plan";

describe("the long-run offer rate", () => {
  it("equals living each fixed seed by the same policy", () => {
    const rates = longRunByAllowance(middlePolicy);

    const direct = ALLOWANCE_DISTRIBUTION.map(([amount]) => {
      const lives = LONG_RUN_SEEDS.map((seed) => autoLive(seed, middlePolicy)).filter(
        (life) => life.log[0]?.kind === "profile" && life.log[0].allowance === amount,
      );
      return lives.filter((life) => life.offers.length).length / lives.length;
    });
    expect(rates).toEqual(direct);
  });
});

describe("following recorded plans", () => {
  it("uses the plan recorded for a period and the middle way where none is", () => {
    const life = makeLife(1);
    sceneAt(life, 0);
    const scene = sceneAt(life, 1)!;
    const recorded = mostPolicy(life, scene);

    expect(followPlans({ earlySummer: recorded })(life, scene)).toEqual(recorded);
    expect(followPlans({})(life, scene)).toEqual(middlePolicy(life, scene));
  });
});
