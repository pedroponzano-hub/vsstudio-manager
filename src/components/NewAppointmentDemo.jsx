import { useEffect, useMemo, useState } from "react";

import SearchableCombobox from "./SearchableCombobox.jsx";
import ClientReferralComboboxDemo from "./ClientReferralComboboxDemo.jsx";
import ProfessionalServiceSelectorDemo from "./ProfessionalServiceSelectorDemo.jsx";
import {
  DEMO_APPOINTMENT_SOURCES,
  DEMO_CLIENTS,
  DEMO_PROFESSIONALS,
  DEMO_SERVICES,
  DEMO_SLOT_INTERVALS,
  DEMO_TREATWELL_BOOKING_TYPES,
  calculateDemoAvailability,
  formatMinutes,
  minutesToTime,
  timeToMinutes,
} from "../utils/availabilityDemo.js";
import { appointmentBlocksSlot } from "../utils/agendaCalendarDemo.js";

const emptyClientDraft = { name: "", phone: "" };
const durationOptions = [15, 30, 45, 60, 75, 90, 120];
const defaultCommercialDetails = {
  appointmentSource: "Walk-in",
  treatwellBookingType: "",
  treatwellCommissionPercent: "",
  isPrepaid: false,
  prepaidMethod: null,
  prepaidAmount: 0,
  amountDueAtSalon: 0,
  referralMode: "none",
  referralClientId: "",
  referralClientName: "",
  referralText: "",
  appointmentNotes: "",
};

function getLocalCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function automaticAppointmentType(date, slotStart) {
  const today = new Date();
  const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (date > todayText) return "Reservada";
  if (date < todayText) return "Reservada";
  return slotStart <= getLocalCurrentMinutes() + 30 ? "Walk-in / Sin reserva previa" : "Reservada";
}

function resolveTreatwellDetails(bookingTypeId, expectedPrice) {
  const bookingType = DEMO_TREATWELL_BOOKING_TYPES.find((item) => item.id === bookingTypeId);
  if (!bookingType) {
    return {
      treatwellBookingType: "",
      treatwellCommissionPercent: "",
      isPrepaid: false,
      prepaidMethod: null,
      prepaidAmount: 0,
      amountDueAtSalon: expectedPrice,
    };
  }

  return {
    treatwellBookingType: bookingType.id,
    treatwellCommissionPercent: bookingType.commissionPercent,
    isPrepaid: bookingType.isPrepaid,
    prepaidMethod: bookingType.prepaidMethod,
    prepaidAmount: bookingType.isPrepaid ? expectedPrice : 0,
    amountDueAtSalon: bookingType.isPrepaid ? 0 : expectedPrice,
  };
}

