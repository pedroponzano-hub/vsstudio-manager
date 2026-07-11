import { useMemo, useState } from "react";
import { getTodayLocalDateString } from "../utils/date.js";

function money(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function operationalDate(item = {}) {
  return item.fechaOperativa || item.date || "";
}

function saleStatus(sale = {}) {
  const status = String(sale.status || "cobrado").toLowerCase();
  if (status === "editada") return "cobrado";
  return status || "cobrado";
}

function monthPrefix() {
  return getTodayLocalDateString().slice(0, 7);
}

function previousMonthPrefix() {
  const today = getTodayLocalDateString();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  return `${previousYear}-${String(previousMonth).padStart(2, "0")}`;
}

function periodRange(period) {
  const today = getTodayLocalDateString();
  if (period === "currentMonth") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (period === "previousMonth") {
    const previous = previousMonthPrefix();
    const lastDay = new Date(Number(previous.slice(0, 4)), Number(previous.slice(5, 7)), 0).getDate();
    return { from: `${previous}-01`, to: `${previous}-${String(lastDay).padStart(2, "0")}` };
  }
  if (period === "currentYear") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from: "", to: "" };
}

function inRange(date, range) {
  if (!date) return false;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

function ProfessionalSummary({ commissions = [] }) {
  const sold = commissions.reduce((total, commission) => total + Number(commission.saleTotal || 0), 0);
  const generated = commissions.reduce((total, commission) => total + Number(commission.commissionAmount || 0), 0);
  const pending = commissions.filter((commission) => commission.status !== "pagada").reduce((total, commission) => total + Number(commission.commissionAmount || 0), 0);
  const paid = commissions.filter((commission) => commission.status === "pagada").reduce((total, commission) => total + Number(commission.commissionAmount || 0), 0);

  return (
    <section className="summary-grid compact">
      <article className="metric"><span>Total vendido</span><strong>{money(sold)}</strong></article>
      <article className="metric"><span>Comision generada</span><strong>{money(generated)}</strong></article>
      <article className="metric"><span>Pendiente</span><strong>{money(pending)}</strong></article>
      <article className="metric"><span>Pagado</span><strong>{money(paid)}</strong></article>
    </section>
  );
}

function ProfessionalCommissions({ sales = [], commissions = [] }) {
  const initialRange = periodRange("currentMonth");
  const [period, setPeriod] = useState("currentMonth");
  const [draftRange, setDraftRange] = useState(initialRange);
  const [range, setRange] = useState(initialRange);
  const rows = useMemo(() => (
    [...(commissions || [])]
      .filter((commission) => inRange(String(commission.date || ""), range))
      .sort((first, second) => `${second.date || ""} ${second.hour || ""}`.localeCompare(`${first.date || ""} ${first.hour || ""}`))
  ), [commissions, range]);

  const changePeriod = (nextPeriod) => {
    setPeriod(nextPeriod);
    if (nextPeriod === "custom") return;
    const nextRange = periodRange(nextPeriod);
    setDraftRange(nextRange);
    setRange(nextRange);
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setRange(draftRange);
  };

  const clearFilters = () => {
    const nextRange = periodRange("currentMonth");
    setPeriod("currentMonth");
    setDraftRange(nextRange);
    setRange(nextRange);
  };

  return (
    <section className="module">
      <div className="section-title">
        <div>
          <h2>Mis comisiones</h2>
          <span>Comisiones generadas, pendientes y pagadas</span>
        </div>
      </div>

      <form className="panel filters-panel" onSubmit={applyFilters}>
        <label>Periodo<select value={period} onChange={(event) => changePeriod(event.target.value)}>
          <option value="currentMonth">Mes actual</option>
          <option value="previousMonth">Mes anterior</option>
          <option value="currentYear">Año actual</option>
          <option value="custom">Rango personalizado</option>
        </select></label>
        <label>Fecha desde<input type="date" value={draftRange.from} onChange={(event) => {
          setPeriod("custom");
          setDraftRange((current) => ({ ...current, from: event.target.value }));
        }} /></label>
        <label>Fecha hasta<input type="date" value={draftRange.to} onChange={(event) => {
          setPeriod("custom");
          setDraftRange((current) => ({ ...current, to: event.target.value }));
        }} /></label>
        <button type="submit">Aplicar filtro</button>
        <button className="secondary-button" type="button" onClick={clearFilters}>Limpiar filtro</button>
      </form>

      <ProfessionalSummary sales={sales} commissions={rows} />
      <section className="panel">
        <div className="finance-table">
          <div className="finance-header professional-commissions-row">
            <span>Fecha</span><span>Hora</span><span>Servicio</span><span>Venta asociada</span><span>% aplicado</span><span>Importe comision</span><span>Estado</span>
          </div>
          {rows.map((row) => (
            <div className="finance-row professional-commissions-row" key={row.saleId || row.id}>
              <span>{row.date || "-"}</span>
              <span>{row.hour || "-"}</span>
              <span>{row.services || "Sin servicio"}</span>
              <strong>{money(row.saleTotal)}</strong>
              <strong>{Number(row.commissionPercent || 0).toFixed(2)}%</strong>
              <strong>{money(row.commissionAmount)}</strong>
              <span className={row.status === "pagada" ? "status-badge paid" : "status-badge pending"}>{row.status === "pagada" ? "pagada" : "pendiente"}</span>
            </div>
          ))}
          {rows.length === 0 && <p className="empty-state">No tienes comisiones registradas en este periodo.</p>}
        </div>
      </section>
    </section>
  );
}

function ProfessionalAgenda({ appointments = [] }) {
  const rows = [...(appointments || [])].sort((first, second) => `${first.date || ""} ${first.startTime || first.time || ""}`.localeCompare(`${second.date || ""} ${second.startTime || second.time || ""}`));

  return (
    <section className="module">
      <div className="section-title">
        <div>
          <h2>Mi agenda</h2>
          <span>Citas asignadas a tu usuario</span>
        </div>
      </div>
      <section className="panel">
        <div className="finance-table">
          <div className="finance-header professional-agenda-row">
            <span>Fecha</span><span>Hora</span><span>Cliente</span><span>Servicio</span><span>Duracion</span><span>Estado</span>
          </div>
          {rows.map((appointment) => (
            <div className="finance-row professional-agenda-row" key={appointment.id}>
              <span>{appointment.date || "-"}</span>
              <span>{appointment.startTime || appointment.time || "-"}</span>
              <span>{appointment.clientName || "Sin cliente"}</span>
              <span>{appointment.serviceName || appointment.service || "Sin servicio"}</span>
              <span>{appointment.duration || "-"}</span>
              <strong>{appointment.status || "Pendiente"}</strong>
            </div>
          ))}
          {rows.length === 0 && <p className="empty-state">No hay citas asociadas a tu usuario.</p>}
        </div>
      </section>
    </section>
  );
}

export { ProfessionalAgenda, ProfessionalCommissions };
