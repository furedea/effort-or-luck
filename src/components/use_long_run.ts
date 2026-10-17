import { useEffect, useState } from "react";

import type { Effort, SceneId } from "../engine/facts";
import { longRunByAllowance } from "../engine/long_run";

/**
 * Long-run offer rates per allowance for the monthly efforts in `wants`, computed after the
 * screen is drawn; null until ready.
 */
export function useLongRun(
  wants: Readonly<Partial<Record<SceneId, Effort>>>,
): readonly number[] | null {
  const [rates, setRates] = useState<readonly number[] | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setRates(longRunByAllowance((month) => wants[month] ?? 1));
    }, 0);
    return () => clearTimeout(timer);
  }, [wants]);
  return rates;
}
