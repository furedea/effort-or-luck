import { WEEKS } from "./calendar";
import { eventAt, OPTION_EFFORT, pickOption, resolve, type Event } from "./events";
import type { Effort, OptionKey, RoutineKey } from "./facts";
import { makeLife, type Life } from "./life";
import { ROUTINES } from "./routine";
import { liveWeek } from "./week";

// A whole year lived by a policy: a timetable for every week and a choice at every event.

/** A player's input at a point in the year, recorded so the year can be replayed. */
export type Decision =
  | { readonly week: number; readonly kind: "timetable"; readonly timetable: readonly RoutineKey[] }
  | { readonly week: number; readonly kind: "choice"; readonly option: OptionKey };

export interface Choice {
  /** The option wanted, taken when offered and affordable; null to choose by effort alone. */
  readonly key: OptionKey | null;
  /** Effort to fall back to when the wanted option cannot be taken. */
  readonly want: Effort;
}

export interface Policy {
  timetable(life: Life, week: number): readonly RoutineKey[];
  choose(life: Life, event: Event, week: number): Choice;
}

const JOB_ROUTINES = ROUTINES.filter((spec) => spec.kind === "job").map((spec) => spec.key);
const LIFE_ROUTINES = ROUTINES.filter((spec) => spec.kind === "life").map((spec) => spec.key);
/** About half of a typical week on job hunting, the rest on oneself, no paid extras. */
const MIDDLE_TIMETABLE: readonly RoutineKey[] = [
  "selfAnalysis",
  "infoSessions",
  "interviewPractice",
  "friends",
  "research",
  "rest",
];
const MIDDLE_CHOICE: Choice = { key: null, want: 1 };

/** Savings below which the all-in path takes on part-time work to keep paying for job hunting. */
const LOW_SAVINGS_YEN = 20_000;
const JOB_ROUTINES_WITH_WORK: readonly RoutineKey[] = [...JOB_ROUTINES, "extraWork"];

/**
 * Every job-hunting routine and the most effortful option at every event; nothing for oneself,
 * apart from part-time work while savings run low.
 */
export const mostPolicy: Policy = {
  timetable: (life) => (life.money < LOW_SAVINGS_YEN ? JOB_ROUTINES_WITH_WORK : JOB_ROUTINES),
  choose: () => ({ key: null, want: 2 }),
};

/** Only time for oneself, and the least effortful option at every event. */
export const leastPolicy: Policy = {
  timetable: () => LIFE_ROUTINES,
  choose: () => ({ key: null, want: -1 }),
};

/** About half the week on job hunting without paid extras, and middle options at events. */
export const middlePolicy: Policy = {
  timetable: () => MIDDLE_TIMETABLE,
  choose: () => MIDDLE_CHOICE,
};

/**
 * Replays recorded decisions: the latest timetable set by each week, and the recorded option at
 * each event; an event without a recorded choice is met the middle way.
 */
export function followDecisions(decisions: readonly Decision[]): Policy {
  return {
    timetable: (_, week) => {
      let timetable: readonly RoutineKey[] = [];
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

/** Lives a whole year from `seed` by `policy`. */
export function autoLive(seed: number, policy: Policy): Life {
  const life = makeLife(seed);
  for (let week = 0; week < WEEKS; week++) {
    const event = eventAt(life, week);
    if (event?.options.length) meet(life, event, policy.choose(life, event, week));
    liveWeek(life, week, policy.timetable(life, week));
  }
  eventAt(life, WEEKS);
  return life;
}
