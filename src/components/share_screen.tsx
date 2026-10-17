import { useEffect, useState } from "react";

import "../styles/game.css";
import { LINK_ERRORS, PLAY_YOURSELF, TITLE } from "../copy/screen";
import type { Cohort, YearEnd } from "../engine/cohort";
import { parse, replay, type LinkError } from "../share/result_link";
import { RevealView } from "./reveal_view";

type Shared =
  | {
      readonly kind: "loaded";
      readonly cohort: Cohort;
      readonly yearEnd: YearEnd;
      readonly player: number;
    }
  | { readonly kind: "failed"; readonly error: LinkError };

export function ShareScreen() {
  const [shared, setShared] = useState<Shared | null>(null);

  // The link lives in the query string, which only the browser has; reading it after
  // hydration keeps the server and browser output the same.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setShared(load(window.location.search));
  }, []);

  const playLink = (
    <a className="next" href="/">
      {PLAY_YOURSELF}
    </a>
  );
  if (!shared) return <main />;
  return (
    <main>
      <h1 className="title">{TITLE}</h1>
      {shared.kind === "loaded" ? (
        <RevealView
          paths={{
            same: shared.cohort.lives,
            most: shared.yearEnd.most,
            least: shared.yearEnd.least,
          }}
          ranks={shared.cohort.allowanceRanks}
          player={shared.player}
          blocked={shared.cohort.everBlocked.size}
          decisions={shared.cohort.decisions}
          difficulty={shared.cohort.difficulty}
          subject="them"
          actions={playLink}
        />
      ) : (
        <section className="reveal">
          <p className="link-error">{LINK_ERRORS[shared.error]}</p>
          <div className="reveal-actions">{playLink}</div>
        </section>
      )}
    </main>
  );
}

function load(search: string): Shared {
  const params = parse(search);
  if (!params.ok) return { kind: "failed", error: params.error };
  const replayed = replay(params.value);
  if (!replayed.ok) return { kind: "failed", error: replayed.error };
  return { kind: "loaded", ...replayed.value, player: params.value.player };
}
