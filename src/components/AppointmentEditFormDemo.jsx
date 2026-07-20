import { useMemo, useState } from "react";

import ClientReferralComboboxDemo from "./ClientReferralComboboxDemo.jsx";
import ProfessionalServiceSelectorDemo from "./ProfessionalServiceSelectorDemo.jsx";
import SearchableCombobox from "./SearchableCombobox.jsx";
import {
  DEMO_CLIENTS,
  DEMO_PROFESSIONALS,
  DEMO_SERVICES,
  calculateDemoAvailability,
  durationToMinutes,
  formatMinutes,
  minutesToTime,
  normalizeDemoDate,
  normalizeDemoAppointmentStatus,
  timeToMinutes,
} from "../utils/availabilityDemo.js";
import { appointmentBlocksSlot } from "../utils/agendaCalendarDemo.js";

const editReasons = [
  "Error en cliente",
  "Error en telefono",
  "Error en fecha u hora",
  "Error en profesional",
  "Error en servicio",
  "Cambio solicitado por cliente",
  "Cliente reprogramo",
  "Cancelacion registrada por error",
  "Correccion administrativa",
  "Otro",
];

function normalizeClient(client = {}) {
  return {
    id: client.id || client.clientId || client.phone || client.name,
    name: client.name || `${client.firstName || ""} ${client.lastName || client.apellidos || ""}`.trim(),
    phone: client.phone || client.telefono || client.telefonoNormalizado || "",
    email: client.email || "",
  };
}

function valuesEqual(first, second) {
  return String(first ?? "") === String(second ?? "");
}

function formatValue(value) {
  if (value === undefined || value === null || value === "") return "Sin indicar";
  return String(value);
}

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildChangeSet(previous, next) {
  const fields = [
    ["clientName", "Cliente"],
    ["phone", "Telefono"],
    ["serviceName", "Servicio"],
    ["date", "Fecha"],
    ["startTime", "Hora"],
    ["appointmentDuration", "Duracion"],
    ["employee", "Profesional"],
    ["referralText", "Referido por"],
    ["appointmentNotes", "Observaciones"],
    ["expectedPrice", "Precio previsto"],
    ["appointmentStatus", "Estado"],
  ];

  return fields.reduce((changes, [field, label]) => {
    if (valuesEqual(previous[field], next[field])) return changes;
    return [
      ...changes,
      {
        field,
        label,
        previous: previous[field],
        next: next[field],
      },
    ];
  }, []);
}

