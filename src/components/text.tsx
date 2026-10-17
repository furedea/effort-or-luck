import type { Segment } from "../copy/screen";
import type { Statistic } from "../data/statistics";

export function Segments({ segments }: { segments: readonly Segment[] }) {
  return segments.map((segment, k) =>
    segment.strong ? <b key={k}>{segment.text}</b> : segment.text,
  );
}

export function Stats({ stats }: { stats: readonly Statistic[] }) {
  return (
    <div className="stats" hidden={!stats.length}>
      {stats.map((stat) => (
        <aside className="stat" key={stat.text}>
          <p>{stat.text}</p>
          <cite>{stat.source}</cite>
        </aside>
      ))}
    </div>
  );
}
