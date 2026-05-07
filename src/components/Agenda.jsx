import { useState } from "react";

function Agenda({ clients, config, onSave }) {
  const services = (config.services || []).filter((service) => service.active !== false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    time: "10:00",
    clientId: clients[0]?.id || "",
    service: services[0]?.name || "",
    duration: services[0]?.duration || "",
    employee: config.employees[0] || "",
    status: "Pendiente",
  });
  const clientNames = Object.fromEntries(clients.map((client) => [client.id, client.name]));

  const updateField = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const updateService = (event) => {
    const service = services.find((item) => item.id === event.target.value);
    setForm({ ...form, service: service?.name || "", duration: service?.duration || "" });
  };
  const submit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <section className="two-column">
      <form className="panel" onSubmit={submit}>
        <h2>Agenda</h2>
        <div className="field-row">
          <label>Fecha<input type="date" name="date" value={form.date} onChange={updateField} /></label>
          <label>Hora<input type="time" name="time" value={form.time} onChange={updateField} /></label>
        </div>
        <label>Cliente<select name="clientId" value={form.clientId} onChange={updateField}><option value="">Sin cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
        <label>Servicio<select value={services.find((service) => service.name === form.service)?.id || ""} onChange={updateService}>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
        <label>Empleada<select name="employee" value={form.employee} onChange={updateField}>{config.employees.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Estado<select name="status" value={form.status} onChange={updateField}><option>Pendiente</option><option>Confirmada</option><option>Realizada</option><option>Cancelada</option></select></label>
        <button type="submit">Guardar cita</button>
      </form>
      <div className="panel">
        <h2>Proximas citas</h2>
        <div className="list">
          {(config.agenda || []).map((item) => (
            <article className="list-item" key={item.id}>
              <div><strong>{item.date} - {item.time}</strong><span>{clientNames[item.clientId] || "Sin cliente"} - {item.service}</span></div>
              <b>{item.status}</b>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Agenda;
