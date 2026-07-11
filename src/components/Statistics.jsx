import { useMemo, useState } from "react";
import SaleList from "./SaleList.jsx";
import SalesForm from "./SalesForm.jsx";
import DataService from "../services/DataService.js";
import { getLocalStartOfWeek, getTodayLocalDateString } from "../utils/date.js";

function money(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

const periodOptions = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "year", label: "Año" },
  { value: "custom", label: "Rango personalizado" },
];

function getStatsRange(period) {
  const today = getTodayLocalDateString();
  if (period === "today") return { from: today, to: today };
  if (period === "week") return { from: getLocalStartOfWeek(today), to: today };
  if (period === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (period === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from: "", to: "" };
}

function StatBlock({ title, data }) {
  const entries = Object.entries(data);

  return (
    <article className="panel">
      <h3>{title}</h3>
      <div className="list">
        {entries.length === 0 && <p className="empty-state">Sin datos en el rango.</p>}
        {entries.map(([name, amount]) => (
          <div className="stat-row" key={name}>
            <span>{name}</span>
            <strong>{money(amount)}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function RankingBlock({ title, rows, valueType }) {
  return (
    <article className="panel">
      <h3>{title}</h3>
      <div className="list">
        {rows.length === 0 && <p className="empty-state">Sin datos en el rango.</p>}
        {rows.slice(0, 10).map((row, index) => (
          <div className="stat-row" key={`${row.serviceId || row.serviceName}-${index}`}>
            <span>{index + 1}. {row.serviceName}</span>
            <strong>{valueType === "count" ? `${row.count} ventas` : money(row.revenue)}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function ChannelStatsBlock({ rows }) {
  return (
    <article className="panel wide-panel">
      <h3>Ventas por canal</h3>
      <div className="channel-stats">
        {rows.length === 0 && <p className="empty-state">Sin datos en el rango.</p>}
        {rows.map((row) => (
          <div className="channel-row" key={row.channel}>
            <span>{row.channel}</span>
            <strong>{money(row.amount)}</strong>
            <small>{row.count} ventas</small>
            <small>Ticket medio {money(row.averageTicket)}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

function EmployeeCommissions({ rows }) {
  return (
    <article className="panel wide-panel">
      <h3>Comisiones por empleada</h3>
      <div className="commission-table">
        <div className="commission-header">
          <span>Empleada</span>
          <span>Comision total</span>
          <span>Servicios / ventas</span>
        </div>
        {rows.length === 0 && <p className="empty-state">Sin ventas en el rango.</p>}
        {rows.map((row) => (
          <div className="commission-row" key={row.employee}>
            <strong>{row.employee}</strong>
            <span>{money(row.commissionAmount)}</span>
            <span>{row.servicesCount} servicios / {row.salesCount} ventas</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function SalesByDayTable({ data }) {
  const entries = Object.entries(data).sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate));
  const max = Math.max(...entries.map(([, amount]) => amount), 1);

  return (
    <article className="panel wide-panel">
      <h3>Ventas por dia</h3>
      <div className="sales-day-table">
        {entries.length === 0 && <p className="empty-state">Sin ventas en el rango.</p>}
        {entries.map(([date, amount]) => (
          <div className="day-row" key={date}>
            <span>{date}</span>
            <div className="day-bar"><span style={{ width: `${(amount / max) * 100}%` }} /></div>
            <strong>{money(amount)}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function BusinessAreaSales({ rows }) {
  const max = Math.max(...rows.map((row) => row.amount), 1);

  return (
    <article className="panel wide-panel">
      <h3>Ventas por área de negocio</h3>
      <div className="finance-table">
        <div className="finance-header business-area-row">
          <span>Área</span>
          <span>Ventas</span>
          <span>Nº servicios</span>
          <span>% sobre total</span>
        </div>
        {rows.length === 0 && <p className="empty-state">Sin ventas en el rango.</p>}
        {rows.map((row) => (
          <div className="finance-row business-area-row" key={row.area}>
            <span className="business-area-name">
              <span>{row.area}</span>
              <div className="day-bar"><span style={{ width: `${(row.amount / max) * 100}%` }} /></div>
            </span>
            <strong>{money(row.amount)}</strong>
            <span>{row.servicesCount}</span>
            <strong>{row.percent.toFixed(1)}%</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function PaymentMethodSales({ rows }) {
  const max = Math.max(...rows.map((row) => row.amount), 1);

  return (
    <article className="panel wide-panel">
      <h3>Ventas por metodo de pago</h3>
      <div className="finance-table">
        <div className="finance-header payment-method-stats-row">
          <span>Metodo</span>
          <span>Importe cobrado</span>
          <span>Nº ventas</span>
          <span>% sobre total</span>
        </div>
        {rows.length === 0 && <p className="empty-state">Sin ventas en el rango.</p>}
        {rows.map((row) => (
          <div className="finance-row payment-method-stats-row" key={row.method}>
            <span className="business-area-name">
              <span>{row.method}</span>
              <div className="day-bar"><span style={{ width: `${(row.amount / max) * 100}%` }} /></div>
            </span>
            <strong>{money(row.amount)}</strong>
            <span>{row.count}</span>
            <strong>{row.percent.toFixed(1)}%</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function Statistics({
  dataVersion,
  clients,
  view = "category",
  selectedSaleDate,
  onDateSelect,
  onUpdateSale,
  onDeleteSale,
  onCreateClient,
  onCreateService,
  canCreateService = false,
  canEditSaleDate = false,
  canEditCommission = false,
}) {
  const initialFilters = getStatsRange("month");
  const [periodFilter, setPeriodFilter] = useState("month");
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [editingSale, setEditingSale] = useState(null);
  const stats = useMemo(() => DataService.getStats(filters), [filters, dataVersion]);
  const pageCopy = {
    category: ["Ventas por categoria", "Areas comerciales y facturacion por servicio"],
    employee: ["Ventas por empleada", "Rendimiento por profesional"],
    channels: ["Canales de origen", "Ventas por canal de entrada"],
    commissions: ["Comisiones", "Comisiones generadas por empleada"],
    overview: ["Estadisticas", "Rango de fechas y lectura rapida"],
  }[view] || ["Estadisticas", "Rango de fechas y lectura rapida"];

  const applyFilters = (event) => {
    event.preventDefault();
    setFilters(draftFilters);
  };

  const changePeriod = (period) => {
    setPeriodFilter(period);
    if (period === "custom") return;
    const range = getStatsRange(period);
    setDraftFilters(range);
    setFilters(range);
  };

  const clearFilters = () => {
    const empty = { from: "", to: "" };
    setPeriodFilter("custom");
    setDraftFilters(empty);
    setFilters(empty);
  };

  return (
    <section className="module">
      <div className="section-title">
        <h2>{pageCopy[0]}</h2>
        <span>{pageCopy[1]}</span>
      </div>

      <form className="panel filters-panel" onSubmit={applyFilters}>
        <label>Periodo<select value={periodFilter} onChange={(event) => changePeriod(event.target.value)}>
          {periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>
        <label>Fecha desde<input type="date" value={draftFilters.from} onChange={(event) => {
          setPeriodFilter("custom");
          setDraftFilters({ ...draftFilters, from: event.target.value });
        }} /></label>
        <label>Fecha hasta<input type="date" value={draftFilters.to} onChange={(event) => {
          setPeriodFilter("custom");
          setDraftFilters({ ...draftFilters, to: event.target.value });
        }} /></label>
        <button type="submit">Aplicar filtro</button>
        <button className="secondary-button" type="button" onClick={clearFilters}>Limpiar filtro</button>
      </form>

      {view === "category" && (
        <>
          <BusinessAreaSales rows={stats.salesByBusinessArea} />
          <PaymentMethodSales rows={stats.paymentMethodBreakdown || []} />
        </>
      )}
      {view === "employee" && <StatBlock title="Ventas por empleada" data={stats.salesByEmployee} />}
      {view === "channels" && <ChannelStatsBlock rows={stats.salesByChannel} />}
      {view === "commissions" && <EmployeeCommissions rows={stats.employeeCommissions} />}
      {view === "overview" && (
        <>
          <div className="summary-grid compact">
            <article className="metric"><span>Total ventas</span><strong>{money(stats.totalSales)}</strong></article>
            <article className="metric"><span>Total IVA</span><strong>{money(stats.totalIva)}</strong></article>
            <article className="metric"><span>Total neto sin IVA</span><strong>{money(stats.totalNetWithoutVat)}</strong></article>
            <article className="metric"><span>Total comisiones</span><strong>{money(stats.totalCommissions)}</strong></article>
            <article className="metric"><span>Resultado neto</span><strong>{money(stats.netAfterVatAndCommissions)}</strong></article>
            <article className="metric"><span>Total gastos</span><strong>{money(stats.totalExpenses)}</strong></article>
            <article className="metric"><span>Beneficio</span><strong>{money(stats.profit)}</strong></article>
            <article className="metric"><span>Ticket medio</span><strong>{money(stats.averageTicket)}</strong></article>
          </div>
          <SalesByDayTable data={stats.salesByDay} />
          <div className="cards-grid">
            <StatBlock title="Metodos de pago del rango" data={stats.paymentMethods} />
            <StatBlock title="Gastos por categoria del rango" data={stats.expensesByCategory} />
            <StatBlock title="Ventas por servicio" data={stats.salesByService} />
            <RankingBlock title="Servicios mas vendidos" rows={stats.serviceRankings.byCount} valueType="count" />
            <RankingBlock title="Servicios por facturacion" rows={stats.serviceRankings.byRevenue} valueType="revenue" />
          </div>
        </>
      )}

      {editingSale && (
        <section className="sale-history-modal" role="dialog" aria-modal="true" aria-label="Editar venta">
          <article className="statistics-edit-dialog">
            <div className="section-title">
              <div>
                <h2>Editar venta</h2>
                <span>Los cambios se guardan sin salir de Estadisticas</span>
              </div>
              <button className="secondary-button" type="button" onClick={() => setEditingSale(null)}>Cerrar</button>
            </div>
            <SalesForm
              key={editingSale.id}
              clients={dataVersion.clients || []}
              config={dataVersion.config || {}}
              editingSale={editingSale}
              onSave={() => {}}
              onUpdate={(saleId, updates) => {
                onUpdateSale?.(saleId, updates);
                setEditingSale(null);
              }}
              onCreateClient={onCreateClient}
              onCreateService={onCreateService}
              canCreateService={canCreateService}
              canEditSaleDate={canEditSaleDate}
              canEditCommission={canEditCommission}
              onCancelEdit={() => setEditingSale(null)}
              onDateChange={() => {}}
            />
          </article>
        </section>
      )}
    </section>
  );
}

export default Statistics;
