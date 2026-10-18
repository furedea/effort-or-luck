import { useEffect, useRef, type ReactNode } from "react";

import {
  actualRate,
  ALLOWANCE_HEADER,
  allowanceRow,
  bandSummary,
  blockedCount,
  endedCount,
  DETAILS_TITLE,
  EFFORT_DEFINITION,
  gapSummary,
  EFFORT_PART,
  effortLead,
  LONG_RUN_NOTE,
  LONG_RUN_PENDING,
  longRunRate,
  LUCK_PART,
  luckLead,
  offeredCount,
  offeredFraction,
  pathLabel,
  profileText,
  resultLine,
  sourceCredit,
  SOURCES_LINK,
  YEAR_END,
  type Path,
  type Subject,
} from "../copy/screen";
import { STATISTICS } from "../data/statistics";
import { revealByAllowance, revealGaps } from "../engine/cohort";
import type { Stat } from "../engine/facts";
import type { Life } from "../engine/life";
import type { Difficulty } from "../engine/parameters";
import type { Decision } from "../engine/year";
import { useLongRun } from "./use_long_run";

const PATHS: readonly Path[] = ["least", "same", "most"];

interface Props {
  /** The same 100 selves with the same luck, replayed under each way of choosing. */
  readonly paths: Readonly<Record<Path, readonly Life[]>>;
  readonly ranks: readonly number[];
  readonly player: number;
  /** How many selves could not afford, in some month, the effort they all attempted. */
  readonly blocked: number;
  /** What the selves attempted, to estimate what those decisions usually lead to. */
  readonly decisions: readonly Decision[];
  readonly difficulty: Difficulty;
  /** Whose year this is: the player's own, or someone else's opened from a shared link. */
  readonly subject: Subject;
  /** Buttons at the bottom, such as playing again or sharing. */
  readonly actions: ReactNode;
}

/** The conclusion first: how much luck and effort each moved the offer rate this year. */
function GapSummary({
  paths,
  ranks,
}: {
  paths: Readonly<Record<Path, readonly Life[]>>;
  ranks: readonly number[];
}) {
  const { luck, effort, verdict } = gapSummary(revealGaps(paths.same, ranks, paths));
  return (
    <div className="reveal-summary">
      <p className="gap-luck">
        <span className="gap-label">{luck.label}</span>
        {luck.text}
      </p>
      <p className="gap-effort">
        <span className="gap-label">{effort.label}</span>
        {effort.text}
      </p>
      <p className="gap-verdict">{verdict}</p>
    </div>
  );
}

export function RevealView(props: Props) {
  const { paths, ranks, player, blocked, decisions, difficulty, subject, actions } = props;
  const you = paths.same[player];
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section className="reveal">
      <header className="reveal-head">
        <h2 className="when" ref={heading} tabIndex={-1}>
          {YEAR_END}
        </h2>
        <p className="you">{resultLine(subject, you?.offers.length ?? 0)}</p>
        <p className="profile">{you ? profileText(you.log) : ""}</p>
      </header>
      <GapSummary paths={paths} ranks={ranks} />
      <details className="reveal-details">
        <summary>{DETAILS_TITLE}</summary>
        <p className="effort-definition">{EFFORT_DEFINITION}</p>
        <LuckPart
          lives={paths.same}
          ranks={ranks}
          player={player}
          blocked={blocked}
          decisions={decisions}
          difficulty={difficulty}
          subject={subject}
        />
        <EffortPart paths={paths} ranks={ranks} subject={subject} />
        <aside className="stat">
          <p>{actualRate()}</p>
          <cite>{sourceCredit(STATISTICS.offersJuneActual.source)}</cite>
        </aside>
      </details>
      <div className="reveal-actions">
        {actions}
        <a className="sources-link" href="/sources">
          {SOURCES_LINK}
        </a>
      </div>
    </section>
  );
}

/** ① Same choices, different luck: how far luck alone spreads the 100 selves. */
function LuckPart(props: {
  lives: readonly Life[];
  ranks: readonly number[];
  player: number;
  blocked: number;
  decisions: readonly Decision[];
  difficulty: Difficulty;
  subject: Subject;
}) {
  const { lives, ranks, player, blocked, decisions, difficulty, subject } = props;
  const rows = revealByAllowance(lives, ranks);
  const longRun = useLongRun(decisions, difficulty);
  return (
    <div className="part">
      <h3 className="part-title">{LUCK_PART}</h3>
      <p className="part-lead">{luckLead(subject, lives.length)}</p>
      <div className="bands">
        {rows.map((row, rank) => (
          <div className="band" key={row.amount}>
            <span className="sr-only">
              {bandSummary(
                row.amount,
                {
                  total: row.members.length,
                  offered: row.offered,
                  average: longRun?.[rank] ?? null,
                },
                row.members.includes(player) ? subject : null,
              )}
            </span>
            <span className="band-label" aria-hidden="true">
              {allowanceRow(row.amount)}
            </span>
            <span className="dots" aria-hidden="true">
              {row.members.map((i) => (
                <i
                  key={i}
                  className={[lives[i]?.offers.length ? "offer" : "", i === player ? "you" : ""]
                    .filter(Boolean)
                    .join(" ")}
                />
              ))}
            </span>
            <span className="band-count" aria-hidden="true">
              {offeredCount(row.offered, row.members.length)}
              {longRun ? (
                <span className="band-average">{longRunRate(longRun[rank] ?? 0)}</span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
      <p className="blocked-count">{blockedCount(blocked)}</p>
      <p className="ended-count">{endedCount(endedByStat(lives))}</p>
      <p className="long-run-note">{longRun ? LONG_RUN_NOTE : LONG_RUN_PENDING}</p>
    </div>
  );
}

/** ② Same luck, different choices: how far effort alone moves the same 100 selves. */
function EffortPart(props: {
  paths: Readonly<Record<Path, readonly Life[]>>;
  ranks: readonly number[];
  subject: Subject;
}) {
  const { paths, ranks, subject } = props;
  const columns = PATHS.map((path) => revealByAllowance(paths[path], ranks));
  const rows = columns[0] ?? [];
  return (
    <div className="part">
      <h3 className="part-title">{EFFORT_PART}</h3>
      <p className="part-lead">{effortLead(paths.same.length)}</p>
      <table className="effort-table">
        <thead>
          <tr>
            <th scope="col">{ALLOWANCE_HEADER}</th>
            {PATHS.map((path) => (
              <th scope="col" key={path} className={path === "same" ? "yours" : ""}>
                {pathLabel(path, subject)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rank) => (
            <tr key={row.amount}>
              <th scope="row">{allowanceRow(row.amount)}</th>
              {columns.map((column, k) => {
                const cell = column[rank];
                return (
                  <td key={PATHS[k]} className={PATHS[k] === "same" ? "yours" : ""}>
                    {cell ? offeredFraction(cell.offered, cell.members.length) : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function endedByStat(lives: readonly Life[]): Partial<Record<Stat, number>> {
  const counts: Partial<Record<Stat, number>> = {};
  for (const life of lives) if (life.over) counts[life.over] = (counts[life.over] ?? 0) + 1;
  return counts;
}
