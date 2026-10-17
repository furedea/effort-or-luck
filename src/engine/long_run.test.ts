import { longRunByAllowance, LONG_RUN_SEEDS } from "./long_run";
import { ALLOWANCE_DISTRIBUTION } from "./parameters";
import { autoLive, middlePolicy } from "./year";

test("the long-run offer rate equals living each fixed seed by the same policy", () => {
  const rates = longRunByAllowance(middlePolicy);

  const direct = ALLOWANCE_DISTRIBUTION.map(([amount]) => {
    const lives = LONG_RUN_SEEDS.map((seed) => autoLive(seed, middlePolicy)).filter(
      (life) => life.log[0]?.kind === "profile" && life.log[0].allowance === amount,
    );
    return lives.filter((life) => life.offers.length).length / lives.length;
  });
  expect(rates).toEqual(direct);
});
