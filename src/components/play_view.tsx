import { useEffect, useRef, useState } from "react";

import {
  describeEvent,
  optionCost,
  optionLabel,
  routineDetail,
  routineTileLabel,
  shortfallReason,
  weekLabel,
} from "../copy/scenes";
import {
  budgetLine,
  CANNOT_PAY,
  FEED_TITLE,
  LIMITED_TITLE,
  LOW_NOTE,
  NEXT,
  optionAfterLine,
  oneOffLine,
  overflowLine,
  SECTION,
  SPEED_LABELS,
  statBars,
  statusItems,
  STEP,
  TIMETABLE_TITLE,
  weekStatusLine,
  weeksLeftLine,
} from "../copy/screen";
import { WEEKS } from "../engine/calendar";
import type { Event, PricedOption } from "../engine/events";
import type { OptionKey, RoutineKey } from "../engine/facts";
import type { Life } from "../engine/life";
import { isLimited, isOpen, ROUTINES, type RoutineSpec } from "../engine/routine";
import { planWeek } from "../engine/week";

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
  readonly timetable: readonly RoutineKey[];
  readonly speed: Speed;
  readonly feed: readonly FeedEntry[];
  readonly onTimetable: (timetable: readonly RoutineKey[]) => void;
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
        <EventPanel
          event={event}
          life={life}
          week={week}
          timetable={props.timetable}
          onChoose={props.onChoose}
          onNext={props.onNext}
        />
      ) : (
        <>
          <Timetable
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
  life,
  week,
  timetable,
  onChoose,
  onNext,
}: {
  event: Event;
  life: Life;
  week: number;
  timetable: readonly RoutineKey[];
  onChoose: (option: OptionKey) => void;
  onNext: () => void;
}) {
  const text = describeEvent(event);
  const preview = planWeek(life, week, timetable);
  // An option's hours replace any one-off booked before, so they are added to the routines alone.
  const bookedHours = life.oneOff.weeks > 0 ? life.oneOff.hours / life.oneOff.weeks : 0;
  const routineHours = preview.hours - bookedHours;
  const after = (option: PricedOption) =>
    optionAfterLine({
      hoursLeft: preview.budget - routineHours - option.hours / option.weeks,
      weeks: option.weeks,
      moneyAfter: life.money - option.money + (option.pay ?? 0),
    });
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
      {event.options.length ? (
        <div className="week-status-block">
          <p className="week-status">{weekStatusLine(preview.hours, preview.budget, life.money)}</p>
          <HourBar budget={preview.budget} preview={preview} oneOffHours={bookedHours} />
        </div>
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
              {option.shortfall ? null : <span className="after">{after(option)}</span>}
            </button>
          ))
        ) : (
          <NextButton label={text.next ?? NEXT} onClick={onNext} />
        )}
      </div>
    </div>
  );
}

function Timetable({
  life,
  week,
  timetable,
  onChange,
}: {
  life: Life;
  week: number;
  timetable: readonly RoutineKey[];
  onChange: (timetable: readonly RoutineKey[]) => void;
}) {
  const [pressed, setPressed] = useState<RoutineSpec | null>(null);
  const preview = planWeek(life, week, timetable);
  const toggle = (spec: RoutineSpec) => {
    setPressed(spec);
    onChange(
      timetable.includes(spec.key)
        ? timetable.filter((key) => key !== spec.key)
        : [...timetable, spec.key],
    );
  };
  const oneOffHours = life.oneOff.weeks > 0 ? life.oneOff.hours / life.oneOff.weeks : 0;
  return (
    <div className="timetable">
      <h3 className="activity-section">{TIMETABLE_TITLE}</h3>
      <WeekBar budget={preview.budget} preview={preview} oneOffHours={oneOffHours} />
      <p className="activity-detail" aria-live="polite">
        {pressed ? routineDetail(pressed) : ""}
      </p>
      {groups(week).map(({ key, title, specs }) => (
        <div className={key === "limited" ? "activity-group limited" : "activity-group"} key={key}>
          <h4 className="activity-section">{title}</h4>
          <div className="tiles">
            {specs.map((spec) => {
              const chosen = timetable.includes(spec.key);
              const dropped = preview.dropped.includes(spec.key);
              const hours = `週${spec.weeklyHours}時間`;
              const cost = isLimited(spec)
                ? `${hours}・${weeksLeftLine(spec.until - week)}`
                : hours;
              return (
                <button
                  key={spec.key}
                  type="button"
                  className={["activity", chosen ? "chosen" : "", dropped ? "dropped" : ""]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={chosen}
                  aria-label={routineDetail(spec)}
                  onClick={() => toggle(spec)}
                >
                  <span className="activity-name">{routineTileLabel(spec.key)}</span>
                  <span className="activity-cost">{dropped ? CANNOT_PAY : cost}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Open routines grouped for the tiles: limited-time preparation first, when there is any. */
function groups(week: number) {
  const open = ROUTINES.filter((spec) => isOpen(spec, week));
  const limited = open.filter(isLimited);
  return [
    ...(limited.length ? [{ key: "limited", title: LIMITED_TITLE, specs: limited }] : []),
    ...(["job", "life", "work"] as const).map((kind) => ({
      key: kind,
      title: SECTION[kind],
      specs: open.filter((spec) => spec.kind === kind && !isLimited(spec)),
    })),
  ];
}

function WeekBar({
  budget,
  preview,
  oneOffHours,
}: {
  budget: number;
  preview: ReturnType<typeof planWeek>;
  oneOffHours: number;
}) {
  return (
    <div className="time-bar">
      <p className="time-total">{budgetLine(preview.hours, budget)}</p>
      <HourBar budget={budget} preview={preview} oneOffHours={oneOffHours} />
      {oneOffHours ? <p className="time-left">{oneOffLine(oneOffHours)}</p> : null}
      {preview.shortHours ? <p className="time-over">{overflowLine(preview.shortHours)}</p> : null}
    </div>
  );
}

/** The week's hours as one bar: one-offs, job hunting, oneself, then hours over the budget. */
function HourBar({
  budget,
  preview,
  oneOffHours,
}: {
  budget: number;
  preview: ReturnType<typeof planWeek>;
  oneOffHours: number;
}) {
  const hoursOf = (kind: RoutineSpec["kind"]) =>
    preview.taken
      .filter((spec) => spec.kind === kind)
      .reduce((sum, spec) => sum + spec.weeklyHours, 0);
  const scale = Math.max(budget, preview.hours) || 1;
  const width = (hours: number) => `${(hours / scale) * 100}%`;
  const oneOff = Math.min(oneOffHours, budget);
  const job = Math.min(hoursOf("job"), budget - oneOff);
  const own = Math.min(hoursOf("life") + hoursOf("work"), budget - oneOff - job);
  return (
    <div className="bar" aria-hidden="true">
      <span className="bar-oneoff" style={{ width: width(oneOff) }} />
      <span className="bar-job" style={{ width: width(job) }} />
      <span className="bar-life" style={{ width: width(own) }} />
      <span className="bar-over" style={{ width: width(preview.shortHours) }} />
    </div>
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
