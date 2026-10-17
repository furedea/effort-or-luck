import { useEffect, useState } from "react";

import "../styles/game.css";
import { WHEN, describeScene } from "../copy/scenes";
import {
  assumptionsNote,
  AXIS,
  LEDGER,
  MONTHS,
  monthIndex,
  people,
  sourcesNote,
  TITLE,
  YEAR_END_MONTH,
  type View,
} from "../copy/screen";
import { outcome } from "../engine/choice";
import {
  advance,
  chooseForAll,
  COHORT_SIZE,
  currentFacts,
  isOver,
  ledger,
  replayYear,
  startCohort,
  type Cohort,
  type YearEnd,
} from "../engine/cohort";
import type { Effort } from "../engine/facts";
import type { Life } from "../engine/life";
import { MonthView } from "./month_view";
import { Legend, SelfGrid } from "./self_grid";
import { YearEndView } from "./year_end_view";

interface Game {
  readonly cohort: Cohort;
  readonly focus: number;
  readonly yearEnd: YearEnd | null;
  readonly view: View;
}

export function GameScreen() {
  const [game, setGame] = useState<Game | null>(null);

  // The base seed is random, so the 100 selves are created only in the browser.
  useEffect(() => setGame(newGame()), []);

  if (!game) return <main />;
  const { cohort, focus, yearEnd, view } = game;
  const facts = currentFacts(cohort);
  const paths = yearEnd ? { same: cohort.lives, most: yearEnd.most, least: yearEnd.least } : null;
  const shown = paths ? paths[view] : cohort.lives;
  const month = facts ? monthIndex(facts.id) : YEAR_END_MONTH;
  const counts = ledger(shown);

  const restart = () => {
    setGame(newGame());
    window.scrollTo(0, 0);
  };

  return (
    <main>
      <div className="title">{TITLE}</div>
      <div className="months" aria-hidden="true">
        {MONTHS.map((label, i) => (
          <span key={i} className={i < month ? "past" : i === month ? "now" : ""}>
            {label}
          </span>
        ))}
      </div>
      <header className="head">
        <div className="when">{facts && !yearEnd ? describeWhen(cohort) : WHEN.june}</div>
        <dl className="ledger">
          <div>
            <dt>{LEDGER.offered}</dt>
            <dd>{people(counts.offered)}</dd>
          </div>
          <div>
            <dt>{LEDGER.broke}</dt>
            <dd>{people(counts.broke)}</dd>
          </div>
          <div>
            <dt>{LEDGER.busy}</dt>
            <dd>{people(counts.busy)}</dd>
          </div>
        </dl>
      </header>
      <div className="board">
        <aside className="side">
          <SelfGrid
            lives={shown}
            ranks={cohort.allowanceRanks}
            blocked={yearEnd ? new Set() : (cohort.turn?.blocked ?? new Set())}
            focus={focus}
            onFocus={(index) => setGame({ ...game, focus: index })}
          />
          <p className="axis">{AXIS}</p>
          <Legend ranks={cohort.allowanceRanks} />
        </aside>
        <section className="story" aria-live="polite">
          {paths ? (
            <YearEndView
              paths={paths}
              view={view}
              focus={focus}
              onView={(next) => setGame({ ...game, view: next })}
              onRestart={restart}
            />
          ) : facts ? (
            <MonthView
              cohort={cohort}
              facts={facts}
              focus={focus}
              onChoose={(effort: Effort) =>
                setGame({ ...game, cohort: chooseForAll(cohort, effort) })
              }
              onNext={() => setGame(next(game))}
            />
          ) : null}
        </section>
      </div>
      <footer className="notes">
        <p>{sourcesNote()}</p>
        <p>{assumptionsNote()}</p>
      </footer>
    </main>
  );
}

function newGame(): Game {
  return {
    cohort: startCohort(randomSeed()),
    focus: Math.floor(Math.random() * COHORT_SIZE),
    yearEnd: null,
    view: "same",
  };
}

function next(game: Game): Game {
  const cohort = advance(game.cohort);
  if (!isOver(cohort)) return { ...game, cohort };
  const yearEnd = replayYear(cohort);
  return { ...game, cohort, yearEnd, focus: revealingSelf(yearEnd) ?? game.focus };
}

/** A self who ends without an offer when always trying hardest, preferably one the easy way saves. */
function revealingSelf({ most, least }: YearEnd): number | null {
  const failed = (life: Life | undefined) => !life || outcome(life) === "none";
  const contrast = most.findIndex((life, i) => failed(life) && !failed(least[i]));
  if (contrast >= 0) return contrast;
  const anyFailed = most.findIndex((life) => failed(life));
  return anyFailed >= 0 ? anyFailed : null;
}

function describeWhen(cohort: Cohort): string {
  const first = cohort.scenes.find((scene) => scene !== null);
  return first ? describeScene(first).when : WHEN.june;
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
