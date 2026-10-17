/** Formats yen the way the game writes it: 72350 → "7万2,350円", 0 → "0円". */
export function yen(amount: number): string {
  if (amount === 0) return "0円";
  const man = Math.floor(amount / 10_000);
  const rest = amount % 10_000;
  return (man ? `${man}万` : "") + (rest ? rest.toLocaleString("ja-JP") : "") + "円";
}

/**
 * Savings as the player keeps them in mind: whole 10,000s from 10,000 yen up, 1,000s below,
 * e.g. 47692 → "5万円", 7600 → "8,000円".
 */
export function roughYen(amount: number): string {
  if (amount >= 10_000) return yen(Math.round(amount / 10_000) * 10_000);
  return yen(Math.round(amount / 1_000) * 1_000);
}

export function region(metro: boolean): string {
  return metro ? "首都圏" : "地方";
}
