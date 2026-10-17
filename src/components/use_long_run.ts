import { useEffect, useState } from "react";

import type { PeriodId } from "../engine/facts";
import { followPlans, longRunByAllowance } from "../engine/long_run";
import type { Plan } from "../engine/plan";

/**
 * Long-run offer rates per allowance for the plans the selves followed, computed after the
 * screen is drawn; null until ready.
 */
export function useLongRun(
  plans: Readonly<Partial<Record<PeriodId, Plan>>>,
): readonly number[] | null {
  const [rates, setRates] = useState<readonly number[] | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setRates(longRunByAllowance(followPlans(plans)));
    }, 0);
    return () => clearTimeout(timer);
  }, [plans]);
  return rates;
}
