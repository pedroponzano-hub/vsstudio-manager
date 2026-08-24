import { useMemo, useState } from "react";

import OperationalCalendarDayView from "./OperationalCalendarDayView.jsx";
import NewAppointmentModalDemo from "./NewAppointmentModalDemo.jsx";
import OperationalDayAgenda from "./OperationalDayAgenda.jsx";
import { getTodayLocalDateString } from "../utils/date.js";
import { shiftLocalDate } from "../utils/agendaCalendarDemo.js";
import {
  demoAppointmentsForDate,
  formatDuration,
  getStatusClassName,
  normalizeDemoDate,
  normalizeDemoAppointmentStatus,
  normalizeDemoPaymentStatus,
  normalizeTime,
  valueOrFallback,
} from "../utils/availabilityDemo.js";

function shouldUseDemoAgenda() {
  if (typeof window === "undefined") return false;
  const path = String(window.location.pathname || "").toLowerCase();
  return path === "/pos/agenda-v2" || path.startsWith("/pos/agenda-v2/");
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
  const [agendaDemoView, setAgendaDemoView] = useState("calendar");
  const [newAppointmentDefaults, setNewAppointmentDefaults] = useState({});
  const [demoCreatedAppointments, setDemoCreatedAppointments] = useState([]);
  const [demoAppointmentUpdates, setDemoAppointmentUpdates] = useState({});
  const [demoAppointmentHistory, setDemoAppointmentHistory] = useState({});
  const demoMode = shouldUseDemoAgenda();
  const clientMap = useMemo(() => Object.fromEntries((clients || []).map((client) => [client.id, client])), [clients]);
  const services = config.services || [];
  const visibleAppointments = useMemo(() => (
    demoMode
      ? [...demoAppointmentsForDate(selectedDate), ...demoCreatedAppointments].map((appointment) => ({
        ...appointment,
        ...(demoAppointmentUpdates[appointment.id] || {}),
      }))
      : appointments
  ), [appointments, demoAppointmentUpdates, demoCreatedAppointments, demoMode, selectedDate]);

  const createDemoAppointment = (appointmentDraft) => {
    setDemoCreatedAppointments((current) => [...current, appointmentDraft]);
    setShowNewAppointmentModal(false);
  };

  const updateDemoAppointment = (appointmentId, updates, auditEntry) => {
    setDemoAppointmentUpdates((current) => ({
      ...current,
      [appointmentId]: {
        ...(current[appointmentId] || {}),
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    }));
    if (auditEntry) {
      setDemoAppointmentHistory((current) => ({
        ...current,
        [appointmentId]: [...(current[appointmentId] || []), auditEntry],
      }));
    }
  };

  const openNewAppointmentModal = (defaults = {}) => {
    setNewAppointmentDefaults(defaults);
    setShowNewAppointmentModal(true);
  };

  const rows = useMemo(() => (
    (visibleAppointments || [])
      .filter((appointment) => normalizeDemoDate(appointment.date || appointment.fechaOperativa || "") === normalizeDemoDate(selectedDate))
      .map((appointment) => {
        const client = clientMap[appointment.clientId] || {};
        const service = services.find((item) => (
          item.id === appointment.serviceId
          || item.name === appointment.serviceName
          || item.name === appointment.service
        )) || {};

        const appointmentStatus = normalizeDemoAppointmentStatus(appointment);
        const paymentStatus = normalizeDemoPaymentStatus(appointment);

        return {
          id: appointment.id || `${appointment.date}-${appointment.startTime || appointment.time}-${appointment.clientId || appointment.clientName}`,
          serviceId: appointment.serviceId || service.id || "",
          professionalId: appointment.professionalId || "",
          date: appointment.date || appointment.fechaOperativa || selectedDate,
          time: normalizeTime(appointment.startTime || appointment.time),
          endTime: normalizeTime(appointment.endTime || ""),
          clientName: valueOrFallback(
            appointment.clientName
            || `${client.name || ""} ${client.lastName || ""}`.trim(),
          ),
          phone: valueOrFallback(appointment.clientPhone || client.phone, "No disponible"),
          serviceName: valueOrFallback(appointment.serviceName || appointment.service || service.name),
          employee: valueOrFallback(appointment.employee || appointment.professionalName),
          professionalName: valueOrFallback(appointment.professionalName || appointment.employee),
          duration: formatDuration(appointment.duration || service.duration),
          appointmentDuration: appointment.appointmentDuration || appointment.duration || service.duration,
          serviceDefaultDuration: appointment.serviceDefaultDuration || service.duration || "",
          expectedPrice: Number(appointment.expectedPrice ?? service.price ?? 0),
          appointmentStatus,
          paymentStatus,
          status: valueOrFallback(appointmentStatus),
          demoPaymentCompleted: Boolean(appointment.demoPaymentCompleted),
          demoSaleId: appointment.demoSaleId || "",
          demoPaymentSummary: appointment.demoPaymentSummary || null,
          appointmentSource: appointment.appointmentSource || "",
          treatwellBookingType: appointment.treatwellBookingType || "",
          treatwellCommissionPercent: appointment.treatwellCommissionPercent || 0,
          isPrepaid: Boolean(appointment.isPrepaid),
          prepaidMethod: appointment.prepaidMethod || null,
          prepaidAmount: Number(appointment.prepaidAmount || 0),
          amountDueAtSalon: Number(appointment.amountDueAtSalon ?? service.price ?? 0),
          referralText: appointment.referralText || "",
          referralMode: appointment.referralMode || "",
          referralClientId: appointment.referralClientId || "",
          referralClientName: appointment.referralClientName || "",
          appointmentNotes: appointment.appointmentNotes || "",
          appointmentType: appointment.appointmentType || "",
          createdAt: appointment.createdAt || "",
          updatedAt: appointment.updatedAt || "",
        };
      })
      .sort((first, second) => String(first.time || "99:99").localeCompare(String(second.time || "99:99")))
  ), [clientMap, selectedDate, services, visibleAppointments]);

  const formattedSelectedDate = useMemo(() => {
    const parsedDate = new Date(`${selectedDate}T12:00:00`);
    if (Number.isNaN(parsedDate.getTime())) return selectedDate;
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
      weekday: "short",
    }).format(parsedDate);
  }, [selectedDate]);

  return (
    <section className="module operational-agenda">
      <section className="agenda-command-bar">
        <div className="agenda-date-navigation">
          <button
            aria-label="Día anterior"
            className="secondary-button agenda-arrow-button"
            type="button"
            onClick={() => setSelectedDate(shiftLocalDate(selectedDate, -1))}
          >
            ←
          </button>
          <button className="secondary-button" type="button" onClick={() => setSelectedDate(getTodayLocalDateString())}>Hoy</button>
          <button
            aria-label="Día siguiente"
            className="secondary-button agenda-arrow-button"
            type="button"
            onClick={() => setSelectedDate(shiftLocalDate(selectedDate, 1))}
          >
            →
          </button>
          <label className="agenda-date-field">
            <span>Fecha</span>
            <input
              aria-label="Fecha de agenda"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
        </div>
        <div className="agenda-command-actions">
          {demoMode && (
            <div className="agenda-view-switch" role="group" aria-label="Vista de agenda">
              <button className={agendaDemoView === "calendar" ? "active" : ""} type="button" onClick={() => setAgendaDemoView("calendar")}>Calendario</button>
              <button className={agendaDemoView === "list" ? "active" : ""} type="button" onClick={() => setAgendaDemoView("list")}>Lista</button>
            </div>
          )}
          {demoMode && <button className="agenda-primary-action" type="button" onClick={() => openNewAppointmentModal()}>+ Nueva cita</button>}
        </div>
      </section>

      <section className="agenda-summary-bar" aria-live="polite">
        <strong>{formattedSelectedDate} · {rows.length} {rows.length === 1 ? "cita" : "citas"}</strong>
        <span>Primera: {rows[0]?.time || "—"}</span>
        <span>Última: {rows[rows.length - 1]?.time || "—"}</span>
        {demoMode && (
          <span className="agenda-demo-context" title="Las citas de demostración no se guardan en Firebase">
            <b>DEMO</b>
            Solo local
          </span>
        )}
      </section>

      {demoMode ? (
        <>
          {agendaDemoView === "calendar" ? (
            <OperationalCalendarDayView
              rows={rows}
              clients={clients}
              appointmentHistory={demoAppointmentHistory}
              selectedDate={selectedDate}
              onNewAppointment={openNewAppointmentModal}
              onUpdateAppointment={updateDemoAppointment}
            />
          ) : (
            <OperationalDayAgenda
              rows={rows}
              clients={clients}
              appointmentHistory={demoAppointmentHistory}
              onUpdateAppointment={updateDemoAppointment}
            />
          )}

          {showNewAppointmentModal && (
            <NewAppointmentModalDemo
              appointments={visibleAppointments}
              clients={clients}
              initialInterval={newAppointmentDefaults.initialInterval}
              initialProfessionalId={newAppointmentDefaults.initialProfessionalId}
              initialRequestedTime={newAppointmentDefaults.initialRequestedTime}
              onCreateAppointment={createDemoAppointment}
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
