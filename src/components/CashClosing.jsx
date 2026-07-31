import { useEffect, useMemo, useState } from "react";
import { getMadridTimestamp, getTodayLocalDateString } from "../utils/date.js";

const paymentMethods = ["Efectivo", "Tarjeta", "Transferencia", "Bizum", "Treatwell", "Bono / tarjeta regalo", "Otro"];

function todayDate() {
  return getTodayLocalDateString();
}

function money(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function normalizeMethod(method = "") {
  const value = String(method).trim().toLowerCase();
  if (["bono", "bonos", "tarjeta regalo", "bono / tarjeta regalo"].includes(value)) return "Bono / tarjeta regalo";
  if (value.includes("transferencia")) return "Transferencia";
  if (value.includes("bizum")) return "Bizum";
  if (value.includes("efectivo")) return "Efectivo";
  if (value.includes("tarjeta")) return "Tarjeta";
  if (value.includes("treatwell")) return "Treatwell";
  return paymentMethods.find((item) => item.toLowerCase() === value) || "Otro";
}

function salePayments(sale) {
  if (Array.isArray(sale.payments) && sale.payments.length > 0) return sale.payments;
  return sale.paymentMethod ? [{ method: sale.paymentMethod, amount: Number(sale.total || sale.amount || 0) }] : [];
}

function saleStatus(sale) {
  const status = String(sale.status || "cobrado").toLowerCase();
  if (status === "pendiente_pago" || status === "cancelado" || status === "anulada" || status === "servicio_interno") return status;
  if (status === "editada") return "cobrado";
  return "cobrado";
}

function saleIsEdited(sale) {
  return Boolean(sale.editada || sale.editedAt || String(sale.status || "").toLowerCase() === "editada");
}

function isCollectedSale(sale) {
  return saleStatus(sale) === "cobrado";
}

function operationalDate(item = {}) {
  return item.saleDate || item.fechaOperativa || item.date || "";
}

function saleServicesText(sale) {
  if (Array.isArray(sale.services) && sale.services.length > 0) {
    return sale.services.map((service) => service.serviceName || service.name).filter(Boolean).join(", ");
  }

  return sale.service || "Venta";
}

function saleStatusLabel(sale) {
  if (saleStatus(sale) === "anulada") return "Anulada";
  if (saleStatus(sale) === "cobrado" && saleIsEdited(sale)) return "Cobrada · Editada";
  if (saleStatus(sale) === "cobrado") return "Cobrada";
  if (saleStatus(sale) === "pendiente_pago") return "Pendiente de pago";
  if (saleStatus(sale) === "cancelado") return "Cancelada";
  if (saleStatus(sale) === "servicio_interno") return "Servicio interno";
  return "Cobrada";
}

function groupSalesByMethod(sales) {
  return sales.flatMap(salePayments).reduce((groups, payment) => {
    const method = normalizeMethod(payment.method);
    groups[method] = (groups[method] || 0) + Number(payment.amount || 0);
    return groups;
  }, Object.fromEntries(paymentMethods.map((method) => [method, 0])));
}

function groupPaidExpensesByMethod(expenses) {
  return expenses
    .filter((expense) => expense.status !== "pendiente")
    .reduce((groups, expense) => {
      const method = normalizeMethod(expense.paymentMethod);
      groups[method] = (groups[method] || 0) + Number(expense.amount || 0);
      return groups;
    }, Object.fromEntries(paymentMethods.map((method) => [method, 0])));
}

function groupPaidCommissionsByMethod(commissions) {
  return commissions
    .filter((commission) => commission.status === "pagada")
    .reduce((groups, commission) => {
      const method = normalizeMethod(commission.metodoPagoComision || commission.paymentMethod);
      groups[method] = (groups[method] || 0) + Number(commission.commissionAmount || 0);
      return groups;
    }, Object.fromEntries(paymentMethods.map((method) => [method, 0])));
}

function cardTipsTotal(sales) {
  return sales.reduce((total, sale) => total + Number(sale.cardTipAmount || 0), 0);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildReportHtml(closing, snapshot) {
  const generatedAt = getMadridTimestamp().replace("T", " ");
  const cardSummary = snapshot.summary.card || {};
  const rowsHtml = snapshot.rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.method)}</td>
      <td>${money(row.registered)}</td>
      <td>${money(row.real)}</td>
      <td>${money(row.difference)}</td>
      <td>${money(row.expenses)}</td>
      <td>${money(row.paidCommissions)}</td>
      <td>${money(row.treatwellCommission)}</td>
      <td>${money(row.finalBalance)}</td>
    </tr>
  `).join("");
  const expensesHtml = paymentMethods.map((method) => `
    <tr><td>${escapeHtml(method)}</td><td>${money(snapshot.paidExpenses[method])}</td></tr>
  `).join("");
  const commissionsHtml = paymentMethods.map((method) => `
    <tr><td>${escapeHtml(method)}</td><td>${money(snapshot.paidCommissions[method])}</td></tr>
  `).join("");
  const salesAuditHtml = snapshot.auditSales.map((sale) => `
    <tr>
      <td>${escapeHtml(saleServicesText(sale))}</td>
      <td>${escapeHtml(sale.clientName || "Cliente mostrador")}</td>
      <td>${escapeHtml(saleStatusLabel(sale))}</td>
      <td>${escapeHtml(saleStatus(sale) === "anulada" ? (sale.voidReason || sale.cancelReason || "-") : "-")}</td>
      <td>${saleStatus(sale) === "anulada" ? "No suma" : money(sale.total || sale.amount)}</td>
    </tr>
  `).join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Reporte de Cierre de Caja ${escapeHtml(closing.date)}</title>
      <style>
        @page { size: A4; margin: 18mm; }
        body { color: #1f1b16; font-family: Arial, sans-serif; margin: 0; }
        .page { max-width: 210mm; }
        .brand { color: #9a7a34; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        h1 { font-size: 26px; margin: 8px 0 18px; }
        h2 { border-bottom: 1px solid #e1d8c8; font-size: 15px; margin: 24px 0 10px; padding-bottom: 6px; }
        .meta { display: grid; gap: 8px; grid-template-columns: repeat(2, 1fr); margin-bottom: 18px; }
        .box { background: #fbf8f1; border: 1px solid #eadfcb; border-radius: 8px; padding: 10px 12px; }
        .box span { color: #766e62; display: block; font-size: 11px; margin-bottom: 4px; }
        .box strong { font-size: 15px; }
        table { border-collapse: collapse; font-size: 12px; width: 100%; }
        th { background: #f4ead8; color: #4a4034; text-align: left; }
        th, td { border: 1px solid #e8dfd1; padding: 8px; }
        td:not(:first-child), th:not(:first-child) { text-align: right; }
        .observations { min-height: 58px; white-space: pre-wrap; }
        .footer { color: #766e62; font-size: 11px; margin-top: 24px; text-align: right; }
      </style>
    </head>
    <body>
      <main class="page">
        <div class="brand">VS Studio Beauty & Academy</div>
        <h1>Reporte de Cierre de Caja</h1>
        <section class="meta">
          <div class="box"><span>Fecha del cierre</span><strong>${escapeHtml(closing.date)}</strong></div>
          <div class="box"><span>Responsable</span><strong>${escapeHtml(closing.responsible || "Sin responsable")}</strong></div>
          <div class="box"><span>Venta total registrada</span><strong>${money(snapshot.summary.totalSales)}</strong></div>
          <div class="box"><span>Total teorico registrado</span><strong>${money(snapshot.summary.totalTheoreticalForClosing)}</strong></div>
          <div class="box"><span>Total real confirmado</span><strong>${money(snapshot.summary.totalReal)}</strong></div>
          <div class="box"><span>Diferencia total de cierre</span><strong>${money(snapshot.summary.totalDifference)}</strong></div>
          <div class="box"><span>Propinas tarjeta</span><strong>${money(snapshot.summary.cardTips)}</strong></div>
          <div class="box"><span>Total esperado datafono</span><strong>${money(cardSummary.expectedTerminalTotal)}</strong></div>
        </section>
        <h2>Control de propinas tarjeta</h2>
        <table><tbody>
          <tr><td>Tarjeta ventas</td><td>${money(cardSummary.cardSales)}</td></tr>
          <tr><td>Propinas tarjeta</td><td>${money(cardSummary.cardTips)}</td></tr>
          <tr><td>Total esperado datáfono</td><td>${money(cardSummary.expectedTerminalTotal)}</td></tr>
          <tr><td>Tarjeta real confirmada</td><td>${money(cardSummary.realConfirmed)}</td></tr>
          <tr><td>Diferencia tarjeta</td><td>${money(cardSummary.difference)}</td></tr>
        </tbody></table>
        <h2>Ventas, importes reales, diferencias y saldo final</h2>
        <table>
          <thead><tr><th>Metodo</th><th>Ventas registradas</th><th>Real confirmado</th><th>Diferencia</th><th>Gastos pagados</th><th>Comisiones pagadas</th><th>Comision Treatwell</th><th>Saldo final</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <h2>Gastos pagados por metodo</h2>
        <table><thead><tr><th>Metodo</th><th>Importe</th></tr></thead><tbody>${expensesHtml}</tbody></table>
        <h2>Comisiones pagadas</h2>
        <table><thead><tr><th>Metodo</th><th>Importe</th></tr></thead><tbody>${commissionsHtml}</tbody></table>
        <h2>Control de ventas modificadas</h2>
        <table><tbody>
          <tr><td>Ventas cobradas del dia</td><td>${snapshot.summary.collectedSalesCount}</td></tr>
          <tr><td>Ventas editadas del dia</td><td>${snapshot.summary.editedSalesCount}</td></tr>
          <tr><td>Ventas anuladas del dia</td><td>${snapshot.summary.voidedSalesCount}</td></tr>
        </tbody></table>
        <h2>Detalle de ventas del dia</h2>
        <table><thead><tr><th>Servicios</th><th>Cliente</th><th>Estado</th><th>Motivo anulacion</th><th>Importe</th></tr></thead><tbody>${salesAuditHtml}</tbody></table>
        <h2>Observaciones</h2>
        <div class="box observations">${escapeHtml(closing.observations || "Sin observaciones")}</div>
        <div class="footer">Generado el ${escapeHtml(generatedAt)}</div>
      </main>
    </body>
  </html>`;
}

