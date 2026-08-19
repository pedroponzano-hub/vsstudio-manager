function money(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value || 0);
}

function percent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

const dashboardViews = {
  empleado: ["today"],
  encargado: ["today"],
  administrador: ["today", "month"],
};

const incomeRows = [
  ["Ingresos en efectivo", "Efectivo"],
  ["Ingresos en tarjeta", "Tarjeta"],
  ["Ingresos en Bizum", "Bizum"],
  ["Ingresos por transferencia", "Transferencia"],
  ["Ingresos Treatwell", "Treatwell"],
  ["Otros ingresos", "Otros"],
];

const expenseRows = [
  ["Gastos en efectivo", "Efectivo"],
  ["Gastos en tarjeta", "Tarjeta"],
  ["Gastos por transferencia", "Transferencia"],
  ["Gastos por Bizum", "Bizum"],
  ["Otros gastos", "Otros"],
];

const commissionRows = [
  ["Comisiones pagadas en efectivo", "Efectivo"],
  ["Comisiones pagadas con tarjeta", "Tarjeta"],
  ["Comisiones pagadas por transferencia", "Transferencia"],
  ["Comisiones pagadas por Bizum", "Bizum"],
  ["Otras comisiones pagadas", "Otros"],
];

function CashSummaryBlock({ title, summary = {} }) {
  const incomeByMethod = summary.incomeByMethod || {};
  const expensesByMethod = summary.expensesByMethod || {};
  const commissionsByMethod = summary.commissionsByMethod || {};

  return (
    <section className="panel dashboard-cash-panel">
      <div className="section-title compact-title">
        <h3>{title}</h3>
        <span>Ingresos cobrados y gastos pagados</span>
      </div>
      <div className="dashboard-cash-grid">
        <article>
          <h4>Ingresos</h4>
          <div className="list">
            {incomeRows.map(([label, method]) => (
              <div className="stat-row" key={method}><span>{label}</span><strong>{money(incomeByMethod[method])}</strong></div>
            ))}
            <div className="stat-row total"><span>Total ingresos</span><strong>{money(summary.totalIncome)}</strong></div>
          </div>
        </article>
        <article>
          <h4>Gastos</h4>
          <div className="list">
            {expenseRows.map(([label, method]) => (
              <div className="stat-row" key={method}><span>{label}</span><strong>{money(expensesByMethod[method])}</strong></div>
            ))}
            <div className="stat-row total"><span>Total gastos</span><strong>{money(summary.totalExpenses)}</strong></div>
          </div>
        </article>
        <article>
          <h4>Comisiones pagadas</h4>
          <div className="list">
            {commissionRows.map(([label, method]) => (
              <div className="stat-row" key={method}><span>{label}</span><strong>{money(commissionsByMethod[method])}</strong></div>
            ))}
            <div className="stat-row total"><span>Total comisiones pagadas</span><strong>{money(summary.totalCommissions)}</strong></div>
          </div>
        </article>
        <article className="dashboard-cash-result">
          <span>Resultado neto</span>
          <strong>{money(summary.netResult)}</strong>
        </article>
      </div>
    </section>
  );
}

function DailyCollectionsBlock({ summary = {} }) {
  const incomeByMethod = summary.incomeByMethod || {};

  return (
    <section className="panel dashboard-cash-panel">
      <div className="section-title compact-title">
        <h3>Cobros por método de pago del día</h3>
        <span>Solo cobros registrados hoy</span>
      </div>
      <div className="list">
        {incomeRows.map(([label, method]) => (
          <div className="stat-row" key={method}><span>{label}</span><strong>{money(incomeByMethod[method])}</strong></div>
        ))}
        <div className="stat-row total"><span>Total cobrado hoy</span><strong>{money(summary.totalIncome)}</strong></div>
      </div>
    </section>
  );
}

function Dashboard({ data, viewMode = "administrador", section = "all" }) {
  const visibleSections = dashboardViews[viewMode] || dashboardViews.administrador;
  const showToday = section === "all" || section === "today";
  const showMonth = section === "all" || section === "month";

  return (
    <section className="module">
      <div className="section-title">
        <h2>{section === "month" ? "Resumen mensual" : "Resumen diario"}</h2>
        <span>Dashboard operativo</span>
      </div>

      {showToday && visibleSections.includes("today") && (
        <>
          <h3>Hoy</h3>
          {viewMode === "encargado" ? (
            <>
              <div className="summary-grid">
                <article className="metric"><span>Ventas del día</span><strong>{money(data.today.grossSales)}</strong></article>
                <article className="metric"><span>Número de ventas</span><strong>{data.today.salesCount || 0}</strong></article>
                <article className="metric"><span>Servicios realizados</span><strong>{data.today.servicesCount || 0}</strong></article>
                <article className="metric"><span>Ticket medio del día</span><strong>{money(data.today.averageTicket)}</strong></article>
                <article className="metric"><span>Clientes atendidos</span><strong>{data.today.clients}</strong></article>
                <article className="metric"><span>Citas del día</span><strong>{data.today.appointmentsCount || 0}</strong></article>
              </div>
              <DailyCollectionsBlock summary={data.today.cashSummary} />
            </>
          ) : (
            <>
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
              <CashSummaryBlock title="Resumen de caja del dia" summary={data.today.cashSummary} />
            </>
          )}
        </>
      )}

      {showToday && (
        <>
          <h3>Pendientes</h3>
          <div className="summary-grid compact">
            <article className="metric"><span>Pendientes de cobro</span><strong>{data.pending?.count || 0}</strong></article>
            <article className="metric"><span>Importe pendiente</span><strong>{money(data.pending?.total || 0)}</strong></article>
          </div>
        </>
      )}

      {showMonth && visibleSections.includes("month") && (
        <>
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
          <CashSummaryBlock title="Resumen de caja del mes" summary={data.month.cashSummary} />
        </>
      )}
    </section>
  );
}

export default Dashboard;
