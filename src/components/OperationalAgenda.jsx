import { useMemo, useState } from "react";

import { getTodayLocalDateString } from "../utils/date.js";

const DEMO_SLOT_INTERVALS = [5, 10, 15, 30];

const DEMO_SERVICES = [
  { id: "mani-semi", name: "Manicura semipermanente demo", duration: 45 },
  { id: "cejas-diseno", name: "Diseno de cejas demo", duration: 30 },
  { id: "lifting-pestanas", name: "Lifting de pestanas demo", duration: 60 },
  { id: "pedicura-completa", name: "Pedicura completa demo", duration: 75 },
  { id: "facial-demo", name: "Tratamiento facial demo", duration: 60 },
  { id: "masaje-demo", name: "Masaje corporal demo", duration: 45 },
];

const DEMO_PROFESSIONALS = [
  { id: "marianne", name: "Marianne", workStart: "09:00", workEnd: "19:00", serviceIds: ["mani-semi", "cejas-diseno", "facial-demo"] },
  { id: "ambar", name: "Ambar", workStart: "10:00", workEnd: "18:30", serviceIds: ["cejas-diseno", "lifting-pestanas", "pedicura-completa"] },
  { id: "grace", name: "Grace", workStart: "09:30", workEnd: "20:00", serviceIds: ["lifting-pestanas", "masaje-demo", "facial-demo"] },
  { id: "leidys", name: "Leidys", workStart: "11:00", workEnd: "19:30", serviceIds: ["mani-semi", "pedicura-completa"] },
];

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

function durationToMinutes(value) {
  if (typeof value === "number") return value;
  const text = String(value || "").toLowerCase();
  if (!text) return 0;
  if (/^\d+$/.test(text.trim())) return Number(text);

  const hourMatch = text.match(/(\d+)\s*h/);
  const minuteMatch = text.match(/(\d+)\s*min/);
  return (hourMatch ? Number(hourMatch[1]) * 60 : 0) + (minuteMatch ? Number(minuteMatch[1]) : 0);
}

