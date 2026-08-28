import test from "node:test";
import assert from "node:assert/strict";

import {
  AppointmentValidationError,
  appointmentHasConflict,
  buildAppointmentRecord,
  calculateAppointmentEndTime,
  canTransitionAppointmentStatus,
  createAppointmentOperation,
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
