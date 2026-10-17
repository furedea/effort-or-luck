import type { PeriodId } from "./facts";
import { ALLOWANCE_DISTRIBUTION } from "./parameters";
import { autoLive, middlePolicy, type Plan, type Policy } from "./plan";

// One game of 100 selves swings a lot by chance. Replaying the same plans over many other draws
// of luck shows what those plans usually lead to.

const LONG_RUN_LIVES = 4000;

/** Fixed seeds, so the long-run figures are the same on every screen and in shared links. */
export const LONG_RUN_SEEDS: readonly number[] = Array.from(
  { length: LONG_RUN_LIVES },
  (_, k) => (90_001 + k * 7919) >>> 0,
);

/** Follows `plans` period by period; a period without a plan is divided the middle way. */
export function followPlans(plans: Readonly<Partial<Record<PeriodId, Plan>>>): Policy {
  return (life, scene) => {
    const period = scene.period?.id;
    const plan = period ? plans[period] : undefined;
    return plan ?? middlePolicy(life, scene);
  };
}

/** Offer rate on June 1st per allowance (in distribution order) when living by `policy`. */
export function longRunByAllowance(policy: Policy): number[] {
  const tally = ALLOWANCE_DISTRIBUTION.map(() => ({ lives: 0, offered: 0 }));
  const amounts: readonly number[] = ALLOWANCE_DISTRIBUTION.map(([amount]) => amount);
  for (const seed of LONG_RUN_SEEDS) {
    const life = autoLive(seed, policy);
    const profile = life.log[0];
    const row = profile?.kind === "profile" ? tally[amounts.indexOf(profile.allowance)] : undefined;
    if (!row) continue;
    row.lives += 1;
    if (life.offers.length) row.offered += 1;
  }
  return tally.map(({ lives, offered }) => (lives ? offered / lives : 0));
}
