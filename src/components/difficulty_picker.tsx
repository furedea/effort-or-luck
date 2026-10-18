import {
  DIFFICULTY_LABELS,
  DIFFICULTY_TITLE,
  difficultyDetail,
  TITLE,
  TITLE_LEAD,
} from "../copy/screen";
import type { Difficulty } from "../engine/parameters";

/** The first screen: the title, what the game is, and the difficulty choice that starts it. */
export function DifficultyPicker({ onPick }: { onPick: (difficulty: Difficulty) => void }) {
  return (
    <section className="title-screen">
      <h1 className="title-hero">{TITLE}</h1>
      <p className="lead">
        {TITLE_LEAD.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </p>
      <div className="difficulty">
        <h2 className="difficulty-title">{DIFFICULTY_TITLE}</h2>
        <div className="actions">
          {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((difficulty) => (
            <button
              key={difficulty}
              type="button"
              className="opt"
              onClick={() => onPick(difficulty)}
            >
              <span className="label">{DIFFICULTY_LABELS[difficulty]}</span>
              <span className="cost">{difficultyDetail(difficulty)}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
