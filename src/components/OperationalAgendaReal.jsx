import { useMemo, useState } from "react";

import OperationalCalendarDayView from "./OperationalCalendarDayView.jsx";
import { getTodayLocalDateString } from "../utils/date.js";
import { shiftLocalDate } from "../utils/agendaCalendarDemo.js";
import { formatDuration, getStatusClassName, normalizeDemoAppointmentStatus, normalizeDemoDate, normalizeDemoPaymentStatus, normalizeTime, valueOrFallback } from "../utils/availabilityDemo.js";
import { realAgendaProfessionals, realAgendaServices } from "../utils/agendaRealConfig.js";

function ReadonlyAgendaList({ rows = [] }) {
  return <section className="panel"><div className="operational-agenda-list">
    {rows.map((row) => <article className={`operational-appointment-card ${getStatusClassName(row.status)}`} key={row.id}>
      <div className="appointment-time-block"><strong>{row.time || "No disponible"}</strong><span>Hora</span></div>
      <div className="appointment-main"><div className="appointment-title-line"><div className="appointment-primary-line"><strong>{row.clientName}</strong><span>{row.serviceName}</span><span>{row.employee}</span></div><span className={`operational-status-badge ${getStatusClassName(row.status)}`}>{row.status}</span></div><div className="appointment-meta"><span>Duración: <b>{row.duration}</b></span><span>Teléfono: <b>{row.phone}</b></span></div></div>
    </article>)}
    {rows.length === 0 && <p className="empty-state">No hay citas para la fecha seleccionada.</p>}
  </div></section>;
}

function OperationalAgendaReal({ appointments = [], clients = [], config = {} }) {
  const [selectedDate, setSelectedDate] = useState(getTodayLocalDateString());
  const [view, setView] = useState(() => (typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches ? "list" : "calendar"));
  const clientMap = useMemo(() => Object.fromEntries(clients.map((client) => [client.id, client])), [clients]);
  const services = useMemo(() => realAgendaServices(config), [config]);
  const professionals = useMemo(() => realAgendaProfessionals(config, services), [config, services]);
  const rows = useMemo(() => appointments
    .filter((appointment) => normalizeDemoDate(appointment.date || appointment.fechaOperativa || "") === normalizeDemoDate(selectedDate))
    .map((appointment) => {
      const client = clientMap[appointment.clientId] || {};
      const service = services.find((item) => item.id === appointment.serviceId || item.name === appointment.serviceName || item.name === appointment.service) || {};
      const status = normalizeDemoAppointmentStatus(appointment);
      return {
        ...appointment,
        id: appointment.id || `${selectedDate}-${appointment.startTime || appointment.time}-${appointment.clientId || appointment.clientName}`,
        serviceId: appointment.serviceId || service.id || "",
        professionalId: appointment.professionalId || appointment.employeeId || "",
        date: appointment.date || appointment.fechaOperativa || selectedDate,
        time: normalizeTime(appointment.startTime || appointment.time),
        endTime: normalizeTime(appointment.endTime || ""),
        clientName: valueOrFallback(appointment.clientName || `${client.name || ""} ${client.lastName || ""}`.trim()),
        phone: valueOrFallback(appointment.clientPhone || client.phone, "No disponible"),
        serviceName: valueOrFallback(appointment.serviceName || appointment.service || service.name),
        employee: valueOrFallback(appointment.professionalName || appointment.employee),
        professionalName: valueOrFallback(appointment.professionalName || appointment.employee),
        duration: formatDuration(appointment.durationMinutes || appointment.appointmentDuration || appointment.duration || service.durationMinutes || service.duration),
        appointmentDuration: appointment.durationMinutes || appointment.appointmentDuration || appointment.duration || service.durationMinutes || service.duration,
        appointmentStatus: status,
        paymentStatus: normalizeDemoPaymentStatus(appointment),
        status,
      };
    })
    .sort((first, second) => String(first.time || "99:99").localeCompare(String(second.time || "99:99"))), [appointments, clientMap, selectedDate, services]);
  const formattedDate = useMemo(() => new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", weekday: "short" }).format(new Date(`${selectedDate}T12:00:00`)), [selectedDate]);

  return <section className="module operational-agenda">
    <section className="agenda-command-bar"><div className="agenda-date-navigation">
      <button aria-label="Día anterior" className="secondary-button agenda-arrow-button" type="button" onClick={() => setSelectedDate(shiftLocalDate(selectedDate, -1))}>←</button><button className="secondary-button" type="button" onClick={() => setSelectedDate(getTodayLocalDateString())}>Hoy</button><button aria-label="Día siguiente" className="secondary-button agenda-arrow-button" type="button" onClick={() => setSelectedDate(shiftLocalDate(selectedDate, 1))}>→</button>
      <label className="agenda-date-field"><span>Fecha</span><input aria-label="Fecha de agenda" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
    </div><div className="agenda-command-actions"><div className="agenda-view-switch" role="group" aria-label="Vista de agenda"><button className={view === "calendar" ? "active" : ""} type="button" onClick={() => setView("calendar")}>Calendario</button><button className={view === "list" ? "active" : ""} type="button" onClick={() => setView("list")}>Lista</button></div><button className="agenda-primary-action" disabled title="Persistencia de citas pendiente" type="button">+ Nueva cita · Próximamente</button></div></section>
    <section className="agenda-summary-bar" aria-live="polite"><strong>{formattedDate} · {rows.length} {rows.length === 1 ? "cita" : "citas"}</strong><span>Primera: {rows[0]?.time || "—"}</span><span>Última: {rows[rows.length - 1]?.time || "—"}</span><span>Creación y edición pendientes de persistencia</span></section>
    {view === "calendar" ? <OperationalCalendarDayView rows={rows} clients={clients} professionals={professionals} services={services} selectedDate={selectedDate} readOnly /> : <ReadonlyAgendaList rows={rows} />}
  </section>;
}

export default OperationalAgendaReal;
