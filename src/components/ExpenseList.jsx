import { useMemo, useState } from "react";
import { addLocalDays, getLocalStartOfWeek, getTodayLocalDateString } from "../utils/date.js";

const euroFormatter = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const allValue = "__all__";
const periodOptions = [
  ["today", "Hoy"],
  ["yesterday", "Ayer"],
  ["this_week", "Esta semana"],
  ["this_month", "Este mes"],
  ["previous_month", "Mes anterior"],
  ["custom", "Rango personalizado"],
];

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

function previousMonthRange(today = getTodayLocalDateString()) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const monthText = String(previousMonth).padStart(2, "0");
  const lastDay = new Date(previousYear, previousMonth, 0).getDate();
  return {
    from: `${previousYear}-${monthText}-01`,
    to: `${previousYear}-${monthText}-${String(lastDay).padStart(2, "0")}`,
  };
}

function periodRange(period, today = getTodayLocalDateString()) {
  if (period === "today") return { from: today, to: today };
  if (period === "yesterday") {
    const yesterday = addLocalDays(today, -1);
    return { from: yesterday, to: yesterday };
  }
  if (period === "this_week") return { from: getLocalStartOfWeek(today), to: today };
  if (period === "previous_month") return previousMonthRange(today);
  return { from: `${today.slice(0, 7)}-01`, to: today };
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
  const range = periodRange("this_month", today);
  return {
    period: "this_month",
    from: range.from,
    to: range.to,
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
  return isDateString(filters.from) && isDateString(filters.to) && date >= filters.from && date <= filters.to;
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

  const secondaryFiltersCount = [
    draftFilters.query.trim(),
    draftFilters.category !== allValue,
    draftFilters.status !== allValue,
    draftFilters.paymentMethod !== allValue,
  ].filter(Boolean).length;

  const appliedPeriodLabel = periodOptions.find(([value]) => value === appliedFilters.period)?.[1] || "Rango personalizado";

  const updateDraft = (event) => {
    const { name, value } = event.target;
    setDraftFilters((current) => {
      if (name === "period") {
        if (value === "custom") return { ...current, period: value };
        return { ...current, period: value, ...periodRange(value) };
      }
      if (name === "from" || name === "to") return { ...current, [name]: value, period: "custom" };
      return { ...current, [name]: value };
    });
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
        <div className="expense-filter-main">
          <label>Periodo
            <select name="period" value={draftFilters.period} onChange={updateDraft}>
              {periodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Fecha desde<input type="date" name="from" value={draftFilters.from} max={draftFilters.to || undefined} onChange={updateDraft} /></label>
          <label>Fecha hasta<input type="date" name="to" value={draftFilters.to} min={draftFilters.from || undefined} onChange={updateDraft} /></label>
          <button type="button" onClick={applyFilters}>Aplicar filtro</button>
        </div>
        {filterError && <p className="auth-error">{filterError}</p>}
        <div className="expense-filter-meta">
          <span>{appliedPeriodLabel}: {formatDisplayDate(appliedFilters.from)} - {formatDisplayDate(appliedFilters.to)}</span>
          <button className="secondary-button" type="button" onClick={clearFilters}>Limpiar filtro</button>
        </div>
        <details className="expense-more-filters">
          <summary>Mas filtros{secondaryFiltersCount ? ` (${secondaryFiltersCount})` : ""}</summary>
          <div className="expense-secondary-grid">
            <label>Buscar por concepto<input name="query" value={draftFilters.query} onChange={updateDraft} placeholder="Concepto, proveedor o documento" /></label>
            <label>Categoria<select name="category" value={draftFilters.category} onChange={updateDraft}><option value={allValue}>Todas</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Estado<select name="status" value={draftFilters.status} onChange={updateDraft}><option value={allValue}>Todos</option>{statuses.map((item) => <option key={item} value={item}>{item === "pendiente" ? "Pendiente" : item === "pagado" ? "Pagado" : item}</option>)}</select></label>
            <label>Metodo pago<select name="paymentMethod" value={draftFilters.paymentMethod} onChange={updateDraft}><option value={allValue}>Todos</option>{paymentMethods.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          </div>
        </details>
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
