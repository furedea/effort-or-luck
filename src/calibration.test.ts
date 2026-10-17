import { JUNE_OFFER_RATE, JUNE_OFFER_RATE_BY_REGION } from "./data/statistics";
import { autoLive, middlePolicy, mostPolicy, type Policy } from "./engine/plan";

const LIVES = 20_000;
const TOLERANCE = 0.02;
const MIDDLE_ENDED_EARLY_LIMIT = 0.05;

function year(policy: Policy) {
  const tally = { all: [0, 0], metro: [0, 0], regional: [0, 0] };
  let ended = 0;
  for (let i = 0; i < LIVES; i++) {
    const life = autoLive((1 + i * 7919) >>> 0, policy);
    if (life.over) ended++;
    const offered = life.offers.length > 0 ? 1 : 0;
    for (const key of ["all", life.metro ? "metro" : "regional"] as const) {
      tally[key][0]! += 1;
      tally[key][1]! += offered;
    }
  }
  const rate = ([lives, offered]: number[]) => offered! / lives!;
  return {
    all: rate(tally.all),
    metro: rate(tally.metro),
    regional: rate(tally.regional),
    endedEarly: ended / LIVES,
  };
}

const middle = year(middlePolicy);

test("the middle way matches the surveyed June 1st offer rate within 2 points", () => {
  expect(middle.all).toBeGreaterThanOrEqual(JUNE_OFFER_RATE - TOLERANCE);
  expect(middle.all).toBeLessThanOrEqual(JUNE_OFFER_RATE + TOLERANCE);
});

test("metro selves lead regional ones by the surveyed regional gap within 2 points", () => {
  const surveyed = JUNE_OFFER_RATE_BY_REGION.kanto - JUNE_OFFER_RATE_BY_REGION.otherRegions;

  const gap = middle.metro - middle.regional;

  expect(gap).toBeGreaterThanOrEqual(surveyed - TOLERANCE);
  expect(gap).toBeLessThanOrEqual(surveyed + TOLERANCE);
});

test("few selves who take the middle way end the year early", () => {
  expect(middle.endedEarly).toBeLessThanOrEqual(MIDDLE_ENDED_EARLY_LIMIT);
});

test("putting everything into job hunting ends the year early for more selves", () => {
  expect(year(mostPolicy).endedEarly).toBeGreaterThan(middle.endedEarly);
});
