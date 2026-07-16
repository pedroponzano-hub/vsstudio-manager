import { useMemo, useState } from "react";

import NewAppointmentModalDemo from "./NewAppointmentModalDemo.jsx";
import OperationalDayAgenda from "./OperationalDayAgenda.jsx";
import { getTodayLocalDateString } from "../utils/date.js";
import {
  demoAppointmentsForDate,
  formatDuration,
  getStatusClassName,
  normalizeTime,
  valueOrFallback,
} from "../utils/availabilityDemo.js";

function shouldUseDemoAgenda() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("demoAgenda") === "1";
}

function ReadonlyAgendaList({ rows = [] }) {
  return (
    <section className="panel">
      <div className="operational-agenda-list">
        {rows.map((row) => (
          <article className={`operational-appointment-card ${getStatusClassName(row.status)}`} key={row.id}>
            <div className="appointment-time-block">
              <strong>{row.time || "No disponible"}</strong>
              <span>Hora</span>
            </div>
            <div className="appointment-main">
              <div className="appointment-title-line">
                <div className="appointment-primary-line">
                  <strong>{row.clientName}</strong>
                  <span>{row.serviceName}</span>
                  <span>{row.employee}</span>
                </div>
                <span className={`operational-status-badge ${getStatusClassName(row.status)}`}>
                  {row.status}
                </span>
              </div>
              <div className="appointment-meta">
                <span>Duracion: <b>{row.duration}</b></span>
                <span>Telefono: <b>{row.phone}</b></span>
              </div>
            </div>
          </article>
        ))}
        {rows.length === 0 && <p className="empty-state">No hay citas para la fecha seleccionada.</p>}
      </div>
    </section>
  );
}

function OperationalAgenda({ appointments = [], clients = [], config = {} }) {
  const [selectedDate, setSelectedDate] = useState(getTodayLocalDateString());
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const demoMode = shouldUseDemoAgenda();
  const clientMap = useMemo(() => Object.fromEntries((clients || []).map((client) => [client.id, client])), [clients]);
  const services = config.services || [];
  const visibleAppointments = useMemo(() => (
    demoMode ? demoAppointmentsForDate(selectedDate) : appointments
  ), [appointments, demoMode, selectedDate]);

  const rows = useMemo(() => (
    (visibleAppointments || [])
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
          serviceId: appointment.serviceId || service.id || "",
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
          appointmentSource: appointment.appointmentSource || "",
          treatwellBookingType: appointment.treatwellBookingType || "",
          treatwellCommissionPercent: appointment.treatwellCommissionPercent || 0,
          isPrepaid: Boolean(appointment.isPrepaid),
          prepaidMethod: appointment.prepaidMethod || null,
          prepaidAmount: Number(appointment.prepaidAmount || 0),
          amountDueAtSalon: Number(appointment.amountDueAtSalon ?? service.price ?? 0),
        };
      })
      .sort((first, second) => String(first.time || "99:99").localeCompare(String(second.time || "99:99")))
  ), [clientMap, selectedDate, services, visibleAppointments]);

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

      {demoMode && (
        <section className="version-notice operational-demo-notice" aria-live="polite">
          <span>Modo demo local - no se guarda en Firebase</span>
        </section>
      )}

      <section className="summary-grid compact">
        <article className="metric"><span>Citas del dia</span><strong>{rows.length}</strong></article>
        <article className="metric"><span>Primera cita</span><strong>{rows[0]?.time || "No disponible"}</strong></article>
        <article className="metric"><span>Ultima cita</span><strong>{rows[rows.length - 1]?.time || "No disponible"}</strong></article>
      </section>

      {demoMode ? (
        <>
          <section className="panel agenda-demo-toolbar">
            <div>
              <h2>Agenda del dia</h2>
              <p>Vista principal del POS demo. Las citas se crean desde la agenda.</p>
            </div>
            <button type="button" onClick={() => setShowNewAppointmentModal(true)}>Nueva cita</button>
          </section>

          <OperationalDayAgenda rows={rows} />

          {showNewAppointmentModal && (
            <NewAppointmentModalDemo
              appointments={visibleAppointments}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onClose={() => setShowNewAppointmentModal(false)}
            />
          )}
        </>
      ) : (
        <ReadonlyAgendaList rows={rows} />
      )}
    </section>
  );
}

export default OperationalAgenda;
