import { useEffect, useRef } from "react";

import {
  describeResult,
  describeScene,
  optionCost,
  optionLabel,
  shortfallReason,
} from "../copy/scenes";
import { hours, NEXT, previousChoice, savings } from "../copy/screen";
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
  return (
    <section className="play" aria-live="polite">
      <ol className="progress" aria-hidden="true">
        {Array.from({ length: SCENE_COUNT }, (_, i) => (
          <li key={i} className={i < step ? "done" : i === step ? "now" : ""} />
        ))}
      </ol>
      <header className="play-head">
        {carried ? <p className="carried">{previousChoice(describeResult(carried))}</p> : null}
        <h2 className="when">{text.when}</h2>
        <p className="status">
          <span>{savings(life.money)}</span>
          <span>{hours(freeHours(life))}</span>
        </p>
      </header>
      <div className="lines" key={step}>
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
