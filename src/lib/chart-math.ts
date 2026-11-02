export type ChartDatum = { label: string; value: number };

export function chartMax(values: number[], fallback = 1) {
  const max = Math.max(0, ...values.map((value) => Number(value) || 0));
  return max > 0 ? max : fallback;
}

export function barPercent(value: number, max: number, minVisible = 0) {
  if (max <= 0) return 0;
  const amount = Math.max(0, Number(value) || 0);
  if (amount <= 0) return 0;
  return Math.min(100, Math.max(minVisible, (amount / max) * 100));
}

export function trendLayout(
  series: ChartDatum[],
  width: number,
  height: number,
  padX = 12,
  padY = 18,
) {
  const values = series.map((item) => Number(item.value) || 0);
  const max = chartMax(values);
  const step = series.length > 1 ? (width - padX * 2) / (series.length - 1) : 0;
  const points = series.map((item, index) => {
    const value = Number(item.value) || 0;
    const x = series.length === 1 ? width / 2 : padX + index * step;
    const y = height - padY - (value / max) * (height - padY * 2);
    return { x, y, label: item.label, value };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const lastX = points.at(-1)?.x ?? padX;
  const area = `${padX},${height - padY} ${line} ${lastX},${height - padY}`;
  return {
    max,
    points,
    line,
    area,
    total: values.reduce((sum, value) => sum + value, 0),
  };
}

export function columnPercents(series: ChartDatum[], minVisible = 0) {
  const max = chartMax(series.map((item) => item.value));
  return series.map((item) => ({
    label: item.label,
    value: Number(item.value) || 0,
    percent: barPercent(item.value, max, minVisible),
  }));
}
