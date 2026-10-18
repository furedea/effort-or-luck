import { useEffect, useState } from "react";

import "../styles/game.css";
import { describeEvent, routineTileLabel } from "../copy/scenes";
import {
  limitedLine,
  type PauseReason,
  PLAY_AGAIN,
  shareText,
  TIMETABLE_RESTORED,
  TITLE,
  warningLine,
} from "../copy/screen";
import { WEEKS } from "../engine/calendar";
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
import type { Event } from "../engine/events";
import type { OptionKey, RoutineKey, Stat } from "../engine/facts";
import { isActive, type Life } from "../engine/life";
import type { Difficulty } from "../engine/parameters";
import { isLimited, ROUTINES } from "../engine/routine";
import { planWeek } from "../engine/week";
import { encode } from "../share/result_link";
import { DifficultyPicker } from "./difficulty_picker";
import { PlayView, type FeedEntry, type Speed } from "./play_view";
import { RevealView } from "./reveal_view";
import { ShareButton } from "./share_button";

/** Milliseconds per week when time flows on its own; "step" waits for the player. */
const WEEK_MS = { step: null, normal: 600, double: 300 } as const satisfies Record<
  Speed,
  number | null
>;
const WARN_BELOW = 20;
/** Notices that still stop time: the opening, and the end of the player's year. */
const STOPPING_NOTICES: readonly Event["facts"]["id"][] = ["intro", "june", "over"];

interface Game {
  readonly seed: number;
  readonly cohort: Cohort;
  /** The self the player lives as; the other selves silently follow the same decisions. */
  readonly player: number;
  /** The timetable being edited; it takes effect when the next week is lived. */
  readonly timetable: readonly RoutineKey[];
  readonly speed: Speed;
  /** Why the game took auto play back to one week per press, until the player moves on. */
  readonly pausedFor: PauseReason | null;
  /** Happenings that did not stop time, newest first. */
  readonly feed: readonly FeedEntry[];
  /** Stats already warned about, so each warning comes once. */
  readonly warned: readonly Stat[];
  /** The timetable when an event booked hours, put back once they end. */
  readonly beforeBooking: readonly RoutineKey[] | null;
  readonly yearEnd: YearEnd | null;
}

export function GameScreen() {
  // Null until a difficulty is picked. The base seed is random, so the selves are created on that
  // click, in the browser; creating them during render would make server and browser output differ.
  const [game, setGame] = useState<Game | null>(null);

  const weekMs = game && !game.yearEnd && !stopAt(game) ? WEEK_MS[game.speed] : null;
  useEffect(() => {
    if (!game || weekMs === null) return undefined;
    const timer = setTimeout(() => setGame(advance(game)), weekMs);
    return () => clearTimeout(timer);
  }, [game, weekMs]);

  if (!game) {
    return (
      <main>
        <DifficultyPicker onPick={(difficulty) => setGame(newGame(difficulty))} />
      </main>
    );
  }
  const { cohort, player, yearEnd } = game;
  const life = cohort.lives[player];
  const restart = () => setGame(null);

  return (
    <main>
      <h1 className="title">{TITLE}</h1>
      {yearEnd ? (
        <RevealView
          paths={{ same: cohort.lives, most: yearEnd.most, least: yearEnd.least }}
          ranks={cohort.allowanceRanks}
          player={player}
          blocked={cohort.everBlocked.size}
          decisions={cohort.decisions}
          difficulty={cohort.difficulty}
          subject="you"
          actions={
            <>
              <ShareButton url={shareUrl(game)} text={shareText(life?.offers.length ?? 0)} />
              <button type="button" className="next" onClick={restart}>
                {PLAY_AGAIN}
              </button>
            </>
          }
        />
      ) : life ? (
        <PlayView
          life={life}
          week={cohort.week}
          event={stopAt(game)}
          timetable={game.timetable}
          speed={game.speed}
          feed={game.feed}
          onTimetable={(timetable) => setGame({ ...game, timetable })}
          pausedFor={game.pausedFor}
          onSpeed={(speed) => setGame({ ...game, speed, pausedFor: null })}
          onStep={() => setGame(advance(game))}
          onChoose={(option: OptionKey) => setGame(decide(game, option))}
          onNext={() => setGame(acknowledge(game))}
        />
      ) : null}
    </main>
  );
}

function newGame(difficulty: Difficulty): Game {
  const seed = randomSeed();
  const cohort = startCohort(seed, difficulty);
  const player = Math.floor(Math.random() * COHORT_SIZE);
  return {
    seed,
    cohort,
    player,
    timetable: [],
    speed: "step",
    pausedFor: null,
    feed: [],
    warned: [],
    beforeBooking: null,
    yearEnd: null,
  };
}

/**
 * Lives one week (or, once the player's year has ended, every week left). Time stops only for
 * the player's choices and the end of the year; anything else goes into the feed.
 */
