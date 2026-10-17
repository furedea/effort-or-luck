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
  LOW_NOTE,
  NEXT,
  oneOffLine,
  overflowLine,
  PAUSE,
  PLAY,
  SECTION,
  statBars,
  statusItems,
  TIMETABLE_TITLE,
} from "../copy/screen";
import { WEEKS } from "../engine/calendar";
import type { Event } from "../engine/events";
import type { OptionKey, RoutineKey } from "../engine/facts";
import type { Life } from "../engine/life";
import { isOpen, ROUTINES, type RoutineSpec } from "../engine/routine";
import { planWeek } from "../engine/week";

interface Props {
  readonly life: Life;
  readonly week: number;
  /** The player's event this week, or null while weeks are flowing. */
  readonly event: Event | null;
  readonly timetable: readonly RoutineKey[];
  readonly playing: boolean;
  /** A line about what happened since the last stop, or a warning. */
  readonly notice: string | null;
  readonly onTimetable: (timetable: readonly RoutineKey[]) => void;
  readonly onPlay: () => void;
  readonly onPause: () => void;
  readonly onChoose: (option: OptionKey) => void;
  readonly onNext: () => void;
}

export function PlayView(props: Props) {
  const { life, week, event, playing, notice } = props;
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
        {notice ? <p className="carried">{notice}</p> : null}
        <h2 className="when" ref={heading} tabIndex={-1}>
          {weekLabel(week)}
        </h2>
        <Status life={life} />
      </header>
      {event ? (
        <EventPanel event={event} onChoose={props.onChoose} onNext={props.onNext} />
      ) : (
        <>
          <Timetable
            life={life}
            week={week}
            timetable={props.timetable}
            onChange={props.onTimetable}
          />
          <div className="actions">
            <button
              type="button"
              className="next flow"
              onClick={playing ? props.onPause : props.onPlay}
            >
              {playing ? PAUSE : PLAY}
            </button>
          </div>
        </>
      )}
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
      {(["job", "life", "work"] as const).map((kind) => (
        <div className="activity-group" key={kind}>
          <h4 className="activity-section">{SECTION[kind]}</h4>
          <div className="tiles">
            {ROUTINES.filter((spec) => spec.kind === kind && isOpen(spec, week)).map((spec) => {
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
                    {dropped ? CANNOT_PAY : `週${spec.weeklyHours}時間`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
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
    <div className="time-bar">
      <p className="time-total">{budgetLine(preview.hours, budget)}</p>
      <div className="bar" aria-hidden="true">
        <span className="bar-oneoff" style={{ width: width(oneOff) }} />
        <span className="bar-job" style={{ width: width(job) }} />
        <span className="bar-life" style={{ width: width(own) }} />
        <span className="bar-over" style={{ width: width(preview.shortHours) }} />
      </div>
      {oneOffHours ? <p className="time-left">{oneOffLine(oneOffHours)}</p> : null}
      {preview.shortHours ? (
        <p className="time-over">{overflowLine(preview.shortHours, preview.paid)}</p>
      ) : null}
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
