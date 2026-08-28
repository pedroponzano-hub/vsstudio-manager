import test from "node:test";
import assert from "node:assert/strict";

import {
  AppointmentValidationError,
  appointmentHasConflict,
  buildAppointmentRecord,
  calculateAppointmentEndTime,
  canTransitionAppointmentStatus,
  createAppointmentOperation,
  filterAppointmentServices,
  filterOperationalAppointments,
  isAppointmentBlocking,
  normalizeAppointmentSearchText,
} from "../src/utils/appointmentModel.js";

const basePayload = {
  clientId: "client-real-1",
  clientName: "Cliente real",
  clientPhone: "600000000",
  serviceId: "service-real-1",
  serviceName: "Servicio real",
  professionalId: "professional-real-1",
  professionalName: "Profesional real",
  date: "2026-08-29",
  startTime: "10:00",
  durationMinutes: 45,
  origin: "manual",
  notes: "",
};

test("crea el modelo canónico y calcula 10:00 + 45 minutos como 10:45", () => {
  const appointment = buildAppointmentRecord(basePayload, {
    id: "appointment-1",
    actor: { uid: "admin-uid" },
    now: "2026-08-28T10:00:00.000Z",
  });
  assert.equal(calculateAppointmentEndTime("10:00", 45), "10:45");
  assert.equal(appointment.endTime, "10:45");
  assert.equal(appointment.status, "Confirmada");
  assert.equal(appointment.createdBy, "admin-uid");
});

test("la operación central persiste y recarga un payload futuro Treatwell sin conectar la integración", async () => {
  const stored = new Map();
  const appointment = await createAppointmentOperation({
    ...basePayload,
    origin: "treatwell",
    sourceReference: "test-reference",
    externalBookingId: "external-test-id",
    externalMetadata: { channel: "future-test" },
  }, {
    id: "appointment-treatwell-test",
    loadAppointmentsByDate: async (date) => [...stored.values()].filter((item) => item.date === date),
    saveAppointment: async (record) => stored.set(record.id, structuredClone(record)),
  });
  const reloaded = stored.get(appointment.id);
  assert.equal(reloaded.origin, "treatwell");
  assert.equal(reloaded.sourceReference, "test-reference");
  assert.equal(reloaded.externalBookingId, "external-test-id");
  assert.deepEqual(reloaded.externalMetadata, { channel: "future-test" });
});

test("bloquea solapamiento para la misma profesional", () => {
  const existing = buildAppointmentRecord(basePayload, { id: "appointment-existing" });
  const overlapping = buildAppointmentRecord({ ...basePayload, startTime: "10:30", durationMinutes: 45 }, { id: "appointment-new" });
  assert.equal(appointmentHasConflict(overlapping, [existing]), true);
});

test("permite la misma hora para otra profesional", () => {
  const existing = buildAppointmentRecord(basePayload, { id: "appointment-existing" });
  const otherProfessional = buildAppointmentRecord({
    ...basePayload,
    professionalId: "professional-real-2",
    professionalName: "Otra profesional",
  }, { id: "appointment-new" });
  assert.equal(appointmentHasConflict(otherProfessional, [existing]), false);
});

test("una cita cancelada o no presentada no bloquea disponibilidad", () => {
  const cancelled = buildAppointmentRecord({ ...basePayload, status: "Cancelada" }, { id: "cancelled" });
  const noShow = buildAppointmentRecord({ ...basePayload, status: "No se presentó" }, { id: "no-show" });
  const candidate = buildAppointmentRecord(basePayload, { id: "candidate" });
  assert.equal(appointmentHasConflict(candidate, [cancelled, noShow]), false);
  assert.equal(appointmentHasConflict(cancelled, [candidate]), false);
});

test("centraliza los estados que bloquean horario", () => {
  assert.equal(isAppointmentBlocking("Confirmada"), true);
  assert.equal(isAppointmentBlocking("En servicio"), true);
  assert.equal(isAppointmentBlocking("Finalizada"), true);
  assert.equal(isAppointmentBlocking("Cancelada"), false);
  assert.equal(isAppointmentBlocking("No se presentó"), false);
});

test("excluye canceladas y no presentadas de la parrilla, pero conserva los registros para la lista", () => {
  const appointments = [
    { id: "active", status: "Confirmada" },
    { id: "cancelled", status: "Cancelada" },
    { id: "no-show", status: "No se presentó" },
  ];
  assert.deepEqual(filterOperationalAppointments(appointments).map((item) => item.id), ["active"]);
  assert.deepEqual(appointments.map((item) => item.id), ["active", "cancelled", "no-show"]);
});

test("filtra servicios por palabras parciales, sin mayúsculas ni tildes", () => {
  const services = [
    { id: "volume", name: "Extensiones de pestañas volumen ruso" },
    { id: "manicure", name: "Mujer - Manicura completa - Semipermanente" },
    { id: "brows", name: "Mujer - Depilación de cejas con cera" },
  ];
  assert.deepEqual(filterAppointmentServices(services, "volumen").map((item) => item.id), ["volume"]);
  assert.deepEqual(filterAppointmentServices(services, "manicura semi").map((item) => item.id), ["manicure"]);
  assert.deepEqual(filterAppointmentServices(services, "depilacion cejas").map((item) => item.id), ["brows"]);
  assert.equal(normalizeAppointmentSearchText("  DEPILACIÓN  "), "depilacion");
  assert.equal(filterAppointmentServices(services, "depilacion")[0].id, "brows");
});

test("seleccionar un servicio filtrado conserva su serviceId real", () => {
  const services = [
    { id: "service-real-volume", name: "Extensiones de pestañas volumen ruso" },
  ];
  const selected = filterAppointmentServices(services, "volumen")[0];
  const appointment = buildAppointmentRecord({ ...basePayload, serviceId: selected.id, serviceName: selected.name }, { id: "selected-service" });
  assert.equal(appointment.serviceId, "service-real-volume");
});

test("mantiene transiciones operativas controladas", () => {
  assert.equal(canTransitionAppointmentStatus("Confirmada", "En servicio"), true);
  assert.equal(canTransitionAppointmentStatus("En servicio", "Finalizada"), true);
  assert.equal(canTransitionAppointmentStatus("Finalizada", "Confirmada"), false);
});

test("editar fecha, profesional y duración conserva identidad y recalcula el bloque", () => {
  const existing = buildAppointmentRecord(basePayload, {
    id: "appointment-edit",
    actor: { uid: "creator" },
    now: "2026-08-28T10:00:00.000Z",
  });
  const edited = buildAppointmentRecord({
    date: "2026-08-30",
    startTime: "12:15",
    durationMinutes: 60,
    professionalId: "professional-real-2",
    professionalName: "Otra profesional",
  }, {
    actor: { uid: "editor" },
    existing,
    now: "2026-08-29T11:00:00.000Z",
  });
  assert.equal(edited.id, "appointment-edit");
  assert.equal(edited.createdBy, "creator");
  assert.equal(edited.updatedBy, "editor");
  assert.equal(edited.date, "2026-08-30");
  assert.equal(edited.professionalId, "professional-real-2");
  assert.equal(edited.endTime, "13:15");
});

test("rechaza una cita sin IDs reales", () => {
  assert.throws(
    () => buildAppointmentRecord({ ...basePayload, professionalId: "" }, { id: "invalid" }),
    (error) => error instanceof AppointmentValidationError && error.code === "invalid-argument",
  );
});
