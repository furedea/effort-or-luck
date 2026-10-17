import { describeLog } from "../copy/scenes";
import {
  pathText,
  PLAY_AGAIN,
  SAME_LUCK,
  selfName,
  TRY_OTHER_CHOICES,
  VIEWS,
  yearEndSummary,
  type View,
} from "../copy/screen";
import { STATISTICS } from "../data/statistics";
import type { Life } from "../engine/life";
import { Segments, Stats } from "./text";

interface Props {
  readonly paths: Readonly<Record<View, readonly Life[]>>;
  readonly view: View;
  readonly focus: number;
  readonly onView: (view: View) => void;
  readonly onRestart: () => void;
}

export function YearEndView({ paths, view, focus, onView, onRestart }: Props) {
  const lives = paths[view];
  const offered = lives.filter((life) => life.offers.length > 0).length;
  const early = lives.filter((life) => life.offers.includes("december")).length;
  const profile = paths.same[focus]?.log[0];
  return (
    <>
      <p className="group">
        <Segments segments={yearEndSummary(view, offered, early, lives.length)} />
      </p>
      <Stats stats={[STATISTICS.offersJuneActual]} />
      <div className="focus">
        <div className="focus-head">
          <span>
            <b>{selfName(focus)}</b>
            {profile ? `　${describeLog(profile)}` : ""}
          </span>
          <span>{SAME_LUCK}</span>
        </div>
        <div className="detail">
          <dl>
            {VIEWS.map(([key, label]) => (
              <div key={key} style={{ display: "contents" }}>
                <dt className={key === view ? "on" : ""}>{label}</dt>
                <dd>{pathText(paths[key][focus]?.log ?? [])}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="story">
        <p className="outcome">{TRY_OTHER_CHOICES}</p>
        <div className="row">
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
        <div className="row">
          <button type="button" className="next" onClick={onRestart}>
            {PLAY_AGAIN}
          </button>
        </div>
      </div>
    </>
  );
}
