import {
  choose,
  COHORT_SIZE,
  isOver,
  replayYear,
  setTimetable,
  startCohort,
  step,
  type Cohort,
  type YearEnd,
} from "../engine/cohort";
import { OPTION_EFFORT } from "../engine/events";
import type { OptionKey, RoutineKey } from "../engine/facts";
import { RULES_VERSION } from "../engine/parameters";
import { ROUTINES } from "../engine/routine";
import type { Decision } from "../engine/year";

// A shared result is the base seed, the player's index, and every timetable and choice the
// player made, each with its week: the other selves attempt the same, so the whole year follows.

export interface ShareParams {
  readonly seed: number;
  readonly player: number;
  readonly decisions: readonly Decision[];
}

export type LinkError = "unreadable" | "oldRules";

type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: LinkError };

const DECISION_SEPARATOR = ".";
const TIMETABLE_MARK = "t";
const CHOICE_MARK = "o";
// Links name routines and options by position, so reordering them needs a RULES_VERSION bump.
const ROUTINE_KEYS: readonly RoutineKey[] = ROUTINES.map((spec) => spec.key);
const OPTION_KEYS = Object.keys(OPTION_EFFORT) as OptionKey[];

export function encode({ seed, player, decisions }: ShareParams): string {
  const query = new URLSearchParams({
    r: String(RULES_VERSION),
    s: seed.toString(36),
    p: String(player),
    c: decisions.map(encodeDecision).join(DECISION_SEPARATOR),
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
  const decisions = choices === "" ? [] : choices.split(DECISION_SEPARATOR).map(decodeDecision);
  if (decisions.some((decision) => decision === null)) return failure("unreadable");
  return {
    ok: true,
    value: {
      seed: parsedSeed,
      player: parsedPlayer,
      decisions: decisions.filter((decision) => decision !== null),
    },
  };
}

/**
 * Plays the shared year again, failing if a decision does not fit it: out of order, an option the
 * player was not offered or could not afford, or an event the player left unanswered.
 */
export function replay({
  seed,
  player,
  decisions,
}: ShareParams): Result<{ cohort: Cohort; yearEnd: YearEnd }> {
  let cohort = startCohort(seed);
  for (const decision of decisions) {
    while (cohort.week < decision.week) {
      if (awaitsChoice(cohort, player)) return failure("unreadable");
      cohort = step(cohort);
    }
    if (cohort.week !== decision.week) return failure("unreadable");
    if (decision.kind === "timetable") {
      cohort = setTimetable(cohort, decision.timetable);
      continue;
    }
    const offered = cohort.events[player]?.options.find((o) => o.key === decision.option);
    if (!offered || offered.shortfall) return failure("unreadable");
    cohort = choose(cohort, decision.option);
  }
  while (!isOver(cohort)) {
    if (awaitsChoice(cohort, player)) return failure("unreadable");
    cohort = step(cohort);
  }
  return { ok: true, value: { cohort, yearEnd: replayYear(cohort) } };
}

function awaitsChoice(cohort: Cohort, player: number): boolean {
  return Boolean(cohort.events[player]?.options.length);
}

/** A decision as its week, a mark, and base-36 indices, e.g. "12t0156" or "9o2". */
function encodeDecision(decision: Decision): string {
  if (decision.kind === "choice") {
    return `${decision.week}${CHOICE_MARK}${OPTION_KEYS.indexOf(decision.option).toString(36)}`;
  }
  const routines = decision.timetable.map((key) => ROUTINE_KEYS.indexOf(key).toString(36));
  return `${decision.week}${TIMETABLE_MARK}${routines.join("")}`;
}

function decodeDecision(text: string): Decision | null {
  const match = text.match(/^(\d{1,2})([to])([0-9a-z]*)$/);
  if (!match) return null;
  const [, weekText = "", mark, indices = ""] = match;
  const week = Number(weekText);
  const digits = indices.split("").map((digit) => Number.parseInt(digit, 36));
  if (mark === CHOICE_MARK) {
    const option = digits.length === 1 ? OPTION_KEYS[digits[0] ?? -1] : undefined;
    return option ? { week, kind: "choice", option } : null;
  }
  const timetable = digits.map((digit) => ROUTINE_KEYS[digit]);
  if (timetable.some((key) => key === undefined)) return null;
  if (new Set(timetable).size !== timetable.length) return null;
  return { week, kind: "timetable", timetable: timetable.filter((key) => key !== undefined) };
}

function failure(error: LinkError): { ok: false; error: LinkError } {
  return { ok: false, error };
}