function NewAppointmentDemo({
  appointments = [],
  clients = [],
  initialInterval,
  initialProfessionalId,
  initialRequestedTime,
  onCancel,
  onCreateAppointment,
  selectedDate,
  onDateChange,
}) {
  const [serviceId, setServiceId] = useState("");
  const [durationMode, setDurationMode] = useState("");
  const [customDuration, setCustomDuration] = useState("");
  const [professionalId, setProfessionalId] = useState(initialProfessionalId || "any");
  const [requestedTime, setRequestedTime] = useState(initialRequestedTime || "12:00");
  const [slotInterval, setSlotInterval] = useState(initialInterval || 15);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [clientMode, setClientMode] = useState("existing");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientDraft, setClientDraft] = useState(emptyClientDraft);
  const [commercialDetails, setCommercialDetails] = useState(defaultCommercialDetails);
  const [submitError, setSubmitError] = useState("");
  const [professionalCompatibilityMessage, setProfessionalCompatibilityMessage] = useState("");

  const selectedService = DEMO_SERVICES.find((service) => service.id === serviceId);
  const serviceDefaultDuration = Number(selectedService?.duration || 0);
  const appointmentDuration = durationMode === "custom"
    ? Number(customDuration || 0)
    : Number(durationMode || serviceDefaultDuration || 0);
  const hasValidAppointmentDuration = appointmentDuration >= 5;
  const enabledProfessionals = useMemo(() => (
    serviceId
      ? DEMO_PROFESSIONALS.filter((professional) => professional.serviceIds.includes(serviceId))
      : DEMO_PROFESSIONALS
  ), [serviceId]);
  const selectedProfessional = enabledProfessionals.some((professional) => professional.id === professionalId)
    ? professionalId
    : "any";

  const availabilityResults = useMemo(() => (
    serviceId && hasValidAppointmentDuration
      ? calculateDemoAvailability({
        appointments,
        interval: Number(slotInterval),
        durationOverride: appointmentDuration,
        professionalId: selectedProfessional,
        requestedTime,
        selectedDate,
        serviceId,
      })
      : []
  ), [appointmentDuration, appointments, hasValidAppointmentDuration, requestedTime, selectedDate, selectedProfessional, serviceId, slotInterval]);

  const selectedClient = clientMode === "existing"
    ? DEMO_CLIENTS.find((client) => client.id === selectedClientId)
    : { id: "demo-new-client", ...clientDraft };
  const expectedPrice = Number(selectedService?.price || 0);
  const selectedSlotStart = selectedSlot ? timeToMinutes(minutesToTime(selectedSlot.start)) : 0;
  const selectedSlotStillFits = selectedSlot
    ? hasValidAppointmentDuration && !appointmentBlocksSlot({
      appointments,
      durationMinutes: appointmentDuration,
      professionalId: selectedSlot.professionalId,
      professionalName: selectedSlot.professionalName,
      selectedDate,
      startMinute: selectedSlotStart,
    })
    : true;
  const requestedProfessional = enabledProfessionals.find((professional) => professional.id === selectedProfessional);
  const requestedStartMinute = timeToMinutes(requestedTime);
  const requestedSlotBlocked = Boolean(
    serviceId
    && hasValidAppointmentDuration
    && requestedProfessional
    && appointmentBlocksSlot({
      appointments,
      durationMinutes: appointmentDuration,
      professionalId: requestedProfessional.id,
      professionalName: requestedProfessional.name,
      selectedDate,
      startMinute: requestedStartMinute,
    }),
  );
  const resolvedCommercialDetails = {
    ...commercialDetails,
    ...(commercialDetails.appointmentSource === "Treatwell"
      ? resolveTreatwellDetails(commercialDetails.treatwellBookingType, expectedPrice)
      : {
        treatwellBookingType: "",
        treatwellCommissionPercent: "",
        isPrepaid: false,
        prepaidMethod: null,
        prepaidAmount: 0,
        amountDueAtSalon: expectedPrice,
      }),
  };
  const treatwellTypeRequired = commercialDetails.appointmentSource === "Treatwell" && !commercialDetails.treatwellBookingType;
  const canShowSummary = selectedSlot && selectedClient?.name && !treatwellTypeRequired;
  const appointmentType = selectedSlot ? automaticAppointmentType(selectedDate, selectedSlot.start) : "";
  const appointmentStatus = "Confirmada";
  const paymentStatus = resolvedCommercialDetails.isPrepaid ? "prepaid" : "pending";
  const missingFields = [
    !serviceId && "servicio",
    !selectedDate && "fecha",
    !hasValidAppointmentDuration && "duracion valida",
    !selectedSlot && "horario",
    !selectedSlotStillFits && "hueco disponible para la duracion",
    serviceId && enabledProfessionals.length === 0 && "profesional compatible",
    !selectedSlot?.professionalName && "profesional",
    !selectedClient?.name && "cliente",
    !commercialDetails.appointmentSource && "origen",
    treatwellTypeRequired && "tipo de reserva Treatwell",
  ].filter(Boolean);
  const canCreateAppointment = missingFields.length === 0;

  const resetSlot = () => setSelectedSlot(null);
  const selectService = (service) => {
    setServiceId(service?.id || "");
    const defaultDuration = Number(service?.duration || 0);
    setDurationMode(durationOptions.includes(defaultDuration) ? String(defaultDuration) : defaultDuration ? "custom" : "");
    setCustomDuration(durationOptions.includes(defaultDuration) ? "" : String(defaultDuration || ""));
    const preferredProfessional = DEMO_PROFESSIONALS.find((professional) => professional.id === initialProfessionalId);
    setProfessionalId(preferredProfessional?.serviceIds.includes(service?.id) ? preferredProfessional.id : "any");
    if (preferredProfessional && service?.id && !preferredProfessional.serviceIds.includes(service.id)) {
      setProfessionalCompatibilityMessage("La profesional seleccionada no realiza este servicio");
    }
    resetSlot();
    setSubmitError("");
  };
  const updateDurationMode = (event) => {
    const nextMode = event.target.value;
    setDurationMode(nextMode);
    if (nextMode !== "custom") setCustomDuration("");
    setSubmitError("");
  };
  const updateCustomDuration = (event) => {
    setCustomDuration(event.target.value);
    setSubmitError("");
  };

  useEffect(() => {
    if (!selectedSlot || !hasValidAppointmentDuration) return;
    const refreshedSlot = availabilityResults.find((slot) => (
      slot.professionalId === selectedSlot.professionalId && slot.start === selectedSlot.start
    ));
    if (refreshedSlot) {
      setSelectedSlot(refreshedSlot);
    }
  }, [appointmentDuration, availabilityResults, hasValidAppointmentDuration, selectedSlot]);

  useEffect(() => {
    if (selectedSlot || !serviceId || !initialProfessionalId || initialProfessionalId === "any") return;
    const initialStart = timeToMinutes(initialRequestedTime || requestedTime);
    const initialSlot = availabilityResults.find((slot) => (
      slot.professionalId === initialProfessionalId && slot.start === initialStart
    ));
    if (initialSlot) setSelectedSlot(initialSlot);
  }, [availabilityResults, initialProfessionalId, initialRequestedTime, requestedTime, selectedSlot, serviceId]);

  const updateCommercialDetail = (event) => {
    const { name, value } = event.target;
    setCommercialDetails((current) => {
      if (name === "appointmentSource" && value !== "Treatwell") {
        return {
          ...current,
          appointmentSource: value,
          treatwellBookingType: "",
          treatwellCommissionPercent: "",
          isPrepaid: false,
          prepaidMethod: null,
          prepaidAmount: 0,
          amountDueAtSalon: expectedPrice,
        };
      }

      if (name === "treatwellBookingType") {
        return {
          ...current,
          appointmentSource: "Treatwell",
          ...resolveTreatwellDetails(value, expectedPrice),
        };
      }

      return { ...current, [name]: value };
    });
    setSubmitError("");
  };

  const createDemoAppointment = () => {
    if (!canCreateAppointment) {
      setSubmitError(`Falta completar: ${missingFields.join(", ")}.`);
      return;
    }

    const appointmentDraft = {
      id: `demo-created-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: selectedDate,
      startTime: minutesToTime(selectedSlot.start),
      endTime: minutesToTime(selectedSlot.start + appointmentDuration),
      serviceDefaultDuration,
      appointmentDuration,
      duration: appointmentDuration,
      clientId: clientMode === "existing" ? selectedClient.id : "demo-new-client",
      clientName: selectedClient.name,
      clientPhone: selectedClient.phone || "",
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      professionalId: selectedSlot.professionalId,
      professionalName: selectedSlot.professionalName,
      employee: selectedSlot.professionalName,
      expectedPrice,
      appointmentStatus,
      paymentStatus,
      status: appointmentStatus,
      appointmentSource: resolvedCommercialDetails.appointmentSource,
      treatwellBookingType: resolvedCommercialDetails.treatwellBookingType,
      treatwellCommissionPercent: resolvedCommercialDetails.treatwellCommissionPercent || 0,
      isPrepaid: resolvedCommercialDetails.isPrepaid,
      prepaidMethod: resolvedCommercialDetails.prepaidMethod,
      prepaidAmount: resolvedCommercialDetails.prepaidAmount,
      amountDueAtSalon: resolvedCommercialDetails.amountDueAtSalon,
      referralMode: commercialDetails.referralMode,
      referralClientId: commercialDetails.referralClientId,
      referralClientName: commercialDetails.referralClientName,
      referralText: commercialDetails.referralText,
      appointmentNotes: commercialDetails.appointmentNotes,
      appointmentType,
      createdAt: new Date().toISOString(),
    };

    setSubmitError("");
    onCreateAppointment?.(appointmentDraft);
  };

  return (
    <section className="demo-appointment-flow">
      <section className="panel availability-search-panel">
        <div className="section-title compact-section-title">
          <div>
            <h2>Nueva cita demo</h2>
            <span>Modo demo local — la cita no se guarda en Firebase y desaparecerá al recargar</span>
          </div>
        </div>

        <div className="availability-controls new-appointment-controls">
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
          <label>
            Fecha
            <input type="date" value={selectedDate} onChange={(event) => { onDateChange(event.target.value); resetSlot(); }} />
          </label>
          <label>
            Duracion de la cita
            <select value={durationMode} onChange={updateDurationMode} disabled={!serviceId}>
              <option value="">Seleccionar duracion...</option>
              {durationOptions.map((duration) => (
                <option key={duration} value={duration}>{formatMinutes(duration)}</option>
              ))}
              <option value="custom">Personalizada</option>
            </select>
          </label>
          {durationMode === "custom" && (
            <label>
              Minutos personalizados
              <input
                min="5"
                step="1"
                type="number"
                value={customDuration}
                onChange={updateCustomDuration}
                placeholder="Minimo 5"
              />
            </label>
          )}
          <label>
            Hora aproximada
            <input type="time" value={requestedTime} onChange={(event) => { setRequestedTime(event.target.value); resetSlot(); }} />
          </label>
          <ProfessionalServiceSelectorDemo
            onChange={(nextProfessionalId) => {
              setProfessionalId(nextProfessionalId);
              resetSlot();
            }}
            onCompatibilityMessage={setProfessionalCompatibilityMessage}
            selectedProfessionalId={selectedProfessional}
            serviceId={serviceId}
          />
          <label>
            Intervalo
            <select value={slotInterval} onChange={(event) => { setSlotInterval(Number(event.target.value)); resetSlot(); }}>
              {DEMO_SLOT_INTERVALS.map((interval) => (
                <option key={interval} value={interval}>{interval} min</option>
              ))}
            </select>
          </label>
        </div>

        <details className="panel commercial-details-panel">
          <summary>Origen y detalles</summary>
          <div className="commercial-details-grid">
            <label>
              Origen de la cita
              <select name="appointmentSource" value={commercialDetails.appointmentSource} onChange={updateCommercialDetail}>
                {DEMO_APPOINTMENT_SOURCES.map((source) => <option key={source}>{source}</option>)}
              </select>
            </label>
            {commercialDetails.appointmentSource === "Treatwell" && (
              <label>
                Tipo de reserva Treatwell
                <select name="treatwellBookingType" value={commercialDetails.treatwellBookingType} onChange={updateCommercialDetail} required>
                  <option value="">Seleccionar tipo...</option>
                  {DEMO_TREATWELL_BOOKING_TYPES.map((bookingType) => (
                    <option key={bookingType.id} value={bookingType.id}>{bookingType.label}</option>
                  ))}
                </select>
              </label>
            )}
            {treatwellTypeRequired && <p className="auth-error">Selecciona el tipo de reserva Treatwell para completar el resumen demo.</p>}
            {commercialDetails.appointmentSource === "Treatwell" && commercialDetails.treatwellBookingType && (
              <div className="treatwell-demo-info">
                <span><b>Comision Treatwell:</b> {resolvedCommercialDetails.treatwellCommissionPercent}%</span>
                <span><b>Estado:</b> {resolvedCommercialDetails.isPrepaid ? "Prepaga en Treatwell" : "Pendiente de cobro en centro"}</span>
                <span><b>Pagado previamente:</b> {resolvedCommercialDetails.prepaidAmount.toFixed(2)} EUR</span>
                <span><b>Pendiente en centro:</b> {resolvedCommercialDetails.amountDueAtSalon.toFixed(2)} EUR</span>
              </div>
            )}
            <div className="form-field">
              Referido por
              <ClientReferralComboboxDemo
                clients={clients}
                value={commercialDetails}
                onChange={(referral) => {
                  setCommercialDetails((current) => ({ ...current, ...referral }));
                  setSubmitError("");
                }}
              />
            </div>
            <label>
              Precio previsto
              <input readOnly value={selectedService?.price ? `${selectedService.price.toFixed(2)} EUR` : "Selecciona un servicio"} />
            </label>
            <label className="commercial-notes-field">
              Observaciones de la cita
              <textarea
                name="appointmentNotes"
                value={commercialDetails.appointmentNotes}
                onChange={updateCommercialDetail}
                placeholder="Notas operativas para recepcion y profesional"
              />
            </label>
          </div>
          <p className="empty-state">Informacion comercial de la cita. No es metodo de pago ni total cobrado.</p>
        </details>

        {serviceId && !hasValidAppointmentDuration && (
          <p className="auth-error">La duracion de la cita debe ser de al menos 5 minutos.</p>
        )}
        {professionalCompatibilityMessage && (
          <p className="auth-error">{professionalCompatibilityMessage}</p>
        )}
        {serviceId && enabledProfessionals.length === 0 && (
          <p className="auth-error">No hay profesionales asignadas a este servicio</p>
        )}
        {requestedSlotBlocked && !selectedSlot && (
          <p className="auth-error">El servicio no cabe desde la hora seleccionada para esa profesional. Revisa las alternativas disponibles.</p>
        )}
        {selectedSlot && !selectedSlotStillFits && (
          <p className="auth-error">El hueco seleccionado ya no admite la duracion completa. Selecciona una alternativa disponible.</p>
        )}

        <div className="availability-results">
          {!serviceId && <p className="empty-state">Selecciona un servicio para buscar disponibilidad demo.</p>}
          {serviceId && availabilityResults.map((slot) => (
            <button
              className={selectedSlot?.id === slot.id ? "availability-slot-card selected" : "availability-slot-card"}
              key={slot.id}
              type="button"
              onClick={() => setSelectedSlot(slot)}
            >
              <strong>{minutesToTime(slot.start)} - {minutesToTime(slot.end)}</strong>
              <span>{selectedSlot?.id === slot.id ? "Seleccionado" : "Disponible"}</span>
              <p>{slot.professionalName} - {slot.serviceName} - {formatMinutes(slot.duration)}</p>
              <small>{slot.proximityText}</small>
            </button>
          ))}
          {serviceId && availabilityResults.length === 0 && <p className="empty-state">No hay huecos demo para esta busqueda.</p>}
        </div>
      </section>

      {selectedSlot && (
        <section className="panel demo-client-step">
          <div className="section-title compact-section-title">
            <div>
              <h2>Cliente</h2>
              <span>Horario seleccionado: {minutesToTime(selectedSlot.start)} - {minutesToTime(selectedSlot.start + appointmentDuration)}</span>
            </div>
          </div>

          <div className="demo-client-mode">
            <button className={clientMode === "existing" ? "active" : ""} type="button" onClick={() => setClientMode("existing")}>Buscar cliente demo</button>
            <button className={clientMode === "new" ? "active" : ""} type="button" onClick={() => setClientMode("new")}>Crear cliente demo</button>
          </div>

          {clientMode === "existing" ? (
            <label>
              Cliente demo
              <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
                <option value="">Seleccionar cliente</option>
                {DEMO_CLIENTS.map((client) => (
                  <option key={client.id} value={client.id}>{client.name} - {client.phone}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="field-row">
              <label>
                Nombre
                <input value={clientDraft.name} onChange={(event) => setClientDraft({ ...clientDraft, name: event.target.value })} placeholder="Cliente demo" />
              </label>
              <label>
                Telefono
                <input value={clientDraft.phone} onChange={(event) => setClientDraft({ ...clientDraft, phone: event.target.value })} placeholder="600 000 000" />
              </label>
            </div>
          )}
        </section>
      )}

      {canShowSummary && (
        <section className="panel demo-appointment-summary">
          <div>
            <h2>Resumen final</h2>
            <p>Modo demo local — la cita no se guarda en Firebase y desaparecerá al recargar</p>
          </div>
          <div className="summary-list">
            <span><b>Servicio:</b> {selectedService?.name}</span>
            <span><b>Duracion estandar:</b> {formatMinutes(serviceDefaultDuration)}</span>
            <span><b>Duracion de la cita:</b> {formatMinutes(appointmentDuration)}</span>
            <span><b>Fecha:</b> {selectedDate}</span>
            <span><b>Hora:</b> {minutesToTime(selectedSlot.start)} - {minutesToTime(selectedSlot.start + appointmentDuration)}</span>
            <span><b>Profesional:</b> {selectedSlot.professionalName}</span>
            <span><b>Cliente:</b> {selectedClient.name}</span>
            <span><b>Tipo automatico:</b> {appointmentType}</span>
            <span><b>appointmentSource:</b> {resolvedCommercialDetails.appointmentSource}</span>
            <span><b>treatwellBookingType:</b> {resolvedCommercialDetails.treatwellBookingType || "No aplica"}</span>
            <span><b>treatwellCommissionPercent:</b> {resolvedCommercialDetails.treatwellCommissionPercent ? `${resolvedCommercialDetails.treatwellCommissionPercent}%` : "No aplica"}</span>
            <span><b>isPrepaid:</b> {resolvedCommercialDetails.isPrepaid ? "true" : "false"}</span>
            <span><b>prepaidMethod:</b> {resolvedCommercialDetails.prepaidMethod || "No aplica"}</span>
            <span><b>prepaidAmount:</b> {resolvedCommercialDetails.prepaidAmount.toFixed(2)} EUR</span>
            <span><b>amountDueAtSalon:</b> {resolvedCommercialDetails.amountDueAtSalon.toFixed(2)} EUR</span>
            <span><b>referralText:</b> {commercialDetails.referralText || "Sin indicar"}</span>
            <span><b>referralClientId:</b> {commercialDetails.referralClientId || "Sin referido"}</span>
            <span><b>referralClientName:</b> {commercialDetails.referralClientName || "Sin referido"}</span>
            <span><b>appointmentNotes:</b> {commercialDetails.appointmentNotes || "Sin notas"}</span>
            <span><b>expectedPrice:</b> {selectedService?.price ? `${expectedPrice.toFixed(2)} EUR` : "No disponible"}</span>
            <span><b>Estado sugerido:</b> {appointmentStatus}</span>
          </div>
        </section>
      )}

      <section className="panel demo-appointment-actions">
        <div className="section-title compact-section-title">
          <div>
            <h2>Confirmar cita demo</h2>
            <span>Modo demo local — la cita no se guarda en Firebase y desaparecerá al recargar</span>
          </div>
        </div>
        {missingFields.length > 0 && (
          <p className="empty-state">Falta completar: {missingFields.join(", ")}.</p>
        )}
        {submitError && <p className="auth-error">{submitError}</p>}
        <div className="reset-actions">
          <button type="button" disabled={!canCreateAppointment} onClick={createDemoAppointment}>Crear cita demo</button>
          <button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </section>
    </section>
  );
}

export default NewAppointmentDemo;
