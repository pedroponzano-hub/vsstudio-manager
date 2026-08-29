import { useCallback, useEffect, useMemo, useState } from "react";

import AppointmentModalReal from "./AppointmentModalReal.jsx";
import OperationalCalendarDayView from "./OperationalCalendarDayView.jsx";
import { getTodayLocalDateString } from "../utils/date.js";
import { shiftLocalDate } from "../utils/agendaCalendarDemo.js";
import { formatDuration, getStatusClassName, normalizeTime, valueOrFallback } from "../utils/availabilityDemo.js";
import { filterOperationalAppointments, normalizeAppointmentRecord } from "../utils/appointmentModel.js";
import { realAgendaProfessionals, realAgendaServices } from "../utils/agendaRealConfig.js";

function AgendaList({ onSelectAppointment, rows = [] }) {
  return (
    <section className="panel">
      <div className="operational-agenda-list">
        {rows.map((row) => (
          <button
            className={`operational-appointment-card agenda-button-card ${getStatusClassName(row.status)}`}
            key={row.id}
            type="button"
            onClick={() => onSelectAppointment(row)}
          >
            <div className="appointment-time-block"><strong>{row.time || "No disponible"}</strong><span>Hora</span></div>
            <div className="appointment-main">
              <div className="appointment-title-line">
                <div className="appointment-primary-line"><strong>{row.clientName}</strong><span>{row.serviceName}</span><span>{row.employee}</span></div>
                <span className={`operational-status-badge ${getStatusClassName(row.status)}`}>{row.status}</span>
              </div>
              <div className="appointment-meta"><span>Duración: <b>{row.duration}</b></span><span>Teléfono: <b>{row.phone}</b></span></div>
            </div>
          </button>
        ))}
        {rows.length === 0 && <p className="empty-state">No hay citas para la fecha seleccionada.</p>}
      </div>
    </section>
  );
}

