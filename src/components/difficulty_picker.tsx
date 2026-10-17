import { DIFFICULTY_LABELS, DIFFICULTY_TITLE, difficultyDetail } from "../copy/screen";
import type { Difficulty } from "../engine/parameters";

export function DifficultyPicker({ onPick }: { onPick: (difficulty: Difficulty) => void }) {
  return (
    <section className="play difficulty">
      <h2 className="when">{DIFFICULTY_TITLE}</h2>
      <div className="actions">
        {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((difficulty) => (
          <button key={difficulty} type="button" className="opt" onClick={() => onPick(difficulty)}>
            <span className="label">{DIFFICULTY_LABELS[difficulty]}</span>
            <span className="cost">{difficultyDetail(difficulty)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
