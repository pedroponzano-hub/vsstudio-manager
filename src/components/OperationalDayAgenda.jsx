import { useState } from "react";

import { getStatusClassName } from "../utils/availabilityDemo.js";

function OperationalDayAgenda({ rows = [] }) {
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  return (
    <section className="day-agenda-demo-layout">
      <section className="panel">
        <div className="section-title compact-section-title">
          <div>
            <h2>Agenda del dia demo</h2>
            <span>Modo demo local - no se guarda en Firebase</span>
          </div>
        </div>
        <div className="operational-agenda-list">
          {rows.map((row) => (
            <button
              className={`operational-appointment-card agenda-button-card ${getStatusClassName(row.status)}`}
              key={row.id}
              type="button"
              onClick={() => setSelectedAppointment(row)}
            >
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
            </button>
          ))}
          {rows.length === 0 && <p className="empty-state">No hay citas para la fecha seleccionada.</p>}
        </div>
      </section>

      <section className="panel appointment-readonly-detail">
        <h2>Detalle de cita</h2>
        {selectedAppointment ? (
          <div className="summary-list">
            <span><b>Hora:</b> {selectedAppointment.time || "No disponible"}</span>
            <span><b>Cliente:</b> {selectedAppointment.clientName}</span>
            <span><b>Telefono:</b> {selectedAppointment.phone}</span>
            <span><b>Servicio:</b> {selectedAppointment.serviceName}</span>
            <span><b>Profesional:</b> {selectedAppointment.employee}</span>
            <span><b>Duracion:</b> {selectedAppointment.duration}</span>
            <span><b>Estado:</b> {selectedAppointment.status}</span>
            <small>Solo lectura. Las acciones reales se incorporaran en una fase posterior.</small>
          </div>
        ) : (
          <p className="empty-state">Selecciona una cita para ver el detalle.</p>
        )}
      </section>
    </section>
  );
}

export default OperationalDayAgenda;
