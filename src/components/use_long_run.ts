import { useEffect, useState } from "react";

import { longRunByAllowance } from "../engine/long_run";
import { followDecisions, type Decision } from "../engine/year";

/**
 * Long-run offer rates per allowance for the decisions the selves followed, computed after the
 * screen is drawn; null until ready.
 */
export function useLongRun(decisions: readonly Decision[]): readonly number[] | null {
  const [rates, setRates] = useState<readonly number[] | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setRates(longRunByAllowance(followDecisions(decisions)));
    }, 0);
    return () => clearTimeout(timer);
  }, [decisions]);
  return rates;
}
