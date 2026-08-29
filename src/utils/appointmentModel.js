const APPOINTMENT_STATUSES = Object.freeze([
  "Confirmada",
  "En servicio",
  "Finalizada",
  "Cancelada",
  "No se presentó",
]);

const STATUS_TRANSITIONS = Object.freeze({
  Confirmada: ["En servicio", "Cancelada", "No se presentó"],
  "En servicio": ["Finalizada", "Cancelada"],
  Finalizada: [],
  Cancelada: [],
  "No se presentó": [],
});

export class AppointmentValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AppointmentValidationError";
    this.code = code;
  }
}

function cleanText(value = "") {
  return String(value ?? "").trim();
}

function normalizeText(value = "") {
  return cleanText(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeAppointmentSearchText(value = "") {
  return normalizeText(value).replace(/[^a-z0-9]+/g, " ").trim();
}

export function filterAppointmentServices(services = [], query = "") {
  const terms = normalizeAppointmentSearchText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return services;
  return services.filter((service) => {
    const searchableName = normalizeAppointmentSearchText(service.name);
    return terms.every((term) => searchableName.includes(term));
  });
}

export function servicesAssignedToProfessional(services = [], professional = null) {
  if (!professional?.id) return [];
  const assignedIds = new Set(
    (professional.serviceIds || professional.assignedServiceIds || []).map((serviceId) => cleanText(serviceId)),
  );
  return services.filter((service) => assignedIds.has(cleanText(service.id)));
}

export function professionalHasAssignedService(professional = null, serviceId = "") {
  if (!professional?.id || !cleanText(serviceId)) return false;
  return (professional.serviceIds || professional.assignedServiceIds || [])
    .some((assignedId) => cleanText(assignedId) === cleanText(serviceId));
}

export function normalizeAppointmentDate(value = "") {
  const date = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

export function normalizeAppointmentTime(value = "") {
  const match = cleanText(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return "";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function appointmentTimeToMinutes(value = "") {
  const time = normalizeAppointmentTime(value);
  if (!time) return Number.NaN;
  const [hours, minutes] = time.split(":").map(Number);
  return (hours * 60) + minutes;
}

export function appointmentMinutesToTime(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes >= 24 * 60) return "";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function appointmentDurationMinutes(value) {
  if (typeof value === "number" || /^\d+(?:[.,]\d+)?$/.test(cleanText(value))) {
    const numeric = Number(String(value).replace(",", "."));
    return Number.isFinite(numeric) ? Math.round(numeric) : 0;
  }
  const text = normalizeText(value);
  const hours = text.match(/(\d+(?:[.,]\d+)?)\s*h/);
  const minutes = text.match(/(\d+)\s*min/);
  return Math.round((hours ? Number(hours[1].replace(",", ".")) * 60 : 0) + (minutes ? Number(minutes[1]) : 0));
}

export function calculateAppointmentEndTime(startTime, durationMinutes) {
  const start = appointmentTimeToMinutes(startTime);
  const duration = appointmentDurationMinutes(durationMinutes);
  if (!Number.isFinite(start) || duration < 1 || start + duration >= 24 * 60) return "";
  return appointmentMinutesToTime(start + duration);
}

export function normalizeAppointmentStatus(value = "") {
  const normalized = normalizeText(value || "Confirmada");
  if (normalized === "confirmada" || normalized === "pendiente") return "Confirmada";
  if (normalized === "en servicio" || normalized === "servicio") return "En servicio";
  if (normalized === "finalizada" || normalized === "realizada") return "Finalizada";
  if (normalized === "cancelada") return "Cancelada";
  if (normalized.includes("no se present")) return "No se presentó";
  return "";
}

export function isAppointmentBlocking(status = "") {
  return ["Confirmada", "En servicio", "Finalizada"].includes(normalizeAppointmentStatus(status));
}

export function filterOperationalAppointments(appointments = []) {
  return appointments.filter((appointment) => isAppointmentBlocking(appointment.status || appointment.appointmentStatus));
}

export function normalizeAppointmentOrigin(value = "") {
  const normalized = normalizeText(value || "manual");
  const aliases = {
    manual: "manual",
    telefono: "telefono",
    whatsapp: "whatsapp",
    instagram: "instagram",
    "walk-in/calle": "walk-in",
    "walk-in": "walk-in",
    calle: "walk-in",
    treatwell: "treatwell",
    web: "web",
    otro: "otro",
  };
  return aliases[normalized] || normalized.replace(/\s+/g, "-");
}

function actorIdentifier(actor = {}) {
  return cleanText(actor.uid || actor.email || actor.nombre || actor.name);
}

function optionalObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

export function normalizeAppointmentRecord(appointment = {}) {
  const durationMinutes = appointmentDurationMinutes(
    appointment.durationMinutes ?? appointment.appointmentDuration ?? appointment.duration,
  );
  const startTime = normalizeAppointmentTime(appointment.startTime || appointment.time);
  const calculatedEndTime = calculateAppointmentEndTime(startTime, durationMinutes);
  return {
    ...appointment,
    id: cleanText(appointment.id),
    clientId: cleanText(appointment.clientId),
    clientName: cleanText(appointment.clientName),
    clientPhone: cleanText(appointment.clientPhone || appointment.phone),
    serviceId: cleanText(appointment.serviceId),
    serviceName: cleanText(appointment.serviceName || appointment.service),
    professionalId: cleanText(appointment.professionalId || appointment.employeeId),
    professionalName: cleanText(appointment.professionalName || appointment.employee),
    date: normalizeAppointmentDate(appointment.date || appointment.fechaOperativa),
    startTime,
    durationMinutes,
    endTime: calculatedEndTime || normalizeAppointmentTime(appointment.endTime),
    status: normalizeAppointmentStatus(appointment.status || appointment.appointmentStatus) || "Confirmada",
    origin: normalizeAppointmentOrigin(appointment.origin || appointment.source || appointment.appointmentSource),
    notes: cleanText(appointment.notes || appointment.appointmentNotes),
    sourceReference: cleanText(appointment.sourceReference),
    externalBookingId: cleanText(appointment.externalBookingId),
    externalMetadata: optionalObject(appointment.externalMetadata),
  };
}

export function buildAppointmentRecord(payload = {}, { actor = {}, existing = {}, id = "", now = new Date().toISOString() } = {}) {
  const merged = normalizeAppointmentRecord({ ...existing, ...payload, id: existing.id || id || payload.id });
  const required = [
    [merged.id, "No se pudo asignar un identificador a la cita."],
    [merged.clientId, "Selecciona un cliente real."],
    [merged.clientName, "El cliente no tiene nombre."],
    [merged.serviceId, "Selecciona un servicio real."],
    [merged.serviceName, "El servicio no tiene nombre."],
    [merged.professionalId, "Selecciona una profesional real."],
    [merged.professionalName, "La profesional no tiene nombre."],
    [merged.date, "Indica una fecha válida."],
    [merged.startTime, "Indica una hora válida."],
    [merged.durationMinutes >= 5, "La duración debe ser de al menos 5 minutos."],
    [merged.endTime, "La cita debe finalizar dentro del mismo día."],
    [APPOINTMENT_STATUSES.includes(merged.status), "El estado de la cita no es válido."],
  ];
  const invalid = required.find(([condition]) => !condition);
  if (invalid) throw new AppointmentValidationError("invalid-argument", invalid[1]);

  const createdAt = cleanText(existing.createdAt) || now;
  const createdBy = cleanText(existing.createdBy) || actorIdentifier(actor);
  const record = {
    id: merged.id,
    clientId: merged.clientId,
    clientName: merged.clientName,
    clientPhone: merged.clientPhone,
    serviceId: merged.serviceId,
    serviceName: merged.serviceName,
    professionalId: merged.professionalId,
    professionalName: merged.professionalName,
    date: merged.date,
    startTime: merged.startTime,
    durationMinutes: merged.durationMinutes,
    endTime: merged.endTime,
    status: merged.status,
    origin: merged.origin,
    notes: merged.notes,
    createdAt,
    createdBy,
    updatedAt: now,
    updatedBy: actorIdentifier(actor),
  };

  if (merged.sourceReference) record.sourceReference = merged.sourceReference;
  if (merged.externalBookingId) record.externalBookingId = merged.externalBookingId;
  if (merged.externalMetadata) record.externalMetadata = merged.externalMetadata;
  return record;
}

export function appointmentHasConflict(candidate, appointments = [], excludeId = "") {
  const normalizedCandidate = normalizeAppointmentRecord(candidate);
  if (!isAppointmentBlocking(normalizedCandidate.status)) return false;
  const candidateStart = appointmentTimeToMinutes(normalizedCandidate.startTime);
  const candidateEnd = appointmentTimeToMinutes(normalizedCandidate.endTime);
  if (!normalizedCandidate.date || !normalizedCandidate.professionalId || !Number.isFinite(candidateStart) || !Number.isFinite(candidateEnd)) return false;

  return appointments.some((appointment) => {
    const existing = normalizeAppointmentRecord(appointment);
    if (!existing.id || existing.id === excludeId || existing.date !== normalizedCandidate.date) return false;
    if (!isAppointmentBlocking(existing.status)) return false;
    const sameProfessional = existing.professionalId
      ? existing.professionalId === normalizedCandidate.professionalId
      : normalizeText(existing.professionalName) === normalizeText(normalizedCandidate.professionalName);
    if (!sameProfessional) return false;
    const existingStart = appointmentTimeToMinutes(existing.startTime);
    const existingEnd = appointmentTimeToMinutes(existing.endTime);
    return Number.isFinite(existingStart)
      && Number.isFinite(existingEnd)
      && candidateStart < existingEnd
      && candidateEnd > existingStart;
  });
}

export function assertNoAppointmentConflict(candidate, appointments = [], excludeId = "") {
  if (appointmentHasConflict(candidate, appointments, excludeId)) {
    throw new AppointmentValidationError("conflict", "La profesional ya tiene otra cita que se solapa con ese horario.");
  }
}

export async function createAppointmentOperation(payload = {}, {
  actor = {},
  id,
  loadAppointmentsByDate,
  now = new Date().toISOString(),
  saveAppointment,
} = {}) {
  if (typeof loadAppointmentsByDate !== "function" || typeof saveAppointment !== "function") {
    throw new AppointmentValidationError("invalid-repository", "No se ha configurado la persistencia de citas.");
  }
  const appointment = buildAppointmentRecord(payload, { actor, id, now });
  const appointmentsForDate = await loadAppointmentsByDate(appointment.date);
  assertNoAppointmentConflict(appointment, appointmentsForDate);
  await saveAppointment(appointment);
  return appointment;
}

export function canTransitionAppointmentStatus(currentStatus, nextStatus) {
  const current = normalizeAppointmentStatus(currentStatus);
  const next = normalizeAppointmentStatus(nextStatus);
  return current === next || Boolean(current && next && STATUS_TRANSITIONS[current]?.includes(next));
}

export function assertAppointmentStatusTransition(currentStatus, nextStatus) {
  if (!canTransitionAppointmentStatus(currentStatus, nextStatus)) {
    throw new AppointmentValidationError("invalid-status-transition", "El cambio de estado solicitado no está permitido.");
  }
}

export { APPOINTMENT_STATUSES, STATUS_TRANSITIONS };