function openReportWindow(closing, snapshot, print = false) {
  const reportWindow = window.open("", "_blank", "width=980,height=720");
  if (!reportWindow) return;
  reportWindow.document.write(buildReportHtml(closing, snapshot));
  reportWindow.document.close();
  reportWindow.focus();
  if (print) {
    reportWindow.setTimeout(() => reportWindow.print(), 300);
  }
}

function snapshotWithStoredClosing(snapshot, closing = {}) {
  const storedCardTips = closing.cardTips ?? closing.summary?.cardTips;
  const storedExpectedTerminalTotal = closing.expectedTerminalTotal ?? closing.summary?.expectedTerminalTotal;
  const storedCardReal = closing.cardRealConfirmed ?? closing.summary?.card?.realConfirmed;
  const storedCardDifference = closing.cardDifference ?? closing.summary?.card?.difference;
  const hasStoredCardData = [storedCardTips, storedExpectedTerminalTotal, storedCardReal, storedCardDifference]
    .some((value) => value !== undefined && value !== null);

  if (!hasStoredCardData && !closing.summary) return snapshot;

  const nextRows = snapshot.rows.map((row) => {
    if (row.method !== "Tarjeta" || !hasStoredCardData) return row;
    const cardTips = Number(storedCardTips ?? row.cardTips ?? 0);
    const expectedTerminalTotal = Number(storedExpectedTerminalTotal ?? row.expectedTerminalTotal ?? 0);
    const real = Number(storedCardReal ?? row.real ?? 0);
    const difference = Number(storedCardDifference ?? real - Number(row.registered || 0));

    return {
      ...row,
      cardTips,
      expectedTerminalTotal,
      real,
      difference,
      finalBalance: real - Number(row.expenses || 0) - Number(row.paidCommissions || 0) - Number(row.treatwellCommission || 0),
    };
  });
  const cardRow = nextRows.find((row) => row.method === "Tarjeta") || {};
  const totalTheoreticalForClosing = Number(snapshot.summary.totalTheoreticalForClosing ?? snapshot.summary.totalSales ?? 0);
  const totalReal = nextRows.reduce((total, row) => total + Number(row.real || 0), 0);
  const summary = {
    ...snapshot.summary,
    ...(closing.summary || {}),
    cardTips: Number(storedCardTips ?? closing.summary?.cardTips ?? snapshot.summary.cardTips ?? 0),
    expectedTerminalTotal: Number(storedExpectedTerminalTotal ?? closing.summary?.expectedTerminalTotal ?? snapshot.summary.expectedTerminalTotal ?? 0),
    totalTheoreticalForClosing,
    totalReal,
    totalDifference: roundMoney(totalReal - totalTheoreticalForClosing),
    totalFinalBalance: nextRows.reduce((total, row) => total + Number(row.finalBalance || 0), 0),
    card: {
      ...(snapshot.summary.card || {}),
      ...(closing.summary?.card || {}),
      cardSales: Number(cardRow.registered || 0),
      cardTips: Number(storedCardTips ?? cardRow.cardTips ?? 0),
      expectedTerminalTotal: Number(storedExpectedTerminalTotal ?? cardRow.expectedTerminalTotal ?? 0),
      realConfirmed: Number(storedCardReal ?? cardRow.real ?? 0),
      difference: Number(storedCardDifference ?? cardRow.difference ?? 0),
    },
  };

  return { ...snapshot, rows: nextRows, summary };
}