function timeToMinutes(value = "") {
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesToTime(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatMinutes(value) {
  if (!value) return "0 min";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function proximityLabel(slotStart, requestedTime) {
  const difference = slotStart - timeToMinutes(requestedTime);
  if (difference === 0) return "A la hora solicitada";
  const prefix = difference > 0 ? "+" : "-";
  return `${prefix}${formatMinutes(Math.abs(difference))}`;
}

function getStatusClassName(status = "") {
  const normalizedStatus = String(status)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalizedStatus.includes("confirmada")) return "agenda-status-confirmada";
  if (normalizedStatus.includes("cliente llegado")) return "agenda-status-llegado";
  if (normalizedStatus.includes("en servicio")) return "agenda-status-servicio";
  if (normalizedStatus.includes("pendiente de cobro")) return "agenda-status-cobro";
  if (normalizedStatus.includes("finalizada")) return "agenda-status-finalizada";
  if (normalizedStatus.includes("cancelada")) return "agenda-status-cancelada";
  return "agenda-status-default";
}

function demoAppointmentsForDate(date) {
  return [
    {
      id: "demo-agenda-confirmada",
      date,
      serviceId: "mani-semi",
      startTime: "09:15",
      clientName: "Cliente Demo Aurora",
      clientPhone: "600 000 101",
      serviceName: "Manicura semipermanente demo",
      employee: "Marianne",
      duration: "45 min",
      status: "Confirmada",
    },
    {
      id: "demo-agenda-llegado",
      date,
      serviceId: "cejas-diseno",
      startTime: "10:20",
      clientName: "Cliente Demo Brisa",
      clientPhone: "600 000 202",
      serviceName: "Diseño de cejas demo",
      employee: "Ambar",
      duration: "30 min",
      status: "Cliente llegado",
    },
    {
      id: "demo-agenda-servicio",
      date,
      serviceId: "lifting-pestanas",
      startTime: "11:30",
      clientName: "Cliente Demo Coral",
      clientPhone: "600 000 303",
      serviceName: "Lifting de pestañas demo",
      employee: "Grace",
      duration: "1 h",
      status: "En servicio",
    },
    {
      id: "demo-agenda-cobro",
      date,
      serviceId: "pedicura-completa",
      startTime: "13:00",
      clientName: "Cliente Demo Dalia",
      clientPhone: "600 000 404",
      serviceName: "Pedicura completa demo",
      employee: "Leidys",
      duration: "1 h 15 min",
      status: "Pendiente de cobro",
    },
    {
      id: "demo-agenda-finalizada",
      date,
      serviceId: "facial-demo",
      startTime: "16:10",
      clientName: "Cliente Demo Elara",
      clientPhone: "600 000 505",
      serviceName: "Tratamiento facial demo",
      employee: "Marianne",
      duration: "1 h",
      status: "Finalizada",
    },
    {
      id: "demo-agenda-cancelada",
      date,
      serviceId: "masaje-demo",
      startTime: "18:30",
      clientName: "Cliente Demo Fenix",
      clientPhone: "600 000 606",
      serviceName: "Masaje corporal demo",
      employee: "Grace",
      duration: "45 min",
      status: "Cancelada",
    },
  ];
}

function calculateDemoAvailability({ appointments, interval, professionalId, requestedTime, selectedDate, serviceId }) {
  const service = DEMO_SERVICES.find((item) => item.id === serviceId);
  if (!service) return [];

  const enabledProfessionals = DEMO_PROFESSIONALS.filter((professional) => (
    professional.serviceIds.includes(service.id)
    && (professionalId === "any" || professional.id === professionalId)
  ));

  const dayAppointments = (appointments || [])
    .filter((appointment) => (appointment.date || appointment.fechaOperativa || "") === selectedDate)
    .filter((appointment) => !String(appointment.status || "").toLowerCase().includes("cancelada"));

  const slots = enabledProfessionals.flatMap((professional) => {
    const busyBlocks = dayAppointments
      .filter((appointment) => appointment.employee === professional.name)
      .map((appointment) => {
        const start = timeToMinutes(appointment.startTime || appointment.time);
        const appointmentService = DEMO_SERVICES.find((item) => item.id === appointment.serviceId);
        const duration = appointmentService?.duration || durationToMinutes(appointment.duration);
        return { start, end: start + duration };
      })
      .sort((first, second) => first.start - second.start);

    const workStart = timeToMinutes(professional.workStart);
    const workEnd = timeToMinutes(professional.workEnd);
    const gaps = [];
    let cursor = workStart;

    busyBlocks.forEach((block) => {
      if (block.start > cursor) gaps.push({ start: cursor, end: block.start });
      cursor = Math.max(cursor, block.end);
    });
    if (cursor < workEnd) gaps.push({ start: cursor, end: workEnd });

    return gaps.flatMap((gap) => {
      const results = [];
      for (let start = gap.start; start + service.duration <= gap.end; start += interval) {
        results.push({
          id: `${professional.id}-${service.id}-${start}`,
          start,
          end: start + service.duration,
          professionalName: professional.name,
          serviceName: service.name,
          duration: service.duration,
          proximity: Math.abs(start - timeToMinutes(requestedTime)),
          proximityText: proximityLabel(start, requestedTime),
        });
      }
      return results;
    });
  });

  return slots
    .sort((first, second) => first.proximity - second.proximity || first.start - second.start || first.professionalName.localeCompare(second.professionalName))
    .slice(0, 12);
}

function shouldUseDemoAgenda() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("demoAgenda") === "1";
}

function OperationalAgenda({ appointments = [], clients = [], config = {} }) {
  const [selectedDate, setSelectedDate] = useState(getTodayLocalDateString());
  const [availabilityServiceId, setAvailabilityServiceId] = useState(DEMO_SERVICES[0].id);
  const [availabilityProfessionalId, setAvailabilityProfessionalId] = useState("any");
  const [availabilityTime, setAvailabilityTime] = useState("12:00");
  const [availabilityInterval, setAvailabilityInterval] = useState(15);
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
  ), [clientMap, selectedDate, services, visibleAppointments]);

  const enabledDemoProfessionals = useMemo(() => (
    DEMO_PROFESSIONALS.filter((professional) => professional.serviceIds.includes(availabilityServiceId))
  ), [availabilityServiceId]);

  const selectedAvailabilityProfessional = enabledDemoProfessionals.some((professional) => professional.id === availabilityProfessionalId)
    ? availabilityProfessionalId
    : "any";

  const availabilityResults = useMemo(() => (
    demoMode
      ? calculateDemoAvailability({
        appointments: visibleAppointments,
        interval: Number(availabilityInterval),
        professionalId: selectedAvailabilityProfessional,
        requestedTime: availabilityTime,
        selectedDate,
        serviceId: availabilityServiceId,
      })
      : []
  ), [availabilityInterval, availabilityServiceId, availabilityTime, demoMode, selectedAvailabilityProfessional, selectedDate, visibleAppointments]);

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
          <span>Modo demo local — datos simulados</span>
        </section>
      )}

      <section className="summary-grid compact">
        <article className="metric"><span>Citas del dia</span><strong>{rows.length}</strong></article>
        <article className="metric"><span>Primera cita</span><strong>{rows[0]?.time || "No disponible"}</strong></article>
        <article className="metric"><span>Ultima cita</span><strong>{rows[rows.length - 1]?.time || "No disponible"}</strong></article>
      </section>

      {demoMode && (
        <section className="panel availability-search-panel">
          <div className="section-title compact-section-title">
            <div>
              <h2>Buscar disponibilidad</h2>
              <span>Demo local de solo lectura</span>
            </div>
          </div>
          <div className="availability-controls">
            <label>
              Fecha
              <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </label>
            <label>
              Servicio
              <select
                value={availabilityServiceId}
                onChange={(event) => {
                  setAvailabilityServiceId(event.target.value);
                  setAvailabilityProfessionalId("any");
                }}
              >
                {DEMO_SERVICES.map((service) => (
                  <option key={service.id} value={service.id}>{service.name} - {formatMinutes(service.duration)}</option>
                ))}
              </select>
            </label>
            <label>
              Hora aproximada
              <input type="time" value={availabilityTime} onChange={(event) => setAvailabilityTime(event.target.value)} />
            </label>
            <label>
              Profesional
              <select value={selectedAvailabilityProfessional} onChange={(event) => setAvailabilityProfessionalId(event.target.value)}>
                <option value="any">Cualquiera</option>
                {enabledDemoProfessionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>{professional.name}</option>
                ))}
              </select>
            </label>
            <label>
              Intervalo
              <select value={availabilityInterval} onChange={(event) => setAvailabilityInterval(Number(event.target.value))}>
                {DEMO_SLOT_INTERVALS.map((interval) => (
                  <option key={interval} value={interval}>{interval} min</option>
                ))}
              </select>
            </label>
          </div>

          <div className="availability-results">
            {availabilityResults.map((slot) => (
              <article className="availability-slot-card" key={slot.id}>
                <strong>{minutesToTime(slot.start)} - {minutesToTime(slot.end)}</strong>
                <span>Disponible</span>
                <p>{slot.professionalName} - {slot.serviceName} - {formatMinutes(slot.duration)}</p>
                <small>{slot.proximityText}</small>
              </article>
            ))}
            {availabilityResults.length === 0 && <p className="empty-state">No hay huecos demo para esta busqueda.</p>}
          </div>
        </section>
      )}

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
    </section>
  );
}

export default OperationalAgenda;
