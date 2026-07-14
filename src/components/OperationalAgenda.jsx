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

function shouldUseDemoAgenda() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("demoAgenda") === "1";
}

function OperationalAgenda({ appointments = [], clients = [], config = {} }) {
  const [selectedDate, setSelectedDate] = useState(getTodayLocalDateString());
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
