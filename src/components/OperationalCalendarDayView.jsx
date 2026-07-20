import { useMemo, useState } from "react";

import AppointmentDetailModalDemo from "./AppointmentDetailModalDemo.jsx";
import { getTodayLocalDateString } from "../utils/date.js";
import {
  DEMO_BUSINESS_AREAS,
  DEMO_CALENDAR_INTERVAL,
  createCalendarSlots,
  filterDemoProfessionals,
  getAppointmentLayout,
  shiftLocalDate,
} from "../utils/agendaCalendarDemo.js";
import { getStatusClassName, minutesToTime } from "../utils/availabilityDemo.js";

function OperationalCalendarDayView({
  onDateChange,
  onNewAppointment,
  onUpdateAppointment,
  rows = [],
  selectedDate,
}) {
  const [businessArea, setBusinessArea] = useState("Todas");
  const [professionalQuery, setProfessionalQuery] = useState("");
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("all");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);

  const visibleProfessionals = useMemo(() => (
    filterDemoProfessionals({
      area: businessArea,
      professionalId: selectedProfessionalId,
      query: professionalQuery,
    })
  ), [businessArea, professionalQuery, selectedProfessionalId]);

  const slots = useMemo(() => createCalendarSlots(), []);
  const selectedAppointment = useMemo(() => (
    rows.find((row) => row.id === selectedAppointmentId) || null
  ), [rows, selectedAppointmentId]);

  const rowsByProfessional = useMemo(() => {
    const grouped = Object.fromEntries(visibleProfessionals.map((professional) => [professional.name, []]));
    rows.forEach((row) => {
      if (grouped[row.employee]) grouped[row.employee].push(row);
    });
    return grouped;
  }, [rows, visibleProfessionals]);

  const openNewAppointment = (defaults = {}) => {
    onNewAppointment?.({
      initialInterval: DEMO_CALENDAR_INTERVAL,
      initialProfessionalId: defaults.professionalId || (selectedProfessionalId !== "all" ? selectedProfessionalId : "any"),
      initialRequestedTime: defaults.requestedTime || "12:00",
    });
  };

  return (
    <section className="operational-calendar-view">
      <section className="panel calendar-day-header">
        <div className="calendar-date-actions">
          <button className="secondary-button" type="button" onClick={() => onDateChange(shiftLocalDate(selectedDate, -1))}>Dia anterior</button>
          <button className="secondary-button" type="button" onClick={() => onDateChange(getTodayLocalDateString())}>Hoy</button>
          <button className="secondary-button" type="button" onClick={() => onDateChange(shiftLocalDate(selectedDate, 1))}>Dia siguiente</button>
          <strong>{selectedDate}</strong>
        </div>
      </section>

      <section className="panel calendar-filter-bar">
        <div className="calendar-rubro-filter" role="group" aria-label="Filtros por rubro">
          {DEMO_BUSINESS_AREAS.map((area) => (
            <button
              className={businessArea === area ? "active" : ""}
              key={area}
              type="button"
              onClick={() => {
                setBusinessArea(area);
                setSelectedProfessionalId("all");
              }}
            >
              {area}
            </button>
          ))}
        </div>
        <label>
          Buscar profesional
          <input value={professionalQuery} onChange={(event) => setProfessionalQuery(event.target.value)} placeholder="Nombre profesional" />
        </label>
        <label>
          Profesional
          <select value={selectedProfessionalId} onChange={(event) => setSelectedProfessionalId(event.target.value)}>
            <option value="all">Todas</option>
            {filterDemoProfessionals({ area: businessArea }).map((professional) => (
              <option key={professional.id} value={professional.id}>{professional.name}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => openNewAppointment()}>Nueva cita</button>
      </section>

      <section className="panel calendar-grid-shell">
        <div
          className="calendar-grid"
          style={{
            gridTemplateColumns: `76px repeat(${Math.max(visibleProfessionals.length, 1)}, minmax(180px, 1fr))`,
            gridTemplateRows: `44px repeat(${slots.length}, 32px)`,
          }}
        >
          <div className="calendar-corner">Hora</div>
          {visibleProfessionals.map((professional) => (
            <div className="calendar-professional-head" key={professional.id}>
              <strong>{professional.name}</strong>
            </div>
          ))}

          <div className="calendar-time-column" style={{ gridRow: `2 / span ${slots.length}` }}>
            {slots.map((slot) => (
              <div className="calendar-time-cell" key={slot.minute}>{slot.minute % 60 === 0 ? slot.label : ""}</div>
            ))}
          </div>

          {visibleProfessionals.map((professional, professionalIndex) => {
            const columnRows = rowsByProfessional[professional.name] || [];
            return (
              <div
                className="calendar-professional-column"
                key={professional.id}
                style={{ gridColumn: professionalIndex + 2, gridRow: `2 / span ${slots.length}` }}
              >
                <div className="calendar-column-slots">
                  {slots.map((slot) => (
                    <button
                      className="calendar-free-slot"
                      key={`${professional.id}-${slot.minute}`}
                      type="button"
                      onClick={() => openNewAppointment({ professionalId: professional.id, requestedTime: minutesToTime(slot.minute) })}
                    >
                      <span>Crear cita</span>
                    </button>
                  ))}
                </div>
                <div className="calendar-appointments-layer">
                  {columnRows.map((row) => {
                    const layout = getAppointmentLayout(row);
                    return (
                      <button
                        className={`calendar-appointment-block ${getStatusClassName(row.status)}`}
                        key={row.id}
                        style={{ gridRow: `${layout.rowStart} / span ${layout.rowSpan}` }}
                        type="button"
                        onClick={() => setSelectedAppointmentId(row.id)}
                      >
                        <strong>{row.time} - {row.endTime || layout.endTime}</strong>
                        <span>{row.clientName}</span>
                        <small>{row.serviceName}</small>
                        <em>{row.status} · {row.paymentStatus}</em>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {visibleProfessionals.length === 0 && (
            <div className="calendar-empty-professionals">
              No hay profesionales para el filtro seleccionado.
            </div>
          )}
        </div>
      </section>

      {selectedAppointment && (
        <AppointmentDetailModalDemo
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointmentId(null)}
          onUpdateAppointment={onUpdateAppointment}
        />
      )}
    </section>
  );
}

export default OperationalCalendarDayView;
