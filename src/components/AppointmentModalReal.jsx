import { useMemo, useState } from "react";

import {
  appointmentDurationMinutes,
  appointmentHasConflict,
  calculateAppointmentEndTime,
  filterAppointmentServices,
  normalizeAppointmentOrigin,
  normalizeAppointmentRecord,
} from "../utils/appointmentModel.js";

const ORIGIN_OPTIONS = [
  ["manual", "Manual"],
  ["telefono", "Teléfono"],
  ["whatsapp", "WhatsApp"],
  ["instagram", "Instagram"],
  ["walk-in", "Walk-in/Calle"],
  ["treatwell", "Treatwell"],
  ["web", "Web"],
  ["otro", "Otro"],
];

function clientDisplayName(client = {}) {
  return `${client.name || ""} ${client.lastName || ""}`.trim();
}

function customDurationForProfessional(professional = {}, serviceId = "") {
  const setting = (professional.professionalServiceSettings || []).find((item) => item.serviceId === serviceId);
  return appointmentDurationMinutes(setting?.customDurationMinutes);
}

function defaultDurationForService(service = {}, professional = {}) {
  return customDurationForProfessional(professional, service.id)
    || appointmentDurationMinutes(service.durationMinutes ?? service.duration)
    || 30;
}

function createInitialDraft({ appointment, initialDate, initialProfessionalId, initialStartTime, clients, professionals, services }) {
  if (appointment) {
    const normalized = normalizeAppointmentRecord(appointment);
    return {
      clientId: normalized.clientId,
      clientQuery: normalized.clientName,
      date: normalized.date,
      durationMinutes: normalized.durationMinutes,
      notes: normalized.notes,
      origin: normalized.origin,
      professionalId: normalized.professionalId,
      serviceId: normalized.serviceId,
      serviceQuery: normalized.serviceName,
      startTime: normalized.startTime,
    };
  }

  const professional = professionals.find((item) => item.id === initialProfessionalId);
  const service = services.length === 1 ? services[0] : null;
  const client = clients.length === 1 ? clients[0] : null;
  return {
    clientId: client?.id || "",
    clientQuery: client ? clientDisplayName(client) : "",
    date: initialDate || "",
    durationMinutes: service ? defaultDurationForService(service, professional) : 30,
    notes: "",
    origin: "manual",
    professionalId: professional?.id || "",
    serviceId: service?.id || "",
    serviceQuery: service?.name || "",
    startTime: initialStartTime || "",
  };
}

