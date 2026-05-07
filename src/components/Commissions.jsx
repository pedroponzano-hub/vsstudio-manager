function money(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function Commissions({ data, onStatusChange }) {
  const { rows, totals } = data;
  const employeeTotals = Object.entries(totals.byEmployee || {}).sort((first, second) => second[1] - first[1]);

  return (
    <section className="module">
      <div className="section-title">
        <div>
          <h2>Comisiones</h2>
          <span>Seguimiento de pagos por empleada</span>
        </div>
      </div>

      <div className="summary-grid compact">
        <article className="metric"><span>Total generado</span><strong>{money(totals.generated)}</strong></article>
        <article className="metric"><span>Pendiente</span><strong>{money(totals.pending)}</strong></article>
        <article className="metric"><span>Pagado</span><strong>{money(totals.paid)}</strong></article>
        <article className="metric"><span>Registros</span><strong>{rows.length}</strong></article>
      </div>

      <div className="cards-grid">
        <article className="panel">
          <h3>Total por empleada</h3>
          <div className="list">
            {employeeTotals.length === 0 && <p className="empty-state">Sin comisiones generadas.</p>}
            {employeeTotals.map(([employee, amount]) => (
              <div className="stat-row" key={employee}>
                <span>{employee}</span>
                <strong>{money(amount)}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel wide-panel commission-list-panel">
          <h3>Comisiones generadas desde ventas</h3>
          <div className="commission-cards">
            {rows.length === 0 && <p className="empty-state">No hay ventas con comision.</p>}
            {rows.map((row) => (
              <article className="commission-card" key={row.saleId}>
                <div className="commission-card-main">
                  <strong>{row.services}</strong>
                  <span>{row.client} - {row.date} - {row.employee}</span>
                </div>
                <div className="commission-card-numbers">
                  <span>Venta {money(row.saleTotal)}</span>
                  <span>{row.commissionPercent}% - {money(row.commissionAmount)}</span>
                </div>
                <div className="commission-status-control">
                  <span className={row.status === "pagada" ? "status-badge paid" : "status-badge pending"}>
                    {row.status}
                  </span>
                  <select value={row.status} onChange={(event) => onStatusChange(row.saleId, event.target.value)}>
                    <option value="pendiente">pendiente</option>
                    <option value="pagada">pagada</option>
                  </select>
                </div>
              </article>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

export default Commissions;
