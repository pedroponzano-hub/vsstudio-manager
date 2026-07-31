import { useMemo, useState } from "react";
import { addLocalDays, getLocalStartOfWeek, getTodayLocalDateString } from "../utils/date.js";

function saleServicesText(sale) {
  if (Array.isArray(sale.services) && sale.services.length > 0) {
    return sale.services.map((service) => service.serviceName).join(", ");
  }

  return sale.service || sale.concept || "Sin servicio";
}

function money(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function compactValue(value) {
  if (Array.isArray(value)) return value.map((item) => item.serviceName || item.method || JSON.stringify(item)).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
}

function paymentText(sale) {
  if (Array.isArray(sale.payments) && sale.payments.length > 0) {
    return sale.payments.map((payment) => `${payment.method}: ${money(payment.amount)}`).join(" | ");
  }
  return sale.paymentMethod || "Sin pago";
}

function servicesDetailText(sale) {
  if (Array.isArray(sale.services) && sale.services.length > 0) {
    return sale.services.map((service) => `${service.serviceName || service.name || "Servicio"} x${service.quantity || 1} (${money(Number(service.price || 0) * Number(service.quantity || 1))})`).join(" | ");
  }
  return saleServicesText(sale);
}

function saleStatus(sale) {
  const status = String(sale.status || "cobrado").toLowerCase();
  if (status === "pendiente_pago" || status === "cancelado" || status === "anulada" || status === "servicio_interno") return status;
  if (status === "editada") return "cobrado";
  return "cobrado";
}

function saleIsEdited(sale) {
  return Boolean(sale.editada || sale.editedAt || String(sale.status || "").toLowerCase() === "editada");
}

function matchesStatusFilter(sale, filter) {
  if (filter === "editada") return saleIsEdited(sale);
  if (filter === "cobrado") return saleStatus(sale) === "cobrado";
  return saleStatus(sale) === filter;
}

function operationalDate(item = {}) {
  return item.saleDate || item.fechaOperativa || item.date || "";
}

function saleEditHistory(sale) {
  if (Array.isArray(sale.editHistory) && sale.editHistory.length > 0) return sale.editHistory;
  return (sale.previousVersions || []).map((version, index) => ({
    id: `legacy-${index}`,
    editedAt: version.savedAt || sale.editedAt || "",
    editedBy: sale.editedBy || "",
    reason: version.reason || sale.editReason || "Edicion anterior sin motivo registrado",
    changes: [],
  }));
}

function todayDate() {
  return getTodayLocalDateString();
}

function addDays(date, days) {
  return addLocalDays(date, days);
}

function startOfWeek(date) {
  return getLocalStartOfWeek(date);
}

function SaleItem({ sale, clients, onEditSale, onDeleteSale, onViewHistory }) {
  const statusLabel = saleStatus(sale) === "cobrado" && saleIsEdited(sale) ? "Cobrada - Editada" : {
    cobrado: "Cobrada",
    anulada: "Anulada",
    pendiente_pago: "Pendiente de pago",
    cancelado: "Cancelada",
    servicio_interno: "Servicio interno",
  }[saleStatus(sale)] || "Cobrada";
  return (
    <article className="list-item sale-card">
      <div className="sale-card-main">
        <strong>{saleServicesText(sale)}</strong>
        <span>{clients[sale.clientId] || sale.clientName || "Cliente eliminado"} - {operationalDate(sale)} - {sale.employee || "Sin empleada"}</span>
        <span>
          {statusLabel}
          {saleIsEdited(sale) && <b className="sale-tag edited">[EDITADA]</b>}
          {saleStatus(sale) === "anulada" && <b className="sale-tag voided">[ANULADA]</b>}
          {saleStatus(sale) === "servicio_interno" && <b className="sale-tag edited">[SERVICIO INTERNO]</b>}
          {sale.isBackdated && <b className="sale-tag backdated">[REGISTRADA POSTERIORMENTE]</b>}
        </span>
      </div>
      <div className="item-actions sale-card-actions">
        <b>{money(sale.total || sale.amount)}</b>
        <div className="sale-card-buttons">
          <button type="button" onClick={() => onEditSale(sale)} aria-label="Editar venta">
            Editar
          </button>
          <button className="secondary-button" type="button" onClick={() => onViewHistory(sale)} aria-label="Ver historial de venta">
            Ver historial
          </button>
          <button type="button" onClick={() => onDeleteSale(sale.id)} aria-label="Eliminar venta">
            Eliminar
          </button>
        </div>
      </div>
    </article>
  );
}

function SaleList({ sales, clients, selectedDate, onDateSelect, onEditSale, onDeleteSale, initialStatusFilter = "cobrado", title = "Historial de Ventas", subtitle = "Consulta de ventas por dia o rango" }) {
  const [periodFilter, setPeriodFilter] = useState("today");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historySale, setHistorySale] = useState(null);

  const daySales = useMemo(() => (
    sales.filter((sale) => operationalDate(sale) === selectedDate && matchesStatusFilter(sale, statusFilter))
  ), [sales, selectedDate, statusFilter]);

  const filteredPeriodSales = useMemo(() => {
    const today = todayDate();
    if (periodFilter === "today" || periodFilter === "yesterday") return daySales;
    const from = periodFilter === "week" ? startOfWeek(today) : periodFilter === "month" ? `${today.slice(0, 7)}-01` : historyFrom;
    const to = periodFilter === "week" || periodFilter === "month" ? today : historyTo;
    return sales
      .filter((sale) => !from || operationalDate(sale) >= from)
      .filter((sale) => !to || operationalDate(sale) <= to)
      .filter((sale) => matchesStatusFilter(sale, statusFilter))
      .sort((first, second) => String(operationalDate(second)).localeCompare(String(operationalDate(first))));
  }, [sales, daySales, periodFilter, historyFrom, historyTo, statusFilter]);

  const updatePeriodFilter = (value) => {
    setPeriodFilter(value);
    if (value === "today") onDateSelect?.(todayDate());
    if (value === "yesterday") onDateSelect?.(addDays(todayDate(), -1));
  };

  return (
    <section className="panel list-panel sales-history-panel">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
      </div>

      <div className="field-row sales-filter-row">
        <label>Filtro<select value={periodFilter} onChange={(event) => updatePeriodFilter(event.target.value)}>
          <option value="today">Hoy</option>
          <option value="yesterday">Ayer</option>
          <option value="week">Semana</option>
          <option value="month">Mes</option>
          <option value="custom">Rango personalizado</option>
        </select></label>
        <label>Fecha del dia<input type="date" value={selectedDate} onChange={(event) => { onDateSelect?.(event.target.value || todayDate()); setPeriodFilter("custom"); }} /></label>
        <label>Estado<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="cobrado">Cobradas</option>
          <option value="editada">Editadas</option>
          <option value="anulada">Anuladas</option>
          <option value="pendiente_pago">Pendiente de pago</option>
          <option value="cancelado">Canceladas</option>
          <option value="servicio_interno">Servicio interno</option>
        </select></label>
      </div>
      {periodFilter === "custom" && (
        <div className="field-row">
          <label>Desde<input type="date" value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} /></label>
          <label>Hasta<input type="date" value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} /></label>
        </div>
      )}

      <div className="history-actions">
        <button className="secondary-button" type="button" onClick={() => { setHistoryFrom(""); setHistoryTo(""); setPeriodFilter("today"); onDateSelect?.(todayDate()); }}>
          Limpiar filtro
        </button>
      </div>

      <section className="sales-history">
        <h3>{periodFilter === "custom" ? "Ventas del rango" : "Ventas filtradas"}</h3>
        <div className="list">
          {filteredPeriodSales.length === 0 && <p className="empty-state">No hay ventas para el periodo seleccionado.</p>}
          {filteredPeriodSales.map((sale) => (
            <SaleItem key={sale.id} sale={sale} clients={clients} onEditSale={onEditSale} onDeleteSale={onDeleteSale} onViewHistory={setHistorySale} />
          ))}
        </div>
      </section>
      {historySale && (
        <section className="sale-history-modal" role="dialog" aria-modal="true" aria-label="Historial completo de venta">
          <article className="sale-history-dialog">
            <div className="section-title">
              <div>
                <h2>Historial de venta</h2>
                <span>{saleServicesText(historySale)}</span>
              </div>
              <button className="secondary-button" type="button" onClick={() => setHistorySale(null)}>Cerrar</button>
            </div>
            <div className="client-detail-grid">
              <div><span>Fecha creacion</span><strong>{historySale.createdAt || historySale.horaCreacion || "-"}</strong></div>
              <div><span>Fecha de la venta</span><strong>{operationalDate(historySale) || "-"}</strong></div>
              <div><span>Registrada por</span><strong>{historySale.createdBy || "Sin usuario"}</strong></div>
              <div><span>Hora cierre</span><strong>{historySale.horaCierreLocal || historySale.horaCierre || "-"}</strong></div>
              <div><span>Cliente</span><strong>{clients[historySale.clientId] || historySale.clientName || "Cliente eliminado"}</strong></div>
              <div><span>Profesional</span><strong>{historySale.employee || "Sin profesional"}</strong></div>
              <div><span>Importe total</span><strong>{money(historySale.total || historySale.amount)}</strong></div>
              <div><span>Metodos de pago</span><strong>{paymentText(historySale)}</strong></div>
              <div><span>Canal de origen</span><strong>{historySale.entryChannel || "Sin canal"}</strong></div>
              <div><span>Estado de la venta</span><strong>{saleStatus(historySale)}</strong></div>
              <div><span>Comision empleada</span><strong>{money(historySale.commissionAmount)}</strong></div>
              <div><span>% comision empleada</span><strong>{Number(historySale.commissionPercent || 0).toFixed(2)}%</strong></div>
              <div><span>Comision Treatwell</span><strong>{money(historySale.treatwellCommissionAmount)}</strong></div>
              <div><span>% comision Treatwell</span><strong>{Number(historySale.treatwellCommissionPercent || 0).toFixed(2)}%</strong></div>
              {historySale.isBackdated && <div><span>Motivo registro tardio</span><strong>{historySale.backdatedReasonText || historySale.backdatedReasonCode || "-"}</strong></div>}
              {historySale.registeredAfterClosure && <div><span>Posterior a cierre</span><strong>{historySale.relatedClosureId || historySale.closureStatusAtCreation || "Si"}</strong></div>}
              <div className="wide-detail"><span>Servicios vendidos</span><p>{servicesDetailText(historySale)}</p></div>
            </div>
            <h3>Historial de ediciones</h3>
            <div className="list">
              {saleEditHistory(historySale).length === 0 && <p className="empty-state">Sin ediciones registradas.</p>}
              {saleEditHistory(historySale).map((entry, index) => (
                <article className="list-item" key={entry.id || `${entry.editedAt}-${index}`}>
                  <div>
                    <strong>{index + 1}. {entry.reason || "Sin motivo registrado"}</strong>
                    <span>{entry.editedAt || "Sin fecha"} - {entry.editedBy || "Sin usuario"}</span>
                    {(entry.changes || []).length > 0 ? (
                      (entry.changes || []).map((change) => (
                        <small key={`${change.field}-${compactValue(change.before)}-${compactValue(change.after)}`}>
                          {change.field}: {compactValue(change.before)} -&gt; {compactValue(change.after)}
                        </small>
                      ))
                    ) : (
                      <small>Valores anteriores: {compactValue(entry.previousValues || {})}</small>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>
      )}
    </section>
  );
}

export default SaleList;
