import { useEffect, useRef } from "react";

import {
  actualRate,
  allowanceRow,
  bandSummary,
  offeredCount,
  PLAY_AGAIN,
  profileText,
  revealLead,
  SAME_LUCK,
  sourceCredit,
  SOURCES_LINK,
  VIEWS,
  YEAR_END,
  yourResult,
  type View,
} from "../copy/screen";
import { STATISTICS } from "../data/statistics";
import { revealByAllowance } from "../engine/cohort";
import type { Life } from "../engine/life";

interface Props {
  readonly paths: Readonly<Record<View, readonly Life[]>>;
  readonly ranks: readonly number[];
  readonly player: number;
  readonly view: View;
  readonly onView: (view: View) => void;
  readonly onRestart: () => void;
}

export function RevealView({ paths, ranks, player, view, onView, onRestart }: Props) {
  const you = paths.same[player];
  const shown = paths[view];
  const rows = revealByAllowance(shown, ranks);
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
        <p className="you">{yourResult(you?.offers.length ?? 0)}</p>
        <p className="profile">{you ? profileText(you.log) : ""}</p>
      </header>

      <div className="bands-block">
        <p className="lead">{revealLead(shown.length)}</p>
        <div className="bands">
          {rows.map((row) => (
            <div className="band" key={row.amount}>
              <span className="sr-only">
                {bandSummary(
                  row.amount,
                  row.members.length,
                  row.offered,
                  row.members.includes(player),
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
              </span>
            </div>
          ))}
        </div>
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
        <button type="button" className="next" onClick={onRestart}>
          {PLAY_AGAIN}
        </button>
        <a className="sources-link" href="/sources">
          {SOURCES_LINK}
        </a>
      </div>
    </section>
  );
}
