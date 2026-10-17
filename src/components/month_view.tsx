import { useEffect, useRef } from "react";

import {
  describeLog,
  describeResult,
  describeScene,
  optionLabel,
  shortfallReason,
} from "../copy/scenes";
import {
  ableCount,
  cannotChoose,
  CHOOSE_PROMPT,
  COULD_NOT,
  FINISHED_HUNTING,
  introSummary,
  monthSummary,
  NEXT,
  NEXT_MONTH,
  selfName,
  selfStatus,
  turnOutcome,
  type Segment,
} from "../copy/screen";
import {
  canChoose,
  optionScene,
  sceneTags,
  turnSummary,
  type Cohort,
  type SceneTag,
} from "../engine/cohort";
import type { Effort, SceneFacts } from "../engine/facts";
import { freeHours } from "../engine/life";
import { ALLOWANCE_DISTRIBUTION } from "../engine/parameters";
import { Segments, Stats } from "./text";

interface Props {
  readonly cohort: Cohort;
  readonly facts: SceneFacts;
  readonly focus: number;
  readonly onChoose: (effort: Effort) => void;
  readonly onNext: () => void;
}

export function MonthView({ cohort, facts, focus, onChoose, onNext }: Props) {
  const own = cohort.scenes[focus];
  const first = cohort.scenes.find((scene) => scene !== null);
  const statsScene = own ?? first;
  return (
    <>
      <p className="group">
        <Segments segments={groupSummary(cohort, facts)} />
      </p>
      <Stats stats={statsScene ? describeScene(statsScene).stats : []} />
      <FocusedSelf cohort={cohort} focus={focus} />
      <div className="story">
        <Choices cohort={cohort} focus={focus} onChoose={onChoose} onNext={onNext} />
      </div>
    </>
  );
}

function groupSummary(cohort: Cohort, facts: SceneFacts): Segment[] {
  const size = cohort.lives.length;
  if (facts.id === "intro") {
    const allowances = ALLOWANCE_DISTRIBUTION.map(([amount], k) => ({
      amount,
      count: cohort.allowanceRanks.filter((rank) => rank === k).length,
    }));
    return introSummary(allowances, cohort.lives.filter((life) => life.metro).length, size);
  }
  const active = cohort.scenes.filter((scene) => scene !== null);
  const tagCounts = new Map<SceneTag, number>();
  for (const scene of active) {
    for (const tag of sceneTags(scene.facts)) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  return monthSummary(facts.id, tagCounts, active.length, size);
}

function FocusedSelf({ cohort, focus }: { cohort: Cohort; focus: number }) {
  const life = cohort.lives[focus];
  if (!life) return null;
  const scene = cohort.scenes[focus];
  const lines = scene ? describeScene(scene).lines : [FINISHED_HUNTING];
  const result = cohort.turn?.results[focus];
  const profile = life.log[0];
  return (
    <div className="focus">
      <div className="focus-head">
        <span>
          <b>{selfName(focus)}</b>
          {profile ? `　${describeLog(profile)}` : ""}
        </span>
        <span>{selfStatus(life.money, freeHours(life))}</span>
      </div>
      <div className="lines">
        {lines.map((line, k) => (
          <p key={`${cohort.step}-${focus}-${k}`} style={{ animationDelay: `${k * 0.25}s` }}>
            {line}
          </p>
        ))}
        {result ? <p className="result">{describeResult(result)}</p> : null}
        {cohort.turn?.blocked.has(focus) ? <p className="result">{COULD_NOT}</p> : null}
      </div>
    </div>
  );
}

function Choices({ cohort, focus, onChoose, onNext }: Omit<Props, "facts">) {
  const template = optionScene(cohort, focus);
  if (!template) {
    const first = cohort.scenes.find((scene) => scene !== null);
    const label = (first && describeScene(first).next) ?? NEXT;
    return <NextButton key={cohort.step} label={label} onClick={onNext} />;
  }
  const isOwn = cohort.scenes[focus] === template;
  const turn = cohort.turn;
  const summary = turnSummary(cohort);
  return (
    <>
      <div className="options">
        {template.options.map((option) => {
          const able = canChoose(cohort, option.effort);
          const state = turn ? (option.effort === turn.want ? "chosen" : "faded") : "";
          return (
            <button
              key={option.key}
              type="button"
              className={`opt ${state}`.trim()}
              disabled={turn !== null}
              onClick={() => onChoose(option.effort)}
            >
              <span className="label">
                {optionLabel(template.facts, option.key)}
                {isOwn && option.shortfall ? (
                  <span className="why">{cannotChoose(shortfallReason(option.shortfall))}</span>
                ) : null}
              </span>
              <span className="count">
                <b>{able.count}</b>
                {ableCount(able.active)}
              </span>
            </button>
          );
        })}
      </div>
      {turn ? (
        <>
          <p className="outcome">
            {turnOutcome(summary.did, summary.blocked, summary.absent).map((segment, k) =>
              segment.strong ? (
                <span key={k} className="bad">
                  {segment.text}
                </span>
              ) : (
                segment.text
              ),
            )}
          </p>
          <NextButton key={cohort.step} label={NEXT_MONTH} onClick={onNext} />
        </>
      ) : (
        <p className="outcome">{CHOOSE_PROMPT}</p>
      )}
    </>
  );
}

function NextButton({ label, onClick }: { label: string; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return (
    <div className="row">
      <button ref={ref} type="button" className="next" onClick={onClick}>
        {label}
      </button>
    </div>
  );
}
