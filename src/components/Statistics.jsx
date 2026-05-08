import { useMemo, useState } from "react";
import DataService from "../services/DataService.js";

function money(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
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

function Statistics({ dataVersion }) {
  const [draftFilters, setDraftFilters] = useState({ from: "", to: "" });
  const [filters, setFilters] = useState({ from: "", to: "" });
  const stats = useMemo(() => DataService.getStats(filters), [filters, dataVersion]);

  const applyFilters = (event) => {
    event.preventDefault();
    setFilters(draftFilters);
  };

  const clearFilters = () => {
    const empty = { from: "", to: "" };
    setDraftFilters(empty);
    setFilters(empty);
  };

  return (
    <section className="module">
      <div className="section-title">
        <h2>Estadisticas</h2>
        <span>Rango de fechas y lectura rapida</span>
      </div>

      <form className="panel filters-panel" onSubmit={applyFilters}>
        <label>Fecha desde<input type="date" value={draftFilters.from} onChange={(event) => setDraftFilters({ ...draftFilters, from: event.target.value })} /></label>
        <label>Fecha hasta<input type="date" value={draftFilters.to} onChange={(event) => setDraftFilters({ ...draftFilters, to: event.target.value })} /></label>
        <button type="submit">Aplicar filtro</button>
        <button className="secondary-button" type="button" onClick={clearFilters}>Limpiar filtro</button>
      </form>

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
      <ChannelStatsBlock rows={stats.salesByChannel} />
      <EmployeeCommissions rows={stats.employeeCommissions} />

      <div className="cards-grid">
        <StatBlock title="Metodos de pago del rango" data={stats.paymentMethods} />
        <StatBlock title="Gastos por categoria del rango" data={stats.expensesByCategory} />
        <StatBlock title="Ventas por empleada" data={stats.salesByEmployee} />
        <StatBlock title="Ventas por servicio" data={stats.salesByService} />
        <RankingBlock title="Servicios mas vendidos" rows={stats.serviceRankings.byCount} valueType="count" />
        <RankingBlock title="Servicios por facturacion" rows={stats.serviceRankings.byRevenue} valueType="revenue" />
      </div>
    </section>
  );
}

export default Statistics;
