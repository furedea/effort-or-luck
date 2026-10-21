import { BAR_LABELS, barLegendItem } from "../copy/screen";
import type { RoutineSpec } from "../engine/routine";
import type { WeekOutcome } from "../engine/week";

type BarPart = keyof typeof BAR_LABELS;

/**
 * The week's hours as one bar, with a legend naming each part present: one-offs, job hunting,
 * oneself, part-time work, then hours over the budget.
 */
export function HourBar({
  budget,
  preview,
  oneOffHours,
}: {
  budget: number;
  preview: WeekOutcome;
  oneOffHours: number;
}) {
  const hoursOf = (kind: RoutineSpec["kind"]) =>
    preview.taken
      .filter((spec) => spec.kind === kind)
      .reduce((sum, spec) => sum + spec.weeklyHours, 0);
  const hours: Record<BarPart, number> = {
    oneOff: oneOffHours,
    job: hoursOf("job"),
    study: hoursOf("study"),
    life: hoursOf("life"),
    work: hoursOf("work"),
    over: preview.shortHours,
  };
  const scale = Math.max(budget, preview.hours) || 1;
  let room = budget;
  const drawn = (part: BarPart) => {
    if (part === "over") return hours.over;
    const inside = Math.min(hours[part], Math.max(0, room));
    room -= inside;
    return inside;
  };
  const parts = (Object.keys(BAR_LABELS) as BarPart[]).map((part) => ({
    part,
    width: drawn(part),
  }));
  const present = (Object.keys(BAR_LABELS) as BarPart[]).filter((part) => hours[part] > 0);
  return (
    <>
      <div className="bar" aria-hidden="true">
        {parts.map(({ part, width }) => (
          <span
            key={part}
            className={`bar-${part}`}
            style={{ width: `${(width / scale) * 100}%` }}
          />
        ))}
      </div>
      {present.length ? (
        <ul className="bar-legend">
          {present.map((part) => (
            <li key={part}>
              <i className={`bar-${part}`} aria-hidden="true" />
              {barLegendItem(BAR_LABELS[part], hours[part])}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
