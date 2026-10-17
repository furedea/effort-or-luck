import { JUNE_OFFER_RATE } from "./data/statistics";
import { alwaysChoose, autoLive } from "./engine/choice";

const LIVES = 20_000;
const TOLERANCE = 0.02;

test("always choosing the middle option matches the surveyed June 1st offer rate within 2 points", () => {
  let offered = 0;
  for (let i = 0; i < LIVES; i++) {
    const life = autoLive((1 + i * 7919) >>> 0, alwaysChoose(1));
    if (life.offers.length) offered++;
  }

  const rate = offered / LIVES;

  expect(rate).toBeGreaterThanOrEqual(JUNE_OFFER_RATE - TOLERANCE);
  expect(rate).toBeLessThanOrEqual(JUNE_OFFER_RATE + TOLERANCE);
});
