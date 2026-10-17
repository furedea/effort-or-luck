import { cellLabel, GRID_LABEL, LEGEND, legendAllowance } from "../copy/screen";
import { outcome } from "../engine/choice";
import type { Life } from "../engine/life";
import { ALLOWANCE_DISTRIBUTION } from "../engine/parameters";

interface Props {
  readonly lives: readonly Life[];
  readonly ranks: readonly number[];
  readonly blocked: ReadonlySet<number>;
  readonly focus: number;
  readonly onFocus: (index: number) => void;
}

export function SelfGrid({ lives, ranks, blocked, focus, onFocus }: Props) {
  return (
    <div className="cells" role="group" aria-label={GRID_LABEL}>
      {lives.map((life, i) => {
        const result = outcome(life);
        const className = [
          "cell",
          `l${ranks[i]}`,
          result === "none" ? "" : result,
          blocked.has(i) ? "blocked" : "",
          i === focus ? "sel" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={life.seed}
            type="button"
            className={className}
            aria-label={cellLabel(i, life.log[0])}
            aria-pressed={i === focus}
            onClick={() => onFocus(i)}
          />
        );
      })}
    </div>
  );
}

export function Legend({ ranks }: { ranks: readonly number[] }) {
  return (
    <div className="legend">
      {ALLOWANCE_DISTRIBUTION.map(([amount], k) => (
        <span key={amount}>
          <i className={`l${k}`} />
          {legendAllowance(amount, ranks.filter((rank) => rank === k).length)}
        </span>
      ))}
      {(["early", "offer", "blocked"] as const).map((kind) => (
        <span key={kind}>
          <i className={kind} />
          {LEGEND[kind]}
        </span>
      ))}
    </div>
  );
}
