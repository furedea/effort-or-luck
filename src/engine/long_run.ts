import { autoLive, pickNear } from "./choice";
import type { Effort, SceneId } from "./facts";
import { ALLOWANCE_DISTRIBUTION } from "./parameters";

// One game of 100 selves swings a lot by chance. Replaying the same monthly choices over many
// other draws of luck shows what those choices usually lead to.

const LONG_RUN_LIVES = 4000;

/** Fixed seeds, so the long-run figures are the same on every screen and in shared links. */
export const LONG_RUN_SEEDS: readonly number[] = Array.from(
  { length: LONG_RUN_LIVES },
  (_, k) => (90_001 + k * 7919) >>> 0,
);

/** Offer rate on June 1st per allowance (in distribution order) when wanting `wantFor` each month. */
export function longRunByAllowance(wantFor: (month: SceneId) => Effort): number[] {
  const tally = ALLOWANCE_DISTRIBUTION.map(() => ({ lives: 0, offered: 0 }));
  const amounts: readonly number[] = ALLOWANCE_DISTRIBUTION.map(([amount]) => amount);
  for (const seed of LONG_RUN_SEEDS) {
    const life = autoLive(seed, (scene) => {
      const want = wantFor(scene.facts.id);
      return { option: pickNear(scene.options, want), want };
    });
    const profile = life.log[0];
    const row = profile?.kind === "profile" ? tally[amounts.indexOf(profile.allowance)] : undefined;
    if (!row) continue;
    row.lives += 1;
    if (life.offers.length) row.offered += 1;
  }
  return tally.map(({ lives, offered }) => (lives ? offered / lives : 0));
}
