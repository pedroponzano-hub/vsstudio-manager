import { useMemo, useState } from "react";

function todayDate() {
  return new Date().toISOString().slice(0, 10);
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

  const date = new Date();
  date.setHours(hours, mins + minutes, 0, 0);

  return date.toTimeString().slice(0, 5);
}

function Agenda({ clients, config, appointments, onSave, onUpdate, onDelete }) {
  const services = (config.services || []).filter((service) => service.active !== false);
  const appointmentList = appointments || config.agenda || [];
  const clientNames = useMemo(() => Object.fromEntries(clients.map((client) => [client.id, client.name])), [clients]);
  const [form, setForm] = useState(() => emptyAppointmentForm());
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");

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

  const resetForm = () => {
    setForm(emptyAppointmentForm());
    setEditingId("");
    setError("");
  };

  const editAppointment = (appointment) => {
    const serviceId = appointment.serviceId || services.find((service) => service.name === (appointment.serviceName || appointment.service))?.id || "";
    const service = services.find((item) => item.id === serviceId);

    setEditingId(appointment.id);
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
        <label>
          Cliente
          <select name="clientId" value={form.clientId} onChange={updateField}>
            <option value="">Seleccionar...</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>
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
