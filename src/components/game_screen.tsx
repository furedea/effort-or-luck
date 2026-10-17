import { useEffect, useState } from "react";

import "../styles/game.css";
import { PLAY_AGAIN, shareText, TITLE } from "../copy/screen";
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
import type { Effort } from "../engine/facts";
import { encode } from "../share/result_link";
import { PlayView, type Carried } from "./play_view";
import { RevealView } from "./reveal_view";
import { ShareButton } from "./share_button";

interface Game {
  readonly seed: number;
  readonly cohort: Cohort;
  /** The self the player lives as; the other selves silently make the same choices. */
  readonly player: number;
  readonly yearEnd: YearEnd | null;
  /** What the last choice led to, shown on the next month. */
  readonly carried: Carried | null;
  /** Every choice the player made, in order, so the year can be shared and replayed. */
  readonly choices: readonly Effort[];
}

export function GameScreen() {
  const [game, setGame] = useState<Game | null>(null);

  // The base seed is random, so the selves are created only in the browser, after hydration;
  // creating them during render would make the server and browser output differ.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setGame(newGame());
  }, []);
  const step = game?.cohort.step;
  // Effects must not return the call's value: scrollTo returns a promise in current browsers.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  if (!game) return <main />;
  const { cohort, player, yearEnd, carried } = game;
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
          wants={cohort.wants}
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
    </main>
  );
}

function newGame(): Game {
  const seed = randomSeed();
  return {
    seed,
    cohort: startCohort(seed),
    player: Math.floor(Math.random() * COHORT_SIZE),
    yearEnd: null,
    carried: null,
    choices: [],
  };
}

function choose(game: Game, effort: Effort): Game {
  const option = game.cohort.scenes[game.player]?.options.find((o) => o.effort === effort);
  const { cohort, result } = chooseAndAdvance(game.cohort, game.player, effort);
  const carried = { result, shortHours: option?.shortHours ?? 0, total: option?.total ?? 0 };
  return moveOn({ ...game, choices: [...game.choices, effort] }, cohort, carried);
}

function moveOn(game: Game, cohort: Cohort, carried: Carried | null): Game {
  return { ...game, cohort, carried, yearEnd: isOver(cohort) ? replayYear(cohort) : null };
}

function shareUrl({ seed, player, choices }: Game): string {
  return `${window.location.origin}/share${encode({ seed, player, choices })}`;
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
