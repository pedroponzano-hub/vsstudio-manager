import { getTodayLocalDateString } from "../utils/date.js";

function ExpenseList({ expenses, onEditExpense, onDeleteExpense, canDeleteExpense }) {
  const today = getTodayLocalDateString();

  return (
    <section className="panel list-panel">
      <h2>Gastos</h2>
      <div className="list">
        {expenses.map((expense) => {
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
