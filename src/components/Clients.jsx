import { useState } from "react";
import ClientProfile from "./ClientProfile.jsx";

const emptyForm = { name: "", phone: "", email: "", observations: "", interests: "" };

function Clients({ clients, sales, config, onCreateClient, onUpdateClient, onDeleteClient }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(clients[0]?.id || "");
  const [form, setForm] = useState(emptyForm);
  const filteredClients = clients.filter((client) => `${client.name} ${client.phone} ${client.email}`.toLowerCase().includes(query.toLowerCase()));
  const selectedClient = clients.find((client) => client.id === selectedId) || filteredClients[0] || clients[0];

  const updateField = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const submit = (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    onCreateClient(form);
    setForm(emptyForm);
  };

  const deleteClient = (client) => {
    const confirmed = window.confirm("¿Seguro que deseas eliminar este cliente? Esta acción no se puede deshacer.");
    if (!confirmed) return;
    onDeleteClient(client.id);
    if (selectedId === client.id) setSelectedId("");
  };

  return (
    <section className="two-column">
      <div className="panel">
        <h2>Clientes</h2>
        <label>Buscar<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, telefono o email" /></label>
        <div className="list">
          {filteredClients.map((client) => (
            <article className="client-row" key={client.id}>
              <button className="client-button" type="button" onClick={() => setSelectedId(client.id)}>
                <span>{client.name}</span><small>{client.phone || "Sin telefono"}{client.email ? ` - ${client.email}` : ""}</small>
              </button>
              <div className="row-actions">
                <button className="danger-button" type="button" onClick={() => deleteClient(client)}>Eliminar</button>
              </div>
            </article>
          ))}
        </div>
        <form className="inline-form" onSubmit={submit}>
          <h3>Crear cliente</h3>
          <input name="name" value={form.name} onChange={updateField} placeholder="Nombre" />
          <input name="phone" value={form.phone} onChange={updateField} placeholder="Telefono" />
          <input name="email" value={form.email} onChange={updateField} placeholder="Email" />
          <textarea name="observations" value={form.observations} onChange={updateField} placeholder="Observaciones" />
          <textarea name="interests" value={form.interests} onChange={updateField} placeholder="Intereses" />
          <div className="row-actions">
            <button type="submit">Crear cliente</button>
          </div>
        </form>
      </div>
      {selectedClient && (
        <ClientProfile
          key={selectedClient.id}
          client={selectedClient}
          sales={sales.filter((sale) => sale.clientId === selectedClient.id)}
          config={config}
          onUpdateClient={onUpdateClient}
        />
      )}
    </section>
  );
}

export default Clients;
