import { useEffect, useState } from "react";

import "../styles/game.css";
import {
  periodSummary,
  PLAY_AGAIN,
  shareText,
  sinceLastStop,
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
import type { OptionKey, RoutineKey, Stat } from "../engine/facts";
import { isActive, type Life } from "../engine/life";
import { encode } from "../share/result_link";
import { PlayView } from "./play_view";
import { RevealView } from "./reveal_view";
import { ShareButton } from "./share_button";

const WEEK_MS = 300;
const WARN_BELOW = 20;

interface Snapshot {
  readonly money: number;
  readonly stats: Readonly<Record<Stat, number>>;
}

interface Game {
  readonly seed: number;
  readonly cohort: Cohort;
  /** The self the player lives as; the other selves silently follow the same decisions. */
  readonly player: number;
  /** The timetable being edited; it takes effect when the next week is lived. */
  readonly timetable: readonly RoutineKey[];
  readonly playing: boolean;
  readonly notice: string | null;
  /** The player's savings and stats at the last stop, to say what changed since. */
  readonly since: Snapshot;
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

  const flowing = Boolean(game?.playing && !game.yearEnd && !game.cohort.events[game.player]);
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
          event={cohort.events[player] ?? null}
          timetable={game.timetable}
          playing={game.playing}
          notice={game.notice}
          onTimetable={(timetable) => setGame({ ...game, timetable })}
          onPlay={() => setGame({ ...game, playing: true, notice: null })}
          onPause={() => setGame(stop(game, null))}
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
    notice: null,
    since: snapshot(cohort.lives[player]),
    warned: [],
    yearEnd: null,
  };
}

/** Lives one week (or, once the player's year has ended, every week left) and stops when needed. */
function advance(game: Game): Game {
  let cohort = step(withTimetable(game.cohort, game.timetable));
  const life = cohort.lives[game.player];
  while (life && !isActive(life) && cohort.week < WEEKS && !cohort.events[game.player]) {
    cohort = step(cohort);
  }
  const next = { ...game, cohort };
  if (isOver(cohort)) return { ...next, playing: false, yearEnd: replayYear(cohort) };
  const falling = life ? warningFor(life, game.warned) : null;
  if (falling && life) {
    const warned = { ...next, warned: [...game.warned, falling] };
    return stop(warned, warningLine(falling, life.stats[falling]));
  }
  return cohort.events[game.player] ? stop(next, null) : next;
}

function decide(game: Game, option: OptionKey): Game {
  const cohort = choose(withTimetable(game.cohort, game.timetable), option);
  return { ...game, cohort, playing: true, notice: null };
}

/**
 * Moves on from a notice; after the results, the year is over. The opening notice leaves time
 * paused so the player can set a timetable first.
 */
function acknowledge(game: Game): Game {
  const opening = game.cohort.week === 0;
  const cohort = step(withTimetable(game.cohort, game.timetable));
  if (isOver(cohort)) return { ...game, cohort, playing: false, yearEnd: replayYear(cohort) };
  return { ...game, cohort, playing: !opening, notice: null };
}

/** Pauses, saying what changed since the last stop unless `notice` says something else. */
function stop(game: Game, notice: string | null): Game {
  const life = game.cohort.lives[game.player];
  const summary = life ? changeSince(game.since, life) : "";
  return {
    ...game,
    playing: false,
    notice: notice ?? (summary ? sinceLastStop(summary) : null),
    since: snapshot(life),
  };
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

function snapshot(life: Life | undefined): Snapshot {
  return {
    money: life?.money ?? 0,
    stats: { ...(life?.stats ?? { health: 0, mind: 0, social: 0, research: 0 }) },
  };
}

function changeSince(before: Snapshot, after: Life): string {
  const stats = { ...after.stats };
  for (const stat of Object.keys(stats) as Stat[]) stats[stat] -= before.stats[stat];
  return periodSummary(after.money - before.money, stats);
}

function shareUrl({ seed, player, cohort }: Game): string {
  return `${window.location.origin}/share${encode({ seed, player, decisions: cohort.decisions })}`;
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
