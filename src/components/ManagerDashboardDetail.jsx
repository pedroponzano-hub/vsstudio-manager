import { useMemo } from "react";

import { deriveManagerDashboard, operationalDate } from "../utils/managerDashboard.js";
import { dashboardDetailRows, dashboardDetailTotal, parseDashboardDetailSearch } from "../utils/managerDashboardDrilldown.js";

const LABELS = {
  sales: "Ventas",
  operations: "Operaciones",
  services: "Servicios",
  "average-ticket": "Ticket medio",
  clients: "Clientes",
  expenses: "Gastos",
  "result-estimated": "Resultado estimado",
  "pending-commissions": "Comisiones pendientes",
  "paid-commissions": "Comisiones pagadas",
  "new-clients": "Clientes nuevos",
  "recurring-clients": "Clientes recurrentes",
};

function money(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function rowDate(row, metric) {
  if (metric === "paid-commissions") return row.paymentDate || row.fechaPagoComision || row.fechaPago || "";
  return row.generationDate || row.fechaGeneracion || operationalDate(row);
}

function rowConcept(row, metric) {
  if (metric === "result-estimated") return row.concept;
  if (metric === "services") return `${row.serviceName || "Servicio"}${Number(row.quantity || 1) > 1 ? ` × ${row.quantity}` : ""}`;
  if (metric.includes("clients")) return row.name || row.clientName || row.email || "Cliente";
  if (metric.includes("commissions")) return row.services || row.serviceName || `Venta ${row.saleId || row.id || ""}`;
  if (metric === "expenses") return row.concept || row.description || row.category || "Gasto";
  return Array.isArray(row.services) ? row.services.map((service) => service.serviceName || service.name).filter(Boolean).join(", ") : row.serviceName || row.service || "Venta";
}

function rowOwner(row, metric, clientsById) {
  if (metric === "result-estimated") return "Cálculo del periodo";
  if (metric.includes("clients")) return row.phone || row.telefono || row.email || "-";
  if (metric === "expenses") return row.provider || row.supplier || row.paymentMethod || "-";
  return row.employee || row.professionalName || row.clientName || clientsById[row.clientId] || "-";
}

function rowAmount(row, metric) {
  if (metric.includes("clients") || metric === "operations") return "";
  if (metric.includes("commissions")) return money(row.commissionAmount);
  return money(row.amount ?? row.total);
}

function ManagerDashboardDetail({ commissionsData = {}, sourceData = {} }) {
  const context = useMemo(() => parseDashboardDetailSearch(window.location.search), []);
  const dashboard = useMemo(() => deriveManagerDashboard(
    { ...sourceData, commissionRows: commissionsData.rows || [] },
    context,
  ), [commissionsData.rows, context, sourceData]);
  const rows = dashboardDetailRows(dashboard, context.metric);
  const total = dashboardDetailTotal(rows, context.metric);
  const clientsById = Object.fromEntries((sourceData.clients || []).map((client) => [client.id, client.name]));
  const isCount = ["operations", "services", "clients", "new-clients", "recurring-clients"].includes(context.metric);
  const isResult = context.metric === "result-estimated";
  const dimensionsApply = context.metric !== "expenses";
  const professionalLabel = context.professional === "all"
    ? "Todas"
    : (sourceData.config?.employeeSettings || []).find((item) => item.id === context.professional || item.professionalId === context.professional)?.displayName
      || (sourceData.config?.employeeSettings || []).find((item) => item.id === context.professional || item.professionalId === context.professional)?.name
      || context.professional;

  return (
    <section className="module manager-dashboard-detail">
      <div className="section-title">
        <div>
          <p className="manager-kicker">Detalle del Dashboard</p>
          <h2>{LABELS[context.metric]}</h2>
          <span>{context.bounds.from}{context.bounds.to !== context.bounds.from ? ` — ${context.bounds.to}` : ""}</span>
        </div>
        <button className="secondary-button" type="button" onClick={() => window.history.back()}>Volver al Dashboard</button>
      </div>

      <section className="summary-grid compact">
        <article className="metric"><span>Registros</span><strong>{rows.length}</strong></article>
        <article className="metric"><span>{isCount ? "Total" : "Importe explicado"}</span><strong>{isCount ? total : money(total)}</strong></article>
        <article className="metric"><span>Profesional</span><strong>{!dimensionsApply ? "No aplica" : professionalLabel}</strong></article>
        <article className="metric"><span>Categoría</span><strong>{!dimensionsApply ? "No aplica" : context.category === "all" ? "Todas" : context.category}</strong></article>
      </section>

      {context.metric === "average-ticket" && <section className="panel"><p className="manager-panel-note">{money(dashboard.metrics.totalSales)} en ventas / {dashboard.metrics.salesCount} operaciones = {money(dashboard.metrics.averageTicket)} de ticket medio.</p></section>}

      {isResult && <section className="panel">
        <h3>Desglose del resultado estimado</h3>
        <div className="manager-finance-summary">
          <div><span>Facturación cobrada</span><strong>{money(dashboard.resultBreakdown.grossCollections)}</strong></div>
          <div><span>Comisiones generadas</span><strong>{money(dashboard.resultBreakdown.generatedCommissions)}</strong></div>
          <div><span>Base neta tras comisiones e impuestos</span><strong>{money(dashboard.resultBreakdown.netIncomeAfterCommissions)}</strong></div>
          <div><span>Gastos del periodo</span><strong>{money(dashboard.resultBreakdown.expenses)}</strong></div>
          <div><span>Resultado estimado</span><strong>{money(dashboard.resultBreakdown.result)}</strong></div>
        </div>
      </section>}

      <section className="panel">
        <div className="finance-table">
          <div className="finance-header manager-drilldown-row"><span>Fecha</span><span>Concepto</span><span>Profesional / referencia</span><span>Importe</span></div>
          {rows.map((row, index) => <div className="finance-row manager-drilldown-row" key={row.id || row.saleId || `${context.metric}-${index}`}>
            <span data-label="Fecha">{rowDate(row, context.metric) || "-"}</span>
            <span data-label="Concepto">{rowConcept(row, context.metric)}</span>
            <span data-label="Profesional / referencia">{rowOwner(row, context.metric, clientsById)}</span>
            <strong data-label="Importe">{rowAmount(row, context.metric) || "-"}</strong>
          </div>)}
          {!rows.length && <p className="empty-state">No hay registros para este contexto.</p>}
        </div>
      </section>
    </section>
  );
}

export default ManagerDashboardDetail;
