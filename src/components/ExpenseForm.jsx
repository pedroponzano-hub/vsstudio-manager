import { useState } from "react";

function ExpenseForm({ config = {}, onAddExpense }) {
  const categories = config.expenseCategories || ["General"];
  const paymentMethods = config.paymentMethods || ["Tarjeta"];
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: categories[0] || "General",
    concept: "",
    amount: "",
    paymentMethod: paymentMethods[0] || "",
  });

  const updateField = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const submit = (event) => {
    event.preventDefault();
    if (!form.concept.trim() || !form.amount) return;
    onAddExpense({ ...form, amount: Number(form.amount) });
    setForm({ ...form, concept: "", amount: "" });
  };

  return (
    <form className="panel" onSubmit={submit}>
      <h2>Nuevo gasto</h2>
      <div className="field-row">
        <label>Fecha<input name="date" type="date" value={form.date} onChange={updateField} /></label>
        <label>Categoria<select name="category" value={form.category} onChange={updateField}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <label>Concepto<input name="concept" value={form.concept} onChange={updateField} placeholder="Materiales" /></label>
      <div className="field-row">
        <label>Importe<input name="amount" type="number" min="0" step="0.01" value={form.amount} onChange={updateField} /></label>
        <label>Metodo pago<select name="paymentMethod" value={form.paymentMethod} onChange={updateField}>{paymentMethods.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <button type="submit">Guardar gasto</button>
    </form>
  );
}

export default ExpenseForm;
