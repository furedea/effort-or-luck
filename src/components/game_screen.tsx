import { useEffect, useState } from "react";

import "../styles/game.css";
import { periodSummary, PLAY_AGAIN, previousPeriod, shareText, TITLE } from "../copy/screen";
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
import type { Stat } from "../engine/facts";
import type { Plan } from "../engine/plan";
import { encode } from "../share/result_link";
import { PlayView } from "./play_view";
import { RevealView } from "./reveal_view";
import { ShareButton } from "./share_button";

interface Game {
  readonly seed: number;
  readonly cohort: Cohort;
  /** The self the player lives as; the other selves silently make the same choices. */
  readonly player: number;
  readonly yearEnd: YearEnd | null;
  /** What the last period did, shown on the next scene. */
  readonly carried: string | null;
  /** The plan the player chose for each period, in order, so the year can be shared and replayed. */
  readonly plans: readonly Plan[];
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
          blocked={cohort.everBlocked.size}
          plans={cohort.plans}
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
          onConfirm={(plan: Plan) => setGame(choose(game, plan))}
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
    plans: [],
  };
}

function choose(game: Game, plan: Plan): Game {
  const life = game.cohort.lives[game.player];
  const before = life ? { money: life.money, stats: { ...life.stats } } : null;
  const { cohort } = chooseAndAdvance(game.cohort, game.player, plan);
  const carried = life && before ? previousPeriod(changeSince(before, life)) : null;
  return moveOn({ ...game, plans: [...game.plans, plan] }, cohort, carried);
}

function changeSince(
  before: { money: number; stats: Record<Stat, number> },
  after: { money: number; stats: Record<Stat, number> },
): string {
  const stats = { ...after.stats };
  for (const stat of Object.keys(stats) as Stat[]) stats[stat] -= before.stats[stat];
  return periodSummary(after.money - before.money, stats);
}

function moveOn(game: Game, cohort: Cohort, carried: string | null): Game {
  return { ...game, cohort, carried, yearEnd: isOver(cohort) ? replayYear(cohort) : null };
}

function shareUrl({ seed, player, plans }: Game): string {
  return `${window.location.origin}/share${encode({ seed, player, plans })}`;
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
