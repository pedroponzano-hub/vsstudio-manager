import { useMemo, useState } from "react";
import { getTodayLocalDateString } from "../utils/date.js";

const euroFormatter = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const allValue = "__all__";

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isDateString(value = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

function formatDisplayDate(value = "") {
  if (!isDateString(value)) return value || "-";
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

function getExpenseBusinessDate(expense = {}) {
  if (isDateString(expense.expenseDate)) return expense.expenseDate;
  if (isDateString(expense.date)) return expense.date;
  const createdAt = String(expense.createdAt || "");
  const createdDate = createdAt.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return createdDate || "";
}

function expenseSortKey(expense = {}) {
  return `${getExpenseBusinessDate(expense)}T${String(expense.createdAt || "")}`;
}

function initialFilters() {
  const today = getTodayLocalDateString();
  return {
    dateMode: "month",
    day: today,
    from: "",
    to: "",
    month: today.slice(0, 7),
    query: "",
    category: allValue,
    status: allValue,
    paymentMethod: allValue,
  };
}

function uniqueOptions(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort((first, second) => first.localeCompare(second, "es"));
}

function filterByDate(expense, filters) {
  const date = getExpenseBusinessDate(expense);
  if (!date) return false;
  if (filters.dateMode === "day") return date === filters.day;
  if (filters.dateMode === "range") return isDateString(filters.from) && isDateString(filters.to) && date >= filters.from && date <= filters.to;
  return date.startsWith(filters.month);
}

function matchesFilters(expense, filters) {
  if (!filterByDate(expense, filters)) return false;
  if (filters.category !== allValue && String(expense.category || "") !== filters.category) return false;
  if (filters.status !== allValue && String(expense.status || "").toLowerCase() !== filters.status) return false;
  if (filters.paymentMethod !== allValue && String(expense.paymentMethod || "") !== filters.paymentMethod) return false;

  const query = normalizeText(filters.query);
  if (!query) return true;

  const searchableText = [
    expense.concept,
    expense.notes,
    expense.observations,
    expense.provider,
    expense.supplier,
    expense.documentNumber,
    expense.invoiceNumber,
  ].map(normalizeText).join(" ");

  return searchableText.includes(query);
}

function rangeError(filters) {
  if (filters.dateMode !== "range") return "";
  if (!filters.from || !filters.to) return "Selecciona fecha desde y hasta para aplicar el rango.";
  if (filters.from > filters.to) return "La fecha Desde no puede ser posterior a Hasta.";
  return "";
}

function ExpenseList({ expenses, config = {}, notice = "", onEditExpense, onDeleteExpense, canDeleteExpense }) {
  const today = getTodayLocalDateString();
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [filterError, setFilterError] = useState("");

  const categories = useMemo(() => uniqueOptions([...(config.expenseCategories || []), ...(expenses || []).map((expense) => expense.category)]), [config.expenseCategories, expenses]);
  const statuses = useMemo(() => uniqueOptions(["pagado", "pendiente", ...(expenses || []).map((expense) => String(expense.status || "").toLowerCase())]), [expenses]);
  const paymentMethods = useMemo(() => uniqueOptions([...(config.paymentMethods || []), "Transferencia", ...(expenses || []).map((expense) => expense.paymentMethod)]), [config.paymentMethods, expenses]);

  const filteredExpenses = useMemo(() => (expenses || []).filter((expense) => matchesFilters(expense, appliedFilters)), [expenses, appliedFilters]);
  const sortedExpenses = [...filteredExpenses].sort((first, second) => {
    const dateComparison = expenseSortKey(second).localeCompare(expenseSortKey(first));
    if (dateComparison !== 0) return dateComparison;
    return String(second.id || "").localeCompare(String(first.id || ""));
  });
  const summary = filteredExpenses.reduce((totals, expense) => {
    const amount = Number(expense.amount || 0);
    totals.count += 1;
    totals.total += amount;
    if (String(expense.status || "").toLowerCase() === "pendiente") totals.pending += amount;
    else totals.paid += amount;
    return totals;
  }, { count: 0, total: 0, paid: 0, pending: 0 });

  const updateDraft = (event) => {
    const { name, value } = event.target;
    setDraftFilters((current) => ({ ...current, [name]: value }));
    setFilterError("");
  };

  const applyFilters = () => {
    const error = rangeError(draftFilters);
    if (error) {
      setFilterError(error);
      return;
    }
    setAppliedFilters(draftFilters);
    setFilterError("");
  };

  const clearFilters = () => {
    const nextFilters = initialFilters();
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setFilterError("");
  };

  return (
    <section className="panel list-panel">
      <h2>Gastos</h2>
      {notice && <p className="success-message">{notice}</p>}
      <section className="expense-filter-box">
        <div className="section-title compact">
          <h3>Buscar y filtrar gastos</h3>
          <span>{appliedFilters.dateMode === "month" ? `Mes ${appliedFilters.month}` : appliedFilters.dateMode === "day" ? `Dia ${formatDisplayDate(appliedFilters.day)}` : `${formatDisplayDate(appliedFilters.from)} - ${formatDisplayDate(appliedFilters.to)}`}</span>
        </div>
        <div className="expense-filter-grid">
          <label>Tipo de filtro
            <select name="dateMode" value={draftFilters.dateMode} onChange={updateDraft}>
              <option value="day">Dia</option>
              <option value="range">Rango</option>
              <option value="month">Mes</option>
            </select>
          </label>
          {draftFilters.dateMode === "day" && <label>Fecha<input type="date" name="day" value={draftFilters.day} onChange={updateDraft} /></label>}
          {draftFilters.dateMode === "range" && (
            <>
              <label>Desde<input type="date" name="from" value={draftFilters.from} max={draftFilters.to || undefined} onChange={updateDraft} /></label>
              <label>Hasta<input type="date" name="to" value={draftFilters.to} min={draftFilters.from || undefined} onChange={updateDraft} /></label>
            </>
          )}
          {draftFilters.dateMode === "month" && <label>Mes<input type="month" name="month" value={draftFilters.month} onChange={updateDraft} /></label>}
          <label>Buscar<input name="query" value={draftFilters.query} onChange={updateDraft} placeholder="Concepto, proveedor o documento" /></label>
          <label>Categoria<select name="category" value={draftFilters.category} onChange={updateDraft}><option value={allValue}>Todas</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Estado<select name="status" value={draftFilters.status} onChange={updateDraft}><option value={allValue}>Todos</option>{statuses.map((item) => <option key={item} value={item}>{item === "pendiente" ? "Pendiente" : item === "pagado" ? "Pagado" : item}</option>)}</select></label>
          <label>Metodo pago<select name="paymentMethod" value={draftFilters.paymentMethod} onChange={updateDraft}><option value={allValue}>Todos</option>{paymentMethods.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </div>
        {filterError && <p className="auth-error">{filterError}</p>}
        <div className="row-actions">
          <button type="button" onClick={applyFilters}>Aplicar filtros</button>
          <button className="secondary-button" type="button" onClick={clearFilters}>Limpiar filtros</button>
        </div>
      </section>
      <section className="expense-summary-grid">
        <article className="metric"><span>Gastos</span><strong>{summary.count}</strong></article>
        <article className="metric"><span>Total</span><strong>{euroFormatter.format(summary.total)}</strong></article>
        <article className="metric"><span>Pagado</span><strong>{euroFormatter.format(summary.paid)}</strong></article>
        <article className="metric"><span>Pendiente</span><strong>{euroFormatter.format(summary.pending)}</strong></article>
      </section>
      <div className="list">
        {sortedExpenses.map((expense) => {
          const businessDate = getExpenseBusinessDate(expense);
          const canEditToday = businessDate === today;
          const canDelete = canDeleteExpense ? canDeleteExpense(expense) : true;

          return (
            <article className="list-item" key={expense.id}>
              <div>
                <strong>{expense.concept}</strong>
                <span>{expense.category} - {expense.documentType || "Otro"} - {formatDisplayDate(businessDate)} - {expense.status === "pendiente" ? "Pendiente" : "Pagado"} - {expense.paymentMethod || "Sin metodo"}</span>
                {expense.documentType === "Factura" && <span>Base {Number(expense.taxableBase || 0).toFixed(2)} EUR - IVA {Number(expense.supportedVat || 0).toFixed(2)} EUR</span>}
              </div>
              <div className="item-actions">
                <b>{euroFormatter.format(Number(expense.amount || 0))}</b>
                {canEditToday && <button className="secondary-button" type="button" onClick={() => onEditExpense?.(expense)}>Editar</button>}
                {canDelete && (
                  <button type="button" onClick={() => onDeleteExpense(expense.id)} aria-label={`Eliminar ${expense.concept}`}>
                    Eliminar
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {sortedExpenses.length === 0 && (
          <div className="empty-state expense-empty-state">
            <p>No hay gastos para los filtros seleccionados.</p>
            <button className="secondary-button" type="button" onClick={clearFilters}>Limpiar filtros</button>
          </div>
        )}
      </div>
    </section>
  );
}

export default ExpenseList;
