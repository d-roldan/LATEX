interface Props {
  title: string;
  description: string;
  milestones: string[];
}

export function PlaceholderPage({ title, description, milestones }: Props) {
  return (
    <div className="stack-lg page-enter">
      <section className="panel hero-panel stagger-1">
        <div>
          <p className="eyebrow">Modulo</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="status-pill neutral">En construccion activa</span>
      </section>

      <section className="panel stagger-2">
        <div className="section-head">
          <h3>Proximo alcance</h3>
          <p>Hoja de trabajo para pasar de base tecnica a flujo operativo real.</p>
        </div>

        <ul className="milestone-list">
          {milestones.map((milestone) => (
            <li key={milestone}>{milestone}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
