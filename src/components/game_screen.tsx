import { useEffect, useState } from "react";

import "../styles/game.css";
import { assumptionsNote, sourcesNote, TITLE, type View } from "../copy/screen";
import {
  advanceFor,
  chooseAndAdvance,
  COHORT_SIZE,
  isOver,
  replayYear,
  startCohort,
  type Cohort,
  type YearEnd,
} from "../engine/cohort";
import type { Effort, ResultFact } from "../engine/facts";
import { PlayView } from "./play_view";
import { RevealView } from "./reveal_view";

interface Game {
  readonly cohort: Cohort;
  /** The self the player lives as; the other selves silently make the same choices. */
  readonly player: number;
  readonly yearEnd: YearEnd | null;
  readonly view: View;
  /** What the last choice led to, shown on the next month. */
  readonly carried: ResultFact | null;
}

export function GameScreen() {
  const [game, setGame] = useState<Game | null>(null);

  // The base seed is random, so the selves are created only in the browser.
  useEffect(() => {
    setGame(newGame());
  }, []);
  const step = game?.cohort.step;
  // Effects must not return the call's value: scrollTo returns a promise in current browsers.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  if (!game) return <main />;
  const { cohort, player, yearEnd, view, carried } = game;
  const life = cohort.lives[player];
  const scene = cohort.scenes[player];

  const restart = () => setGame(newGame());

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
          carried={carried}
          onChoose={(effort: Effort) => setGame(choose(game, effort))}
          onNext={() => setGame(moveOn(game, advanceFor(cohort, player), null))}
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
    carried: null,
  };
}

function choose(game: Game, effort: Effort): Game {
  const { cohort, result } = chooseAndAdvance(game.cohort, game.player, effort);
  return moveOn(game, cohort, result ?? null);
}

function moveOn(game: Game, cohort: Cohort, carried: ResultFact | null): Game {
  return { ...game, cohort, carried, yearEnd: isOver(cohort) ? replayYear(cohort) : null };
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
