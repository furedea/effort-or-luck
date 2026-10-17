import { useEffect, useRef, useState } from "react";

import {
  describeEvent,
  optionCost,
  optionLabel,
  routineDetail,
  routineTileLabel,
  DAY_LABELS,
  DAY_STATE_LABELS,
  shortfallReason,
  weekLabel,
} from "../copy/scenes";
import {
  CANNOT_PAY,
  CLEAR_DAY,
  FEED_TITLE,
  LOW_NOTE,
  NEXT,
  overflowLine,
  SECTION,
  SPEED_LABELS,
  statBars,
  statusItems,
  STEP,
  TIMETABLE_TITLE,
} from "../copy/screen";
import { WEEKS } from "../engine/calendar";
import type { Event } from "../engine/events";
import type { OptionKey, RoutineKey } from "../engine/facts";
import type { Life } from "../engine/life";
import { fitsDay, isOpen, ROUTINES, type RoutineSpec } from "../engine/routine";
import { withDay, type Timetable } from "../engine/timetable";
import { planWeek, type DayOutcome } from "../engine/week";

/** How time moves: one week per press, or on its own at normal or double speed. */
export type Speed = keyof typeof SPEED_LABELS;

export interface FeedEntry {
  readonly week: number;
  readonly text: string;
}

interface Props {
  readonly life: Life;
  readonly week: number;
  /** The player's event this week, or null while weeks are flowing. */
  readonly event: Event | null;
  readonly timetable: Timetable;
  readonly speed: Speed;
  readonly feed: readonly FeedEntry[];
  readonly onTimetable: (timetable: Timetable) => void;
  readonly onSpeed: (speed: Speed) => void;
  readonly onStep: () => void;
  readonly onChoose: (option: OptionKey) => void;
  readonly onNext: () => void;
}

