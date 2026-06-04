function ExpenseList({ expenses, onDeleteExpense }) {
  return (
    <section className="panel list-panel">
      <h2>Gastos</h2>
      <div className="list">
        {expenses.map((expense) => (
          <article className="list-item" key={expense.id}>
            <div>
              <strong>{expense.concept}</strong>
              <span>{expense.category} - {expense.documentType || "Otro"} - {expense.date} - {expense.status === "pendiente" ? "Pendiente" : "Pagado"}</span>
              {expense.documentType === "Factura" && <span>Base {Number(expense.taxableBase || 0).toFixed(2)} EUR - IVA {Number(expense.supportedVat || 0).toFixed(2)} EUR</span>}
            </div>
            <div className="item-actions">
              <b>{Number(expense.amount).toFixed(2)} EUR</b>
              <button type="button" onClick={() => onDeleteExpense(expense.id)} aria-label={`Eliminar ${expense.concept}`}>
                Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ExpenseList;
