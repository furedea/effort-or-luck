import { WEEKS } from "./calendar";
import { eventAt, OPTION_EFFORT, pickOption, resolve, type Event } from "./events";
import type { Effort, OptionKey, RoutineKey } from "./facts";
import { makeLife, type Life } from "./life";
import type { Difficulty } from "./parameters";
import { fitsDay, routineOf } from "./routine";
import { DAYS, EMPTY_TIMETABLE, type Timetable } from "./timetable";
import { liveWeek, partTimeDaysOf } from "./week";

// A whole year lived by a policy: a timetable for every week and a choice at every event.

/** A player's input at a point in the year, recorded so the year can be replayed. */
export type Decision =
  | { readonly week: number; readonly kind: "timetable"; readonly timetable: Timetable }
  | { readonly week: number; readonly kind: "choice"; readonly option: OptionKey };

export interface Choice {
  /** The option wanted, taken when offered and affordable; null to choose by effort alone. */
  readonly key: OptionKey | null;
  /** Effort to fall back to when the wanted option cannot be taken. */
  readonly want: Effort;
}

export interface Policy {
  timetable(life: Life, week: number): Timetable;
  choose(life: Life, event: Event, week: number): Choice;
}

/**
 * Routines a policy wants in order of priority, each placed on a free day it fits: a rest day or
 * friends as late in the week as possible, anything else as early as possible.
 */
type Priorities = readonly RoutineKey[];

const MOST: Priorities = [
  "rest",
  "jobCourse",
  "interviewPractice",
  "infoSessions",
  "longIntern",
  "longIntern",
  "longIntern",
];
/** Part-time work replaces a day of the internship while savings run low. */
const MOST_WITH_WORK: Priorities = ["rest", "extraWork", ...MOST.slice(1, -1)];
const LEAST: Priorities = [
  "rest",
  "research",
  "friends",
  "friends",
  "sns",
  "research",
  "certification",
];
/** About half the week on job hunting without paid extras; friends at the weekend and a rest day. */
const MIDDLE: Priorities = [
  "rest",
  "research",
  "friends",
  "selfAnalysis",
  "infoSessions",
  "interviewPractice",
];
const DAY_ORDER: readonly number[] = Array.from({ length: DAYS }, (_, day) => day);
const MIDDLE_CHOICE: Choice = { key: null, want: 1 };
/** Savings below which the all-in path takes on part-time work. */
const LOW_SAVINGS_YEN = 20_000;

/**
 * Job hunting on every day but one rest day, and the most effortful option at every event;
 * part-time work only while savings run low.
 */
export const mostPolicy: Policy = {
  timetable: (life, week) =>
    place(life.money < LOW_SAVINGS_YEN ? MOST_WITH_WORK : MOST, life, week, "selfAnalysis"),
  choose: () => ({ key: null, want: 2 }),
};

/** Only time for oneself, and the least effortful option at every event. */
export const leastPolicy: Policy = {
  timetable: (life, week) => place(LEAST, life, week),
  choose: () => ({ key: null, want: -1 }),
};

/** About half the week on job hunting without paid extras, and middle options at events. */
export const middlePolicy: Policy = {
  timetable: (life, week) => place(MIDDLE, life, week),
  choose: () => MIDDLE_CHOICE,
};

/**
 * Replays recorded decisions: the latest timetable set by each week, and the recorded option at
 * each event; an event without a recorded choice is met the middle way.
 */
export function followDecisions(decisions: readonly Decision[]): Policy {
  return {
    timetable: (_, week) => {
      let timetable = EMPTY_TIMETABLE;
      for (const decision of decisions) {
        if (decision.week > week) break;
        if (decision.kind === "timetable") timetable = decision.timetable;
      }
      return timetable;
    },
    choose: (_, __, week) => {
      const recorded = decisions.find((d) => d.kind === "choice" && d.week === week);
      if (recorded?.kind !== "choice") return MIDDLE_CHOICE;
      return { key: recorded.option, want: OPTION_EFFORT[recorded.option] };
    },
  };
}

/** Meets an event with options by `choice`, falling back to what the life can afford. */
export function meet(life: Life, event: Event, choice: Choice): void {
  const picked = pickOption(event, choice.key, choice.want);
  resolve(life, event, picked, choice.key);
}

/** Places `priorities` on the days free of part-time work, then fills empty days with `rest`. */
function place(priorities: Priorities, life: Life, week: number, rest?: RoutineKey): Timetable {
  const days: (RoutineKey | null)[] = [...EMPTY_TIMETABLE];
  const locked = partTimeDaysOf(life);
  const open = (key: RoutineKey, day: number) =>
    !locked.includes(day) && days[day] === null && fitsDay(routineOf(key), week, day);
  for (const key of [...priorities, ...Array.from({ length: DAYS }, () => rest ?? null)]) {
    if (!key) continue;
    const late = key === "rest" || routineOf(key).weekendFactor > 1;
    const order = late ? DAY_ORDER.toReversed() : DAY_ORDER;
    const day = order.find((d) => open(key, d));
    if (day !== undefined) days[day] = key;
  }
  return days;
}

/** Lives a whole year from `seed` by `policy`. */
export function autoLive(seed: number, policy: Policy, difficulty: Difficulty = "normal"): Life {
  const life = makeLife(seed, difficulty);
  for (let week = 0; week < WEEKS; week++) {
    const event = eventAt(life, week);
    if (event?.options.length) meet(life, event, policy.choose(life, event, week));
    liveWeek(life, week, policy.timetable(life, week));
  }
  eventAt(life, WEEKS);
  return life;
}
