import { useState } from "react";
import { getTodayLocalDateString } from "../utils/date.js";

const documentTypes = ["Factura", "Ticket", "Recibo", "Nómina", "Comisión bancaria", "Otro"];
const vatOptions = ["21", "10", "4", "0", "personalizado"];

function ExpenseForm({ config = {}, onAddExpense }) {
  const categories = config.expenseCategories || ["General"];
  const paymentMethods = config.paymentMethods || ["Tarjeta"];
  const [form, setForm] = useState({
    date: getTodayLocalDateString(),
    category: categories[0] || "General",
    concept: "",
    amount: "",
    paymentMethod: paymentMethods[0] || "",
    status: "pagado",
    documentType: "Otro",
    vatOption: "21",
    customVatRate: "",
  });

  const updateField = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const isInvoice = form.documentType === "Factura";
  const vatRate = isInvoice ? Number(form.vatOption === "personalizado" ? form.customVatRate : form.vatOption) : 0;
  const amount = Number(form.amount || 0);
  const taxableBase = isInvoice && vatRate > 0 ? amount / (1 + vatRate / 100) : amount;
  const supportedVat = isInvoice && vatRate > 0 ? amount - taxableBase : 0;

  const submit = (event) => {
    event.preventDefault();
    if (!form.concept.trim() || !form.amount) return;
    onAddExpense({
      ...form,
      amount,
      vatRate,
      taxableBase,
      supportedVat,
    });
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
      <div className="field-row">
        <label>Tipo de documento<select name="documentType" value={form.documentType} onChange={updateField}>{documentTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
        {isInvoice && <label>Tipo de IVA<select name="vatOption" value={form.vatOption} onChange={updateField}>{vatOptions.map((item) => <option key={item} value={item}>{item === "personalizado" ? "Personalizado" : `${item}%`}</option>)}</select></label>}
      </div>
      {isInvoice && form.vatOption === "personalizado" && <label>IVA personalizado %<input name="customVatRate" type="number" min="0" step="0.01" value={form.customVatRate} onChange={updateField} /></label>}
      {isInvoice && (
        <div className="calculated-row tax-row">
          <span>Base imponible: <b>{taxableBase.toFixed(2)} EUR</b></span>
          <span>IVA soportado: <b>{supportedVat.toFixed(2)} EUR</b></span>
          <span>Total factura: <b>{amount.toFixed(2)} EUR</b></span>
        </div>
      )}
      <label>Estado<select name="status" value={form.status} onChange={updateField}><option value="pagado">Pagado</option><option value="pendiente">Pendiente</option></select></label>
      <button type="submit">Guardar gasto</button>
    </form>
  );
}

export default ExpenseForm;
