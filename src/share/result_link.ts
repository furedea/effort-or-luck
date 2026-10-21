import {
  choose,
  COHORT_SIZE,
  isOver,
  replayYear,
  setBookingTimetable,
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
const BOOKING_MARK = "b";
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
  const fields = readFields(new URLSearchParams(search));
  if (!fields) return failure("unreadable");
  const { rules, seed, player, choices, difficulty } = fields;
  if (rules !== String(RULES_VERSION)) {
    return /^\d+$/.test(rules) ? failure("oldRules") : failure("unreadable");
  }
  if (!isWellFormed(fields) || !isDifficulty(difficulty)) return failure("unreadable");
  const parsedSeed = Number.parseInt(seed, 36);
  const parsedPlayer = Number(player);
  if (parsedSeed > 0xffffffff || parsedPlayer >= COHORT_SIZE) return failure("unreadable");
  const decisions = decodeDecisions(choices);
  if (!decisions) return failure("unreadable");
  return { ok: true, value: { seed: parsedSeed, player: parsedPlayer, difficulty, decisions } };
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
    const reached = stepWhile(cohort, player, (current) => current.week < decision.week);
    if (!reached || reached.week !== decision.week) return failure("unreadable");
    const decided = applyDecision(reached, player, decision);
    if (!decided) return failure("unreadable");
    cohort = decided;
  }
  const ended = stepWhile(cohort, player, (current) => !isOver(current));
  if (!ended) return failure("unreadable");
  return { ok: true, value: { cohort: ended, yearEnd: replayYear(ended) } };
}

interface QueryFields {
  readonly rules: string;
  readonly seed: string;
  readonly player: string;
  readonly choices: string;
  readonly difficulty: string;
}

/** The raw query fields, or null when a required one is missing. */
function readFields(query: URLSearchParams): QueryFields | null {
  const rules = query.get("r");
  const seed = query.get("s");
  const player = query.get("p");
  const choices = query.get("c");
  // Links made before difficulty existed were all normal.
  const difficulty = query.get("d") ?? "normal";
  if (rules === null || seed === null || player === null || choices === null) return null;
  return { rules, seed, player, choices, difficulty };
}

function isWellFormed({ seed, player, choices }: QueryFields): boolean {
  return /^[0-9a-z]{1,7}$/.test(seed) && /^\d{1,2}$/.test(player) && /^[0-9a-z.]*$/.test(choices);
}

/** Steps the year while `holds`, or null if the player meets an unanswered event on the way. */
function stepWhile(
  cohort: Cohort,
  player: number,
  holds: (cohort: Cohort) => boolean,
): Cohort | null {
  let current = cohort;
  while (holds(current)) {
    if (awaitsChoice(current, player)) return null;
    current = step(current);
  }
  return current;
}

/** The year after `decision`, or null when the player was not offered or cannot afford it. */
function applyDecision(cohort: Cohort, player: number, decision: Decision): Cohort | null {
  if (decision.kind === "timetable") return setTimetable(cohort, decision.timetable);
  if (decision.kind === "booking") return setBookingTimetable(cohort, decision.timetable);
  const offered = cohort.events[player]?.options.find((o) => o.key === decision.option);
  if (!offered || offered.shortfall) return null;
  return choose(cohort, decision.option);
}

function isDifficulty(text: string): text is Difficulty {
  return Object.hasOwn(DIFFICULTY, text);
}

function awaitsChoice(cohort: Cohort, player: number): boolean {
  return Boolean(cohort.events[player]?.options.length);
}

/** A decision as its week, a mark, and base-36 indices, e.g. "12t0156", "9o02", or "9b15". */
function encodeDecision(decision: Decision): string {
  if (decision.kind === "choice") {
    const index = OPTION_KEYS.indexOf(decision.option).toString(36).padStart(OPTION_DIGITS, "0");
    return `${decision.week}${CHOICE_MARK}${index}`;
  }
  const routines = decision.timetable.map((key) => ROUTINE_KEYS.indexOf(key).toString(36));
  const mark = decision.kind === "booking" ? BOOKING_MARK : TIMETABLE_MARK;
  return `${decision.week}${mark}${routines.join("")}`;
}

function decodeDecisions(text: string): Decision[] | null {
  if (text === "") return [];
  const decisions = text.split(DECISION_SEPARATOR).map(decodeDecision);
  return decisions.every((decision) => decision !== null) ? decisions : null;
}

function decodeDecision(text: string): Decision | null {
  const match = text.match(/^(\d{1,2})([tob])([0-9a-z]*)$/);
  if (!match) return null;
  const [, weekText = "", mark, indices = ""] = match;
  const week = Number(weekText);
  const digits = indices.split("").map((digit) => Number.parseInt(digit, 36));
  if (mark === CHOICE_MARK) {
    const option =
      indices.length === OPTION_DIGITS ? OPTION_KEYS[Number.parseInt(indices, 36)] : undefined;
    return option ? { week, kind: "choice", option } : null;
  }
  const timetable = digits.map((digit) => ROUTINE_KEYS[digit]);
  if (timetable.some((key) => key === undefined)) return null;
  if (new Set(timetable).size !== timetable.length) return null;
  const kind = mark === BOOKING_MARK ? "booking" : "timetable";
  return { week, kind, timetable: timetable.filter((key) => key !== undefined) };
}

function failure(error: LinkError): { ok: false; error: LinkError } {
  return { ok: false, error };
}