function CashClosing({ data, commissionsData = { rows: [] }, user, onSave }) {
  const [date, setDate] = useState(todayDate());
  const [realAmounts, setRealAmounts] = useState({});
  const [responsible, setResponsible] = useState(user?.nombre || "");
  const [observations, setObservations] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [closingError, setClosingError] = useState("");

  const existingClosing = useMemo(() => (
    (data.cashClosings || []).find((closing) => closing.date === date)
  ), [data.cashClosings, date]);

  const createSnapshot = (targetDate, targetRealAmounts = realAmounts) => {
    const daySales = (data.sales || []).filter((sale) => operationalDate(sale) === targetDate);
    const sales = daySales.filter(isCollectedSale);
    const editedSales = daySales.filter((sale) => isCollectedSale(sale) && saleIsEdited(sale));
    const voidedSales = daySales.filter((sale) => saleStatus(sale) === "anulada");
    const auditSales = [...sales, ...voidedSales].sort((first, second) => String(second.horaCierre || second.horaCreacion || "").localeCompare(String(first.horaCierre || first.horaCreacion || "")));
    const expenses = (data.expenses || []).filter((expense) => expense.date === targetDate);
    const commissions = (commissionsData.rows || []).filter((commission) => (
      commission.status === "pagada" && (commission.paymentDate || commission.fechaPago || commission.date) === targetDate
    ));
    const registeredSales = groupSalesByMethod(sales);
    const paidExpenses = groupPaidExpensesByMethod(expenses);
    const paidCommissions = groupPaidCommissionsByMethod(commissions);
    const treatwellCommission = sales.reduce((total, sale) => total + Number(sale.treatwellCommissionAmount || 0), 0);
    const cardTips = cardTipsTotal(sales);
    const cardSales = Number(registeredSales.Tarjeta || 0);
    const expectedTerminalTotal = cardSales + cardTips;

    const rows = paymentMethods.map((method) => {
      const registered = Number(registeredSales[method] || 0);
      const hasRealAmount = targetRealAmounts[method] !== undefined && targetRealAmounts[method] !== "";
      const real = hasRealAmount ? Number(targetRealAmounts[method] || 0) : 0;
      const expensesAmount = Number(paidExpenses[method] || 0);
      const paidCommissionsAmount = Number(paidCommissions[method] || 0);
      const treatwellAmount = method === "Treatwell" ? treatwellCommission : 0;

      return {
        method,
        registered,
        cardTips: method === "Tarjeta" ? cardTips : 0,
        expectedTerminalTotal: method === "Tarjeta" ? expectedTerminalTotal : registered,
        real,
        difference: real - registered,
        expenses: expensesAmount,
        paidCommissions: paidCommissionsAmount,
        treatwellCommission: treatwellAmount,
        finalBalance: hasRealAmount ? real - expensesAmount - paidCommissionsAmount - treatwellAmount : 0,
      };
    });
    const cardRow = rows.find((row) => row.method === "Tarjeta") || {};
    const totalTheoreticalForClosing = rows.reduce((total, row) => total + Number(row.registered || 0), 0);
    const totalRealConfirmed = rows.reduce((total, row) => total + Number(row.real || 0), 0);

    const summary = {
      totalSales: rows.reduce((total, row) => total + row.registered, 0),
      totalTheoreticalForClosing,
      totalReal: totalRealConfirmed,
      totalExpenses: rows.reduce((total, row) => total + row.expenses, 0),
      totalPaidCommissions: rows.reduce((total, row) => total + row.paidCommissions, 0),
      totalDifference: roundMoney(totalRealConfirmed - totalTheoreticalForClosing),
      totalFinalBalance: rows.reduce((total, row) => total + row.finalBalance, 0),
      treatwellCommission,
      cardTips,
      expectedTerminalTotal,
      card: {
        cardSales,
        cardTips,
        expectedTerminalTotal,
        realConfirmed: Number(cardRow.real || 0),
        difference: Number(cardRow.difference || 0),
      },
      collectedSalesCount: sales.length,
      editedSalesCount: editedSales.length,
      voidedSalesCount: voidedSales.length,
    };

    return { sales, daySales, auditSales, editedSales, voidedSales, expenses, commissions, registeredSales, paidExpenses, paidCommissions, treatwellCommission, rows, summary };
  };

  const dayData = useMemo(() => createSnapshot(date, realAmounts), [data.sales, data.expenses, commissionsData.rows, date, realAmounts]);

  useEffect(() => {
    if (existingClosing) {
      setRealAmounts(existingClosing.realAmounts || {});
      setResponsible(existingClosing.responsible || user?.nombre || "");
      setObservations(existingClosing.observations || "");
      return;
    }

    setRealAmounts({});
    setResponsible(user?.nombre || "");
    setObservations("");
  }, [date, existingClosing, user?.nombre]);

  const updateRealAmount = (method, value) => {
    setRealAmounts((current) => ({ ...current, [method]: value }));
    setSavedMessage("");
    setClosingError("");
  };

  const closingPayload = () => ({
    date,
    responsible,
    realAmounts: Object.fromEntries(paymentMethods.map((method) => {
      const value = realAmounts[method];
      return [method, value === undefined || value === "" ? 0 : Number(value || 0)];
    })),
    cardTips: dayData.summary.cardTips,
    expectedTerminalTotal: dayData.summary.expectedTerminalTotal,
    cardRealConfirmed: dayData.summary.card.realConfirmed,
    cardDifference: dayData.summary.card.difference,
    summary: dayData.summary,
    observations,
  });

  const saveClosing = () => {
    const difference = roundMoney(dayData.summary.totalDifference);
    if (Math.abs(difference) > 0.009) {
      setSavedMessage("");
      setClosingError(`No se puede guardar el cierre: la diferencia total es ${money(difference)}. Revisa los importes reales confirmados.`);
      return;
    }

    onSave?.(closingPayload());
    setClosingError("");
    setSavedMessage("Cierre guardado correctamente.");
  };

  const downloadPdf = () => {
    const payload = closingPayload();
    openReportWindow(payload, dayData, true);
  };

  const viewReport = (closing) => {
    const snapshot = snapshotWithStoredClosing(createSnapshot(closing.date, closing.realAmounts || {}), closing);
    openReportWindow(closing, snapshot, false);
  };

  const printHistoryReport = (closing) => {
    const snapshot = snapshotWithStoredClosing(createSnapshot(closing.date, closing.realAmounts || {}), closing);
    openReportWindow(closing, snapshot, true);
  };

  const closingHistory = useMemo(() => (
    [...(data.cashClosings || [])].sort((first, second) => String(second.date || "").localeCompare(String(first.date || "")))
  ), [data.cashClosings]);

  return (
    <section className="module">
      <div className="section-title">
        <div>
          <h2>Cierre de Caja</h2>
          <span>Control operativo diario del local</span>
        </div>
      </div>

      <section className="panel filters-panel">
        <label>Fecha del cierre<input type="date" value={date} onChange={(event) => setDate(event.target.value || todayDate())} /></label>
        <label>Responsable<input value={responsible} onChange={(event) => setResponsible(event.target.value)} placeholder="Responsable del cierre" /></label>
      </section>

      <section className="summary-grid compact">
        {dayData.rows.map((row) => (
          <article className="metric" key={row.method}>
            <span>{row.method} registrado</span>
            <strong>{money(row.registered)}</strong>
          </article>
        ))}
        <article className="metric"><span>Venta total registrada</span><strong>{money(dayData.summary.totalSales)}</strong></article>
        <article className="metric"><span>Propinas tarjeta registradas</span><strong>{money(dayData.summary.cardTips)}</strong></article>
        <article className="metric"><span>Total esperado datáfono</span><strong>{money(dayData.summary.expectedTerminalTotal)}</strong></article>
      </section>

      <section className="panel">
        <h3>Propinas registradas del dia</h3>
        <div className="stat-row">
          <span>Propinas cobradas con tarjeta para conciliacion del datafono</span>
          <strong>{money(dayData.summary.cardTips)}</strong>
        </div>
      </section>

      <section className="panel">
        <h3>Control de ventas modificadas</h3>
        <div className="summary-grid compact">
          <article className="metric"><span>Ventas cobradas del dia</span><strong>{dayData.summary.collectedSalesCount}</strong></article>
          <article className="metric"><span>Ventas editadas del dia</span><strong>{dayData.summary.editedSalesCount}</strong></article>
          <article className="metric"><span>Ventas anuladas del dia</span><strong>{dayData.summary.voidedSalesCount}</strong></article>
        </div>
      </section>

      <section className="panel">
        <h3>Confirmacion diaria por metodo</h3>
        <div className="stat-row">
          <span>Total teorico registrado</span>
          <strong>{money(dayData.summary.totalTheoreticalForClosing)}</strong>
        </div>
        <div className="stat-row">
          <span>Total real confirmado</span>
          <strong>{money(dayData.summary.totalReal)}</strong>
        </div>
        <div className="stat-row">
          <span>Diferencia total de cierre</span>
          <strong>{money(dayData.summary.totalDifference)}</strong>
        </div>
        <div className="finance-table">
          <div className="finance-header cash"><span>Metodo</span><span>Registrado</span><span>Real confirmado</span><span>Diferencia</span><span>Gastos pagados</span><span>Comisiones pagadas</span><span>Saldo final</span></div>
          {dayData.rows.map((row) => (
            <div className="finance-row cash" key={row.method}>
              <span>
                {row.method}
                {row.method === "Tarjeta" && (
                  <small className="cash-card-breakdown">
                    Tarjeta ventas: {money(row.registered)} · Propinas tarjeta: {money(row.cardTips)} · Total esperado datáfono: {money(row.expectedTerminalTotal)}
                  </small>
                )}
              </span>
              <strong>{money(row.registered)}</strong>
              <input type="number" step="0.01" value={realAmounts[row.method] ?? ""} onChange={(event) => updateRealAmount(row.method, event.target.value)} placeholder="0.00" />
              <strong>{money(row.difference)}</strong>
              <strong>{money(row.expenses)}</strong>
              <strong>{money(row.paidCommissions)}</strong>
              <strong>{money(row.finalBalance)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Gastos pagados del dia</h3>
        <div className="list">
          {dayData.expenses.filter((expense) => expense.status !== "pendiente").map((expense) => (
            <div className="stat-row" key={expense.id}>
              <span>{expense.concept || expense.category} - {expense.paymentMethod || "Sin metodo"}</span>
              <strong>{money(expense.amount)}</strong>
            </div>
          ))}
          {dayData.expenses.filter((expense) => expense.status !== "pendiente").length === 0 && <p className="empty-state">Sin gastos pagados en esta fecha.</p>}
        </div>
      </section>

      <section className="panel">
        <h3>Detalle de ventas del dia</h3>
        <div className="list">
          {dayData.auditSales.length === 0 && <p className="empty-state">Sin ventas cobradas o anuladas en esta fecha.</p>}
          {dayData.auditSales.map((sale) => (
            <div className="stat-row" key={sale.id}>
              <span>
                {saleServicesText(sale)} - {sale.clientName || "Cliente mostrador"} - {saleStatusLabel(sale)}
                {saleStatus(sale) === "anulada" && (sale.voidReason || sale.cancelReason) ? ` - Motivo: ${sale.voidReason || sale.cancelReason}` : ""}
              </span>
              <strong>{saleStatus(sale) === "anulada" ? "No suma" : money(sale.total || sale.amount)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <label>Observaciones<textarea value={observations} onChange={(event) => setObservations(event.target.value)} placeholder="Notas del cierre, descuadres o incidencias" /></label>
        {closingError && <p className="error-message">{closingError}</p>}
        {savedMessage && <p className="success-message">{savedMessage}</p>}
        <div className="row-actions">
          <button type="button" onClick={saveClosing}>Guardar cierre</button>
          <button className="secondary-button" type="button" onClick={downloadPdf}>Descargar PDF</button>
        </div>
      </section>

      <section className="panel">
        <h3>Historial de cierres</h3>
        <div className="finance-table">
          <div className="finance-header closing-history"><span>Fecha</span><span>Responsable</span><span>Total ventas</span><span>Total gastos</span><span>Diferencia total</span><span>Observaciones</span><span>Accion</span></div>
          {closingHistory.map((closing) => {
            const snapshot = snapshotWithStoredClosing(createSnapshot(closing.date, closing.realAmounts || {}), closing);
            const summary = { ...snapshot.summary, ...(closing.summary || {}) };
            return (
              <div className="finance-row closing-history" key={closing.id || closing.date}>
                <span>{closing.date}</span>
                <span>{closing.responsible || "Sin responsable"}</span>
                <strong>{money(summary.totalSales)}</strong>
                <strong>{money(summary.totalExpenses)}</strong>
                <strong>{money(summary.totalDifference)}</strong>
                <span>{closing.observations || "Sin observaciones"}</span>
                <div className="row-actions compact-actions">
                  <button className="secondary-button" type="button" onClick={() => viewReport(closing)}>Ver reporte</button>
                  <button className="secondary-button" type="button" onClick={() => printHistoryReport(closing)}>Descargar PDF</button>
                </div>
              </div>
            );
          })}
          {closingHistory.length === 0 && <p className="empty-state">Aun no hay cierres guardados.</p>}
        </div>
      </section>
    </section>
  );
}

export default CashClosing;
