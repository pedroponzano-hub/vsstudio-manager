function formatAuditDate(value) {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-ES");
}

function AppointmentEditHistoryDemo({ history = [] }) {
  return (
    <details className="appointment-edit-history-demo">
      <summary>Historial de cambios</summary>
      {history.length === 0 ? (
        <p className="empty-state">Sin modificaciones registradas en esta sesion</p>
      ) : (
        <div className="edit-history-list">
          {history.map((entry, index) => (
            <article className="edit-history-entry" key={`${entry.changedAt}-${index}`}>
              <strong>{formatAuditDate(entry.changedAt)}</strong>
              <span>{entry.changedBy}</span>
              <span>Motivo: {entry.editReasonText || entry.editReasonCode}</span>
              <small>
                Estado: {entry.previousStatus || "Sin estado"} - {entry.newStatus || "Sin estado"}
              </small>
              <small>
                Cambios: {(entry.changedFields || []).join(", ") || "Sin cambios detectados"}
              </small>
            </article>
          ))}
        </div>
      )}
    </details>
  );
}

export default AppointmentEditHistoryDemo;
