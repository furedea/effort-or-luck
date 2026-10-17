/** Formats yen the way the game writes it: 72350 → "7万2,350円", 0 → "0円". */
export function yen(amount: number): string {
  if (amount === 0) return "0円";
  const man = Math.floor(amount / 10_000);
  const rest = amount % 10_000;
  return (man ? `${man}万` : "") + (rest ? rest.toLocaleString("ja-JP") : "") + "円";
}

export function region(metro: boolean): string {
  return metro ? "首都圏" : "地方";
}
