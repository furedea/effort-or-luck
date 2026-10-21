/** Formats yen the way the game writes it: 72350 → "7万2,350円", 0 → "0円". */
export function yen(amount: number): string {
  if (amount === 0) return "0円";
  const man = Math.floor(amount / 10_000);
  const rest = amount % 10_000;
  return (man ? `${man}万` : "") + (rest ? grouped(rest) : "") + "円";
}

/**
 * Groups digits by thousands: 1100 → "1,100". Written out rather than with toLocaleString, whose
 * first call in the browser loads locale number data in a long task when the game starts.
 */
export function grouped(amount: number): string {
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function region(metro: boolean): string {
  return metro ? "首都圏" : "地方";
}
