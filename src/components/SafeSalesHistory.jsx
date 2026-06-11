import { useMemo, useState } from "react";

function money(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function operationalDate(sale = {}) {
  return sale.fechaOperativa || sale.date || "";
}

function saleStatus(sale = {}) {
  const status = String(sale.status || "cobrado").toLowerCase();
  if (status === "editada") return "cobrado";
  if (["cobrado", "anulada", "pendiente_pago", "cancelado", "servicio_interno"].includes(status)) return status;
  return "cobrado";
}

function saleIsEdited(sale = {}) {
  return Boolean(sale.editada || sale.editedAt || String(sale.status || "").toLowerCase() === "editada");
}

function servicesText(sale = {}) {
  if (Array.isArray(sale.services) && sale.services.length > 0) {
    return sale.services
      .map((service) => `${service.serviceName || service.name || "Servicio"}${Number(service.quantity || 1) > 1 ? ` x${service.quantity}` : ""}`)
      .join(", ");
  }
  return sale.serviceName || sale.service || sale.concept || "Sin servicio";
}

function paymentText(sale = {}) {
  if (Array.isArray(sale.payments) && sale.payments.length > 0) {
    return sale.payments.map((payment) => `${payment.method || "Sin metodo"} ${money(payment.amount)}`).join(" / ");
  }
  return sale.paymentMethod || "Sin pago";
}

function saleHour(sale = {}) {
  return sale.horaCierreLocal || sale.horaCierre || sale.horaCreacionLocal || sale.horaCreacion || "";
}

function matchesStatus(sale, filter) {
  if (filter === "all") return true;
  if (filter === "editada") return saleIsEdited(sale);
  if (filter === "cobrado") return saleStatus(sale) === "cobrado";
  return saleStatus(sale) === filter;
}

function statusLabel(sale) {
  if (saleStatus(sale) === "cobrado" && saleIsEdited(sale)) return "Cobrada - Editada";
  return {
    cobrado: "Cobrada",
    anulada: "Anulada",
    pendiente_pago: "Pendiente",
    cancelado: "Cancelada",
    servicio_interno: "Servicio interno",
  }[saleStatus(sale)] || "Cobrada";
}

function SafeSalesHistory({
  sales = [],
  clients = {},
  mode = "history",
  onEditSale,
  onDeleteSale,
  onVoidSale,
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statusFilter, setStatusFilter] = useState(mode === "audit" ? "editada" : "all");
  const [selectedSale, setSelectedSale] = useState(null);

  const historyState = useMemo(() => {
    try {
      const rows = (Array.isArray(sales) ? sales : [])
        .filter((sale) => {
          const date = operationalDate(sale);
          if (from && date < from) return false;
          if (to && date > to) return false;
          if (mode === "audit" && statusFilter === "all") return saleIsEdited(sale) || saleStatus(sale) === "anulada";
          return matchesStatus(sale, statusFilter);
        })
        .sort((first, second) => {
          const firstKey = `${operationalDate(first)} ${saleHour(first)}`;
          const secondKey = `${operationalDate(second)} ${saleHour(second)}`;
          return secondKey.localeCompare(firstKey);
        });
      return { rows, error: "" };
    } catch {
      return { rows: [], error: "No se pudo cargar el historial de ventas." };
    }
  }, [sales, from, to, statusFilter, mode]);

  if (historyState.error) {
    return (
      <section className="module">
        <section className="panel">
          <h2>Historial de ventas</h2>
          <p className="empty-state">No se pudo cargar el historial de ventas.</p>
        </section>
      </section>
    );
  }

  return (
    <section className="module">
      <div className="section-title">
        <div>
          <h2>{mode === "audit" ? "Ventas editadas/anuladas" : "Historial de ventas"}</h2>
          <span>Consulta estable de ventas registradas</span>
        </div>
      </div>

      <section className="panel filters-panel">
        <label>Fecha desde<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>Fecha hasta<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <label>Estado<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Todas</option>
          <option value="cobrado">Cobradas</option>
          <option value="editada">Editadas</option>
          <option value="anulada">Anuladas</option>
          <option value="pendiente_pago">Pendientes</option>
        </select></label>
        <button className="secondary-button" type="button" onClick={() => { setFrom(""); setTo(""); setStatusFilter(mode === "audit" ? "editada" : "all"); }}>
          Limpiar filtros
        </button>
      </section>

      <section className="panel">
        <div className="finance-table">
          <div className="finance-header safe-sales-history-row">
            <span>Fecha operativa</span>
            <span>Hora</span>
            <span>Cliente</span>
            <span>Profesional</span>
            <span>Servicios</span>
            <span>Importe</span>
            <span>Metodo pago</span>
            <span>Estado</span>
            <span>Acciones</span>
          </div>
          {historyState.rows.length === 0 && <p className="empty-state">No hay ventas para el periodo seleccionado.</p>}
          {historyState.rows.map((sale) => (
            <div className="finance-row safe-sales-history-row" key={sale.id || `${operationalDate(sale)}-${saleHour(sale)}-${servicesText(sale)}`}>
              <span>{operationalDate(sale) || "-"}</span>
              <span>{saleHour(sale) || "-"}</span>
              <span>{clients[sale.clientId] || sale.clientName || "Cliente mostrador"}</span>
              <span>{sale.employee || "Sin profesional"}</span>
              <span>{servicesText(sale)}</span>
              <strong>{money(sale.total || sale.amount)}</strong>
              <span>{paymentText(sale)}</span>
              <span className={saleStatus(sale) === "anulada" ? "status-pill pending" : saleIsEdited(sale) ? "status-pill edited" : "status-pill online"}>
                {statusLabel(sale)}
              </span>
              <div className="compact-actions">
                <button className="secondary-button" type="button" onClick={() => setSelectedSale(sale)}>Ver historial</button>
                <button className="secondary-button" type="button" onClick={() => onEditSale?.(sale)}>Editar</button>
                {saleStatus(sale) === "cobrado" && <button className="danger-button" type="button" onClick={() => onVoidSale?.(sale)}>Anular</button>}
                {saleStatus(sale) !== "cobrado" && <button className="danger-button" type="button" onClick={() => onDeleteSale?.(sale.id)}>Eliminar</button>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {selectedSale && (
        <section className="sale-history-modal" role="dialog" aria-modal="true" aria-label="Historial de venta">
          <article className="sale-history-dialog">
            <div className="section-title">
              <div>
                <h2>Historial de venta</h2>
                <span>{servicesText(selectedSale)}</span>
              </div>
              <button className="secondary-button" type="button" onClick={() => setSelectedSale(null)}>Cerrar</button>
            </div>
            <div className="client-detail-grid">
              <div><span>Fecha operativa</span><strong>{operationalDate(selectedSale) || "-"}</strong></div>
              <div><span>Hora</span><strong>{saleHour(selectedSale) || "-"}</strong></div>
              <div><span>Cliente</span><strong>{clients[selectedSale.clientId] || selectedSale.clientName || "Cliente mostrador"}</strong></div>
              <div><span>Profesional</span><strong>{selectedSale.employee || "Sin profesional"}</strong></div>
              <div><span>Importe</span><strong>{money(selectedSale.total || selectedSale.amount)}</strong></div>
              <div><span>Metodo pago</span><strong>{paymentText(selectedSale)}</strong></div>
              <div><span>Estado</span><strong>{statusLabel(selectedSale)}</strong></div>
              <div className="wide-detail"><span>Servicios</span><p>{servicesText(selectedSale)}</p></div>
              <div className="wide-detail"><span>Observaciones</span><p>{selectedSale.notes || "Sin observaciones"}</p></div>
            </div>
          </article>
        </section>
      )}
    </section>
  );
}

export default SafeSalesHistory;
