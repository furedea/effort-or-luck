import { useRef, useState } from "react";

import { describeEvent, optionCost, optionLabel, shortfallReason, weekLabel } from "../copy/scenes";
import {
  CARD_TITLES,
  HISTORY_TITLE,
  LOW_NOTE,
  monthlyBreakdown,
  NEXT,
  optionRoom,
  PAUSE_HEAD,
  pauseLines,
  REST_PICK_BACK,
  REST_PICK_CONFIRM,
  restStatusLine,
  type PauseReason,
  SPEED_LABELS,
  statBars,
  statusItems,
  STEP,
  weekStatusLine,
} from "../copy/screen";
import { WEEKS } from "../engine/calendar";
import type { Event, PricedOption } from "../engine/events";
import type { OptionKey, RoutineKey } from "../engine/facts";
import type { Life } from "../engine/life";
import { planWeek, type WeekOutcome } from "../engine/week";
import { HourBar } from "./hour_bar";
import { Timetable } from "./timetable";
import { useFocusNextFrame } from "./use_focus_next_frame";

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
  /** Takes `option`, following `booking` instead of the usual timetable while its hours last. */
  readonly onChoose: (option: OptionKey, booking: readonly RoutineKey[] | null) => void;
  /** Changes the timetable followed while the current booking lasts. */
  readonly onBooking: (timetable: readonly RoutineKey[]) => void;
  readonly onNext: () => void;
}

export function PlayView(props: Props) {
  const { life, week, event, speed, feed } = props;
  const heading = useRef<HTMLHeadingElement>(null);
  // An event replaces the controls the player was using, so keyboard focus moves to it.
  useFocusNextFrame(heading, event);
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
          {life.oneOff.weeks > 0 && life.oneOff.timetable ? (
            <Timetable
              life={life}
              week={week}
              timetable={life.oneOff.timetable}
              onChange={props.onBooking}
              booking={{ weeks: life.oneOff.weeks, usual: props.timetable }}
            />
          ) : (
            <Timetable
              life={life}
              week={week}
              timetable={props.timetable}
              onChange={props.onTimetable}
            />
          )}
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
              <span className="meter-value">
                {value}
                {low ? <span className="sr-only">{LOW_NOTE}</span> : null}
              </span>
              <span className="meter" aria-hidden="true">
                <span style={{ width: `${value}%` }} />
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
  onChoose: (option: OptionKey, booking: readonly RoutineKey[] | null) => void;
  onNext: () => void;
}) {
  const text = describeEvent(event);
  const [picking, setPicking] = useState<PricedOption | null>(null);
  const [draft, setDraft] = useState<readonly RoutineKey[]>(timetable);
  // An option's hours replace any one-off booked before; the hours it adds beyond the sleep the
  // timetable already cuts are the hours short, for which the player picks tiles to rest.
  const unbooked = planWeek(withBooking(life, 0, 0), week, timetable);
  const planOf = (option: PricedOption) =>
    planWeek(withBooking(life, option.hours, option.weeks), week, timetable);
  const roomOf = (option: PricedOption) => {
    const plan = planOf(option);
    return optionRoom({
      spare: plan.budget - plan.hours,
      short: plan.shortHours,
      need: plan.shortHours - unbooked.shortHours,
    });
  };
  const take = (option: PricedOption) => {
    if (planOf(option).shortHours <= unbooked.shortHours) return onChoose(option.key, null);
    setDraft(timetable);
    setPicking(option);
  };
  const booked = picking ? withBooking(life, picking.hours, picking.weeks) : null;
  return (
    <div className="event">
      <EventCard
        text={text}
        life={life}
        preview={event.options.length && !picking ? planWeek(life, week, timetable) : null}
      />
      {picking && booked ? (
        <Timetable
          life={booked}
          week={week}
          timetable={draft}
          onChange={setDraft}
          booking={{ weeks: picking.weeks, usual: timetable }}
        />
      ) : null}
      <div className="actions">
        {picking && booked ? (
          <RestPick
            plan={planWeek(booked, week, draft)}
            onConfirm={() => onChoose(picking.key, draft)}
            onBack={() => setPicking(null)}
          />
        ) : event.options.length ? (
          event.options.map((option) => (
            <button
              key={option.key}
              type="button"
              className="opt"
              disabled={option.shortfall !== null}
              onClick={() => take(option)}
            >
              <span className="label">{optionLabel(option, event.facts)}</span>
              <span className="cost">
                {option.shortfall ? shortfallReason(option.shortfall) : optionCost(option)}
              </span>
              {option.shortfall ? null : <OptionRoom room={roomOf(option)} />}
            </button>
          ))
        ) : (
          <NextButton label={text.next ?? NEXT} onClick={onNext} />
        )}
      </div>
    </div>
  );
}

/** The event's lines and figures, with the week so far when `preview` is given. */
function EventCard({
  text,
  life,
  preview,
}: {
  text: ReturnType<typeof describeEvent>;
  life: Life;
  preview: WeekOutcome | null;
}) {
  const bookedHours = life.oneOff.weeks > 0 ? life.oneOff.hours / life.oneOff.weeks : 0;
  return (
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
      {preview ? (
        <div className="week-status-block">
          <p className="week-status">{weekStatusLine(preview.hours, preview.budget, life.money)}</p>
          <HourBar budget={preview.budget} preview={preview} oneOffHours={bookedHours} />
        </div>
      ) : null}
    </div>
  );
}

/** Hours short with the rest tiles picked so far, and the buttons to take or leave the option. */
function RestPick({
  plan,
  onConfirm,
  onBack,
}: {
  plan: WeekOutcome;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <p className={plan.shortHours > 0 ? "rest-status over" : "rest-status"}>
        {restStatusLine(plan.shortHours)}
      </p>
      <button type="button" className="rest-confirm" onClick={onConfirm}>
        {REST_PICK_CONFIRM}
      </button>
      <button type="button" className="toggle" onClick={onBack}>
        {REST_PICK_BACK}
      </button>
    </>
  );
}

/** What an option does to the week, beside it; savings show in the status above. */
function OptionRoom({ room }: { room: ReturnType<typeof optionRoom> }) {
  return (
    <span className={room.over ? "room-block over" : "room-block"}>
      <span className="room-head">{room.head}</span>
      {room.sub ? <span className="room-sub">{room.sub}</span> : null}
    </span>
  );
}

/** The life as if `hours` were booked over `weeks` on the usual timetable, for planning only. */
function withBooking(life: Life, hours: number, weeks: number): Life {
  return { ...life, oneOff: { hours, weeks, timetable: null } };
}

function NextButton({ label, onClick }: { label: string; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useFocusNextFrame(ref, true);
  return (
    <button ref={ref} type="button" className="next" onClick={onClick}>
      {label}
    </button>
  );
}
