import { useEffect, useMemo, useState } from "react";
import {
  calculateOperatingResult,
  calculatePaymentMethodReconciliation,
  calculateTreasuryResult,
  commissionFinancialSummary,
  findPotentialCommissionExpenseDuplicates,
  formatFinancialInput,
  groupPaidCommissionsByMethod as groupCommissionPaymentsByMethod,
  resolveFinancialInput,
} from "../utils/commissionFinance.js";
import { getDaysInMadridMonth, getLocalStartOfWeek, getMadridTimestamp, getTodayLocalDateString } from "../utils/date.js";

const paymentMethods = ["Efectivo", "Tarjeta", "Transferencia", "Bizum", "Treatwell", "Bono / tarjeta regalo", "Otro"];
const expenseMethods = ["Efectivo", "Tarjeta", "Transferencia", "Bizum", "Otro"];
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const emptyFinanceControls = Object.freeze({});

function financeControlDrafts(values = {}) {
  return Object.fromEntries(Object.entries(values).map(([method, value]) => [method, formatFinancialInput(value)]));
}

function money(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function todayDate() {
  return getTodayLocalDateString();
}

function startOfWeek(date) {
  return getLocalStartOfWeek(date);
}

function getRange(filter, customRange) {
  const today = todayDate();
  if (filter === "today") return { from: today, to: today };
  if (filter === "week") return { from: startOfWeek(today), to: today };
  if (filter === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (filter === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return customRange;
}

function controlKey(range) {
  return `${range.from || "inicio"}_${range.to || "fin"}`;
}

function inRange(date, range) {
  if (!date) return false;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

function operationalDate(item = {}) {
  return item.saleDate || item.fechaOperativa || item.date || "";
}

function normalizeMethod(method = "", methods = paymentMethods) {
  const value = String(method).trim().toLowerCase();
  if (["bono", "bonos", "tarjeta regalo", "bono / tarjeta regalo"].includes(value)) return "Bono / tarjeta regalo";
  if (value.includes("transferencia")) return "Transferencia";
  if (value.includes("bizum")) return "Bizum";
  if (value.includes("efectivo")) return "Efectivo";
  if (value.includes("tarjeta")) return "Tarjeta";
  if (value.includes("treatwell")) return "Treatwell";
  return methods.find((item) => item.toLowerCase() === value) || "Otro";
}

function salePayments(sale) {
  if (Array.isArray(sale.payments) && sale.payments.length > 0) return sale.payments;
  return sale.paymentMethod ? [{ method: sale.paymentMethod, amount: Number(sale.total || sale.amount || 0) }] : [];
}

function isCollectedSale(sale) {
  return String(sale.status || "cobrado").toLowerCase() === "cobrado";
}

function groupPayments(sales) {
  return sales.flatMap((sale) => salePayments(sale)).reduce((groups, payment) => {
    const method = normalizeMethod(payment.method);
    groups[method] = (groups[method] || 0) + Number(payment.amount || 0);
    return groups;
  }, Object.fromEntries(paymentMethods.map((method) => [method, 0])));
}

function groupExpenses(expenses) {
  return expenses.reduce((groups, expense) => {
    const method = normalizeMethod(expense.paymentMethod, expenseMethods);
    groups[method] = groups[method] || { registered: 0, paid: 0, pending: 0 };
    groups[method].registered += Number(expense.amount || 0);
    if (expense.status === "pendiente") groups[method].pending += Number(expense.amount || 0);
    else groups[method].paid += Number(expense.amount || 0);
    return groups;
  }, Object.fromEntries(expenseMethods.map((method) => [method, { registered: 0, paid: 0, pending: 0 }])));
}

function groupPaidExpensesForPaymentMethods(expenses) {
  return expenses
    .filter((expense) => expense.status !== "pendiente")
    .reduce((groups, expense) => {
      const method = normalizeMethod(expense.paymentMethod, paymentMethods);
      groups[method] = (groups[method] || 0) + Number(expense.amount || 0);
      return groups;
    }, Object.fromEntries(paymentMethods.map((method) => [method, 0])));
}

function groupCommissions(rows) {
  return rows.reduce((groups, row) => {
    const employee = row.employee || "Sin profesional";
    groups[employee] = groups[employee] || { employee, pending: 0, paid: 0, total: 0 };
    const amount = Number(row.commissionAmount || 0);
    groups[employee].total += amount;
    if (row.status === "pagada") groups[employee].paid += amount;
    else groups[employee].pending += amount;
    return groups;
  }, {});
}

function groupPaidCommissionsByMethod(rows) {
  return groupCommissionPaymentsByMethod(rows, paymentMethods);
}

function groupMonthlyPaidCommissionsByMethod(rows) {
  return groupCommissionPaymentsByMethod(rows, expenseMethods);
}

function vatSummary(sales, expenses) {
  const outputVat = sales.reduce((total, sale) => total + Number(sale.ivaAmount || 0), 0);
  const salesWithoutVat = sales.reduce((total, sale) => total + Number(sale.netWithoutVat || 0), 0);
  const inputVat = expenses
    .filter((expense) => expense.documentType === "Factura")
    .reduce((total, expense) => total + Number(expense.supportedVat || 0), 0);

  return {
    salesWithoutVat,
    outputVat,
    inputVat,
    estimatedVat: outputVat - inputVat,
  };
}

function monthRange(year, month) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = getDaysInMadridMonth(year, month);
  return { from, to: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}` };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function savedDateLabel(value) {
  return String(value || "").slice(0, 10) || "-";
}

function buildMonthlyReportHtml(closing) {
  const monthLabel = monthNames[Number(closing.month || 1) - 1] || "";
  const generatedAt = getMadridTimestamp().replace("T", " ");
  const collectionRows = paymentMethods.map((method) => `<tr><td>${escapeHtml(method)}</td><td>${money(closing.collectionsByMethod?.[method])}</td></tr>`).join("");
  const expenseRows = expenseMethods.map((method) => {
    const row = closing.expensesByMethod?.[method] || {};
    return `<tr><td>${escapeHtml(method)}</td><td>${money(row.registered)}</td><td>${money(row.paid)}</td><td>${money(row.pending)}</td></tr>`;
  }).join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Cierre_Mensual_VS_Studio_${escapeHtml(monthLabel)}_${escapeHtml(closing.year)}</title>
      <style>
        @page { size: A4; margin: 18mm; }
        body { color: #1f1b16; font-family: Arial, sans-serif; margin: 0; }
        .brand { color: #9a7a34; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        h1 { font-size: 26px; margin: 8px 0 18px; }
        h2 { border-bottom: 1px solid #e1d8c8; font-size: 15px; margin: 22px 0 10px; padding-bottom: 6px; }
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
      <main>
        <div class="brand">VS Studio Beauty & Academy</div>
        <h1>Reporte de Cierre Mensual</h1>
        <section class="meta">
          <div class="box"><span>Mes y año</span><strong>${escapeHtml(monthLabel)} ${escapeHtml(closing.year)}</strong></div>
          <div class="box"><span>Fecha de generación</span><strong>${escapeHtml(generatedAt)}</strong></div>
          <div class="box"><span>Ventas totales</span><strong>${money(closing.salesTotal)}</strong></div>
          <div class="box"><span>Beneficio operativo</span><strong>${money(closing.operatingProfit)}</strong></div>
          <div class="box"><span>Tesorería teórica</span><strong>${money(closing.theoreticalTreasury)}</strong></div>
          <div class="box"><span>Resultado final</span><strong>${money(Number(closing.bankReal || 0) + Number(closing.cashReal || 0))}</strong></div>
        </section>
        <h2>Cobros por método</h2>
        <table><thead><tr><th>Método</th><th>Importe</th></tr></thead><tbody>${collectionRows}</tbody></table>
        <h2>Gastos por método</h2>
        <table><thead><tr><th>Método</th><th>Registrados</th><th>Pagados</th><th>Pendientes</th></tr></thead><tbody>${expenseRows}</tbody></table>
        <h2>Comisiones y Treatwell</h2>
        <table><tbody>
          <tr><td>Comisiones generadas</td><td>${money(closing.generatedCommissionsTotal)}</td></tr>
          <tr><td>Comisiones pagadas</td><td>${money(closing.paidCommissionsTotal)}</td></tr>
          <tr><td>Comisiones pendientes</td><td>${money(closing.pendingCommissionsTotal)}</td></tr>
          <tr><td>Comisión Treatwell</td><td>${money(closing.treatwellCommissionTotal)}</td></tr>
        </tbody></table>
        <h2>Resumen IVA</h2>
        <table><tbody>
          <tr><td>IVA repercutido</td><td>${money(closing.outputVat)}</td></tr>
          <tr><td>IVA soportado</td><td>${money(closing.inputVat)}</td></tr>
          <tr><td>IVA estimado</td><td>${money(closing.estimatedVat)}</td></tr>
        </tbody></table>
        <h2>Conciliación</h2>
        <table><thead><tr><th>Concepto</th><th>Teórico</th><th>Real</th><th>Diferencia</th></tr></thead><tbody>
          <tr><td>Banco</td><td>${money(closing.bankTheoretical)}</td><td>${money(closing.bankReal)}</td><td>${money(closing.bankDifference)}</td></tr>
          <tr><td>Caja</td><td>${money(closing.cashTheoretical)}</td><td>${money(closing.cashReal)}</td><td>${money(closing.cashDifference)}</td></tr>
        </tbody></table>
        <h2>Observaciones</h2>
        <div class="box observations">${escapeHtml(closing.observations || "Sin observaciones")}</div>
        <div class="footer">Responsable: ${escapeHtml(closing.responsible || "Sin responsable")}</div>
      </main>
    </body>
  </html>`;
}

function openMonthlyReport(closing, print = false) {
  const reportWindow = window.open("", "_blank", "width=980,height=720");
  if (!reportWindow) return;
  reportWindow.document.write(buildMonthlyReportHtml(closing));
  reportWindow.document.close();
  reportWindow.focus();
  if (print) reportWindow.setTimeout(() => reportWindow.print(), 300);
}

function MonthlyClosing({ data, commissionsData, user, canManage = false, onSave }) {
  const today = todayDate();
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [bankReal, setBankReal] = useState("");
  const [cashReal, setCashReal] = useState("");
  const [observations, setObservations] = useState("");
  const [message, setMessage] = useState("");
  const periodKey = `${year}-${String(month).padStart(2, "0")}`;
  const existingClosing = (data.monthlyClosings || []).find((closing) => closing.periodKey === periodKey);

  useEffect(() => {
    setBankReal(existingClosing?.bankReal ?? "");
    setCashReal(existingClosing?.cashReal ?? "");
    setObservations(existingClosing?.observations || "");
    setMessage("");
  }, [periodKey, existingClosing]);

  const closing = useMemo(() => {
    const range = monthRange(year, month);
    const sales = (data.sales || []).filter((sale) => inRange(operationalDate(sale), range) && isCollectedSale(sale));
    const expenses = (data.expenses || []).filter((expense) => inRange(expense.date, range));
    const commissionSummary = commissionFinancialSummary(commissionsData.rows || [], range);
    const commissions = commissionSummary.generated;
    const paidCommissionsForTreasury = commissionSummary.paidForTreasury;
    const collectionsByMethod = groupPayments(sales);
    const expensesByMethod = groupExpenses(expenses);
    const paidCommissionsByMethod = groupMonthlyPaidCommissionsByMethod(paidCommissionsForTreasury);
    const salesTotal = sales.reduce((total, sale) => total + Number(sale.total || 0), 0);
    const expensesTotal = expenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
    const paidExpensesTotal = expenses.filter((expense) => expense.status !== "pendiente").reduce((total, expense) => total + Number(expense.amount || 0), 0);
    const pendingExpensesTotal = expenses.filter((expense) => expense.status === "pendiente").reduce((total, expense) => total + Number(expense.amount || 0), 0);
    const generatedCommissionsTotal = commissionSummary.generatedTotal;
    const paidCommissionsTotal = commissionSummary.paidTotal;
    const pendingCommissionsTotal = commissionSummary.pendingGeneratedTotal;
    const treatwellCommissionTotal = sales.reduce((total, sale) => total + Number(sale.treatwellCommissionAmount || 0), 0);
    const taxes = vatSummary(sales, expenses);
    const collectionsTotal = Object.values(collectionsByMethod).reduce((total, amount) => total + Number(amount || 0), 0);
    const operatingProfit = calculateOperatingResult({
      income: salesTotal,
      expenses: expensesTotal,
      generatedCommissions: generatedCommissionsTotal,
      platformCommissions: treatwellCommissionTotal,
    });
    const theoreticalTreasury = calculateTreasuryResult({
      collections: collectionsTotal,
      paidExpenses: paidExpensesTotal,
      paidCommissions: paidCommissionsTotal,
      platformPayments: treatwellCommissionTotal,
    });
    const bankTheoretical = Number(collectionsByMethod.Tarjeta || 0) + Number(collectionsByMethod.Transferencia || 0) + Number(collectionsByMethod.Bizum || 0) + Number(collectionsByMethod.Treatwell || 0)
      - Number(expensesByMethod.Tarjeta?.paid || 0) - Number(expensesByMethod.Transferencia?.paid || 0) - Number(expensesByMethod.Bizum?.paid || 0)
      - Number(paidCommissionsByMethod.Tarjeta || 0) - Number(paidCommissionsByMethod.Transferencia || 0) - Number(paidCommissionsByMethod.Bizum || 0)
      - treatwellCommissionTotal;
    const cashTheoretical = Number(collectionsByMethod.Efectivo || 0)
      - Number(expensesByMethod.Efectivo?.paid || 0)
      - Number(paidCommissionsByMethod.Efectivo || 0);
    const bankRealNumber = Number(bankReal || 0);
    const cashRealNumber = Number(cashReal || 0);
    const potentialCommissionExpenseDuplicates = findPotentialCommissionExpenseDuplicates(expenses, paidCommissionsForTreasury);

    return {
      month,
      year,
      periodKey,
      responsible: user?.nombre || "",
      salesTotal,
      collectionsByMethod,
      expensesTotal,
      paidExpensesTotal,
      pendingExpensesTotal,
      expensesByMethod,
      generatedCommissionsTotal,
      paidCommissionsTotal,
      pendingCommissionsTotal,
      treatwellCommissionTotal,
      outputVat: taxes.outputVat,
      inputVat: taxes.inputVat,
      estimatedVat: taxes.estimatedVat,
      operatingProfit,
      theoreticalTreasury,
      bankTheoretical,
      bankReal: bankRealNumber,
      bankDifference: bankRealNumber - bankTheoretical,
      cashTheoretical,
      cashReal: cashRealNumber,
      cashDifference: cashRealNumber - cashTheoretical,
      potentialCommissionExpenseDuplicates,
      observations,
    };
  }, [data, commissionsData, month, year, bankReal, cashReal, observations, user]);

  const saveClosing = () => {
    if (!canManage) return;
    if (existingClosing && !window.confirm("Ya existe un cierre para este mes. ¿Deseas sobrescribirlo?")) return;
    onSave?.(closing);
    setMessage("Cierre mensual guardado.");
  };

  const history = useMemo(() => (
    [...(data.monthlyClosings || [])].sort((a, b) => String(b.periodKey || "").localeCompare(String(a.periodKey || "")))
  ), [data.monthlyClosings]);

  return (
    <section className="panel monthly-closing-panel">
      <div className="section-title">
        <div>
          <h3>Cierre Mensual</h3>
          <span>Resultado mensual y conciliación banco/caja</span>
        </div>
        <button className="secondary-button" type="button" onClick={() => openMonthlyReport(closing, true)} disabled={!canManage}>Generar PDF</button>
      </div>
      {!canManage && <p className="empty-state">Sección preparada solo para administradores.</p>}
      <div className="filters-panel">
        <label>Mes<select value={month} onChange={(event) => setMonth(Number(event.target.value))} disabled={!canManage}>
          {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
        </select></label>
        <label>Año<input type="number" value={year} onChange={(event) => setYear(Number(event.target.value || today.slice(0, 4)))} disabled={!canManage} /></label>
        <label>Saldo banco real<input type="number" step="0.01" value={bankReal} onChange={(event) => setBankReal(event.target.value)} disabled={!canManage} /></label>
        <label>Saldo caja real<input type="number" step="0.01" value={cashReal} onChange={(event) => setCashReal(event.target.value)} disabled={!canManage} /></label>
      </div>
      <div className="summary-grid compact">
        <article className="metric"><span>Ventas totales</span><strong>{money(closing.salesTotal)}</strong></article>
        <article className="metric"><span>Gastos totales</span><strong>{money(closing.expensesTotal)}</strong></article>
        <article className="metric"><span>Comisiones generadas</span><strong>{money(closing.generatedCommissionsTotal)}</strong></article>
        <article className="metric"><span>Comisiones pagadas</span><strong>{money(closing.paidCommissionsTotal)}</strong></article>
        <article className="metric"><span>Comisiones pendientes</span><strong>{money(closing.pendingCommissionsTotal)}</strong></article>
        <article className="metric"><span>Comisión Treatwell</span><strong>{money(closing.treatwellCommissionTotal)}</strong></article>
        <article className="metric"><span>IVA repercutido</span><strong>{money(closing.outputVat)}</strong></article>
        <article className="metric"><span>IVA soportado</span><strong>{money(closing.inputVat)}</strong></article>
        <article className="metric"><span>IVA estimado</span><strong>{money(closing.estimatedVat)}</strong></article>
        <article className="metric"><span>Beneficio operativo</span><strong>{money(closing.operatingProfit)}</strong></article>
        <article className="metric"><span>Tesorería teórica</span><strong>{money(closing.theoreticalTreasury)}</strong></article>
      </div>
      {closing.potentialCommissionExpenseDuplicates.length > 0 && (
        <p className="warning-message" role="alert">
          Revisa {closing.potentialCommissionExpenseDuplicates.length} posible(s) duplicidad(es): hay gastos manuales de comisiones con la misma fecha e importe que pagos de comisión.
        </p>
      )}
      <div className="cards-grid">
        <article className="panel nested-panel">
          <h3>Cobros por método</h3>
          <div className="list">{paymentMethods.map((method) => <div className="stat-row" key={method}><span>{method}</span><strong>{money(closing.collectionsByMethod[method])}</strong></div>)}</div>
        </article>
        <article className="panel nested-panel">
          <h3>Gastos por método</h3>
          <div className="finance-table">
            <div className="finance-header compact"><span>Método</span><span>Registrado</span><span>Pagado</span><span>Pendiente</span></div>
            {expenseMethods.map((method) => <div className="finance-row compact" key={method}><span>{method}</span><strong>{money(closing.expensesByMethod[method]?.registered)}</strong><strong>{money(closing.expensesByMethod[method]?.paid)}</strong><strong>{money(closing.expensesByMethod[method]?.pending)}</strong></div>)}
          </div>
        </article>
      </div>
      <section>
        <h3>Conciliación mensual</h3>
        <div className="finance-table">
          <div className="finance-header compact"><span>Concepto</span><span>Teórico sistema</span><span>Real introducido</span><span>Diferencia</span></div>
          <div className="finance-row compact"><span>Banco</span><strong>{money(closing.bankTheoretical)}</strong><strong>{money(closing.bankReal)}</strong><strong>{money(closing.bankDifference)}</strong></div>
          <div className="finance-row compact"><span>Caja</span><strong>{money(closing.cashTheoretical)}</strong><strong>{money(closing.cashReal)}</strong><strong>{money(closing.cashDifference)}</strong></div>
        </div>
      </section>
      <label>Observaciones del cierre<textarea value={observations} onChange={(event) => setObservations(event.target.value)} disabled={!canManage} placeholder="Diferencias, ingresos pendientes, gastos fuera de fecha..." /></label>
      {message && <p className="success-message">{message}</p>}
      <div className="row-actions">
        <button type="button" onClick={saveClosing} disabled={!canManage}>Guardar cierre mensual</button>
        <button className="secondary-button" type="button" onClick={() => openMonthlyReport(closing, true)} disabled={!canManage}>Generar PDF</button>
      </div>
      <section>
        <h3>Historial de cierres mensuales</h3>
        <div className="finance-table">
          <div className="finance-header monthly-history"><span>Mes</span><span>Año</span><span>Fecha de cierre</span><span>Ventas</span><span>Beneficio</span><span>Banco real</span><span>Caja real</span><span>Diferencia total</span><span>Acción</span></div>
          {history.map((item) => (
            <div className="finance-row monthly-history" key={item.id}>
              <span>{monthNames[Number(item.month || 1) - 1]}</span><span>{item.year}</span><span>{savedDateLabel(item.updatedAt)}</span><strong>{money(item.salesTotal)}</strong><strong>{money(item.operatingProfit)}</strong><strong>{money(item.bankReal)}</strong><strong>{money(item.cashReal)}</strong><strong>{money(Number(item.bankDifference || 0) + Number(item.cashDifference || 0))}</strong>
              <div className="compact-actions"><button className="secondary-button" type="button" onClick={() => openMonthlyReport(item, false)}>Ver</button><button className="secondary-button" type="button" onClick={() => openMonthlyReport(item, true)}>Descargar PDF</button></div>
            </div>
          ))}
          {history.length === 0 && <p className="empty-state">Aún no hay cierres mensuales guardados.</p>}
        </div>
      </section>
    </section>
  );
}

function Finance({ data, commissionsData, user, canManageMonthlyClosing = false, onSaveControls, onSaveMonthlyClosing, view = "treasury" }) {
  const [filter, setFilter] = useState("month");
  const [customRange, setCustomRange] = useState({ from: `${todayDate().slice(0, 7)}-01`, to: todayDate() });
  const [showDetail, setShowDetail] = useState(false);
  const range = getRange(filter, customRange);
  const key = controlKey(range);
  const savedControls = data.config?.financeControls || emptyFinanceControls;
  const savedControlsForRange = savedControls[key] || emptyFinanceControls;
  const savedControlsSignature = JSON.stringify(savedControlsForRange);
  const [realControls, setRealControls] = useState(() => financeControlDrafts(savedControlsForRange));

  useEffect(() => {
    setRealControls(financeControlDrafts(savedControlsForRange));
  }, [key, savedControlsSignature]);

  const finance = useMemo(() => {
    const sales = (data.sales || []).filter((sale) => inRange(operationalDate(sale), range) && isCollectedSale(sale));
    const expenses = (data.expenses || []).filter((expense) => inRange(expense.date, range));
    const commissionSummary = commissionFinancialSummary(commissionsData.rows || [], range);
    const commissions = commissionSummary.generated;
    const paidCommissionsForTreasury = commissionSummary.paidForTreasury;
    const registeredPayments = groupPayments(sales);
    const expensesByMethod = groupExpenses(expenses);
    const paidExpensesForBalance = groupPaidExpensesForPaymentMethods(expenses);
    const paidCommissionsByMethod = groupPaidCommissionsByMethod(paidCommissionsForTreasury);
    const commissionByEmployee = Object.values(groupCommissions(commissions)).sort((a, b) => b.total - a.total);
    const salesTotal = sales.reduce((total, sale) => total + Number(sale.total || 0), 0);
    const collectionsTotal = Object.values(registeredPayments).reduce((total, amount) => total + Number(amount || 0), 0);
    const expensesTotal = expenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
    const paidExpensesTotal = expenses.filter((expense) => expense.status !== "pendiente").reduce((total, expense) => total + Number(expense.amount || 0), 0);
    const pendingExpensesTotal = expenses.filter((expense) => expense.status === "pendiente").reduce((total, expense) => total + Number(expense.amount || 0), 0);
    const generatedCommissionsTotal = commissionSummary.generatedTotal;
    const paidCommissionsTotal = commissionSummary.paidTotal;
    const pendingCommissionsTotal = commissionSummary.pendingGeneratedTotal;
    const internalCommissionsTotal = commissions
      .filter((commission) => commission.operationType === "servicio_interno")
      .reduce((total, commission) => total + Number(commission.commissionAmount || 0), 0);
    const treatwellTotal = sales.reduce((total, sale) => total + Number(sale.treatwellCommissionAmount || 0), 0);
    const taxes = vatSummary(sales, expenses);
    const operatingProfit = calculateOperatingResult({
      income: salesTotal,
      expenses: expensesTotal,
      generatedCommissions: generatedCommissionsTotal,
      platformCommissions: treatwellTotal,
    });
    const reconciliationByMethod = paymentMethods.map((method) => {
      const registered = Number(registeredPayments[method] || 0);
      const paidExpenses = Number(paidExpensesForBalance[method] || 0);
      const paidCommissions = Number(paidCommissionsByMethod[method] || 0);
      const treatwellCommission = method === "Treatwell" ? treatwellTotal : 0;
      const provisional = calculatePaymentMethodReconciliation({
        method,
        registered,
        paidExpenses,
        paidCommissions,
        otherOutflows: treatwellCommission,
      });
      const reconciliation = calculatePaymentMethodReconciliation({
        method,
        registered,
        paidExpenses,
        paidCommissions,
        otherOutflows: treatwellCommission,
        real: resolveFinancialInput(realControls[method], provisional.reconciliationTarget),
      });

      return {
        ...reconciliation,
        paidExpenses,
        paidCommissions,
        treatwellCommission,
      };
    });
    const cashReconciliation = reconciliationByMethod.find((row) => row.method === "Efectivo");
    const cashCounted = Number(cashReconciliation?.confirmedAmount || 0);
    const bankTreasury = reconciliationByMethod
      .filter((row) => row.method !== "Efectivo")
      .reduce((total, row) => total + Number(row.treasuryBalance || 0), 0);
    const realTreasury = reconciliationByMethod.reduce((total, row) => total + Number(row.treasuryBalance || 0), 0);
    const detailRows = [
      ...sales.map((sale) => ({ date: operationalDate(sale), type: "Venta", concept: sale.service || "Venta", amount: Number(sale.total || 0) })),
      ...expenses.map((expense) => ({ date: expense.date, type: "Gasto", concept: expense.concept, amount: -Number(expense.amount || 0) })),
      ...commissions.map((commission) => ({ date: commission.date, type: commission.operationType === "servicio_interno" ? "Comision interna" : "Comision", concept: commission.employee, amount: -Number(commission.commissionAmount || 0) })),
    ].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    const potentialCommissionExpenseDuplicates = findPotentialCommissionExpenseDuplicates(expenses, paidCommissionsForTreasury);

    return {
      salesTotal,
      collectionsTotal,
      cashCounted,
      bankTreasury,
      expensesTotal,
      paidExpensesTotal,
      pendingExpensesTotal,
      generatedCommissionsTotal,
      paidCommissionsTotal,
      pendingCommissionsTotal,
      internalCommissionsTotal,
      treatwellTotal,
      taxes,
      operatingProfit,
      realTreasury,
      registeredPayments,
      expensesByMethod,
      paidCommissionsByMethod,
      reconciliationByMethod,
      commissionByEmployee,
      detailRows,
      potentialCommissionExpenseDuplicates,
    };
  }, [data, commissionsData, range.from, range.to, realControls]);

  if (view === "monthlyClosing") {
    return (
      <section className="module">
        <MonthlyClosing
          data={data}
          commissionsData={commissionsData}
          user={user}
          canManage={canManageMonthlyClosing}
          onSave={onSaveMonthlyClosing}
        />
      </section>
    );
  }

  const updateRealControl = (method, value) => {
    setRealControls((current) => ({ ...current, [method]: value }));
  };

  const normalizeRealControl = (method, fallback) => {
    setRealControls((current) => ({
      ...current,
      [method]: formatFinancialInput(resolveFinancialInput(current[method], fallback)),
    }));
  };

  const saveControls = () => {
    const normalizedValues = Object.fromEntries(finance.reconciliationByMethod.map((row) => [
      row.method,
      resolveFinancialInput(realControls[row.method], row.reconciliationTarget),
    ]));
    setRealControls(financeControlDrafts(normalizedValues));
    onSaveControls?.({
      ...savedControls,
      [key]: normalizedValues,
    });
  };

  return (
    <section className="module">
      <div className="section-title">
        <div>
          <h2>Finanzas</h2>
          <span>Control financiero y conciliacion</span>
        </div>
      </div>

      <section className="panel filters-panel">
        <label>Periodo<select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="today">Hoy</option>
          <option value="week">Semana</option>
          <option value="month">Mes</option>
          <option value="year">Año</option>
          <option value="custom">Rango personalizado</option>
        </select></label>
        <label>Desde<input type="date" value={range.from || ""} disabled={filter !== "custom"} onChange={(event) => setCustomRange({ ...customRange, from: event.target.value })} /></label>
        <label>Hasta<input type="date" value={range.to || ""} disabled={filter !== "custom"} onChange={(event) => setCustomRange({ ...customRange, to: event.target.value })} /></label>
      </section>

      <section className="summary-grid compact">
        <article className="metric"><span>Ventas registradas</span><strong>{money(finance.salesTotal)}</strong></article>
        <article className="metric"><span>Efectivo contado</span><strong>{money(finance.cashCounted)}</strong></article>
        <article className="metric"><span>Tesoreria bancaria neta</span><strong>{money(finance.bankTreasury)}</strong></article>
        <article className="metric"><span>Gastos registrados</span><strong>{money(finance.expensesTotal)}</strong></article>
        <article className="metric"><span>Gastos pagados</span><strong>{money(finance.paidExpensesTotal)}</strong></article>
        <article className="metric"><span>Comisiones generadas</span><strong>{money(finance.generatedCommissionsTotal)}</strong></article>
        <article className="metric"><span>Comisiones pendientes</span><strong>{money(finance.pendingCommissionsTotal)}</strong></article>
        <article className="metric"><span>Comisiones pagadas</span><strong>{money(finance.paidCommissionsTotal)}</strong></article>
        <article className="metric"><span>Comisiones pagadas efectivo</span><strong>{money(finance.paidCommissionsByMethod.Efectivo)}</strong></article>
        <article className="metric"><span>Comisiones pagadas tarjeta</span><strong>{money(finance.paidCommissionsByMethod.Tarjeta)}</strong></article>
        <article className="metric"><span>Comisiones pagadas transferencia</span><strong>{money(finance.paidCommissionsByMethod.Transferencia)}</strong></article>
        <article className="metric"><span>Comisiones internas</span><strong>{money(finance.internalCommissionsTotal)}</strong></article>
        <article className="metric"><span>Beneficio operativo</span><strong>{money(finance.operatingProfit)}</strong></article>
        <article className="metric"><span>Tesoreria real</span><strong>{money(finance.realTreasury)}</strong></article>
      </section>

      {finance.potentialCommissionExpenseDuplicates.length > 0 && (
        <p className="warning-message" role="alert">
          Posible doble contabilizacion: {finance.potentialCommissionExpenseDuplicates.length} gasto(s) manual(es) de comisiones coinciden en fecha e importe con pagos registrados.
        </p>
      )}

      <section className="panel">
        <h3>Resumen IVA</h3>
        <div className="summary-grid compact">
          <article className="metric"><span>Ventas sin IVA</span><strong>{money(finance.taxes.salesWithoutVat)}</strong></article>
          <article className="metric"><span>IVA repercutido</span><strong>{money(finance.taxes.outputVat)}</strong></article>
          <article className="metric"><span>IVA soportado</span><strong>{money(finance.taxes.inputVat)}</strong></article>
          <article className="metric"><span>IVA estimado a ingresar</span><strong>{money(finance.taxes.estimatedVat)}</strong></article>
        </div>
      </section>

      {view === "overview" && canManageMonthlyClosing && (
        <MonthlyClosing
          data={data}
          commissionsData={commissionsData}
          user={user}
          canManage={canManageMonthlyClosing}
          onSave={onSaveMonthlyClosing}
        />
      )}

      <section className="panel">
        <div className="section-title">
          <h3>Conciliacion por metodo de pago</h3>
          <button type="button" onClick={saveControls}>Guardar importes reales</button>
        </div>
        <div className="finance-table">
          <div className="finance-header balance"><span>Metodo</span><span>Cobros registrados</span><span>Base de conciliacion</span><span>Real contado / recibido</span><span>Diferencia conciliacion</span></div>
          {finance.reconciliationByMethod.map((row) => (
            <div className="finance-row balance" key={row.method}>
              <span>{row.method}</span>
              <strong>{money(row.registered)}</strong>
              <strong>{money(row.reconciliationTarget)}</strong>
              <input
                type="text"
                inputMode="decimal"
                value={realControls[row.method] ?? formatFinancialInput(row.reconciliationTarget)}
                onChange={(event) => updateRealControl(row.method, event.target.value)}
                onBlur={() => normalizeRealControl(row.method, row.reconciliationTarget)}
                aria-label={`Importe real confirmado para ${row.method}`}
              />
              <strong>{money(row.difference)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Tesoreria neta por metodo</h3>
        <div className="finance-table">
          <div className="finance-header treasury"><span>Metodo</span><span>Entradas</span><span>Salidas</span><span>Saldo neto teorico</span><span>Real conciliado</span><span>Tesoreria neta real</span></div>
          {finance.reconciliationByMethod.map((row) => (
            <div className="finance-row treasury" key={row.method}>
              <span>{row.method}</span>
              <strong>{money(row.registered)}</strong>
              <strong>{money(row.outflows)}</strong>
              <strong>{money(row.expectedBalance)}</strong>
              <strong>{money(row.confirmedAmount)}</strong>
              <strong>{money(row.treasuryBalance)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Gastos por metodo</h3>
        <div className="finance-table">
          <div className="finance-header compact"><span>Metodo</span><span>Registrados</span><span>Pagados</span><span>Pendientes</span></div>
          {expenseMethods.map((method) => (
            <div className="finance-row compact" key={method}>
              <span>{method}</span>
              <strong>{money(finance.expensesByMethod[method]?.registered)}</strong>
              <strong>{money(finance.expensesByMethod[method]?.paid)}</strong>
              <strong>{money(finance.expensesByMethod[method]?.pending)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Comisiones</h3>
        <div className="finance-table">
          <div className="finance-header compact"><span>Profesional</span><span>Pendiente</span><span>Pagado</span><span>Total</span></div>
          {finance.commissionByEmployee.map((row) => (
            <div className="finance-row compact" key={row.employee}>
              <span>{row.employee}</span>
              <strong>{money(row.pending)}</strong>
              <strong>{money(row.paid)}</strong>
              <strong>{money(row.total)}</strong>
            </div>
          ))}
          {finance.commissionByEmployee.length === 0 && <p className="empty-state">Sin comisiones en este periodo.</p>}
        </div>
      </section>

      <section className="cards-grid">
        <article className="panel">
          <h3>Beneficio operativo</h3>
          <div className="list">
            <div className="stat-row"><span>Ventas registradas</span><strong>{money(finance.salesTotal)}</strong></div>
            <div className="stat-row"><span>- Comision Treatwell</span><strong>{money(finance.treatwellTotal)}</strong></div>
            <div className="stat-row"><span>- Gastos registrados</span><strong>{money(finance.expensesTotal)}</strong></div>
            <div className="stat-row"><span>- Comisiones generadas</span><strong>{money(finance.generatedCommissionsTotal)}</strong></div>
            <div className="stat-row"><span>Beneficio operativo</span><strong>{money(finance.operatingProfit)}</strong></div>
          </div>
        </article>
        <article className="panel">
          <h3>Tesoreria real</h3>
          <div className="list">
            <div className="stat-row"><span>Efectivo contado neto</span><strong>{money(finance.cashCounted)}</strong></div>
            <div className="stat-row"><span>Tesoreria bancaria neta</span><strong>{money(finance.bankTreasury)}</strong></div>
            <div className="stat-row"><span>Tesoreria real</span><strong>{money(finance.realTreasury)}</strong></div>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="section-title">
          <h3>Detalle</h3>
          <button className="secondary-button" type="button" onClick={() => setShowDetail((current) => !current)}>{showDetail ? "Ocultar" : "Mostrar"}</button>
        </div>
        {showDetail && (
          <div className="finance-table">
            <div className="finance-header compact"><span>Fecha</span><span>Tipo</span><span>Concepto</span><span>Importe</span></div>
            {finance.detailRows.map((row, index) => (
              <div className="finance-row compact" key={`${row.type}-${row.date}-${index}`}>
                <span>{row.date}</span><span>{row.type}</span><span>{row.concept}</span><strong>{row.amount >= 0 ? "+" : ""}{money(row.amount)}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

export default Finance;