function OperationalAgendaReal({
  appointments = [],
  clients = [],
  config = {},
  onCreateAppointment,
  onCreateClient,
  onCreateSaleFromAppointment,
  onLoadAppointmentsByDate,
  onUpdateAppointment,
}) {
  const [selectedDate, setSelectedDate] = useState(getTodayLocalDateString());
  const [view, setView] = useState(() => (typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches ? "list" : "calendar"));
  const [appointmentsForDate, setAppointmentsForDate] = useState(() => appointments.filter((appointment) => normalizeAppointmentRecord(appointment).date === getTodayLocalDateString()));
  const [modalState, setModalState] = useState(null);
  const [loadingDate, setLoadingDate] = useState(false);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const clientMap = useMemo(() => Object.fromEntries(clients.map((client) => [client.id, client])), [clients]);
  const services = useMemo(() => realAgendaServices(config), [config]);
  const professionals = useMemo(() => realAgendaProfessionals(config, services), [config, services]);

  const loadSelectedDate = useCallback(async (date, { silent = false } = {}) => {
    if (!onLoadAppointmentsByDate) return [];
    if (!silent) setLoadingDate(true);
    setLoadError("");
    try {
      const loaded = await onLoadAppointmentsByDate(date);
      setAppointmentsForDate(loaded);
      return loaded;
    } catch (error) {
      setLoadError(error?.message || "No se pudieron cargar las citas desde Firebase.");
      throw error;
    } finally {
      if (!silent) setLoadingDate(false);
    }
  }, [onLoadAppointmentsByDate]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingDate(true);
      setLoadError("");
      try {
        const loaded = await onLoadAppointmentsByDate(selectedDate);
        if (active) setAppointmentsForDate(loaded);
      } catch (error) {
        if (active) setLoadError(error?.message || "No se pudieron cargar las citas desde Firebase.");
      } finally {
        if (active) setLoadingDate(false);
      }
    };
    if (onLoadAppointmentsByDate) load();
    return () => { active = false; };
  }, [onLoadAppointmentsByDate, selectedDate]);

  const rows = useMemo(() => appointmentsForDate
    .map((appointment) => {
      const normalized = normalizeAppointmentRecord(appointment);
      const client = clientMap[normalized.clientId] || {};
      const service = services.find((item) => item.id === normalized.serviceId) || {};
      return {
        ...normalized,
        time: normalizeTime(normalized.startTime),
        clientName: valueOrFallback(normalized.clientName || `${client.name || ""} ${client.lastName || ""}`.trim()),
        phone: valueOrFallback(normalized.clientPhone || client.phone, "No disponible"),
        serviceName: valueOrFallback(normalized.serviceName || service.name),
        employee: valueOrFallback(normalized.professionalName),
        duration: formatDuration(normalized.durationMinutes),
        appointmentDuration: normalized.durationMinutes,
        appointmentStatus: normalized.status,
      };
    })
    .sort((first, second) => String(first.time || "99:99").localeCompare(String(second.time || "99:99"))), [appointmentsForDate, clientMap, services]);
  const formattedDate = useMemo(() => new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", weekday: "short" }).format(new Date(`${selectedDate}T12:00:00`)), [selectedDate]);
  const operationalRows = useMemo(() => filterOperationalAppointments(rows), [rows]);
  const visibleRows = view === "calendar" ? operationalRows : rows;

  const openNewAppointment = (defaults = {}) => {
    setNotice("");
    setModalState({
      mode: "create",
      initialDate: defaults.initialDate || selectedDate,
      initialProfessionalId: defaults.initialProfessionalId === "any" ? "" : defaults.initialProfessionalId || "",
      initialStartTime: defaults.initialRequestedTime || "",
    });
  };

  const saveAppointment = async (payload) => {
    const editing = modalState?.mode === "edit" ? modalState.appointment : null;
    const saved = editing
      ? await onUpdateAppointment(editing.id, payload)
      : await onCreateAppointment(payload);
    const savedDate = saved.date || payload.date;
    if (savedDate === selectedDate) {
      setAppointmentsForDate((current) => [saved, ...current.filter((appointment) => appointment.id !== saved.id)]);
    } else {
      setSelectedDate(savedDate);
    }
    setModalState(null);
    setNotice(editing ? "Cita actualizada correctamente en Firebase." : "Cita creada correctamente en Firebase.");
    loadSelectedDate(savedDate, { silent: true }).catch(() => {});
  };

  const changeAppointmentStatus = async (status) => {
    const editing = modalState?.appointment;
    if (!editing) return;
    const saved = await onUpdateAppointment(editing.id, { status });
    setAppointmentsForDate((current) => [saved, ...current.filter((appointment) => appointment.id !== saved.id)]);
    setModalState(null);
    setNotice(status === "Cancelada" ? "La cita se ha cancelado sin eliminarse." : `Estado actualizado: ${status}.`);
    loadSelectedDate(saved.date || selectedDate, { silent: true }).catch(() => {});
  };

  return (
    <section className="module operational-agenda">
      <section className="agenda-command-bar">
        <div className="agenda-date-navigation">
          <button aria-label="Día anterior" className="secondary-button agenda-arrow-button" type="button" onClick={() => setSelectedDate(shiftLocalDate(selectedDate, -1))}>←</button>
          <button className="secondary-button" type="button" onClick={() => setSelectedDate(getTodayLocalDateString())}>Hoy</button>
          <button aria-label="Día siguiente" className="secondary-button agenda-arrow-button" type="button" onClick={() => setSelectedDate(shiftLocalDate(selectedDate, 1))}>→</button>
          <label className="agenda-date-field"><span>Fecha</span><input aria-label="Fecha de agenda" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
        </div>
        <div className="agenda-command-actions">
          <div className="agenda-view-switch" role="group" aria-label="Vista de agenda">
            <button className={view === "calendar" ? "active" : ""} type="button" onClick={() => setView("calendar")}>Calendario</button>
            <button className={view === "list" ? "active" : ""} type="button" onClick={() => setView("list")}>Lista</button>
          </div>
          <button className="agenda-primary-action" type="button" onClick={() => openNewAppointment({ initialDate: selectedDate })}>+ Nueva cita</button>
        </div>
      </section>

      <section className="agenda-summary-bar" aria-live="polite">
        <strong>{formattedDate} · {visibleRows.length} {visibleRows.length === 1 ? "cita" : "citas"}</strong>
        <span>Primera: {visibleRows[0]?.time || "—"}</span>
        <span>Última: {visibleRows[visibleRows.length - 1]?.time || "—"}</span>
        <span>{loadingDate ? "Cargando Firebase…" : "Agenda sincronizada por fecha"}</span>
      </section>

      {notice && <p className="success-message agenda-persistence-notice" role="status">{notice}</p>}
      {loadError && <p className="auth-error agenda-persistence-notice" role="alert">{loadError}</p>}

      {view === "calendar" ? (
        <OperationalCalendarDayView
          rows={operationalRows}
          professionals={professionals}
          services={services}
          selectedDate={selectedDate}
          onNewAppointment={openNewAppointment}
          onSelectAppointment={(appointment) => setModalState({ mode: "edit", appointment })}
        />
      ) : <AgendaList rows={rows} onSelectAppointment={(appointment) => setModalState({ mode: "edit", appointment })} />}

      {modalState && (
        <AppointmentModalReal
          appointment={modalState.mode === "edit" ? modalState.appointment : null}
          appointments={rows}
          clients={clients}
          configuredOrigins={config.entryChannels || []}
          initialDate={modalState.initialDate}
          initialProfessionalId={modalState.initialProfessionalId}
          initialStartTime={modalState.initialStartTime}
          onClose={() => setModalState(null)}
          onCreateClient={onCreateClient}
          onCreateSale={(appointment) => {
            setModalState(null);
            onCreateSaleFromAppointment?.(appointment);
          }}
          onSave={saveAppointment}
          onStatusChange={changeAppointmentStatus}
          professionals={professionals}
          services={services}
        />
      )}
    </section>
  );
}

export default OperationalAgendaReal;
