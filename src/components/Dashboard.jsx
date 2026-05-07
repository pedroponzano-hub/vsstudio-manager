function money(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value || 0);
}

function percent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function Dashboard({ data }) {
  return (
    <section className="module">
      <div className="section-title">
        <h2>Dashboard</h2>
        <span>Resumen operativo</span>
      </div>

      <h3>Hoy</h3>
      <div className="summary-grid">
        <article className="metric"><span>Ventas brutas</span><strong>{money(data.today.grossSales)}</strong></article>
        <article className="metric"><span>IVA estimado</span><strong>{money(data.today.ivaAmount)}</strong></article>
        <article className="metric"><span>Ventas netas sin IVA</span><strong>{money(data.today.netWithoutVat)}</strong></article>
        <article className="metric"><span>Comisiones totales</span><strong>{money(data.today.commissionAmount)}</strong></article>
        <article className="metric"><span>Resultado despues IVA y comisiones</span><strong>{money(data.today.netAfterCommission)}</strong></article>
        <article className="metric"><span>Gastos</span><strong>{money(data.today.expenses)}</strong></article>
        <article className="metric"><span>Beneficio</span><strong>{money(data.today.profit)}</strong></article>
        <article className="metric"><span>Clientes</span><strong>{data.today.clients}</strong></article>
        <article className="metric"><span>Ticket medio</span><strong>{money(data.today.averageTicket)}</strong></article>
      </div>

      <h3>Mes</h3>
      <div className="summary-grid">
        <article className="metric"><span>Ventas brutas</span><strong>{money(data.month.grossSales)}</strong></article>
        <article className="metric"><span>IVA estimado</span><strong>{money(data.month.ivaAmount)}</strong></article>
        <article className="metric"><span>Ventas netas sin IVA</span><strong>{money(data.month.netWithoutVat)}</strong></article>
        <article className="metric"><span>Comisiones totales</span><strong>{money(data.month.commissionAmount)}</strong></article>
        <article className="metric"><span>Resultado despues IVA y comisiones</span><strong>{money(data.month.netAfterCommission)}</strong></article>
        <article className="metric"><span>Gastos acumulados</span><strong>{money(data.month.expenses)}</strong></article>
        <article className="metric"><span>Beneficio</span><strong>{money(data.month.profit)}</strong></article>
        <article className="metric"><span>Margen</span><strong>{percent(data.month.margin)}</strong></article>
        <article className="metric"><span>Objetivo mensual</span><strong>{money(data.month.goal)}</strong></article>
        <article className="metric"><span>Cumplido</span><strong>{percent(data.month.completion)}</strong></article>
        <article className="metric"><span>Prediccion cierre</span><strong>{money(data.month.predictedClose)}</strong></article>
      </div>
    </section>
  );
}

export default Dashboard;
