import { useMemo, useState } from "react";

import AppointmentDetailModalDemo from "./AppointmentDetailModalDemo.jsx";
import { getStatusClassName } from "../utils/availabilityDemo.js";

function OperationalDayAgenda({ appointmentHistory = {}, clients = [], onUpdateAppointment, rows = [] }) {
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
  const selectedAppointment = useMemo(() => (
    rows.find((row) => row.id === selectedAppointmentId) || null
  ), [rows, selectedAppointmentId]);

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
              onClick={() => setSelectedAppointmentId(row.id)}
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
                  <span>Pago: <b>{row.paymentStatus}</b></span>
                </div>
              </div>
            </button>
          ))}
          {rows.length === 0 && <p className="empty-state">No hay citas para la fecha seleccionada.</p>}
        </div>
      </section>

      {selectedAppointment && (
        <AppointmentDetailModalDemo
          appointment={selectedAppointment}
          appointments={rows}
          clients={clients}
          appointmentHistory={appointmentHistory[selectedAppointment.id] || []}
          onClose={() => setSelectedAppointmentId(null)}
          onUpdateAppointment={onUpdateAppointment}
        />
      )}
    </section>
  );
}

export default OperationalDayAgenda;
