import { useMemo, useState } from "react";

import { getTodayLocalDateString } from "../utils/date.js";

function todayDate() {
  return getTodayLocalDateString();
}

function emptyAppointmentForm() {
  return {
    date: todayDate(),
    time: "",
    clientId: "",
    serviceId: "",
    serviceName: "",
    duration: "",
    employee: "",
    status: "",
  };
}

function durationToMinutes(duration = "") {
  const text = String(duration).toLowerCase();
  const hours = text.match(/(\d+(?:[.,]\d+)?)\s*h/);
  const minutes = text.match(/(\d+)\s*min/);
  const hourMinutes = hours ? Number(hours[1].replace(",", ".")) * 60 : 0;
  const extraMinutes = minutes ? Number(minutes[1]) : 0;

  return Math.round(hourMinutes + extraMinutes);
}

function calculateEndTime(startTime, duration) {
  const minutes = durationToMinutes(duration);
  if (!startTime || !minutes) return "";

  const [hours, mins] = startTime.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(mins)) return "";

  const totalMinutes = (hours * 60) + mins + minutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;

  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

const emptyQuickClient = { name: "", lastName: "", phone: "", email: "", observations: "" };

function Agenda({ clients, config, appointments, onSave, onUpdate, onDelete, onCreateClient }) {
  const services = (config.services || []).filter((service) => service.active !== false);
  const appointmentList = appointments || config.agenda || [];
  const clientNames = useMemo(() => Object.fromEntries(clients.map((client) => [client.id, client.name])), [clients]);
  const [form, setForm] = useState(() => emptyAppointmentForm());
  const [clientQuery, setClientQuery] = useState("");
  const [showClientResults, setShowClientResults] = useState(false);
  const [showQuickClientForm, setShowQuickClientForm] = useState(false);
  const [quickClient, setQuickClient] = useState(emptyQuickClient);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");

  const filteredClients = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    if (!query) return [];
    return clients.filter((client) => (
      `${client.name || ""} ${client.lastName || ""} ${client.phone || ""} ${client.email || ""}`
        .toLowerCase()
        .includes(query)
    )).slice(0, 12);
  }, [clientQuery, clients]);

  const updateField = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
    setError("");
  };

  const updateService = (event) => {
    const service = services.find((item) => item.id === event.target.value);
    setForm({
      ...form,
      serviceId: service?.id || "",
      serviceName: service?.name || "",
      duration: service?.duration || "",
    });
    setError("");
  };

  const updateClientQuery = (event) => {
    const value = event.target.value;
    setClientQuery(value);
    setShowClientResults(Boolean(value.trim()));
    setError("");
    setForm((current) => ({ ...current, clientId: "" }));
  };

  const selectClient = (client) => {
    setForm((current) => ({ ...current, clientId: client.id }));
    setClientQuery(`${client.name || ""}${client.lastName ? ` ${client.lastName}` : ""}`.trim());
    setShowClientResults(false);
    setShowQuickClientForm(false);
    setError("");
  };

  const openQuickClientForm = () => {
    setShowClientResults(false);
    setShowQuickClientForm(true);
  };

  const updateQuickClientField = (event) => {
    setQuickClient({ ...quickClient, [event.target.name]: event.target.value });
  };

  const saveQuickClient = () => {
    if (!quickClient.name.trim()) {
      setError("Introduce el nombre del cliente.");
      return;
    }

    const client = onCreateClient?.({
      name: quickClient.name.trim(),
      lastName: quickClient.lastName.trim(),
      phone: quickClient.phone.trim(),
      email: quickClient.email.trim(),
      observations: quickClient.observations.trim(),
    });
    if (!client) return;

    selectClient(client);
    setQuickClient(emptyQuickClient);
  };

  const resetForm = () => {
    setForm(emptyAppointmentForm());
    setClientQuery("");
    setShowClientResults(false);
    setShowQuickClientForm(false);
    setQuickClient(emptyQuickClient);
    setEditingId("");
    setError("");
  };

  const editAppointment = (appointment) => {
    const serviceId = appointment.serviceId || services.find((service) => service.name === (appointment.serviceName || appointment.service))?.id || "";
    const service = services.find((item) => item.id === serviceId);

    setEditingId(appointment.id);
    setClientQuery(appointment.clientName || clients.find((client) => client.id === appointment.clientId)?.name || "");
    setForm({
      date: appointment.date || todayDate(),
      time: appointment.startTime || appointment.time || "",
      clientId: appointment.clientId || "",
      serviceId,
      serviceName: appointment.serviceName || appointment.service || service?.name || "",
      duration: appointment.duration || service?.duration || "",
      employee: appointment.employee || "",
      status: appointment.status || "",
    });
    setError("");
  };

  const deleteAppointment = (appointmentId) => {
    const confirmed = window.confirm("¿Seguro que deseas eliminar esta cita? Esta acción no se puede deshacer.");
    if (!confirmed) return;
    onDelete?.(appointmentId);
    if (editingId === appointmentId) resetForm();
  };

  const submit = (event) => {
    event.preventDefault();
    const client = clients.find((item) => item.id === form.clientId);
    const service = services.find((item) => item.id === form.serviceId);

    if (!form.clientId || !form.serviceId || !form.employee || !form.date || !form.time) {
      setError("Completa cliente, servicio, empleada, fecha y hora antes de guardar.");
      return;
    }

    const endTime = calculateEndTime(form.time, form.duration || service?.duration);
    const payload = {
      ...form,
      status: form.status || "Pendiente",
      clientName: client?.name || "",
      serviceId: service?.id || form.serviceId,
      serviceName: service?.name || form.serviceName,
      service: service?.name || form.serviceName,
      category: service?.category || "",
      duration: form.duration || service?.duration || "",
      startTime: form.time,
      endTime,
    };

    if (editingId) {
      onUpdate?.(editingId, payload);
    } else {
      onSave(payload);
    }

    resetForm();
  };

  return (
    <section className="two-column">
      <form className="panel form-grid" onSubmit={submit}>
        <h2>{editingId ? "Editar cita" : "Agenda"}</h2>
        <div className="field-row">
          <label>Fecha<input type="date" name="date" value={form.date} onChange={updateField} /></label>
          <label>Hora<input type="time" name="time" value={form.time} onChange={updateField} /></label>
        </div>
        <label className="service-search-field">
          Cliente
          <input
            value={clientQuery}
            onChange={updateClientQuery}
            onFocus={() => setShowClientResults(Boolean(clientQuery.trim()))}
            placeholder="Buscar por nombre, telefono o email"
          />
          {onCreateClient && (
            <div className="client-quick-actions">
              <button className="secondary-button" type="button" onClick={openQuickClientForm}>+ Crear cliente nuevo</button>
            </div>
          )}
          {showClientResults && (
            <div className="service-results">
              {filteredClients.map((client) => (
                <button className="service-result" type="button" key={client.id} onMouseDown={() => selectClient(client)}>
                  <strong>{client.name}{client.lastName ? ` ${client.lastName}` : ""}</strong>
                  <span>{client.phone || "Sin telefono"}{client.email ? ` - ${client.email}` : ""}</span>
                </button>
              ))}
              {filteredClients.length === 0 && <p className="empty-state">Sin clientes con esa busqueda.</p>}
            </div>
          )}
        </label>
        {showQuickClientForm && onCreateClient && (
          <section className="quick-client-box">
            <h3>Crear cliente nuevo</h3>
            <div className="field-row">
              <input name="name" value={quickClient.name} onChange={updateQuickClientField} placeholder="Nombre" />
              <input name="lastName" value={quickClient.lastName} onChange={updateQuickClientField} placeholder="Apellidos" />
            </div>
            <div className="field-row">
              <input name="phone" value={quickClient.phone} onChange={updateQuickClientField} placeholder="Telefono" />
              <input name="email" type="email" value={quickClient.email} onChange={updateQuickClientField} placeholder="Email" />
            </div>
            <textarea name="observations" value={quickClient.observations} onChange={updateQuickClientField} placeholder="Observaciones" />
            <div className="row-actions">
              <button type="button" onClick={saveQuickClient}>Guardar cliente</button>
              <button className="secondary-button" type="button" onClick={() => setShowQuickClientForm(false)}>Cancelar</button>
            </div>
          </section>
        )}
        <label>
          Servicio
          <select value={form.serviceId} onChange={updateService}>
            <option value="">Seleccionar...</option>
            {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select>
        </label>
        <label>
          Empleada
          <select name="employee" value={form.employee} onChange={updateField}>
            <option value="">Seleccionar...</option>
            {(config.employees || []).map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          Estado
          <select name="status" value={form.status} onChange={updateField}>
            <option value="">Pendiente</option>
            <option>Pendiente</option>
            <option>Confirmada</option>
            <option>Realizada</option>
            <option>Cancelada</option>
          </select>
        </label>
        {form.duration && (
          <div className="calculated-row">
            <span>Duracion: <b>{form.duration}</b></span>
            <span>Inicio: <b>{form.time || "--:--"}</b></span>
            <span>Fin: <b>{calculateEndTime(form.time, form.duration) || "--:--"}</b></span>
          </div>
        )}
        {error && <p className="empty-state">{error}</p>}
        <div className="form-actions">
          <button type="submit">{editingId ? "Guardar cambios" : "Guardar cita"}</button>
          {editingId && <button className="secondary-button" type="button" onClick={resetForm}>Cancelar edición</button>}
        </div>
      </form>
      <div className="panel">
        <h2>Proximas citas</h2>
        <div className="list">
          {appointmentList.map((item) => (
            <article className="list-item" key={item.id}>
              <div>
                <strong>{item.date} - {item.startTime || item.time}{item.endTime ? ` a ${item.endTime}` : ""}</strong>
                <span>{clientNames[item.clientId] || item.clientName || "Sin cliente"} - {item.serviceName || item.service}</span>
                <span>{item.employee || "Sin empleada"}{item.duration ? ` - ${item.duration}` : ""}</span>
              </div>
              <div className="item-actions">
                <b>{item.status || "Pendiente"}</b>
                <div className="row-actions">
                  <button className="secondary-button" type="button" onClick={() => editAppointment(item)}>Editar</button>
                  <button className="danger-button" type="button" onClick={() => deleteAppointment(item.id)}>Eliminar</button>
                </div>
              </div>
            </article>
          ))}
          {appointmentList.length === 0 && <p className="empty-state">No hay citas creadas.</p>}
        </div>
      </div>
    </section>
  );
}

export default Agenda;
