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
import { DIFFICULTY, RULES_VERSION, type Difficulty } from "../engine/parameters";
import { ROUTINES } from "../engine/routine";
import type { Decision } from "../engine/year";

// A shared result is the base seed, the player's index, and every timetable and choice the
// player made, each with its week: the other selves attempt the same, so the whole year follows.

export interface ShareParams {
  readonly seed: number;
  readonly player: number;
  readonly difficulty: Difficulty;
  readonly decisions: readonly Decision[];
}

export type LinkError = "unreadable" | "oldRules";

type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: LinkError };

const DECISION_SEPARATOR = ".";
const TIMETABLE_MARK = "t";
const CHOICE_MARK = "o";
/** Options outnumber one base-36 digit, so each takes two. */
const OPTION_DIGITS = 2;
// Links name routines and options by position, so reordering them needs a RULES_VERSION bump.
const ROUTINE_KEYS: readonly RoutineKey[] = ROUTINES.map((spec) => spec.key);
const OPTION_KEYS = Object.keys(OPTION_EFFORT) as OptionKey[];

export function encode({ seed, player, difficulty, decisions }: ShareParams): string {
  const query = new URLSearchParams({
    r: String(RULES_VERSION),
    s: seed.toString(36),
    p: String(player),
    c: decisions.map(encodeDecision).join(DECISION_SEPARATOR),
    d: difficulty,
  });
  return `?${query.toString()}`;
}

export function parse(search: string): Result<ShareParams> {
  const query = new URLSearchParams(search);
  const rules = query.get("r");
  const seed = query.get("s");
  const player = query.get("p");
  const choices = query.get("c");
  // Links made before difficulty existed were all normal.
  const difficulty = query.get("d") ?? "normal";
  if (rules === null || seed === null || player === null || choices === null) {
    return failure("unreadable");
  }
  if (rules !== String(RULES_VERSION)) {
    return /^\d+$/.test(rules) ? failure("oldRules") : failure("unreadable");
  }
  if (!/^[0-9a-z]{1,7}$/.test(seed) || !/^\d{1,2}$/.test(player) || !/^[0-9a-z.]*$/.test(choices)) {
    return failure("unreadable");
  }
  if (!isDifficulty(difficulty)) return failure("unreadable");
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
      difficulty,
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
  difficulty,
  decisions,
}: ShareParams): Result<{ cohort: Cohort; yearEnd: YearEnd }> {
  let cohort = startCohort(seed, difficulty);
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
    cohort = choose(cohort, decision.option, decision.resting);
  }
  while (!isOver(cohort)) {
    if (awaitsChoice(cohort, player)) return failure("unreadable");
    cohort = step(cohort);
  }
  return { ok: true, value: { cohort, yearEnd: replayYear(cohort) } };
}

function isDifficulty(text: string): text is Difficulty {
  return Object.hasOwn(DIFFICULTY, text);
}

function awaitsChoice(cohort: Cohort, player: number): boolean {
  return Boolean(cohort.events[player]?.options.length);
}

/**
 * A decision as its week, a mark, and base-36 indices, e.g. "12t0156", or "9o02" and "9o0215"
 * for a choice that rests routines 1 and 5.
 */
function encodeDecision(decision: Decision): string {
  if (decision.kind === "choice") {
    const index = OPTION_KEYS.indexOf(decision.option).toString(36).padStart(OPTION_DIGITS, "0");
    return `${decision.week}${CHOICE_MARK}${index}${routineDigits(decision.resting)}`;
  }
  return `${decision.week}${TIMETABLE_MARK}${routineDigits(decision.timetable)}`;
}

function routineDigits(keys: readonly RoutineKey[]): string {
  return keys.map((key) => ROUTINE_KEYS.indexOf(key).toString(36)).join("");
}

function decodeDecision(text: string): Decision | null {
  const match = text.match(/^(\d{1,2})([to])([0-9a-z]*)$/);
  if (!match) return null;
  const [, weekText = "", mark, indices = ""] = match;
  const week = Number(weekText);
  if (mark === CHOICE_MARK) {
    const option = OPTION_KEYS[Number.parseInt(indices.slice(0, OPTION_DIGITS), 36)];
    const resting = decodeRoutines(indices.slice(OPTION_DIGITS));
    if (indices.length < OPTION_DIGITS || !option || !resting) return null;
    return { week, kind: "choice", option, resting };
  }
  const timetable = decodeRoutines(indices);
  return timetable ? { week, kind: "timetable", timetable } : null;
}

/** Routines named by one base-36 digit each, or null for an unknown or repeated one. */
function decodeRoutines(digits: string): RoutineKey[] | null {
  const keys = digits.split("").map((digit) => ROUTINE_KEYS[Number.parseInt(digit, 36)]);
  if (keys.some((key) => key === undefined)) return null;
  if (new Set(keys).size !== keys.length) return null;
  return keys.filter((key) => key !== undefined);
}

function failure(error: LinkError): { ok: false; error: LinkError } {
  return { ok: false, error };
}