function advance(game: Game): Game {
  // Lives change in place, so the booking is read before the week is lived.
  const booked = game.cohort.lives[game.player]?.oneOff ?? { hours: 0, weeks: 0 };
  let cohort = step(withTimetable(game.cohort, game.timetable));
  const life = cohort.lives[game.player];
  while (life && !isActive(life) && cohort.week < WEEKS && !cohort.events[game.player]) {
    cohort = step(cohort);
  }
  if (isOver(cohort)) return { ...game, cohort, yearEnd: replayYear(cohort) };
  const falling = life ? warningFor(life, game.warned) : null;
  const warnings =
    falling && life ? [{ week: cohort.week, text: warningLine(falling, life.stats[falling]) }] : [];
  const living = Boolean(life && isActive(life));
  const opened = living ? openedLimited(cohort.week) : [];
  const appeared = opened.map((spec) => ({
    week: cohort.week,
    text: limitedLine(routineTileLabel(spec.key), spec.until - cohort.week),
  }));
  const [first] = opened;
  const limitedPause: PauseReason | null = first
    ? { kind: "limited", tile: routineTileLabel(first.key), weeks: first.until - cohort.week }
    : null;
  // Tiles dropped to make room for an event's hours come back once those hours end.
  const ended = booked.weeks === 1 ? game.beforeBooking : null;
  const restored = living && ended && !sameTimetable(ended, game.timetable) ? ended : null;
  return {
    ...game,
    cohort,
    timetable: restored ?? game.timetable,
    beforeBooking: booked.weeks === 1 ? null : game.beforeBooking,
    // Limited-time preparation would pass within seconds at speed, so time waits for the player.
    speed: appeared.length ? "step" : game.speed,
    pausedFor: game.speed !== "step" ? limitedPause : null,
    feed: [
      ...appeared,
      ...(restored ? [{ week: cohort.week, text: TIMETABLE_RESTORED }] : []),
      ...warnings,
      ...noticeEntries(cohort, game.player),
      ...game.feed,
    ],
    warned: falling ? [...game.warned, falling] : game.warned,
  };
}

/** Limited-time preparation that opens this week. */
function openedLimited(week: number) {
  return ROUTINES.filter((spec) => isLimited(spec) && spec.from === week);
}

/**
 * Takes an option. When an option that takes hours runs the week over the free hours, time waits
 * on the timetable so the player can drop something or accept losing sleep.
 */
function decide(game: Game, option: OptionKey): Game {
  const takesHours = Boolean(stopAt(game)?.options.find((o) => o.key === option)?.hours);
  const cohort = choose(withTimetable(game.cohort, game.timetable), option);
  const life = cohort.lives[game.player];
  const shortHours =
    takesHours && life ? planWeek(life, cohort.week, game.timetable).shortHours : 0;
  const over = shortHours > 0;
  return {
    ...game,
    cohort,
    speed: over ? "step" : game.speed,
    pausedFor: over && game.speed !== "step" ? { kind: "over", hours: shortHours } : game.pausedFor,
    beforeBooking: takesHours ? game.timetable : game.beforeBooking,
  };
}

/** Moves on from a stopping notice; after the results, the year is over. */
function acknowledge(game: Game): Game {
  const cohort = step(withTimetable(game.cohort, game.timetable));
  if (isOver(cohort)) return { ...game, cohort, yearEnd: replayYear(cohort) };
  return { ...game, cohort };
}

/** The player's event if it stops time: one with options, or a stopping notice. */
function stopAt({ cohort, player }: Game): Event | null {
  const event = cohort.events[player];
  if (!event) return null;
  return event.options.length || STOPPING_NOTICES.includes(event.facts.id) ? event : null;
}

function noticeEntries(cohort: Cohort, player: number): FeedEntry[] {
  const event = cohort.events[player];
  if (!event || event.options.length || STOPPING_NOTICES.includes(event.facts.id)) return [];
  return [{ week: cohort.week, text: describeEvent(event).lines.join("") }];
}

function withTimetable(cohort: Cohort, timetable: readonly RoutineKey[]): Cohort {
  return sameTimetable(timetable, cohort.timetable) ? cohort : setTimetable(cohort, timetable);
}

function sameTimetable(a: readonly RoutineKey[], b: readonly RoutineKey[]): boolean {
  return a.length === b.length && a.every((key, i) => b[i] === key);
}

function warningFor(life: Life, warned: readonly Stat[]): Stat | null {
  const stats = Object.keys(life.stats) as Stat[];
  return stats.find((stat) => life.stats[stat] < WARN_BELOW && !warned.includes(stat)) ?? null;
}

function shareUrl({ seed, player, cohort }: Game): string {
  const { difficulty, decisions } = cohort;
  return `${window.location.origin}/share${encode({ seed, player, difficulty, decisions })}`;
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
