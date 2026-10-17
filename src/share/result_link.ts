import {
  advanceFor,
  chooseAndAdvance,
  COHORT_SIZE,
  isOver,
  replayYear,
  startCohort,
  type Cohort,
  type YearEnd,
} from "../engine/cohort";
import type { Effort } from "../engine/facts";
import { RULES_VERSION } from "../engine/parameters";

// A shared result is the base seed, the player's index, and the player's choices: the
// other selves derive their choices from the player's, so the whole year follows.

export interface ShareParams {
  readonly seed: number;
  readonly player: number;
  readonly choices: readonly Effort[];
}

export type LinkError = "unreadable" | "oldRules";

type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: LinkError };

const EFFORT_OFFSET = 1;

export function encode({ seed, player, choices }: ShareParams): string {
  const query = new URLSearchParams({
    r: String(RULES_VERSION),
    s: seed.toString(36),
    p: String(player),
    c: choices.map((effort) => effort + EFFORT_OFFSET).join(""),
  });
  return `?${query.toString()}`;
}

export function parse(search: string): Result<ShareParams> {
  const query = new URLSearchParams(search);
  const rules = query.get("r");
  const seed = query.get("s");
  const player = query.get("p");
  const choices = query.get("c");
  if (rules === null || seed === null || player === null || choices === null)
    return failure("unreadable");
  if (rules !== String(RULES_VERSION))
    return /^\d+$/.test(rules) ? failure("oldRules") : failure("unreadable");
  if (!/^[0-9a-z]{1,7}$/.test(seed) || !/^\d{1,2}$/.test(player) || !/^[0-3]*$/.test(choices)) {
    return failure("unreadable");
  }
  const parsedSeed = Number.parseInt(seed, 36);
  const parsedPlayer = Number(player);
  if (parsedSeed > 0xffffffff || parsedPlayer >= COHORT_SIZE) return failure("unreadable");
  return {
    ok: true,
    value: {
      seed: parsedSeed,
      player: parsedPlayer,
      choices: choices.split("").map((digit) => (Number(digit) - EFFORT_OFFSET) as Effort),
    },
  };
}

/** Plays the shared year again, failing if a recorded choice does not fit it. */
export function replay({
  seed,
  player,
  choices,
}: ShareParams): Result<{ cohort: Cohort; yearEnd: YearEnd }> {
  let cohort = startCohort(seed);
  let next = 0;
  while (!isOver(cohort)) {
    const scene = cohort.scenes[player];
    if (!scene) return failure("unreadable");
    if (!scene.options.length) {
      cohort = advanceFor(cohort, player);
      continue;
    }
    const effort = choices[next++];
    const available = scene.options.some((o) => o.effort === effort && o.shortfall === null);
    if (effort === undefined || !available) return failure("unreadable");
    cohort = chooseAndAdvance(cohort, player, effort).cohort;
  }
  if (next !== choices.length) return failure("unreadable");
  return { ok: true, value: { cohort, yearEnd: replayYear(cohort) } };
}

function failure(error: LinkError): { ok: false; error: LinkError } {
  return { ok: false, error };
}
