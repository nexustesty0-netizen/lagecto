import { money } from "@/lib/format";
import { TrendChart } from "@/components/ui/charts";

export function SalesTrendChart({
  series,
}: {
  series: { label: string; value: number }[];
}) {
  const total = series.reduce((sum, item) => sum + item.value, 0);
  return (
    <section className="overflow-hidden rounded-[var(--lg-radius)] bg-[var(--lagecto-primary-deep)] p-4 text-white sm:p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--lagecto-accent)]">This week</p>
          <h2 className="mt-1 text-lg font-semibold">Sales graph</h2>
        </div>
        <p className="text-sm font-semibold tabular-nums">{money(total)}</p>
      </div>
      <div className="mt-3">
        <TrendChart
          series={series}
          label="Sales for the last seven days"
          tone="dark"
          empty="No completed sales in the last 7 days yet. The graph fills in as you sell."
        />
      </div>
      {total > 0 ? (
        <div className="mt-1 grid grid-cols-7 text-center text-[10px] text-white/75">
          {series.map((item) => (
            <span key={item.label}>{item.label}</span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
