import type { V2CurrentStage } from "@/lib/admissions-v2";
import { number } from "@/lib/format";

export function V2CurrentStages({
  title,
  owner,
  stages,
}: {
  title: string;
  owner: string;
  stages: V2CurrentStage[];
}) {
  const total = stages.reduce((sum, stage) => sum + Number(stage.opportunity_count || 0), 0);

  return (
    <section className="panel v2-stage-panel">
      <div className="panel-heading compact-panel-heading">
        <div>
          <p className="eyebrow">COLA OPERATIVA · {owner}</p>
          <h2>{title}</h2>
        </div>
        <div className="v2-stage-total"><strong>{number(total)}</strong><span>opportunities actuales</span></div>
      </div>
      <div className="v2-stage-grid">
        {stages.map((stage) => (
          <article className={`v2-stage-card v2-stage-${stage.stage_group}`} key={stage.canonical_key}>
            <span>{stage.stage_name}</span>
            <strong>{number(stage.opportunity_count)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
