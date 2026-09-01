import { useMemo, useState } from "react";

import { getTodayLocalDateString } from "../utils/date.js";
import { deriveManagerDashboard, managerFilterOptions, periodBounds, periodLabel } from "../utils/managerDashboard.js";

const PERIODS = [
  ["today", "Hoy"],
  ["week", "Esta semana"],
  ["month", "Este mes"],
  ["previousMonth", "Mes anterior"],
  ["custom", "Personalizado"],
];

function money(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function compactMoney(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));
}

function shortDate(value) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
}

export function ManagerPageHeader({ periodText }) {
  return <header className="manager-page-header"><div><p className="manager-kicker">Centro de control</p><h2>Estado del negocio</h2><p>Analiza la actividad, detecta prioridades y accede al detalle.</p></div><span className="manager-period-summary">{periodText}</span></header>;
}

export function ManagerFilterBar({ bounds, categories, category, custom, onCategoryChange, onCustomChange, onPeriodChange, onProfessionalChange, period, professional, professionals }) {
  return <section className="manager-filter-bar" aria-label="Filtros globales del Dashboard">
    <div className="manager-period-tabs" role="group" aria-label="Periodo">
      {PERIODS.map(([value, label]) => <button aria-pressed={period === value} className={period === value ? "active" : ""} key={value} type="button" onClick={() => onPeriodChange(value)}>{label}</button>)}
    </div>
    {period === "custom" && <div className="manager-custom-range"><label>Desde<input type="date" value={custom.from} onChange={(event) => onCustomChange({ ...custom, from: event.target.value })} /></label><label>Hasta<input min={custom.from} type="date" value={custom.to} onChange={(event) => onCustomChange({ ...custom, to: event.target.value })} /></label></div>}
    <div className="manager-dimension-filters">
      {professionals.length > 0 && <label>Profesional<select value={professional} onChange={(event) => onProfessionalChange(event.target.value)}><option value="all">Todas</option>{professionals.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>}
      {categories.length > 0 && <label>Categoría<select value={category} onChange={(event) => onCategoryChange(event.target.value)}><option value="all">Todas</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>}
    </div>
    <span className="manager-filter-caption">{shortDate(bounds.from)}{bounds.from === bounds.to ? "" : ` – ${shortDate(bounds.to)}`}</span>
  </section>;
}

export function MetricCard({ actionLabel, label, onClick, tone = "default", value }) {
  const content = <><span>{label}</span><strong>{value}</strong>{onClick && <small>{actionLabel || "Ver detalle"} →</small>}</>;
  return onClick
    ? <button className={`manager-metric-card tone-${tone}`} type="button" onClick={onClick}>{content}</button>
    : <article className={`manager-metric-card tone-${tone}`}>{content}</article>;
}

export function DashboardPanel({ action, children, className = "", subtitle, title }) {
  return <section className={`manager-dashboard-panel ${className}`}><header><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action}</header>{children}</section>;
}

export function EmptyState({ children = "No hay datos para este periodo." }) {
  return <div className="manager-empty-state"><span aria-hidden="true">·</span><p>{children}</p></div>;
}

export function StatusBadge({ children, tone = "neutral" }) {
  return <span className={`manager-status-badge ${tone}`}>{children}</span>;
}

export function ResponsiveDataList({ columns, emptyText, rows }) {
  if (!rows.length) return <EmptyState>{emptyText}</EmptyState>;
  return <div className="manager-data-list" role="table"><div className="manager-data-header" role="row">{columns.map((column) => <span key={column.key} role="columnheader">{column.label}</span>)}</div>{rows.map((row, index) => <div className="manager-data-row" key={row.id || row.name || index} role="row">{columns.map((column) => <div data-label={column.label} key={column.key} role="cell">{column.render ? column.render(row) : row[column.key]}</div>)}</div>)}</div>;
}

function BarChart({ data, emptyText, formatLabel, onSelect }) {
  const max = Math.max(...data.map((row) => row.amount), 0);
  if (!data.length || max <= 0) return <EmptyState>{emptyText}</EmptyState>;
  return <div className="manager-bar-chart" role="img" aria-label="Evolución de ventas del periodo">{data.map((row) => {
    const height = Math.max(5, (row.amount / max) * 100);
    return <button key={row.key} type="button" className="manager-chart-column" title={`${row.key}: ${money(row.amount)} · ${row.count} operaciones`} onClick={() => onSelect?.(row)}><span className="manager-chart-value">{compactMoney(row.amount)}</span><i style={{ height: `${height}%` }} /><small>{formatLabel(row.key)}</small></button>;
  })}</div>;
}

