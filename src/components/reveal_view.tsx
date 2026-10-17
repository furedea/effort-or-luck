import { useEffect, useRef, type ReactNode } from "react";

import {
  actualRate,
  allowanceRow,
  bandSummary,
  LONG_RUN_NOTE,
  LONG_RUN_PENDING,
  longRunRate,
  offeredCount,
  profileText,
  revealLead,
  SAME_LUCK,
  sourceCredit,
  SOURCES_LINK,
  VIEWS,
  resultLine,
  YEAR_END,
  type Subject,
  type View,
} from "../copy/screen";
import { STATISTICS } from "../data/statistics";
import { revealByAllowance } from "../engine/cohort";
import type { Effort, SceneId } from "../engine/facts";
import type { Life } from "../engine/life";
import { useLongRun } from "./use_long_run";

interface Props {
  readonly paths: Readonly<Record<View, readonly Life[]>>;
  readonly ranks: readonly number[];
  readonly player: number;
  readonly view: View;
  readonly onView: (view: View) => void;
  /** The effort the selves attempted each month, to estimate what those choices usually lead to. */
  readonly wants: Readonly<Partial<Record<SceneId, Effort>>>;
  /** Whose year this is: the player's own, or someone else's opened from a shared link. */
  readonly subject: Subject;
  /** Buttons at the bottom, such as playing again or sharing. */
  readonly actions: ReactNode;
}

export function RevealView(props: Props) {
  const { paths, ranks, player, view, onView, wants, subject, actions } = props;
  const you = paths.same[player];
  const shown = paths[view];
  const rows = revealByAllowance(shown, ranks);
  const longRun = useLongRun(wants, view);
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

      <div className="bands-block">
        <p className="lead">{revealLead(shown.length)}</p>
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
                    className={[shown[i]?.offers.length ? "offer" : "", i === player ? "you" : ""]
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
        <p className="long-run-note">{longRun ? LONG_RUN_NOTE : LONG_RUN_PENDING}</p>
        <p className="lead small">{SAME_LUCK}</p>
        <div className="toggles">
          {VIEWS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className="toggle"
              aria-pressed={view === key}
              onClick={() => onView(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <aside className="stat">
        <p>{actualRate()}</p>
        <cite>{sourceCredit(STATISTICS.offersJuneActual.source)}</cite>
      </aside>
      <div className="reveal-actions">
        {actions}
        <a className="sources-link" href="/sources">
          {SOURCES_LINK}
        </a>
      </div>
    </section>
  );
}
