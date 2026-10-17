import { useEffect, useRef } from "react";

import {
  describeResult,
  describeScene,
  optionCost,
  optionLabel,
  shortfallReason,
} from "../copy/scenes";
import { hours, NEXT, savings } from "../copy/screen";
import type { Scene } from "../engine/choice";
import type { Effort, ResultFact } from "../engine/facts";
import { freeHours, type Life } from "../engine/life";
import { SCENE_COUNT } from "../engine/scenes";

interface Props {
  readonly life: Life;
  readonly scene: Scene;
  readonly step: number;
  /** Set once the choice for this month has been made. */
  readonly chosen: { readonly effort: Effort; readonly result: ResultFact | undefined } | null;
  readonly onChoose: (effort: Effort) => void;
  readonly onNext: () => void;
}

export function PlayView({ life, scene, step, chosen, onChoose, onNext }: Props) {
  const text = describeScene(scene);
  const decided = chosen !== null || !scene.options.length;
  return (
    <section className="play" aria-live="polite">
      <ol className="progress" aria-hidden="true">
        {Array.from({ length: SCENE_COUNT }, (_, i) => (
          <li key={i} className={i < step ? "done" : i === step ? "now" : ""} />
        ))}
      </ol>
      <header className="play-head">
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
      {scene.options.length ? (
        <div className="options">
          {scene.options.map((option) => {
            const isChosen = chosen?.effort === option.effort;
            const className = ["opt", isChosen ? "chosen" : "", chosen && !isChosen ? "faded" : ""]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={option.key}
                type="button"
                className={className}
                disabled={chosen !== null || option.shortfall !== null}
                onClick={() => onChoose(option.effort)}
              >
                <span className="label">{optionLabel(scene.facts, option.key)}</span>
                <span className="cost">
                  {option.shortfall
                    ? shortfallReason(option.shortfall)
                    : optionCost(option.hours, option.money)}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {chosen?.result ? <p className="result">{describeResult(chosen.result)}</p> : null}
      {decided ? <NextButton key={step} label={text.next ?? NEXT} onClick={onNext} /> : null}
    </section>
  );
}

function NextButton({ label, onClick }: { label: string; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return (
    <button ref={ref} type="button" className="next" onClick={onClick}>
      {label}
    </button>
  );
}