function Distribution({ rows, valueKey = "amount", onSelect }) {
  const total = rows.reduce((sum, row) => sum + Number(row[valueKey] || 0), 0);
  if (!rows.length || !total) return <EmptyState />;
  return <div className="manager-distribution">{rows.map((row) => {
    const share = (Number(row[valueKey] || 0) / total) * 100;
    const body = <><div><strong>{row.name}</strong><span>{money(row[valueKey])} · {share.toFixed(1)}%</span></div><span className="manager-progress"><i style={{ width: `${share}%` }} /></span></>;
    return onSelect ? <button key={row.name} type="button" onClick={() => onSelect(row)}>{body}</button> : <article key={row.name}>{body}</article>;
  })}</div>;
}

function ManagerDashboard({ commissionsData = {}, initialPeriod = "month", onNavigate, sourceData = {} }) {
  const today = getTodayLocalDateString();
  const [period, setPeriod] = useState(initialPeriod);
  const [custom, setCustom] = useState({ from: today, to: today });
  const [professional, setProfessional] = useState("all");
  const [category, setCategory] = useState("all");
  const bounds = useMemo(() => periodBounds(period, today, custom), [custom, period, today]);
  const source = useMemo(() => ({ ...sourceData, commissionRows: commissionsData.rows || [] }), [commissionsData.rows, sourceData]);
  const options = useMemo(() => managerFilterOptions(sourceData), [sourceData]);
  const dashboard = useMemo(() => deriveManagerDashboard(source, { bounds, period, professional, category }), [bounds, category, period, professional, source]);
  const { metrics } = dashboard;
  const navigate = (target) => onNavigate?.(target, { bounds, period, professional, category });
  const salesColumns = [
    { key: "name", label: "Profesional" },
    { key: "sales", label: "Ventas", render: (row) => money(row.sales) },
    { key: "services", label: "Servicios" },
    { key: "commission", label: "Comisión", render: (row) => money(row.commission) },
    { key: "share", label: "% total", render: (row) => `${row.share.toFixed(1)}%` },
  ];
  const serviceColumns = [
    { key: "name", label: "Servicio" },
    { key: "units", label: "Unidades" },
    { key: "amount", label: "Facturación", render: (row) => money(row.amount) },
    { key: "share", label: "% total", render: (row) => `${metrics.totalSales ? ((row.amount / metrics.totalSales) * 100).toFixed(1) : "0.0"}%` },
  ];
  const latestClosingDifference = Number(dashboard.latestClosing?.totalDifference ?? dashboard.latestClosing?.summary?.totalDifference ?? 0);

  const choosePeriod = (nextPeriod) => {
    setPeriod(nextPeriod);
    if (nextPeriod === "custom" && !custom.from) setCustom({ from: today, to: today });
  };
  const selectChartPoint = (row) => {
    if (period === "today") return;
    setCustom({ from: row.key, to: row.key });
    setPeriod("custom");
  };

  return <section className="module manager-dashboard">
    <ManagerPageHeader periodText={periodLabel(period, bounds)} />
    <ManagerFilterBar bounds={bounds} categories={options.categories} category={category} custom={custom} onCategoryChange={setCategory} onCustomChange={setCustom} onPeriodChange={choosePeriod} onProfessionalChange={setProfessional} period={period} professional={professional} professionals={options.professionals} />

    <section className="manager-primary-metrics" aria-label="Indicadores principales">
      <MetricCard label="Ventas" value={money(metrics.totalSales)} onClick={() => navigate("sales")} />
      <MetricCard label="Operaciones" value={metrics.salesCount} onClick={() => navigate("operations")} />
      <MetricCard label="Servicios" value={metrics.servicesCount} onClick={() => navigate("services")} />
      <MetricCard label="Ticket medio" value={money(metrics.averageTicket)} onClick={() => navigate("average-ticket")} />
      <MetricCard label="Clientes" value={metrics.clients} onClick={() => navigate("clients")} />
      <MetricCard label="Gastos" value={money(metrics.expenses)} tone="warning" onClick={() => navigate("expenses")} />
      <MetricCard label="Resultado estimado" value={dashboard.hasDimensionFilter ? "No atribuible" : money(metrics.resultEstimated)} tone={dashboard.hasDimensionFilter ? "default" : metrics.resultEstimated < 0 ? "danger" : "success"} onClick={dashboard.hasDimensionFilter ? undefined : () => navigate("result-estimated")} />
    </section>

    <section className="manager-secondary-metrics">
      <MetricCard label="Comisiones pendientes" value={`${metrics.pendingCommissions} · ${money(metrics.pendingCommissionAmount)}`} tone={metrics.pendingCommissions ? "warning" : "success"} onClick={() => navigate("pending-commissions")} />
      <MetricCard label="Clientes nuevos" value={metrics.clientsNew} onClick={() => navigate("new-clients")} />
      <MetricCard label="Clientes recurrentes" value={metrics.clientsRecurring} onClick={() => navigate("recurring-clients")} />
      <MetricCard label="Comisiones pagadas" value={`${metrics.paidCommissions} · ${money(metrics.paidCommissionAmount)}`} onClick={() => navigate("paid-commissions")} />
    </section>

    <section className="manager-dashboard-grid manager-dashboard-grid-featured">
      <DashboardPanel className="manager-sales-chart-panel" title="Evolución de ventas" subtitle="Ventas cobradas y número de operaciones" action={<button className="manager-panel-action" type="button" onClick={() => navigate("sales")}>Ver ventas</button>}>
        <BarChart data={dashboard.salesSeries} emptyText="No hay ventas cobradas para este periodo." formatLabel={(key) => period === "today" ? key : shortDate(key)} onSelect={selectChartPoint} />
      </DashboardPanel>
      <DashboardPanel title="Necesita atención" subtitle="Situaciones reales detectadas">
        {dashboard.alerts.length ? <div className="manager-alert-list">{dashboard.alerts.map((alert) => <button key={`${alert.target}-${alert.label}`} type="button" onClick={() => navigate(alert.target)}><StatusBadge tone={alert.type}>{alert.type === "danger" ? "Revisar" : "Pendiente"}</StatusBadge><span>{alert.label}</span><b>→</b></button>)}</div> : <div className="manager-all-clear"><span>✓</span><div><strong>Todo al día</strong><p>No hay incidencias detectables en este periodo.</p></div></div>}
      </DashboardPanel>
    </section>

    <section className="manager-dashboard-grid">
      <DashboardPanel title="Ventas por categoría" subtitle="Distribución del catálogo real" action={<button className="manager-panel-action" type="button" onClick={() => navigate("categories")}>Ver estadísticas</button>}>
        <Distribution rows={dashboard.categories.slice(0, 7)} onSelect={(row) => setCategory(row.name)} />
      </DashboardPanel>
      <DashboardPanel title="Métodos de pago" subtitle="Cobros registrados, sin restar gastos">
        <Distribution rows={dashboard.paymentMethods} />
      </DashboardPanel>
    </section>

    <DashboardPanel className="manager-wide-panel" title="Rendimiento por profesional" subtitle="Información objetiva del periodo" action={<button className="manager-panel-action" type="button" onClick={() => navigate("professionals")}>Ver estadísticas</button>}>
      <ResponsiveDataList columns={salesColumns} emptyText="No hay actividad por profesional en este periodo." rows={dashboard.professionals} />
    </DashboardPanel>

    <section className="manager-dashboard-grid">
      <DashboardPanel title="Servicios más vendidos" subtitle="Top 5 por unidades">
        <ResponsiveDataList columns={serviceColumns} emptyText="No hay servicios vendidos en este periodo." rows={dashboard.services.slice(0, 5)} />
      </DashboardPanel>
      <DashboardPanel title="Resumen financiero" subtitle="Mismos importes registrados en Finanzas">
        <div className="manager-finance-summary"><div><span>Ingresos</span><strong>{money(metrics.totalSales)}</strong></div><div><span>Gastos del periodo</span><strong>{money(metrics.expenses)}</strong></div><div className={dashboard.hasDimensionFilter ? "" : metrics.resultEstimated < 0 ? "negative" : "positive"}><span>Resultado estimado</span><strong>{dashboard.hasDimensionFilter ? "No atribuible" : money(metrics.resultEstimated)}</strong></div></div>
        <p className="manager-panel-note">{dashboard.hasDimensionFilter ? "Los gastos no tienen atribución por profesional o categoría; por eso no se calcula un resultado parcial engañoso." : "Los gastos por tarjeta permanecen separados de los cobros por tarjeta."}</p>
      </DashboardPanel>
      <DashboardPanel title="Comisiones" subtitle="Generadas y estado de pago" action={<button className="manager-panel-action" type="button" onClick={() => navigate("commissions")}>Ver comisiones</button>}>
        <div className="manager-finance-summary compact"><div><span>Generadas</span><strong>{money(metrics.commissionGenerated)}</strong></div><div><span>Pendientes</span><strong>{money(metrics.pendingCommissionAmount)}</strong></div><div><span>Pagadas</span><strong>{metrics.paidCommissions}</strong></div></div>
      </DashboardPanel>
      <DashboardPanel title="Último cierre" subtitle="Lectura del cierre guardado" action={<button className="manager-panel-action" type="button" onClick={() => navigate("closing")}>Ver cierres</button>}>
        {dashboard.latestClosing ? <div className="manager-closing-summary"><div><span>Fecha</span><strong>{shortDate(dashboard.latestClosing.date)}</strong></div><div><span>Diferencia</span><strong>{money(latestClosingDifference)}</strong></div><StatusBadge tone={Math.abs(latestClosingDifference) < 0.01 ? "success" : "danger"}>{Math.abs(latestClosingDifference) < 0.01 ? "Cuadrado" : "Con diferencia"}</StatusBadge></div> : <EmptyState>No hay cierres guardados en este periodo.</EmptyState>}
      </DashboardPanel>
    </section>
  </section>;
}

export default ManagerDashboard;
