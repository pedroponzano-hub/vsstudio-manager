import { useState } from "react";

function ClientForm({ onAddClient }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  const updateField = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const submit = (event) => {
    event.preventDefault();

    if (!form.name.trim()) return;

    onAddClient(form);
    setForm({ name: "", email: "", phone: "" });
  };

  return (
    <form className="panel" onSubmit={submit}>
      <h2>Nuevo cliente</h2>
      <label>
        Nombre
        <input name="name" value={form.name} onChange={updateField} placeholder="Nombre completo" />
      </label>
      <label>
        Email
        <input name="email" type="email" value={form.email} onChange={updateField} placeholder="cliente@email.com" />
      </label>
      <label>
        Telefono
        <input name="phone" value={form.phone} onChange={updateField} placeholder="600 000 000" />
      </label>
      <button type="submit">Anadir cliente</button>
    </form>
  );
}

export default ClientForm;
