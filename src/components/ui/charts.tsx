import { barPercent, columnPercents, trendLayout, type ChartDatum } from "@/lib/chart-math";

export function TrendChart({
  series,
  label,
  tone = "dark",
  empty = "No values in this range yet.",
}: {
  series: ChartDatum[];
  label: string;
  tone?: "dark" | "light";
  empty?: string;
}) {
  const width = 360;
  const height = 148;
  const layout = trendLayout(series, width, height);
  const dark = tone === "dark";
  const stroke = dark ? "#D4AF37" : "#0B6E4F";
  const fillId = `lg-trend-${tone}-${label.replace(/[^a-z0-9]+/gi, "").slice(0, 24) || "chart"}`;

  if (layout.total <= 0) {
    return <p className={`mt-6 text-sm ${dark ? "text-white/75" : "text-[var(--lagecto-muted)]"}`}>{empty}</p>;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full" role="img" aria-label={label}>
      <defs>
        <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={layout.area} fill={`url(#${fillId})`} />
      <polyline points={layout.line} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {layout.points.map((point) => (
        <circle key={point.label} cx={point.x} cy={point.y} r="3.5" fill={dark ? "#fff" : "#fffdf8"} stroke={stroke} strokeWidth="2">
          <title>
            {point.label}: {point.value}
          </title>
        </circle>
      ))}
    </svg>
  );
}

export function ColumnChart({
  series,
  label,
  empty = "No values in this range yet.",
}: {
  series: ChartDatum[];
  label: string;
  empty?: string;
}) {
  const cols = columnPercents(series);
  if (!cols.some((item) => item.value > 0)) {
    return <p className="text-sm text-[var(--lagecto-muted)]">{empty}</p>;
  }
  return (
    <div className="flex h-24 items-end gap-2" role="img" aria-label={label}>
      {cols.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex h-16 w-full items-end rounded-md bg-[var(--lagecto-cream)]">
            <div
              className="w-full rounded-md bg-[var(--lagecto-primary)]"
              style={{ height: `${item.percent}%` }}
              title={`${item.label}: ${item.value}`}
            />
          </div>
          <p className="text-[10px] text-[var(--lagecto-muted)]">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

export function HorizontalBars({
  items,
  empty = "Not enough data yet.",
  formatValue,
}: {
  items: ChartDatum[];
  empty?: string;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(0, ...items.map((item) => Number(item.value) || 0));
  if (!items.length || max <= 0) {
    return <p className="text-sm text-[var(--lagecto-muted)]">{empty}</p>;
  }
  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span>{item.label}</span>
            <span className="font-medium tabular-nums">{formatValue ? formatValue(item.value) : item.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--lagecto-cream)]">
            <span className="block h-full rounded-full bg-[var(--lagecto-primary)]" style={{ width: `${barPercent(item.value, max, 6)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
