import { JUNE_OFFER_RATE, JUNE_OFFER_RATE_BY_REGION } from "./data/statistics";
import { alwaysChoose, autoLive } from "./engine/choice";

const LIVES = 20_000;
const TOLERANCE = 0.02;

function middleYear() {
  const tally = { all: [0, 0], metro: [0, 0], regional: [0, 0] };
  for (let i = 0; i < LIVES; i++) {
    const life = autoLive((1 + i * 7919) >>> 0, alwaysChoose(1));
    const offered = life.offers.length > 0 ? 1 : 0;
    for (const key of ["all", life.metro ? "metro" : "regional"] as const) {
      tally[key][0]! += 1;
      tally[key][1]! += offered;
    }
  }
  const rate = ([lives, offered]: number[]) => offered! / lives!;
  return { all: rate(tally.all), metro: rate(tally.metro), regional: rate(tally.regional) };
}

const rates = middleYear();

test("always choosing the middle option matches the surveyed June 1st offer rate within 2 points", () => {
  expect(rates.all).toBeGreaterThanOrEqual(JUNE_OFFER_RATE - TOLERANCE);
  expect(rates.all).toBeLessThanOrEqual(JUNE_OFFER_RATE + TOLERANCE);
});

test("metro selves lead regional ones by the surveyed regional gap within 2 points", () => {
  const surveyed = JUNE_OFFER_RATE_BY_REGION.kanto - JUNE_OFFER_RATE_BY_REGION.otherRegions;

  const gap = rates.metro - rates.regional;

  expect(gap).toBeGreaterThanOrEqual(surveyed - TOLERANCE);
  expect(gap).toBeLessThanOrEqual(surveyed + TOLERANCE);
});