function AppointmentEditFormDemo({
  appointment,
  appointments = [],
  clients = [],
  onCancel,
  onSave,
}) {
  const normalizedClients = (clients.length ? clients : DEMO_CLIENTS).map(normalizeClient);
  const initialService = DEMO_SERVICES.find((service) => service.id === appointment.serviceId || service.name === appointment.serviceName);
  const initialProfessional = DEMO_PROFESSIONALS.find((professional) => (
    professional.id === appointment.professionalId || professional.name === appointment.employee || professional.name === appointment.professionalName
  ));
  const initialDuration = durationToMinutes(appointment.appointmentDuration || appointment.duration || initialService?.duration);
  const initialStatus = appointment.appointmentStatus || appointment.status || "Confirmada";
  const normalizedInitialStatus = normalizeText(initialStatus);
  const canReactivate = normalizedInitialStatus.includes("cancelada") || normalizedInitialStatus.includes("no se present");
  const [draft, setDraft] = useState({
    appointmentStatus: initialStatus,
    clientName: appointment.clientName || "",
    phone: appointment.phone || appointment.clientPhone || "",
    date: appointment.date || "",
    startTime: appointment.startTime || appointment.time || "",
    appointmentDuration: initialDuration || 30,
    expectedPrice: Number(appointment.expectedPrice || initialService?.price || 0),
    serviceId: initialService?.id || appointment.serviceId || "",
    serviceName: appointment.serviceName || initialService?.name || "",
    serviceDefaultDuration: Number(appointment.serviceDefaultDuration || initialService?.duration || 0),
    professionalId: initialProfessional?.id || appointment.professionalId || "any",
    employee: appointment.employee || appointment.professionalName || "",
    appointmentNotes: appointment.appointmentNotes || "",
    referralMode: appointment.referralClientId ? "client" : appointment.referralText ? "other" : "none",
    referralClientId: appointment.referralClientId || "",
    referralClientName: appointment.referralClientName || "",
    referralText: appointment.referralText || "",
  });
  const [reasonCode, setReasonCode] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [compatibilityMessage, setCompatibilityMessage] = useState("");
  const [formError, setFormError] = useState("");

  const selectedService = DEMO_SERVICES.find((service) => service.id === draft.serviceId);
  const selectedProfessional = DEMO_PROFESSIONALS.find((professional) => professional.id === draft.professionalId);
  const endTime = draft.startTime && draft.appointmentDuration
    ? minutesToTime(timeToMinutes(draft.startTime) + Number(draft.appointmentDuration))
    : "";
  const shouldValidateAvailability = draft.appointmentStatus === "Confirmada";
  const professionalCompatible = draft.professionalId !== "any"
    && selectedProfessional
    && (!draft.serviceId || selectedProfessional.serviceIds.includes(draft.serviceId));
  const hasConflict = shouldValidateAvailability && professionalCompatible && appointmentBlocksSlot({
    appointments,
    durationMinutes: Number(draft.appointmentDuration),
    excludeId: appointment.id,
    professionalId: draft.professionalId,
    professionalName: selectedProfessional.name,
    selectedDate: draft.date,
    startMinute: timeToMinutes(draft.startTime),
  });
  const conflictAppointment = shouldValidateAvailability && professionalCompatible
    ? appointments.find((item) => {
      if (item.id === appointment.id) return false;
      if (normalizeDemoDate(item.date || item.fechaOperativa || "") !== normalizeDemoDate(draft.date)) return false;
      const status = normalizeText(normalizeDemoAppointmentStatus(item));
      if (status.includes("cancelada") || status.includes("no se present")) return false;
      const professionalMatches = item.professionalId === selectedProfessional.id || item.employee === selectedProfessional.name;
      if (!professionalMatches) return false;
      const itemStart = timeToMinutes(item.startTime || item.time);
      const itemDuration = durationToMinutes(item.appointmentDuration || item.duration);
      const itemEnd = itemStart + itemDuration;
      const draftStart = timeToMinutes(draft.startTime);
      const draftEnd = draftStart + Number(draft.appointmentDuration || 0);
      return draftStart < itemEnd && draftEnd > itemStart;
    })
    : null;
  const alternatives = hasConflict
    ? calculateDemoAvailability({
      appointments,
      durationOverride: Number(draft.appointmentDuration),
      interval: 15,
      professionalId: draft.professionalId,
      requestedTime: draft.startTime,
      selectedDate: draft.date,
      serviceId: draft.serviceId,
    }).slice(0, 3)
    : [];
  const previousComparable = {
    appointmentStatus: initialStatus,
    clientName: appointment.clientName || "",
    phone: appointment.phone || appointment.clientPhone || "",
    date: appointment.date || "",
    startTime: appointment.startTime || appointment.time || "",
    appointmentDuration: initialDuration || 0,
    employee: appointment.employee || appointment.professionalName || "",
    serviceName: appointment.serviceName || "",
    referralText: appointment.referralText || "",
    appointmentNotes: appointment.appointmentNotes || "",
    expectedPrice: Number(appointment.expectedPrice || 0),
  };
  const nextComparable = {
    appointmentStatus: draft.appointmentStatus,
    clientName: draft.clientName,
    phone: draft.phone,
    date: draft.date,
    startTime: draft.startTime,
    appointmentDuration: Number(draft.appointmentDuration),
    employee: selectedProfessional?.name || draft.employee,
    serviceName: selectedService?.name || draft.serviceName,
    referralText: draft.referralText,
    appointmentNotes: draft.appointmentNotes,
    expectedPrice: Number(draft.expectedPrice || 0),
  };
  const changes = useMemo(() => buildChangeSet(previousComparable, nextComparable), [appointment, draft, initialStatus, initialDuration, selectedProfessional, selectedService]);
  const finalReasonText = reasonCode === "Otro" ? reasonText.trim() : reasonCode;

  const updateDraft = (updates) => {
    setDraft((current) => ({ ...current, ...updates }));
    setFormError("");
  };

  const selectService = (service) => {
    updateDraft({
      serviceId: service?.id || "",
      serviceName: service?.name || "",
      serviceDefaultDuration: Number(service?.duration || 0),
      expectedPrice: Number(service?.price || 0),
    });
  };

  const saveChanges = () => {
    if (!draft.clientName.trim()) {
      setFormError("Indica el cliente de la cita.");
      return;
    }
    if (!draft.serviceId || !selectedService) {
      setFormError("Selecciona un servicio valido.");
      return;
    }
    if (!draft.professionalId || draft.professionalId === "any" || !selectedProfessional) {
      setFormError("Selecciona una profesional concreta.");
      return;
    }
    if (shouldValidateAvailability && !professionalCompatible) {
      setFormError("La profesional seleccionada no realiza este servicio.");
      return;
    }
    if (!draft.date || !draft.startTime) {
      setFormError("Indica fecha y hora.");
      return;
    }
    if (Number(draft.appointmentDuration) < 5) {
      setFormError("La duracion debe ser positiva y de al menos 5 minutos.");
      return;
    }
    if (hasConflict) {
      setFormError(`Existe conflicto con otra cita de ${selectedProfessional.name} en ese tramo. Revisa alternativas disponibles.`);
      return;
    }
    if (!finalReasonText) {
      setFormError("Indica el motivo de la edicion.");
      return;
    }
    if (changes.length === 0) {
      setFormError("No hay cambios para guardar.");
      return;
    }
    if (!window.confirm("Aplicar estos cambios demo a la cita?")) return;

    const updates = {
      appointmentStatus: draft.appointmentStatus,
      status: draft.appointmentStatus,
      clientName: draft.clientName.trim(),
      clientPhone: draft.phone.trim(),
      phone: draft.phone.trim(),
      date: draft.date,
      startTime: draft.startTime,
      time: draft.startTime,
      endTime,
      appointmentDuration: Number(draft.appointmentDuration),
      duration: Number(draft.appointmentDuration),
      serviceDefaultDuration: draft.serviceDefaultDuration,
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      professionalId: selectedProfessional.id,
      professionalName: selectedProfessional.name,
      employee: selectedProfessional.name,
      referralMode: draft.referralMode,
      referralClientId: draft.referralClientId,
      referralClientName: draft.referralClientName,
      referralText: draft.referralText,
      appointmentNotes: draft.appointmentNotes,
      expectedPrice: Number(draft.expectedPrice || 0),
    };
    const auditEntry = {
      action: "appointment_edited",
      appointmentId: appointment.id,
      previousStatus: initialStatus,
      newStatus: draft.appointmentStatus,
      changedAt: new Date().toISOString(),
      changedBy: "Pedro - Admin",
      editReasonCode: reasonCode,
      editReasonText: finalReasonText,
      changedFields: changes.map((change) => change.label),
      previousValues: Object.fromEntries(changes.map((change) => [change.field, change.previous])),
      newValues: Object.fromEntries(changes.map((change) => [change.field, change.next])),
    };

    onSave?.(updates, auditEntry);
  };

  return (
    <section className="appointment-edit-form-demo">
      <section className="appointment-edit-block">
        <h3>Cliente</h3>
        <div className="field-row">
          <label>
            Cliente
            <input value={draft.clientName} onChange={(event) => updateDraft({ clientName: event.target.value })} />
          </label>
          <label>
            Telefono
            <input value={draft.phone} onChange={(event) => updateDraft({ phone: event.target.value })} />
          </label>
        </div>
      </section>

      <section className="appointment-edit-block">
        <h3>Servicio y profesional</h3>
        <div className="field-row">
          <label>
            Servicio
            <SearchableCombobox
              emptyMessage="No se encontraron servicios"
              getLabel={(service) => service?.name || ""}
              getSearchText={(service) => [service?.name, service?.category].filter(Boolean).join(" ")}
              items={DEMO_SERVICES}
              onChange={selectService}
              placeholder="Buscar servicio..."
              renderItem={(service) => (
                <span className="service-combobox-result">
                  <strong>{service.name}</strong>
                  <small>{[service.category, formatMinutes(service.duration), service.price ? `${service.price.toFixed(2)} EUR` : ""].filter(Boolean).join(" - ")}</small>
                </span>
              )}
              value={selectedService || null}
            />
          </label>
          <ProfessionalServiceSelectorDemo
            onChange={(nextProfessionalId) => updateDraft({ professionalId: nextProfessionalId })}
            onCompatibilityMessage={setCompatibilityMessage}
            selectedProfessionalId={draft.professionalId}
            serviceId={draft.serviceId}
          />
        </div>
        {compatibilityMessage && <p className="auth-error">{compatibilityMessage}</p>}
      </section>

      <section className="appointment-edit-block">
        <h3>Fecha, hora y duracion</h3>
        <div className="field-row">
          <label>
            Fecha
            <input type="date" value={draft.date} onChange={(event) => updateDraft({ date: event.target.value })} />
          </label>
          <label>
            Hora
            <input type="time" value={draft.startTime} onChange={(event) => updateDraft({ startTime: event.target.value })} />
          </label>
          <label>
            Duracion aplicada
            <input min="5" step="1" type="number" value={draft.appointmentDuration} onChange={(event) => updateDraft({ appointmentDuration: event.target.value })} />
          </label>
          <label>
            Hora final
            <input readOnly value={endTime || "No disponible"} />
          </label>
        </div>
        <p className="empty-state">Duracion estandar del servicio: {formatMinutes(draft.serviceDefaultDuration)}</p>
      </section>

      {canReactivate && (
        <section className="appointment-edit-block">
          <h3>Estado</h3>
          <label>
            Estado de la cita
            <select value={draft.appointmentStatus} onChange={(event) => updateDraft({ appointmentStatus: event.target.value })}>
              <option value={initialStatus}>Mantener {initialStatus}</option>
              <option value="Confirmada">Reactivar como Confirmada</option>
            </select>
          </label>
        </section>
      )}

      <section className="appointment-edit-block">
        <h3>Referido y observaciones</h3>
        <ClientReferralComboboxDemo
          clients={normalizedClients}
          value={draft}
          onChange={(referral) => updateDraft(referral)}
        />
        <label>
          Observaciones
          <textarea value={draft.appointmentNotes} onChange={(event) => updateDraft({ appointmentNotes: event.target.value })} />
        </label>
        <label>
          Precio previsto
          <input min="0" step="0.01" type="number" value={draft.expectedPrice} onChange={(event) => updateDraft({ expectedPrice: event.target.value })} />
        </label>
      </section>

      <section className="appointment-edit-block">
        <h3>Motivo de la edicion</h3>
        <label>
          Motivo
          <select value={reasonCode} onChange={(event) => { setReasonCode(event.target.value); setFormError(""); }}>
            <option value="">Seleccionar motivo...</option>
            {editReasons.map((reason) => <option key={reason}>{reason}</option>)}
          </select>
        </label>
        {reasonCode === "Otro" && (
          <label>
            Detalle del motivo
            <input value={reasonText} onChange={(event) => { setReasonText(event.target.value); setFormError(""); }} />
          </label>
        )}
      </section>

      <section className="appointment-edit-block">
        <h3>Resumen de cambios</h3>
        {changes.length === 0 ? (
          <p className="empty-state">Sin cambios detectados.</p>
        ) : (
          <div className="edit-change-summary">
            {changes.map((change) => (
              <div className="calculated-row" key={change.field}>
                <span>{change.label}</span>
                <span>{formatValue(change.previous)}</span>
                <span>{formatValue(change.next)}</span>
              </div>
            ))}
          </div>
        )}
        {hasConflict && (
          <div className="auth-error">
            <p>Conflicto: {selectedProfessional?.name} ya tiene ocupado ese horario.</p>
            {conflictAppointment && (
              <p>
                Cita: {conflictAppointment.clientName} - {conflictAppointment.serviceName} - {conflictAppointment.startTime || conflictAppointment.time}
              </p>
            )}
            {alternatives.length > 0 && (
              <p>
                Alternativas: {alternatives.map((slot) => `${minutesToTime(slot.start)}-${minutesToTime(slot.end)}`).join(", ")}
              </p>
            )}
          </div>
        )}
        {formError && <p className="auth-error">{formError}</p>}
      </section>

      <div className="reset-actions">
        <button type="button" onClick={saveChanges}>Guardar cambios demo</button>
        <button className="secondary-button" type="button" onClick={onCancel}>Descartar cambios</button>
      </div>
    </section>
  );
}

export default AppointmentEditFormDemo;
