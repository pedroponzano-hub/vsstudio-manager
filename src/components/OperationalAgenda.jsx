import { useMemo, useState } from "react";

import { getTodayLocalDateString } from "../utils/date.js";

function valueOrFallback(value, fallback = "Sin asignar") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeTime(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (!match) return text;
  return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
}

function formatDuration(value) {
  if (value === undefined || value === null || value === "") return "No disponible";
  if (typeof value === "number") return value > 0 ? `${value} min` : "No disponible";

  const text = String(value).trim();
  if (!text) return "No disponible";
  if (/^\d+$/.test(text)) return `${text} min`;
  return text;
}

function OperationalAgenda({ appointments = [], clients = [], config = {} }) {
  const [selectedDate, setSelectedDate] = useState(getTodayLocalDateString());
  const clientMap = useMemo(() => Object.fromEntries((clients || []).map((client) => [client.id, client])), [clients]);
  const services = config.services || [];

  const rows = useMemo(() => (
    (appointments || [])
      .filter((appointment) => (appointment.date || appointment.fechaOperativa || "") === selectedDate)
      .map((appointment) => {
        const client = clientMap[appointment.clientId] || {};
        const service = services.find((item) => (
          item.id === appointment.serviceId
          || item.name === appointment.serviceName
          || item.name === appointment.service
        )) || {};

        return {
          id: appointment.id || `${appointment.date}-${appointment.startTime || appointment.time}-${appointment.clientId || appointment.clientName}`,
          time: normalizeTime(appointment.startTime || appointment.time),
          clientName: valueOrFallback(
            appointment.clientName
            || `${client.name || ""} ${client.lastName || ""}`.trim(),
          ),
          phone: valueOrFallback(appointment.clientPhone || client.phone, "No disponible"),
          serviceName: valueOrFallback(appointment.serviceName || appointment.service || service.name),
          employee: valueOrFallback(appointment.employee),
          duration: formatDuration(appointment.duration || service.duration),
          status: valueOrFallback(appointment.status || "Pendiente"),
        };
      })
      .sort((first, second) => String(first.time || "99:99").localeCompare(String(second.time || "99:99")))
  ), [appointments, clientMap, selectedDate, services]);

  return (
    <section className="module operational-agenda">
      <div className="section-title">
        <div>
          <h2>Agenda operativa v2</h2>
          <span>Vista experimental de solo lectura</span>
        </div>
        <label className="compact-date-filter">
          Fecha
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </label>
      </div>

      <section className="summary-grid compact">
        <article className="metric"><span>Citas del dia</span><strong>{rows.length}</strong></article>
        <article className="metric"><span>Primera cita</span><strong>{rows[0]?.time || "No disponible"}</strong></article>
        <article className="metric"><span>Ultima cita</span><strong>{rows[rows.length - 1]?.time || "No disponible"}</strong></article>
      </section>

      <section className="panel">
        <div className="finance-table">
          <div className="finance-header operational-agenda-row">
            <span>Hora</span>
            <span>Cliente</span>
            <span>Telefono</span>
            <span>Servicio</span>
            <span>Profesional</span>
            <span>Duracion</span>
            <span>Estado</span>
          </div>
          {rows.map((row) => (
            <div className="finance-row operational-agenda-row" key={row.id}>
              <strong>{row.time || "No disponible"}</strong>
              <span>{row.clientName}</span>
              <span>{row.phone}</span>
              <span>{row.serviceName}</span>
              <span>{row.employee}</span>
              <span>{row.duration}</span>
              <span className="status-pill pending">{row.status}</span>
            </div>
          ))}
          {rows.length === 0 && <p className="empty-state">No hay citas para la fecha seleccionada.</p>}
        </div>
      </section>
    </section>
  );
}

export default OperationalAgenda;
