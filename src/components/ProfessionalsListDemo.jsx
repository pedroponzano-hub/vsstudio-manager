import { professionalSpecialtiesText, todayScheduleText } from "../utils/professionalsConfigDemo.js";

function ProfessionalsListDemo({
  filter,
  onAction,
  professionals = [],
  query,
  servicesCatalog = [],
  allowDuplicate = true,
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const rows = professionals.filter((professional) => {
    const matchesQuery = !normalizedQuery || `${professional.firstName} ${professional.lastName} ${professional.displayName}`.toLowerCase().includes(normalizedQuery);
    const matchesFilter = filter === "all" || (filter === "active" ? professional.active !== false : professional.active === false);
    return matchesQuery && matchesFilter;
  });

  return (
    <section className="professional-demo-list">
      {rows.map((professional) => (
        <article className="professional-demo-card" key={professional.id}>
          <div className="professional-demo-main">
            <span className="professional-color-dot" style={{ background: professional.calendarColor }} />
            <div>
              <strong>{professional.displayName}</strong>
              <span>{professional.email || "Sin acceso por correo"}</span>
            </div>
          </div>
          <span className={professional.active ? "status-pill online" : "status-pill offline"}>{professional.active ? "Activa" : "Inactiva"}</span>
          <span>{professionalSpecialtiesText(professional, servicesCatalog)}</span>
          <span>{todayScheduleText(professional)}</span>
          <span>{professional.employmentType}</span>
          <strong>{Number(professional.economics.defaultServiceCommissionPercent || 0).toFixed(2)}%</strong>
          <span>{professional.access.enabled ? professional.access.role : "Sin acceso"}</span>
          <div className="professional-demo-actions">
            <button type="button" onClick={() => onAction("edit", professional)}>Editar</button>
            <button className="secondary-button" type="button" onClick={() => onAction(professional.active ? "deactivate" : "activate", professional)}>
              {professional.active ? "Desactivar" : "Activar"}
            </button>
            {allowDuplicate && <button className="secondary-button" type="button" onClick={() => onAction("duplicate", professional)}>Duplicar configuración</button>}
            <button className="ghost-button" type="button" onClick={() => onAction("agenda", professional)}>Ver agenda</button>
          </div>
        </article>
      ))}
      {rows.length === 0 && <p className="empty-state">No hay profesionales para el filtro seleccionado.</p>}
    </section>
  );
}

export default ProfessionalsListDemo;
