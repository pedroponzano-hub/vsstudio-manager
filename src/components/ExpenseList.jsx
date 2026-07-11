import { getTodayLocalDateString } from "../utils/date.js";

function expenseSortKey(expense = {}) {
  return String(expense.createdAt || expense.date || "");
}

function ExpenseList({ expenses, onEditExpense, onDeleteExpense, canDeleteExpense }) {
  const today = getTodayLocalDateString();
  const sortedExpenses = [...(expenses || [])].sort((first, second) => {
    const dateComparison = expenseSortKey(second).localeCompare(expenseSortKey(first));
    if (dateComparison !== 0) return dateComparison;
    return String(second.id || "").localeCompare(String(first.id || ""));
  });

  return (
    <section className="panel list-panel">
      <h2>Gastos</h2>
      <div className="list">
        {sortedExpenses.map((expense) => {
          const canEditToday = expense.date === today;
          const canDelete = canDeleteExpense ? canDeleteExpense(expense) : true;

          return (
            <article className="list-item" key={expense.id}>
              <div>
                <strong>{expense.concept}</strong>
                <span>{expense.category} - {expense.documentType || "Otro"} - {expense.date} - {expense.status === "pendiente" ? "Pendiente" : "Pagado"}</span>
                {expense.documentType === "Factura" && <span>Base {Number(expense.taxableBase || 0).toFixed(2)} EUR - IVA {Number(expense.supportedVat || 0).toFixed(2)} EUR</span>}
              </div>
              <div className="item-actions">
                <b>{Number(expense.amount).toFixed(2)} EUR</b>
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
      </div>
    </section>
  );
}

export default ExpenseList;
