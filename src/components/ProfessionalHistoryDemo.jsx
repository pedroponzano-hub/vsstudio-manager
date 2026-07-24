function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-ES");
}

function ProfessionalHistoryDemo({ history = [] }) {
  return (
    <details className="professional-demo-history">
      <summary>Historial de cambios de esta sesión</summary>
      {history.length === 0 ? (
        <p className="empty-state">Sin cambios registrados en esta sesión.</p>
      ) : (
        <div className="professional-history-list">
          {history.map((entry, index) => (
            <article className="professional-history-entry" key={`${entry.changedAt}-${index}`}>
              <strong>{entry.action}</strong>
              <span>{formatDate(entry.changedAt)} · {entry.changedBy}</span>
              <small>{(entry.changedFields || []).join(", ") || "Sin campos detallados"}</small>
            </article>
          ))}
        </div>
      )}
    </details>
  );
}

export default ProfessionalHistoryDemo;
