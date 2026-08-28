import { useMemo, useState } from "react";

import {
  DEMO_BUSINESS_AREAS,
  DEMO_CALENDAR_INTERVAL,
  appointmentBlocksSlot,
  createCalendarSlots,
  filterDemoProfessionals,
  getAppointmentLayout,
} from "../utils/agendaCalendarDemo.js";
import { getStatusClassName, minutesToTime } from "../utils/availabilityDemo.js";
import { professionalMatchesAppointment } from "../utils/agendaRealConfig.js";

function OperationalCalendarDayView({
  onNewAppointment,
  onSelectAppointment,
  professionals = [],
  rows = [],
  selectedDate,
  services = [],
}) {
  const [businessArea, setBusinessArea] = useState("Todas");
  const [professionalQuery, setProfessionalQuery] = useState("");
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("all");

  const visibleProfessionals = useMemo(() => (
    filterDemoProfessionals({
      area: businessArea,
      professionalId: selectedProfessionalId,
      query: professionalQuery,
      professionals,
      services,
    })
  ), [businessArea, professionalQuery, professionals, selectedProfessionalId, services]);

  const slots = useMemo(() => createCalendarSlots(), []);
  const rowsByProfessional = useMemo(() => {
    const grouped = Object.fromEntries(visibleProfessionals.map((professional) => [professional.id, rows.filter((row) => professionalMatchesAppointment(professional, row))]));
    return grouped;
  }, [rows, visibleProfessionals]);

  const openNewAppointment = (defaults = {}) => {
    onNewAppointment?.({
      initialDate: defaults.date || selectedDate,
      initialInterval: DEMO_CALENDAR_INTERVAL,
      initialProfessionalId: defaults.professionalId || (selectedProfessionalId !== "all" ? selectedProfessionalId : "any"),
      initialRequestedTime: defaults.requestedTime || "12:00",
    });
  };

  return (
    <section className="operational-calendar-view">
      <section className="calendar-filter-bar">
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
            {filterDemoProfessionals({ area: businessArea, professionals, services }).map((professional) => (
              <option key={professional.id} value={professional.id}>{professional.name}</option>
            ))}
          </select>
        </label>
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
            const columnRows = rowsByProfessional[professional.id] || [];
            return (
              <div
                className="calendar-professional-column"
                key={professional.id}
                style={{ gridColumn: professionalIndex + 2, gridRow: `2 / span ${slots.length}` }}
              >
                <div className="calendar-column-slots">
                  {slots.map((slot) => {
                    const slotStartTime = minutesToTime(slot.minute);
                    const slotEndTime = minutesToTime(slot.minute + DEMO_CALENDAR_INTERVAL);
                    const slotIsBlocked = appointmentBlocksSlot({
                      appointments: rows,
                      durationMinutes: DEMO_CALENDAR_INTERVAL,
                      professionalId: professional.id,
                      professionalName: professional.name,
                      selectedDate,
                      startMinute: slot.minute,
                    });
                    const slotTitle = slotIsBlocked
                      ? `${professional.name} ocupado de ${slotStartTime} a ${slotEndTime}`
                      : `Crear cita con ${professional.name} a las ${slotStartTime}`;
                    return (
                      <button
                        aria-label={slotTitle}
                        className={slotIsBlocked ? "calendar-free-slot calendar-free-slot-blocked" : "calendar-free-slot"}
                        data-date={selectedDate}
                        data-interval-minutes={DEMO_CALENDAR_INTERVAL}
                        data-professional-id={professional.id}
                        data-slot-end-time={slotEndTime}
                        data-slot-start-time={slotStartTime}
                        disabled={slotIsBlocked}
                        key={`${professional.id}-${slot.minute}`}
                        title={slotTitle}
                        type="button"
                        onClick={() => openNewAppointment({
                          date: selectedDate,
                          professionalId: professional.id,
                          requestedTime: slotStartTime,
                        })}
                      >
                        <span>Crear cita a las {slotStartTime}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="calendar-appointments-layer">
                  {columnRows.map((row) => {
                    const layout = getAppointmentLayout(row, services);
                    const endTime = row.endTime || layout.endTime;
                    const appointmentTitle = [
                      `${row.time} - ${endTime}`,
                      row.clientName,
                      row.serviceName,
                      row.employee,
                      row.status,
                      row.paymentStatus,
                    ].filter(Boolean).join(" | ");
                    return (
                      <button
                        className={`calendar-appointment-block ${layout.rowSpan <= 2 ? "compact-calendar-appointment" : ""} ${getStatusClassName(row.status)}`}
                        key={row.id}
                        style={{ gridRow: `${layout.rowStart} / span ${layout.rowSpan}` }}
                        title={appointmentTitle}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectAppointment?.(row);
                        }}
                      >
                        <strong>{row.time} - {endTime}</strong>
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

    </section>
  );
}

export default OperationalCalendarDayView;
