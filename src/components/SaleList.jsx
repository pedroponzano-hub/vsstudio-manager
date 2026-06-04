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

function saleStatus(sale) {
  const status = String(sale.status || "cobrado").toLowerCase();
  if (status === "pendiente_pago" || status === "cancelado" || status === "anulada") return status;
  if (status === "editada") return "cobrado";
  return "cobrado";
}

function saleIsEdited(sale) {
  return Boolean(sale.editada || sale.editedAt || String(sale.status || "").toLowerCase() === "editada");
}

function matchesStatusFilter(sale, filter) {
  if (filter === "editada") return saleIsEdited(sale);
  return saleStatus(sale) === filter;
}

function operationalDate(item = {}) {
  return item.fechaOperativa || item.date || "";
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

function SaleItem({ sale, clients, onEditSale, onDeleteSale }) {
  const statusLabel = saleStatus(sale) === "cobrado" && saleIsEdited(sale) ? "Cobrada · Editada" : {
    cobrado: "Cobrada",
    anulada: "Anulada",
    pendiente_pago: "Pendiente de pago",
    cancelado: "Cancelada",
  }[saleStatus(sale)] || "Cobrada";

  return (
    <article className="list-item sale-card">
      <div className="sale-card-main">
        <strong>{saleServicesText(sale)}</strong>
        <span>{clients[sale.clientId] || sale.clientName || "Cliente eliminado"} - {operationalDate(sale)} - {sale.employee || "Sin empleada"}</span>
        <span>{statusLabel}</span>
      </div>
      <div className="item-actions sale-card-actions">
        <b>{Number(sale.total || sale.amount || 0).toFixed(2)} EUR</b>
        <div className="sale-card-buttons">
          <button type="button" onClick={() => onEditSale(sale)} aria-label="Editar venta">
            Editar
          </button>
          <button type="button" onClick={() => onDeleteSale(sale.id)} aria-label="Eliminar venta">
            Eliminar
          </button>
        </div>
      </div>
    </article>
  );
}

function SaleList({ sales, clients, selectedDate, onDateSelect, onEditSale, onDeleteSale }) {
  const [periodFilter, setPeriodFilter] = useState("today");
  const [statusFilter, setStatusFilter] = useState("cobrado");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");

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
          <h2>Historial de Ventas</h2>
          <span>Consulta de ventas por dia o rango</span>
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
          <option value="cobrado">Cobrada</option>
          <option value="editada">Editada</option>
          <option value="anulada">Anulada</option>
          <option value="pendiente_pago">Pendiente de pago</option>
          <option value="cancelado">Cancelada</option>
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
          {filteredPeriodSales.length === 0 && <p className="empty-state">Sin ventas en el periodo seleccionado.</p>}
          {filteredPeriodSales.map((sale) => (
            <SaleItem key={sale.id} sale={sale} clients={clients} onEditSale={onEditSale} onDeleteSale={onDeleteSale} />
          ))}
        </div>
      </section>
    </section>
  );
}

export default SaleList;
