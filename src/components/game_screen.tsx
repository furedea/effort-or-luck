import { useEffect, useState } from "react";

import "../styles/game.css";
import { assumptionsNote, sourcesNote, TITLE, type View } from "../copy/screen";
import {
  advanceFor,
  chooseForAll,
  COHORT_SIZE,
  isOver,
  replayYear,
  startCohort,
  type Cohort,
  type YearEnd,
} from "../engine/cohort";
import type { Effort } from "../engine/facts";
import { PlayView } from "./play_view";
import { RevealView } from "./reveal_view";

interface Game {
  readonly cohort: Cohort;
  /** The self the player lives as; the other selves silently make the same choices. */
  readonly player: number;
  readonly yearEnd: YearEnd | null;
  readonly view: View;
}

export function GameScreen() {
  const [game, setGame] = useState<Game | null>(null);

  // The base seed is random, so the selves are created only in the browser.
  useEffect(() => setGame(newGame()), []);

  if (!game) return <main />;
  const { cohort, player, yearEnd, view } = game;
  const life = cohort.lives[player];
  const scene = cohort.scenes[player];
  const turn = cohort.turn;

  const restart = () => {
    setGame(newGame());
    window.scrollTo(0, 0);
  };

  return (
    <main>
      <h1 className="title">{TITLE}</h1>
      {yearEnd ? (
        <RevealView
          paths={{ same: cohort.lives, most: yearEnd.most, least: yearEnd.least }}
          ranks={cohort.allowanceRanks}
          player={player}
          view={view}
          onView={(next) => setGame({ ...game, view: next })}
          onRestart={restart}
        />
      ) : life && scene ? (
        <PlayView
          life={life}
          scene={scene}
          step={cohort.step}
          chosen={turn ? { effort: turn.want, result: turn.results[player] } : null}
          onChoose={(effort: Effort) => setGame({ ...game, cohort: chooseForAll(cohort, effort) })}
          onNext={() => setGame(next(game))}
        />
      ) : null}
      {yearEnd ? (
        <footer className="notes">
          <p>{sourcesNote()}</p>
          <p>{assumptionsNote()}</p>
        </footer>
      ) : null}
    </main>
  );
}

function newGame(): Game {
  return {
    cohort: startCohort(randomSeed()),
    player: Math.floor(Math.random() * COHORT_SIZE),
    yearEnd: null,
    view: "same",
  };
}

function next(game: Game): Game {
  const cohort = advanceFor(game.cohort, game.player);
  return { ...game, cohort, yearEnd: isOver(cohort) ? replayYear(cohort) : null };
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
