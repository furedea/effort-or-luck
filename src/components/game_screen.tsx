import { useEffect, useState } from "react";

import "../styles/game.css";
import { describeEvent, routineTileLabel } from "../copy/scenes";
import { limitedLine, PLAY_AGAIN, shareText, TITLE, warningLine } from "../copy/screen";
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
  /** Happenings that did not stop time, newest first. */
  readonly feed: readonly FeedEntry[];
  /** Stats already warned about, so each warning comes once. */
  readonly warned: readonly Stat[];
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
        <h1 className="title">{TITLE}</h1>
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
          onSpeed={(speed) => setGame({ ...game, speed })}
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
    feed: [],
    warned: [],
    yearEnd: null,
  };
}

/**
 * Lives one week (or, once the player's year has ended, every week left). Time stops only for
 * the player's choices and the end of the year; anything else goes into the feed.
 */
function advance(game: Game): Game {
  let cohort = step(withTimetable(game.cohort, game.timetable));
  const life = cohort.lives[game.player];
  while (life && !isActive(life) && cohort.week < WEEKS && !cohort.events[game.player]) {
    cohort = step(cohort);
  }
  if (isOver(cohort)) return { ...game, cohort, yearEnd: replayYear(cohort) };
  const falling = life ? warningFor(life, game.warned) : null;
  const warnings =
    falling && life ? [{ week: cohort.week, text: warningLine(falling, life.stats[falling]) }] : [];
  const appeared = life && isActive(life) ? limitedEntries(cohort.week) : [];
  return {
    ...game,
    cohort,
    // Limited-time preparation would pass within seconds at speed, so time waits for the player.
    speed: appeared.length ? "step" : game.speed,
    feed: [...appeared, ...warnings, ...noticeEntries(cohort, game.player), ...game.feed],
    warned: falling ? [...game.warned, falling] : game.warned,
  };
}

/** Limited-time preparation that opens this week. */
function limitedEntries(week: number): FeedEntry[] {
  return ROUTINES.filter((spec) => isLimited(spec) && spec.from === week).map((spec) => ({
    week,
    text: limitedLine(routineTileLabel(spec.key), spec.until - week),
  }));
}

function decide(game: Game, option: OptionKey): Game {
  const cohort = choose(withTimetable(game.cohort, game.timetable), option);
  return { ...game, cohort };
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
  const same =
    timetable.length === cohort.timetable.length &&
    timetable.every((key, i) => cohort.timetable[i] === key);
  return same ? cohort : setTimetable(cohort, timetable);
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
