import { useEffect, useRef } from "react";

import {
  describeResult,
  describeScene,
  optionCost,
  optionLabel,
  shortfallReason,
} from "../copy/scenes";
import { NEXT, previousChoice, statusParts } from "../copy/screen";
import type { Scene } from "../engine/choice";
import type { Effort, ResultFact } from "../engine/facts";
import { freeHours, type Life } from "../engine/life";
import { SCENE_COUNT } from "../engine/scenes";

interface Props {
  readonly life: Life;
  readonly scene: Scene;
  readonly step: number;
  /** What the previous choice led to, shown at the top of this month. */
  readonly carried: ResultFact | null;
  readonly onChoose: (effort: Effort) => void;
  readonly onNext: () => void;
}

export function PlayView({ life, scene, step, carried, onChoose, onNext }: Props) {
  const text = describeScene(scene);
  const heading = useRef<HTMLHeadingElement>(null);
  const hasOptions = scene.options.length > 0;
  // The chosen button disappears with the month, so keyboard focus moves to the new month.
  // Months without options focus their next button instead.
  useEffect(() => {
    if (hasOptions) heading.current?.focus({ preventScroll: true });
  }, [step, hasOptions]);
  return (
    <section className="play">
      <ol className="progress" aria-hidden="true">
        {Array.from({ length: SCENE_COUNT }, (_, i) => (
          <li key={i} className={i < step ? "done" : i === step ? "now" : ""} />
        ))}
      </ol>
      <header className="play-head">
        {carried ? <p className="carried">{previousChoice(describeResult(carried))}</p> : null}
        <h2 className="when" ref={heading} tabIndex={-1}>
          {text.when}
        </h2>
        <p className="status">
          {statusParts({
            allowance: life.allowance,
            scholarship: life.scholarship,
            money: life.money,
            freeHours: freeHours(life),
            offers: life.offers.length,
          }).map((part) => (
            <span key={part}>{part}</span>
          ))}
        </p>
      </header>
      <div className="lines" key={step} aria-live="polite">
        {text.lines.map((line, k) => (
          <p key={k} style={{ animationDelay: `${k * 0.2}s` }}>
            {line}
          </p>
        ))}
      </div>
      <div className="actions" key={`actions-${step}`}>
        {scene.options.length ? (
          scene.options.map((option) => (
            <button
              key={option.key}
              type="button"
              className="opt"
              disabled={option.shortfall !== null}
              onClick={() => onChoose(option.effort)}
            >
              <span className="label">{optionLabel(scene.facts, option.key)}</span>
              <span className="cost">
                {option.shortfall
                  ? shortfallReason(option.shortfall)
                  : optionCost(option.hours, option.money)}
              </span>
            </button>
          ))
        ) : (
          <NextButton label={text.next ?? NEXT} onClick={onNext} />
        )}
      </div>
    </section>
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
