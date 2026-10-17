import { useEffect, useState } from "react";

import "../styles/game.css";
import { describeEvent } from "../copy/scenes";
import { PLAY_AGAIN, shareText, TITLE, warningLine } from "../copy/screen";
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
import { encode } from "../share/result_link";
import { PlayView, type FeedEntry } from "./play_view";
import { RevealView } from "./reveal_view";
import { ShareButton } from "./share_button";

const WEEK_MS = 300;
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
  readonly playing: boolean;
  /** Happenings that did not stop time, newest first. */
  readonly feed: readonly FeedEntry[];
  /** Stats already warned about, so each warning comes once. */
  readonly warned: readonly Stat[];
  readonly yearEnd: YearEnd | null;
}

export function GameScreen() {
  const [game, setGame] = useState<Game | null>(null);

  // The base seed is random, so the selves are created only in the browser, after hydration;
  // creating them during render would make the server and browser output differ.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setGame(newGame());
  }, []);

  const flowing = Boolean(game?.playing && !game.yearEnd && !stopAt(game));
  useEffect(() => {
    if (!game || !flowing) return undefined;
    const timer = setTimeout(() => setGame(advance(game)), WEEK_MS);
    return () => clearTimeout(timer);
  }, [game, flowing]);

  if (!game) return <main />;
  const { cohort, player, yearEnd } = game;
  const life = cohort.lives[player];
  const restart = () => setGame(newGame());

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
          playing={game.playing}
          feed={game.feed}
          onTimetable={(timetable) => setGame({ ...game, timetable })}
          onPlay={() => setGame({ ...game, playing: true })}
          onPause={() => setGame({ ...game, playing: false })}
          onChoose={(option: OptionKey) => setGame(decide(game, option))}
          onNext={() => setGame(acknowledge(game))}
        />
      ) : null}
    </main>
  );
}

function newGame(): Game {
  const seed = randomSeed();
  const cohort = startCohort(seed);
  const player = Math.floor(Math.random() * COHORT_SIZE);
  return {
    seed,
    cohort,
    player,
    timetable: [],
    playing: false,
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
  if (isOver(cohort)) return { ...game, cohort, playing: false, yearEnd: replayYear(cohort) };
  const falling = life ? warningFor(life, game.warned) : null;
  const warnings =
    falling && life ? [{ week: cohort.week, text: warningLine(falling, life.stats[falling]) }] : [];
  const next = {
    ...game,
    cohort,
    feed: [...warnings, ...noticeEntries(cohort, game.player), ...game.feed],
    warned: falling ? [...game.warned, falling] : game.warned,
  };
  return stopAt(next) ? { ...next, playing: false } : next;
}

function decide(game: Game, option: OptionKey): Game {
  const cohort = choose(withTimetable(game.cohort, game.timetable), option);
  return { ...game, cohort, playing: true };
}

/**
 * Moves on from a stopping notice; after the results, the year is over. The opening notice leaves
 * time paused so the player can set a timetable first.
 */
function acknowledge(game: Game): Game {
  const opening = game.cohort.week === 0;
  const cohort = step(withTimetable(game.cohort, game.timetable));
  if (isOver(cohort)) return { ...game, cohort, playing: false, yearEnd: replayYear(cohort) };
  return { ...game, cohort, playing: !opening };
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
  return `${window.location.origin}/share${encode({ seed, player, decisions: cohort.decisions })}`;
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
