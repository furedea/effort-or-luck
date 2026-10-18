import { useEffect, useRef, useState } from "react";

import { yen } from "../copy/format";
import {
  describeEvent,
  optionCost,
  optionLabel,
  routineDetail,
  routineEffects,
  routineTileLabel,
  shortfallReason,
  weekLabel,
} from "../copy/scenes";
import {
  BAR_LABELS,
  barLegendItem,
  budgetLine,
  CANNOT_PAY,
  CHOSEN_LABEL,
  removeLabel,
  CARD_TITLES,
  CLEAR_ALL,
  LIMITED_TITLE,
  HISTORY_TITLE,
  LOW_NOTE,
  lostHoursLine,
  monthlyBreakdown,
  NEXT,
  optionRoom,
  oneOffLine,
  slackLine,
  PAUSE_HEAD,
  pauseLines,
  type PauseReason,
  savingsAfterLine,
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
import type { LostReason, OptionKey, RoutineKey } from "../engine/facts";
import type { Life } from "../engine/life";
import { isAvailable, isLimited, ROUTINES, type RoutineSpec } from "../engine/routine";
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
  readonly pausedFor: PauseReason | null;
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
      <header className="play-head">
        <h2 className="when" ref={heading} tabIndex={-1}>
          {weekLabel(week)}
        </h2>
        <div className="progress-bar" aria-hidden="true">
          <span style={{ width: `${(Math.min(week, WEEKS) / WEEKS) * 100}%` }} />
        </div>
      </header>
      <div className="card status-card">
        <Status life={life} />
      </div>
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
            {props.pausedFor ? (
              <p className="paused-note" role="status">
                <span className="paused-head">{PAUSE_HEAD}</span>
                <span className="paused-text">
                  {pauseLines(props.pausedFor).map((line) => (
                    <span key={line} className="paused-line">
                      {line}
                    </span>
                  ))}
                </span>
              </p>
            ) : null}
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

/** The latest happening that did not stop time, in one line. */
function Feed({ entries }: { entries: readonly FeedEntry[] }) {
  const [latest] = entries;
  if (!latest) return null;
  // The latest line stays in view; the whole history opens from it without taking room.
  return (
    <details className="history">
      <summary>
        <span className="feed-entry" aria-live="polite">
          <span className="feed-when">{weekLabel(latest.week)}</span>
          {latest.text}
        </span>
        <span className="history-open">{HISTORY_TITLE}</span>
      </summary>
      <ul>
        {entries.map(({ week, text }, k) => (
          <li key={k}>
            <span className="feed-when">{weekLabel(week)}</span>
            {text}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The monthly flow under savings; its parts open on demand. */
function MoneyDetail({ life }: { life: Life }) {
  const { summary, rows } = monthlyBreakdown(life);
  return (
    <details className="money-detail">
      <summary>{summary}</summary>
      <dl>
        {rows.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function Status({ life }: { life: Life }) {
  const items = statusItems({ money: life.money, offers: life.offers.length });
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
      <MoneyDetail life={life} />
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
  const roomOf = (option: PricedOption) =>
    optionRoom(preview.budget - routineHours - option.hours / option.weeks);
  return (
    <div className="event">
      <div className="card">
        <h3 className="card-title">{CARD_TITLES.event}</h3>
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
            <p className="week-status">
              {weekStatusLine(preview.hours, preview.budget, life.money)}
            </p>
            <HourBar budget={preview.budget} preview={preview} oneOffHours={bookedHours} />
          </div>
        ) : null}
      </div>
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
              {option.shortfall ? null : (
                <OptionRoom
                  room={roomOf(option)}
                  savings={
                    option.money || option.pay
                      ? savingsAfterLine(life.money - option.money + (option.pay ?? 0))
                      : null
                  }
                />
              )}
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
  const preview = planWeek(life, week, timetable);
  const toggle = (spec: RoutineSpec) => {
    onChange(
      timetable.includes(spec.key)
        ? timetable.filter((key) => key !== spec.key)
        : [...timetable, spec.key],
    );
  };
  const oneOffHours = life.oneOff.weeks > 0 ? life.oneOff.hours / life.oneOff.weeks : 0;
  // A tab chosen before limited-time tiles opened gives way to them once.
  const [chosen, setChosen] = useState({ key: "job", week: -1 });
  const setTab = (key: string) => setChosen({ key, week });
  const shown = groups(week, life);
  const openedAt = Math.max(
    -1,
    ...(shown.find((g) => g.key === "limited")?.specs.map((spec) => spec.from) ?? []),
  );
  const tab = openedAt > chosen.week ? "limited" : chosen.key;
  const group = shown.find((g) => g.key === tab) ?? shown[0];
  return (
    <div className="card timetable">
      <div className="timetable-head">
        <h3 className="activity-section">{TIMETABLE_TITLE}</h3>
        <button
          type="button"
          className="toggle clear-all"
          disabled={timetable.length === 0}
          onClick={() => onChange([])}
        >
          {CLEAR_ALL}
        </button>
      </div>
      {/* The bar, its legend, and the chosen tiles read as one block, so they sit close. */}
      <div className="week-summary">
        <WeekBar
          budget={preview.budget}
          preview={preview}
          oneOffHours={oneOffHours}
          lost={
            life.lostWeeks > 0 && life.lostReason
              ? { reason: life.lostReason, weekly: life.lostWeekly, weeks: life.lostWeeks }
              : null
          }
        />
        {timetable.length ? (
          <ul className="chosen-chips" aria-label={CHOSEN_LABEL}>
            {timetable.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  className="chip"
                  aria-label={removeLabel(routineTileLabel(key))}
                  onClick={() => onChange(timetable.filter((k) => k !== key))}
                >
                  {routineTileLabel(key)} <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="tabs" role="tablist">
        {shown.map(({ key, title }) => (
          <button
            key={key}
            type="button"
            role="tab"
            className={key === "limited" ? "tab limited" : `tab tab-${key}`}
            aria-selected={key === group?.key}
            onClick={() => setTab(key)}
          >
            {title}
          </button>
        ))}
      </div>
      {/* Every tab's tiles share one grid cell, so the tallest sets the height and switching
          tabs does not shift the screen; the hidden ones are inert. */}
      <div className="tile-stack">
        {shown.map(({ key, specs }) => (
          <div
            key={key}
            className={key === group?.key ? "tiles active" : "tiles"}
            role="tabpanel"
            inert={key !== group?.key}
          >
            {specs.map((spec) => {
              const chosen = timetable.includes(spec.key);
              const dropped = preview.dropped.includes(spec.key);
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
                  <span className="activity-cost">
                    {dropped ? CANNOT_PAY : tileCost(spec, week)}
                  </span>
                  <span className="activity-effects">{routineEffects(spec)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A tile's hours, then its weeks left or its price, e.g. "週4時間・5,000円". */
function tileCost(spec: RoutineSpec, week: number): string {
  const hours = `週${spec.weeklyHours}時間`;
  if (isLimited(spec)) return `${hours}・${weeksLeftLine(spec.until - week)}`;
  if (spec.weeklyMoney) return `${hours}・${yen(spec.weeklyMoney)}`;
  if (spec.weeklyPay) return `${hours}・+${yen(spec.weeklyPay)}`;
  return hours;
}

/** Open routines grouped for the tiles: limited-time preparation first, when there is any. */
function groups(week: number, life: Life) {
  const open = ROUTINES.filter((spec) => isAvailable(spec, week, life));
  const limited = open.filter(isLimited);
  return [
    ...(limited.length ? [{ key: "limited", title: LIMITED_TITLE, specs: limited }] : []),
    ...(["job", "study", "life", "work"] as const).map((kind) => ({
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
  lost,
}: {
  budget: number;
  preview: ReturnType<typeof planWeek>;
  oneOffHours: number;
  /** Hours lost this week and why, when any are. */
  lost: { reason: LostReason; weekly: number; weeks: number } | null;
}) {
  const slack = slackLine(preview.shortHours, Math.max(0, budget - preview.hours));
  return (
    <div className="time-bar">
      <p className="time-total">{budgetLine(preview.hours, budget)}</p>
      <HourBar budget={budget} preview={preview} oneOffHours={oneOffHours} />
      {lost ? (
        <p className="time-left">{lostHoursLine(lost.reason, lost.weekly, lost.weeks)}</p>
      ) : null}
      {oneOffHours ? <p className="time-left">{oneOffLine(oneOffHours)}</p> : null}
      {slack ? <p className={preview.shortHours ? "time-over" : "time-spare"}>{slack}</p> : null}
    </div>
  );
}

type BarPart = keyof typeof BAR_LABELS;

/**
 * The week's hours as one bar, with a legend naming each part present: one-offs, job hunting,
 * oneself, part-time work, then hours over the budget.
 */
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

/** The hours an option leaves this week, large beside it, with savings when money moves. */
function OptionRoom({
  room,
  savings,
}: {
  room: ReturnType<typeof optionRoom>;
  savings: string | null;
}) {
  return (
    <span className={room.over ? "room-block over" : "room-block"}>
      <span className="room">
        <span className="room-caption">{room.caption}</span>
        <span className="room-hours">{room.hours}</span>
      </span>
      {room.cost ? <span className="room-cost">{room.cost}</span> : null}
      {savings ? <span className="room-savings">{savings}</span> : null}
    </span>
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
