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

function ProfessionalSummary({ sales = [], commissions = [] }) {
  const currentMonth = monthPrefix();
  const monthSales = sales.filter((sale) => operationalDate(sale).startsWith(currentMonth) && saleStatus(sale) === "cobrado");
  const monthCommissions = commissions.filter((commission) => String(commission.date || "").startsWith(currentMonth));
  const sold = monthSales.reduce((total, sale) => total + Number(sale.total || sale.amount || 0), 0);
  const generated = monthCommissions.reduce((total, commission) => total + Number(commission.commissionAmount || 0), 0);
  const pending = monthCommissions.filter((commission) => commission.status !== "pagada").reduce((total, commission) => total + Number(commission.commissionAmount || 0), 0);
  const paid = monthCommissions.filter((commission) => commission.status === "pagada").reduce((total, commission) => total + Number(commission.commissionAmount || 0), 0);

  return (
    <section className="summary-grid compact">
      <article className="metric"><span>Total vendido este mes</span><strong>{money(sold)}</strong></article>
      <article className="metric"><span>Comision generada</span><strong>{money(generated)}</strong></article>
      <article className="metric"><span>Pendiente</span><strong>{money(pending)}</strong></article>
      <article className="metric"><span>Pagado</span><strong>{money(paid)}</strong></article>
    </section>
  );
}

function ProfessionalCommissions({ sales = [], commissions = [] }) {
  const rows = [...(commissions || [])].sort((first, second) => String(second.date || "").localeCompare(String(first.date || "")));

  return (
    <section className="module">
      <div className="section-title">
        <div>
          <h2>Mis comisiones</h2>
          <span>Comisiones generadas, pendientes y pagadas</span>
        </div>
      </div>
      <ProfessionalSummary sales={sales} commissions={commissions} />
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
          {rows.length === 0 && <p className="empty-state">No hay comisiones asociadas a tu usuario.</p>}
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
