import { useEffect, useRef, useState } from "react";

import { activityCost, activityDetail, activityTileLabel, describeScene } from "../copy/scenes";
import {
  budgetLine,
  CANNOT_PAY,
  CONFIRM,
  leftoverLine,
  LOW_NOTE,
  NEXT,
  overflowLine,
  SECTION,
  statBars,
  statusItems,
} from "../copy/screen";
import type { ActivitySpec } from "../engine/activities";
import type { ActivityKey } from "../engine/facts";
import type { Life } from "../engine/life";
import { allocate, type Plan, type Scene } from "../engine/plan";
import { SCENE_COUNT } from "../engine/scenes";

interface Props {
  readonly life: Life;
  readonly scene: Scene;
  readonly step: number;
  /** What the previous period did, shown at the top of this scene. */
  readonly carried: string | null;
  readonly onConfirm: (plan: Plan) => void;
  readonly onNext: () => void;
}

export function PlayView({ life, scene, step, carried, onConfirm, onNext }: Props) {
  const text = describeScene(scene);
  const heading = useRef<HTMLHeadingElement>(null);
  const isPeriod = scene.period !== null;
  // A new scene replaces the controls the player was using, so keyboard focus moves to it.
  useEffect(() => {
    if (isPeriod) heading.current?.focus({ preventScroll: true });
  }, [step, isPeriod]);
  return (
    <section className="play">
      <ol className="progress" aria-hidden="true">
        {Array.from({ length: SCENE_COUNT }, (_, i) => (
          <li key={i} className={i < step ? "done" : i === step ? "now" : ""} />
        ))}
      </ol>
      <header className="play-head">
        {carried ? <p className="carried">{carried}</p> : null}
        <h2 className="when" ref={heading} tabIndex={-1}>
          {text.when}
        </h2>
        <Status life={life} />
      </header>
      <div className="lines" key={step} aria-live="polite">
        {text.lines.map((line, k) => (
          <p key={k} style={{ animationDelay: `${k * 0.2}s` }}>
            {line}
          </p>
        ))}
      </div>
      <div className="actions" key={`actions-${step}`}>
        {isPeriod ? (
          <Allocation life={life} scene={scene} onConfirm={onConfirm} />
        ) : (
          <NextButton label={text.next ?? NEXT} onClick={onNext} />
        )}
      </div>
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

function Allocation({
  life,
  scene,
  onConfirm,
}: {
  life: Life;
  scene: Scene;
  onConfirm: (plan: Plan) => void;
}) {
  const [selected, setSelected] = useState<ActivityKey[]>([]);
  const [pressed, setPressed] = useState<ActivitySpec | null>(null);
  const period = scene.period;
  if (!period) return null;
  const preview = allocate(life, scene, selected);
  const toggle = (activity: ActivitySpec) => {
    setPressed(activity);
    setSelected((current) => {
      if (current.includes(activity.key)) return current.filter((key) => key !== activity.key);
      const rivals = period.activities
        .filter((a) => a.group && a.group === activity.group)
        .map((a) => a.key);
      return [...current.filter((key) => !rivals.includes(key)), activity.key];
    });
  };
  return (
    <>
      <TimeBar budget={period.budget} preview={preview} />
      <p className="activity-detail" aria-live="polite">
        {pressed ? activityDetail(pressed, scene.facts) : ""}
      </p>
      {(["job", "life"] as const).map((kind) => (
        <div className="activity-group" key={kind}>
          <h3 className="activity-section">{SECTION[kind]}</h3>
          <div className="tiles">
            {period.activities
              .filter((activity) => activity.kind === kind)
              .map((activity) => {
                const chosen = selected.includes(activity.key);
                const dropped = preview.dropped.includes(activity.key);
                return (
                  <button
                    key={activity.key}
                    type="button"
                    className={["activity", chosen ? "chosen" : "", dropped ? "dropped" : ""]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={chosen}
                    aria-label={activityDetail(activity, scene.facts)}
                    onClick={() => toggle(activity)}
                  >
                    <span className="activity-name">
                      {activityTileLabel(activity, scene.facts)}
                    </span>
                    <span className="activity-cost">
                      {dropped ? CANNOT_PAY : activityCost(activity).join("・")}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      ))}
      <button type="button" className="next confirm" onClick={() => onConfirm(selected)}>
        {CONFIRM}
      </button>
    </>
  );
}

function TimeBar({ budget, preview }: { budget: number; preview: ReturnType<typeof allocate> }) {
  const jobHours = preview.taken
    .filter((a) => a.kind === "job")
    .reduce((sum, a) => sum + a.hours, 0);
  const lifeHours = preview.hours - jobHours;
  const scale = Math.max(budget, preview.hours) || 1;
  const width = (hours: number) => `${(hours / scale) * 100}%`;
  const withinJob = Math.min(jobHours, budget);
  const withinLife = Math.min(lifeHours, Math.max(0, budget - withinJob));
  return (
    <div className="time-bar">
      <p className="time-total">{budgetLine(preview.hours, budget)}</p>
      <div className="bar" aria-hidden="true">
        <span className="bar-job" style={{ width: width(withinJob) }} />
        <span className="bar-life" style={{ width: width(withinLife) }} />
        <span className="bar-over" style={{ width: width(preview.shortHours) }} />
      </div>
      {preview.shortHours ? (
        <p className="time-over">{overflowLine(preview.shortHours, preview.paid)}</p>
      ) : null}
      {preview.extraWorkHours ? (
        <p className="time-left">{leftoverLine(preview.extraWorkHours, preview.earned)}</p>
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
