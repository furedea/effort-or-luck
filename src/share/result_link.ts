import { ACTIVITY_KEYS } from "../engine/activities";
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
import { RULES_VERSION } from "../engine/parameters";
import type { Plan } from "../engine/plan";

// A shared result is the base seed, the player's index, and the plan the player chose for each
// period: the other selves attempt the same plans, so the whole year follows.

export interface ShareParams {
  readonly seed: number;
  readonly player: number;
  /** One plan per period the player took part in, in order. */
  readonly plans: readonly Plan[];
}

export type LinkError = "unreadable" | "oldRules";

type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: LinkError };

const PLAN_SEPARATOR = ".";

export function encode({ seed, player, plans }: ShareParams): string {
  const query = new URLSearchParams({
    r: String(RULES_VERSION),
    s: seed.toString(36),
    p: String(player),
    c: plans.map(encodePlan).join(PLAN_SEPARATOR),
  });
  return `?${query.toString()}`;
}

export function parse(search: string): Result<ShareParams> {
  const query = new URLSearchParams(search);
  const rules = query.get("r");
  const seed = query.get("s");
  const player = query.get("p");
  const choices = query.get("c");
  if (rules === null || seed === null || player === null || choices === null) {
    return failure("unreadable");
  }
  if (rules !== String(RULES_VERSION)) {
    return /^\d+$/.test(rules) ? failure("oldRules") : failure("unreadable");
  }
  if (!/^[0-9a-z]{1,7}$/.test(seed) || !/^\d{1,2}$/.test(player) || !/^[0-9a-z.]*$/.test(choices)) {
    return failure("unreadable");
  }
  const parsedSeed = Number.parseInt(seed, 36);
  const parsedPlayer = Number(player);
  if (parsedSeed > 0xffffffff || parsedPlayer >= COHORT_SIZE) return failure("unreadable");
  const plans = choices === "" ? [] : choices.split(PLAN_SEPARATOR).map(decodePlan);
  if (plans.some((plan) => plan === null)) return failure("unreadable");
  return {
    ok: true,
    value: { seed: parsedSeed, player: parsedPlayer, plans: plans.filter((plan) => plan !== null) },
  };
}

/** Plays the shared year again, failing if a recorded plan does not fit it. */
export function replay({
  seed,
  player,
  plans,
}: ShareParams): Result<{ cohort: Cohort; yearEnd: YearEnd }> {
  let cohort = startCohort(seed);
  let next = 0;
  while (!isOver(cohort)) {
    const scene = cohort.scenes[player];
    if (!scene) return failure("unreadable");
    if (!scene.period) {
      cohort = advanceFor(cohort, player);
      continue;
    }
    const plan = plans[next++];
    const offered = new Set(scene.period.activities.map((activity) => activity.key));
    if (!plan || plan.some((key) => !offered.has(key))) return failure("unreadable");
    cohort = chooseAndAdvance(cohort, player, plan).cohort;
  }
  if (next !== plans.length) return failure("unreadable");
  return { ok: true, value: { cohort, yearEnd: replayYear(cohort) } };
}

function encodePlan(plan: Plan): string {
  return plan.map((key) => ACTIVITY_KEYS.indexOf(key).toString(36)).join("");
}

function decodePlan(text: string): Plan | null {
  const keys = text.split("").map((digit) => ACTIVITY_KEYS[Number.parseInt(digit, 36)]);
  return keys.every((key) => key !== undefined) ? keys.filter((key) => key !== undefined) : null;
}

function failure(error: LinkError): { ok: false; error: LinkError } {
  return { ok: false, error };
}
