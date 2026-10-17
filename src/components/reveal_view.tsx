import {
  allowanceRow,
  offeredCount,
  pathText,
  PLAY_AGAIN,
  profileText,
  revealLead,
  SAME_LUCK,
  VIEWS,
  YEAR_END,
  YOU,
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
  const stat = STATISTICS.offersJuneActual;
  return (
    <section className="reveal">
      <h2 className="when">{YEAR_END}</h2>
      <p className="you">{yourResult(you?.offers.length ?? 0)}</p>
      <p className="profile">{you ? profileText(you.log) : ""}</p>

      <p className="lead">{revealLead(shown.length)}</p>
      <div className="bands">
        {rows.map((row) => (
          <div className="band" key={row.amount}>
            <span className="band-label">{allowanceRow(row.amount)}</span>
            <span className="dots">
              {row.members.map((i) => (
                <i
                  key={i}
                  className={[shown[i]?.offers.length ? "offer" : "", i === player ? "you" : ""]
                    .filter(Boolean)
                    .join(" ")}
                  aria-label={i === player ? YOU : undefined}
                />
              ))}
            </span>
            <span className="band-count">{offeredCount(row.offered, row.members.length)}</span>
          </div>
        ))}
      </div>

      <p className="lead">{SAME_LUCK}</p>
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
      <p className="path">{pathText(shown[player]?.log ?? [])}</p>

      <aside className="stat">
        <p>{stat.text}</p>
        <cite>{stat.source}</cite>
      </aside>
      <button type="button" className="next" onClick={onRestart}>
        {PLAY_AGAIN}
      </button>
    </section>
  );
}
