import { useState } from "react";

import { yen } from "../copy/format";
import { routineDetail, routineEffects, routineTileLabel } from "../copy/scenes";
import {
  BOOKING_NOTE,
  bookingTitle,
  budgetLine,
  CANNOT_PAY,
  CHOSEN_LABEL,
  CLEAR_ALL,
  LIMITED_TITLE,
  lostHoursLine,
  oneOffLine,
  removeLabel,
  RESET_TO_USUAL,
  SECTION,
  slackLine,
  TIMETABLE_TITLE,
  weeksLeftLine,
} from "../copy/screen";
import type { RoutineKey } from "../engine/facts";
import type { HourLoss, Life } from "../engine/life";
import {
  areAlternatives,
  isAvailable,
  isLimited,
  routineOf,
  ROUTINES,
  type RoutineSpec,
} from "../engine/routine";
import { planWeek, type WeekOutcome } from "../engine/week";
import { HourBar } from "./hour_bar";

/** The booking a timetable is for, with the usual one to go back to. */
interface Booking {
  readonly weeks: number;
  readonly usual: readonly RoutineKey[];
}

interface Group {
  readonly key: string;
  readonly title: string;
  readonly specs: readonly RoutineSpec[];
}

export function Timetable({
  life,
  week,
  timetable,
  onChange,
  booking = null,
}: {
  life: Life;
  week: number;
  timetable: readonly RoutineKey[];
  onChange: (timetable: readonly RoutineKey[]) => void;
  /** The booking this timetable is for, with the usual one to go back to; null for the usual. */
  booking?: Booking | null;
}) {
  const preview = planWeek(life, week, timetable);
  const takeOut = (key: RoutineKey) => onChange(timetable.filter((k) => k !== key));
  const toggle = (spec: RoutineSpec) => {
    if (timetable.includes(spec.key)) takeOut(spec.key);
    // Part-time amounts are one choice: picking one replaces the other.
    else onChange([...timetable.filter((k) => !areAlternatives(spec, routineOf(k))), spec.key]);
  };
  // A paid tile the savings left this week cannot cover is not offered at all.
  const paymentOf = (spec: RoutineSpec, chosen: boolean): Payment =>
    !chosen && spec.weeklyMoney > life.money - preview.paid
      ? "unaffordable"
      : preview.dropped.includes(spec.key)
        ? "dropped"
        : "payable";
  const oneOffHours = life.oneOff.weeks > 0 ? life.oneOff.hours / life.oneOff.weeks : 0;
  const shown = groups(week, life);
  const [group, setTab] = useTab(shown, week);
  return (
    <div className={booking ? "card timetable booking" : "card timetable"}>
      <TimetableHead timetable={timetable} onChange={onChange} booking={booking} />
      {/* The bar, its legend, and the chosen tiles read as one block, so they sit close. */}
      <div className="week-summary">
        <WeekBar
          budget={preview.budget}
          preview={preview}
          oneOffHours={oneOffHours}
          lost={life.lost}
        />
        {timetable.length ? (
          <ul className="chosen-chips" aria-label={CHOSEN_LABEL}>
            {timetable.map((key) => (
              <li key={key} className="chip">
                <button type="button" className="chip-name" onClick={() => setTab(tabOf(key))}>
                  {routineTileLabel(key)}
                </button>
                <button
                  type="button"
                  className="chip-remove"
                  aria-label={removeLabel(routineTileLabel(key))}
                  onClick={() => takeOut(key)}
                >
                  ×
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
            {specs.map((spec) => (
              <Tile
                key={spec.key}
                spec={spec}
                week={week}
                chosen={timetable.includes(spec.key)}
                payment={paymentOf(spec, timetable.includes(spec.key))}
                onToggle={toggle}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The tab shown: the one chosen, unless limited-time tiles opened since it was chosen. */
function useTab(shown: readonly Group[], week: number) {
  // A tab chosen before limited-time tiles opened gives way to them once.
  const [chosen, setChosen] = useState({ key: "job", week: -1 });
  const setTab = (key: string) => setChosen({ key, week });
  const openedAt = Math.max(
    -1,
    ...(shown.find((g) => g.key === "limited")?.specs.map((spec) => spec.from) ?? []),
  );
  const tab = openedAt > chosen.week ? "limited" : chosen.key;
  return [shown.find((g) => g.key === tab) ?? shown[0], setTab] as const;
}

function TimetableHead({
  timetable,
  onChange,
  booking,
}: {
  timetable: readonly RoutineKey[];
  onChange: (timetable: readonly RoutineKey[]) => void;
  booking: Booking | null;
}) {
  return (
    <>
      <div className="timetable-head">
        <h3 className="activity-section">
          {booking ? bookingTitle(booking.weeks) : TIMETABLE_TITLE}
        </h3>
        {booking ? (
          <button
            type="button"
            className="toggle reset-usual"
            disabled={sameKeys(timetable, booking.usual)}
            onClick={() => onChange(booking.usual)}
          >
            {RESET_TO_USUAL}
          </button>
        ) : null}
        <button
          type="button"
          className="toggle clear-all"
          disabled={timetable.length === 0}
          onClick={() => onChange([])}
        >
          {CLEAR_ALL}
        </button>
      </div>
      {booking ? <p className="booking-note">{BOOKING_NOTE}</p> : null}
    </>
  );
}

/** Whether a tile's price can be paid this week: dropped from the plan, or not offered at all. */
type Payment = "payable" | "dropped" | "unaffordable";

function Tile({
  spec,
  week,
  chosen,
  payment,
  onToggle,
}: {
  spec: RoutineSpec;
  week: number;
  chosen: boolean;
  payment: Payment;
  onToggle: (spec: RoutineSpec) => void;
}) {
  const cannotPay = payment !== "payable";
  return (
    <button
      type="button"
      className={["activity", chosen ? "chosen" : "", cannotPay ? "dropped" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-pressed={chosen}
      aria-label={routineDetail(spec)}
      disabled={payment === "unaffordable"}
      onClick={() => onToggle(spec)}
    >
      <span className="activity-name">{routineTileLabel(spec.key)}</span>
      <span className="activity-cost">
        {cannotPay ? `${yen(spec.weeklyMoney)}・${CANNOT_PAY}` : tileCost(spec, week)}
      </span>
      <span className="activity-effects">{routineEffects(spec)}</span>
    </button>
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

/** The tab a routine's tile is on. */
function tabOf(key: RoutineKey): string {
  const spec = routineOf(key);
  return isLimited(spec) ? "limited" : spec.kind;
}

/** Open routines grouped for the tiles: limited-time preparation first, when there is any. */
function groups(week: number, life: Life): Group[] {
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
  preview: WeekOutcome;
  oneOffHours: number;
  lost: HourLoss | null;
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

/** Whether two timetables hold the same tiles, in any order. */
function sameKeys(a: readonly RoutineKey[], b: readonly RoutineKey[]): boolean {
  return a.length === b.length && a.every((key) => b.includes(key));
}
