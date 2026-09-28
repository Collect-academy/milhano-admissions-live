import type { V2CascadeMetric } from "@/lib/admissions-v2";

export function ConversionRates({ metrics }: { metrics: V2CascadeMetric[] }) {
  const steps = metrics.slice(1).map((metric, index) => {
    const previous = metrics[index];
    const rate = previous.value > 0 ? (metric.value / previous.value) * 100 : 0;
    return { label: `${previous.label} → ${metric.label}`, rate };
  });
  return <section className="panel conversion-rate-panel">
    <div className="panel-heading compact-panel-heading"><div><p className="eyebrow">CONVERSION RATES</p><h2>Conversión entre etapas</h2></div></div>
    <div className="conversion-rate-grid">{steps.map((step) => <article key={step.label}><span>{step.label}</span><strong>{step.rate.toFixed(1)}%</strong></article>)}</div>
  </section>;
}