function AppointmentModalReal({
  appointment = null,
  appointments = [],
  clients = [],
  configuredOrigins = [],
  initialDate = "",
  initialProfessionalId = "",
  initialStartTime = "",
  onClose,
  onCreateClient,
  onCreateSale,
  onSave,
  onStatusChange,
  professionals = [],
  services = [],
}) {
  const [draft, setDraft] = useState(() => createInitialDraft({
    appointment,
    clients,
    initialDate,
    initialProfessionalId,
    initialStartTime,
    professionals,
    services,
  }));
  const [clientResultsOpen, setClientResultsOpen] = useState(false);
  const [serviceResultsOpen, setServiceResultsOpen] = useState(false);
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickClient, setQuickClient] = useState({ name: "", phone: "", email: "" });
  const [createdClient, setCreatedClient] = useState(null);
  const [clientNotice, setClientNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const originOptions = useMemo(() => {
    const entries = [
      ...ORIGIN_OPTIONS,
      ...configuredOrigins.map((label) => [normalizeAppointmentOrigin(label), String(label)]),
    ];
    return [...new Map(entries.map(([value, label]) => [value, [value, label]])).values()];
  }, [configuredOrigins]);

  const availableClients = useMemo(() => (
    createdClient && !clients.some((client) => client.id === createdClient.id)
      ? [createdClient, ...clients]
      : clients
  ), [clients, createdClient]);
  const selectedClient = availableClients.find((client) => client.id === draft.clientId) || null;
  const selectedService = services.find((service) => service.id === draft.serviceId) || null;
  const selectedProfessional = professionals.find((professional) => professional.id === draft.professionalId) || null;
  const compatibleProfessionals = useMemo(() => professionals.filter((professional) => (
    !draft.serviceId || professional.serviceIds?.includes(draft.serviceId)
  )), [draft.serviceId, professionals]);
  const filteredClients = useMemo(() => {
    const query = String(draft.clientQuery || "").trim().toLowerCase();
    if (!query) return [];
    return availableClients.filter((client) => (
      `${clientDisplayName(client)} ${client.phone || ""} ${client.email || ""}`.toLowerCase().includes(query)
    )).slice(0, 10);
  }, [availableClients, draft.clientQuery]);
  const filteredServices = useMemo(() => (
    filterAppointmentServices(services, draft.serviceQuery).slice(0, 20)
  ), [draft.serviceQuery, services]);
  const endTime = calculateAppointmentEndTime(draft.startTime, draft.durationMinutes);
  const normalizedAppointment = appointment ? normalizeAppointmentRecord(appointment) : null;

  const updateDraft = (updates) => {
    setDraft((current) => ({ ...current, ...updates }));
    setError("");
  };

  const selectClient = (client) => {
    updateDraft({ clientId: client.id, clientQuery: clientDisplayName(client) });
    setClientResultsOpen(false);
    setQuickClientOpen(false);
  };

  const selectService = (service) => {
    const serviceId = service?.id || "";
    const professionalIsCompatible = selectedProfessional?.serviceIds?.includes(serviceId);
    const nextProfessional = professionalIsCompatible ? selectedProfessional : null;
    updateDraft({
      serviceId,
      serviceQuery: service?.name || "",
      professionalId: nextProfessional?.id || "",
      durationMinutes: service ? defaultDurationForService(service, nextProfessional) : 30,
    });
    setServiceResultsOpen(false);
  };

  const createQuickClient = async (event) => {
    event.preventDefault();
    if (!onCreateClient) return;
    setSaving(true);
    setError("");
    setClientNotice("");
    try {
      const result = await onCreateClient(quickClient);
      const client = result?.client || result;
      if (!client?.id) throw new Error("No se pudo obtener el identificador real del cliente.");
      setCreatedClient(client);
      selectClient(client);
      setQuickClient({ name: "", phone: "", email: "" });
      setClientNotice(result?.created === false ? "Ya existía un cliente con ese teléfono o email; se ha seleccionado." : "Cliente creado y seleccionado correctamente.");
    } catch (clientError) {
      setError(clientError?.message || "No se pudo crear el cliente en Firebase.");
    } finally {
      setSaving(false);
    }
  };

  const selectProfessional = (professionalId) => {
    const professional = professionals.find((item) => item.id === professionalId);
    updateDraft({
      professionalId,
      durationMinutes: selectedService ? defaultDurationForService(selectedService, professional) : draft.durationMinutes,
    });
  };

  const payloadFromDraft = () => ({
    clientId: selectedClient?.id || "",
    clientName: selectedClient ? clientDisplayName(selectedClient) : "",
    clientPhone: selectedClient?.phone || "",
    serviceId: selectedService?.id || "",
    serviceName: selectedService?.name || "",
    professionalId: selectedProfessional?.id || "",
    professionalName: selectedProfessional?.name || "",
    date: draft.date,
    startTime: draft.startTime,
    durationMinutes: Number(draft.durationMinutes || 0),
    endTime,
    status: normalizedAppointment?.status || "Confirmada",
    origin: normalizeAppointmentOrigin(draft.origin),
    notes: String(draft.notes || "").trim(),
  });

  const submit = async (event) => {
    event.preventDefault();
    const payload = payloadFromDraft();
    if (!selectedClient) return setError("Selecciona un cliente real de la lista."), undefined;
    if (!selectedService) return setError("Selecciona un servicio real."), undefined;
    if (!selectedProfessional) return setError("Selecciona una profesional real."), undefined;
    if (!selectedProfessional.serviceIds?.includes(selectedService.id)) {
      return setError("La profesional seleccionada no tiene asignado este servicio."), undefined;
    }
    if (!payload.date || !payload.startTime || payload.durationMinutes < 5 || !payload.endTime) {
      return setError("Completa una fecha, hora y duración válidas."), undefined;
    }
    if (appointmentHasConflict(payload, appointments, normalizedAppointment?.id || "")) {
      return setError("La profesional ya tiene otra cita que se solapa con ese horario."), undefined;
    }

    setSaving(true);
    setError("");
    try {
      await onSave(payload);
    } catch (saveError) {
      setError(saveError?.message || "No se pudo guardar la cita en Firebase.");
      setSaving(false);
    }
    return undefined;
  };

  const changeStatus = async (status) => {
    setSaving(true);
    setError("");
    try {
      await onStatusChange(status);
    } catch (statusError) {
      setError(statusError?.message || "No se pudo cambiar el estado de la cita.");
      setSaving(false);
    }
  };

  return (
    <section className="sale-history-modal" role="dialog" aria-modal="true" aria-label={appointment ? "Editar cita" : "Nueva cita"}>
      <article className="sale-history-dialog appointment-real-dialog">
        <div className="section-title compact-section-title">
          <div>
            <h2>{appointment ? "Editar cita" : "Nueva cita"}</h2>
            <span>{appointment ? `Estado: ${normalizedAppointment.status}` : "Guardado real y persistente en Firebase"}</span>
          </div>
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Cerrar</button>
        </div>

        <form className="appointment-real-form" onSubmit={submit}>
          <label className="appointment-client-search">
            Cliente
            <input
              autoComplete="off"
              placeholder="Buscar por nombre, teléfono o email"
              value={draft.clientQuery}
              onChange={(event) => {
                updateDraft({ clientId: "", clientQuery: event.target.value });
                setClientNotice("");
                setClientResultsOpen(Boolean(event.target.value.trim()));
              }}
              onFocus={() => setClientResultsOpen(Boolean(draft.clientQuery.trim()))}
            />
            {clientResultsOpen && (
              <div className="service-results appointment-client-results">
                {filteredClients.map((client) => (
                  <button className="service-result" key={client.id} type="button" onMouseDown={() => selectClient(client)}>
                    <strong>{clientDisplayName(client)}</strong>
                    <span>{client.phone || "Sin teléfono"}{client.email ? ` · ${client.email}` : ""}</span>
                  </button>
                ))}
                {filteredClients.length === 0 && <p className="empty-state">No hay clientes que coincidan.</p>}
                {onCreateClient && (
                  <button
                    className="service-result appointment-create-client-action"
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setClientResultsOpen(false);
                      setQuickClient((current) => ({ ...current, name: current.name || draft.clientQuery.trim() }));
                      setQuickClientOpen(true);
                    }}
                  >
                    <strong>+ Crear nuevo cliente</strong>
                    <span>Alta rápida sin salir de la cita</span>
                  </button>
                )}
              </div>
            )}
          </label>

          {quickClientOpen && (
            <fieldset className="appointment-quick-client">
              <legend>Nuevo cliente</legend>
              <div className="appointment-quick-client-fields">
                <label>Nombre *<input autoFocus value={quickClient.name} onChange={(event) => setQuickClient((current) => ({ ...current, name: event.target.value }))} /></label>
                <label>Teléfono *<input inputMode="tel" value={quickClient.phone} onChange={(event) => setQuickClient((current) => ({ ...current, phone: event.target.value }))} /></label>
                <label>Email<input type="email" value={quickClient.email} onChange={(event) => setQuickClient((current) => ({ ...current, email: event.target.value }))} /></label>
              </div>
              <div className="row-actions">
                <button type="button" disabled={saving} onClick={createQuickClient}>{saving ? "Creando…" : "Crear y seleccionar"}</button>
                <button className="secondary-button" type="button" disabled={saving} onClick={() => setQuickClientOpen(false)}>Cancelar</button>
              </div>
            </fieldset>
          )}
          {clientNotice && <p className="success-message appointment-client-notice" role="status">{clientNotice}</p>}

          <label className="appointment-service-search">
            Servicio
            <input
              autoComplete="off"
              placeholder="Escribe para buscar un servicio"
              value={draft.serviceQuery}
              onChange={(event) => {
                updateDraft({ serviceId: "", serviceQuery: event.target.value });
                setServiceResultsOpen(true);
              }}
              onFocus={() => setServiceResultsOpen(true)}
            />
            {serviceResultsOpen && (
              <div className="service-results appointment-service-results">
                {filteredServices.map((service) => (
                  <button className="service-result" key={service.id} type="button" onMouseDown={() => selectService(service)}>
                    <strong>{service.name}</strong>
                    <span>{appointmentDurationMinutes(service.durationMinutes ?? service.duration)} min{Number.isFinite(Number(service.price)) ? ` · ${Number(service.price).toFixed(2)} €` : ""}</span>
                  </button>
                ))}
                {filteredServices.length === 0 && <p className="empty-state">No se encontraron servicios</p>}
              </div>
            )}
          </label>

          <label>
            Profesional
            <select value={draft.professionalId} onChange={(event) => selectProfessional(event.target.value)}>
              <option value="">Seleccionar profesional…</option>
              {compatibleProfessionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}
            </select>
          </label>

          <div className="field-row appointment-date-time-row">
            <label>Fecha<input type="date" value={draft.date} onChange={(event) => updateDraft({ date: event.target.value })} /></label>
            <label>Hora<input type="time" step="900" value={draft.startTime} onChange={(event) => updateDraft({ startTime: event.target.value })} /></label>
            <label>Duración (min)<input min="5" step="5" type="number" value={draft.durationMinutes} onChange={(event) => updateDraft({ durationMinutes: event.target.value })} /></label>
            <label>Fin<input readOnly value={endTime || "--:--"} /></label>
          </div>

          <label>
            Origen
            <select value={draft.origin} onChange={(event) => updateDraft({ origin: event.target.value })}>
              {originOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label className="appointment-notes-field">
            Notas
            <textarea value={draft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} placeholder="Notas operativas opcionales" />
          </label>

          <div className="appointment-real-summary">
            <span>Inicio: <b>{draft.startTime || "--:--"}</b></span>
            <span>Fin: <b>{endTime || "--:--"}</b></span>
            <span>Duración guardada: <b>{Number(draft.durationMinutes || 0)} min</b></span>
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <div className="form-actions appointment-real-actions">
            <button type="submit" disabled={saving}>{saving ? "Guardando…" : appointment ? "Guardar cambios" : "Crear cita"}</button>
            {appointment && normalizedAppointment.status === "Confirmada" && (
              <>
                <button className="secondary-button" type="button" disabled={saving} onClick={() => changeStatus("En servicio")}>Iniciar servicio</button>
                <button className="secondary-button" type="button" disabled={saving} onClick={() => changeStatus("No se presentó")}>No se presentó</button>
              </>
            )}
            {appointment && normalizedAppointment.status === "En servicio" && (
              <button className="secondary-button" type="button" disabled={saving} onClick={() => changeStatus("Finalizada")}>Finalizar</button>
            )}
            {appointment && !["Finalizada", "Cancelada", "No se presentó"].includes(normalizedAppointment.status) && (
              <button className="danger-button" type="button" disabled={saving} onClick={() => changeStatus("Cancelada")}>Cancelar cita</button>
            )}
            {appointment && !["Cancelada", "No se presentó"].includes(normalizedAppointment.status) && onCreateSale && (
              <button className="secondary-button" type="button" disabled={saving} onClick={() => onCreateSale(normalizedAppointment)}>Crear venta desde cita</button>
            )}
          </div>
        </form>
      </article>
    </section>
  );
}

export default AppointmentModalReal;