export function PlayView(props: Props) {
  const { life, week, event, speed, feed } = props;
  const heading = useRef<HTMLHeadingElement>(null);
  // An event replaces the controls the player was using, so keyboard focus moves to it.
  useEffect(() => {
    if (event) heading.current?.focus({ preventScroll: true });
  }, [event]);
  return (
    <section className="play">
      <div className="progress-bar" aria-hidden="true">
        <span style={{ width: `${(Math.min(week, WEEKS) / WEEKS) * 100}%` }} />
      </div>
      <header className="play-head">
        <h2 className="when" ref={heading} tabIndex={-1}>
          {weekLabel(week)}
        </h2>
        <Status life={life} />
      </header>
      <Feed entries={feed} />
      {event ? (
        <EventPanel event={event} onChoose={props.onChoose} onNext={props.onNext} />
      ) : (
        <>
          <WeekPlanner
            life={life}
            week={week}
            timetable={props.timetable}
            onChange={props.onTimetable}
          />
          <div className="actions">
            {speed === "step" ? (
              <button type="button" className="next step" onClick={props.onStep}>
                {STEP}
              </button>
            ) : null}
            <div className="speeds" role="group">
              {(Object.keys(SPEED_LABELS) as Speed[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className="toggle"
                  aria-pressed={speed === key}
                  onClick={() => props.onSpeed(key)}
                >
                  {SPEED_LABELS[key]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

const FEED_SHOWN = 3;

function Feed({ entries }: { entries: readonly FeedEntry[] }) {
  if (!entries.length) return null;
  return (
    <section className="feed-block">
      <h3 className="activity-section">{FEED_TITLE}</h3>
      <ul className="feed" aria-live="polite">
        {entries.slice(0, FEED_SHOWN).map(({ week, text }) => (
          <li key={`${week}${text}`}>
            <span className="feed-when">{weekLabel(week)}</span>
            {text}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Status({ life }: { life: Life }) {
  const items = statusItems({
    allowance: life.allowance,
    scholarship: life.scholarship,
    money: life.money,
    offers: life.offers.length,
  });
  return (
    <div className="status-block">
      <dl className="status">
        {items.map(({ label, value, low }) => (
          <div key={label} className={low ? "status-item low" : "status-item"}>
            <dt>{label}</dt>
            <dd>
              {value}
              {low ? <span className="sr-only">{LOW_NOTE}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
      <dl className="stat-bars">
        {statBars(life.stats).map(({ stat, label, value, low }) => (
          <div key={stat} className={low ? "stat-bar low" : "stat-bar"}>
            <dt>{label}</dt>
            <dd>
              <span className="meter" aria-hidden="true">
                <span style={{ width: `${value}%` }} />
              </span>
              <span className="meter-value">
                {value}
                {low ? <span className="sr-only">{LOW_NOTE}</span> : null}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function EventPanel({
  event,
  onChoose,
  onNext,
}: {
  event: Event;
  onChoose: (option: OptionKey) => void;
  onNext: () => void;
}) {
  const text = describeEvent(event);
  return (
    <div className="event">
      <div className="lines" aria-live="polite">
        {text.lines.map((line, k) => (
          <p key={k} style={{ animationDelay: `${k * 0.2}s` }}>
            {line}
          </p>
        ))}
      </div>
      {text.table ? (
        <dl className="status event-table">
          {text.table.map(({ label, value }) => (
            <div key={label} className="status-item">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="actions">
        {event.options.length ? (
          event.options.map((option) => (
            <button
              key={option.key}
              type="button"
              className="opt"
              disabled={option.shortfall !== null}
              onClick={() => onChoose(option.key)}
            >
              <span className="label">{optionLabel(option, event.facts)}</span>
              <span className="cost">
                {option.shortfall ? shortfallReason(option.shortfall) : optionCost(option)}
              </span>
            </button>
          ))
        ) : (
          <NextButton label={text.next ?? NEXT} onClick={onNext} />
        )}
      </div>
    </div>
  );
}

function WeekPlanner({
  life,
  week,
  timetable,
  onChange,
}: {
  life: Life;
  week: number;
  timetable: Timetable;
  onChange: (timetable: Timetable) => void;
}) {
  const preview = planWeek(life, week, timetable);
  const plannable = (day: number) => {
    const kind = preview.days[day]?.kind;
    return kind !== "partTime" && kind !== "event" && kind !== "lost";
  };
  const [selected, setSelected] = useState(() => DAY_LABELS.findIndex((_, d) => plannable(d)));
  const [pressed, setPressed] = useState<RoutineSpec | null>(null);
  const day = plannable(selected) ? selected : -1;
  const put = (key: RoutineKey | null) => {
    if (day < 0) return;
    onChange(withDay(timetable, day, key));
    const next = DAY_LABELS.findIndex((_, d) => d > day && plannable(d));
    if (next >= 0) setSelected(next);
  };
  return (
    <div className="timetable">
      <h3 className="activity-section">{TIMETABLE_TITLE}</h3>
      <div className="days">
        {DAY_LABELS.map((label, d) => (
          <DayCell
            key={label}
            label={label}
            outcome={preview.days[d]}
            planned={timetable[d] ?? null}
            selected={d === day}
            onSelect={() => setSelected(d)}
          />
        ))}
      </div>
      {preview.shortHours ? (
        <p className="time-over">{overflowLine(preview.shortHours, preview.paid)}</p>
      ) : null}
      <p className="activity-detail" aria-live="polite">
        {pressed ? routineDetail(pressed) : ""}
      </p>
      {(["job", "life", "work"] as const).map((kind) => (
        <div className="activity-group" key={kind}>
          <h4 className="activity-section">{SECTION[kind]}</h4>
          <div className="tiles">
            {ROUTINES.filter((spec) => spec.kind === kind && isOpen(spec, week)).map((spec) => (
              <button
                key={spec.key}
                type="button"
                className={timetable[day] === spec.key ? "activity chosen" : "activity"}
                aria-pressed={timetable[day] === spec.key}
                aria-label={routineDetail(spec)}
                disabled={day < 0 || !fitsDay(spec, week, day)}
                onClick={() => {
                  setPressed(spec);
                  put(spec.key);
                }}
              >
                <span className="activity-name">{routineTileLabel(spec.key)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        className="toggle clear-day"
        disabled={day < 0}
        onClick={() => put(null)}
      >
        {CLEAR_DAY}
      </button>
    </div>
  );
}

function DayCell({
  label,
  outcome,
  planned,
  selected,
  onSelect,
}: {
  label: string;
  outcome: DayOutcome | undefined;
  planned: RoutineKey | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const kind = outcome?.kind ?? "idle";
  const fixed = kind === "partTime" || kind === "event" || kind === "lost";
  const plan = fixed
    ? DAY_STATE_LABELS[kind]
    : kind === "dropped"
      ? CANNOT_PAY
      : planned
        ? routineTileLabel(planned)
        : "—";
  return (
    <button
      type="button"
      className={["day", `day-${kind}`, selected ? "selected" : ""].filter(Boolean).join(" ")}
      aria-pressed={selected}
      disabled={fixed}
      onClick={onSelect}
    >
      <span className="day-label">{label}</span>
      <span className="day-plan">{plan}</span>
    </button>
  );
}

function NextButton({ label, onClick }: { label: string; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <button ref={ref} type="button" className="next" onClick={onClick}>
      {label}
    </button>
  );
}
