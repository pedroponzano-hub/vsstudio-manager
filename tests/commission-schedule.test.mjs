import test from "node:test";
import assert from "node:assert/strict";

import {
  assertCommissionEditReason,
  buildManualCommissionOverride,
  createCommissionAuditEntry,
  filterOwnPositiveCommissions,
  normalizeProfessionalCommissionPolicy,
  resolveSaleCommissionSnapshot,
} from "../src/utils/commissionSchedule.js";

const leo = { id: "professional-leo-real", name: "Leo", commissionPercent: 40 };
const appointments = [
  { id: "appointment-14", date: "2026-09-01", startTime: "14:00", professionalId: leo.id },
  { id: "appointment-16", date: "2026-09-01", startTime: "16:00", professionalId: leo.id },
];

function saleAt(date, time, extra = {}) {
  return {
    id: `sale-${date}-${time}`,
    total: 100,
    professionalId: leo.id,
    employee: "Leo",
    serviceDate: date,
    serviceTime: time,
    horaCreacion: `${date}T18:00:00`,
    ...extra,
  };
}

test("Leo martes 14:00 aplica 0%", () => {
  const result = resolveSaleCommissionSnapshot(saleAt("2026-09-01", "14:00"), { professionals: [leo] });
  assert.equal(result.commissionRateApplied, 0);
  assert.equal(result.commissionRule, "salaried_schedule");
  assert.equal(resolveSaleCommissionSnapshot(saleAt("2026-09-01", "14:59"), { professionals: [leo] }).commissionRateApplied, 0);
});

test("Leo martes 15:00 aplica comisión normal por límite final exclusivo", () => {
  assert.equal(resolveSaleCommissionSnapshot(saleAt("2026-09-01", "15:00"), { professionals: [leo] }).commissionRateApplied, 40);
});

test("Leo martes 16:00 aplica comisión normal", () => {
  assert.equal(resolveSaleCommissionSnapshot(saleAt("2026-09-01", "16:00"), { professionals: [leo] }).commissionRateApplied, 40);
});

test("Leo sábado 12:00 aplica comisión normal", () => {
  assert.equal(resolveSaleCommissionSnapshot(saleAt("2026-09-05", "12:00"), { professionals: [leo] }).commissionRateApplied, 40);
});

test("cita a las 14:00 prevalece sobre venta cerrada a las 18:00", () => {
  const result = resolveSaleCommissionSnapshot(saleAt("2026-09-01", "18:00", { appointmentId: "appointment-14" }), { appointments, professionals: [leo] });
  assert.equal(result.commissionSource, "appointment");
  assert.equal(result.serviceTime, "14:00");
  assert.equal(result.commissionRateApplied, 0);
});

test("cita a las 16:00 prevalece y aplica comisión normal", () => {
  const result = resolveSaleCommissionSnapshot(saleAt("2026-09-01", "18:00", { appointmentId: "appointment-16" }), { appointments, professionals: [leo] });
  assert.equal(result.commissionSource, "appointment");
  assert.equal(result.commissionRateApplied, 40);
});

test("cambiar el horario después no cambia el snapshot histórico", () => {
  const storedSale = { ...saleAt("2026-09-01", "14:00"), ...resolveSaleCommissionSnapshot(saleAt("2026-09-01", "14:00"), { professionals: [leo] }) };
  const changedLeo = { ...leo, economics: { commissionMode: "always", defaultServiceCommissionPercent: 40 } };
  normalizeProfessionalCommissionPolicy(changedLeo);
  assert.equal(storedSale.commissionRateApplied, 0);
  assert.equal(storedSale.commissionRule, "salaried_schedule");
});

test("cambiar el porcentaje después no cambia el snapshot histórico", () => {
  const storedSale = { ...saleAt("2026-09-01", "16:00"), ...resolveSaleCommissionSnapshot(saleAt("2026-09-01", "16:00"), { professionals: [leo] }) };
  const changedLeo = { ...leo, commissionPercent: 55 };
  assert.equal(normalizeProfessionalCommissionPolicy(changedLeo).defaultCommissionPercent, 55);
  assert.equal(storedSale.commissionRateApplied, 40);
  assert.equal(storedSale.commissionAmount, 40);
});

test("override manual de 0 a comisión hace visible la operación", () => {
  const previous = { ...saleAt("2026-09-01", "14:00"), commissionPercent: 0, commissionAmount: 0 };
  const updated = buildManualCommissionOverride(previous, { commissionPercent: 40, commissionAmount: 40 }, { professionals: [leo] });
  const rows = filterOwnPositiveCommissions([{ ...updated, professionalId: leo.id }], leo.id);
  assert.equal(updated.commissionRule, "manual_override");
  assert.equal(rows.length, 1);
});

test("override manual de comisión a 0 oculta la operación", () => {
  const previous = { ...saleAt("2026-09-01", "16:00"), commissionPercent: 40, commissionAmount: 40 };
  const updated = buildManualCommissionOverride(previous, { commissionPercent: 0, commissionAmount: 0 }, { professionals: [leo] });
  assert.equal(filterOwnPositiveCommissions([{ ...updated, professionalId: leo.id }], leo.id).length, 0);
});

test("Mis comisiones exige coincidencia exacta de professionalId", () => {
  const rows = [
    { professionalId: leo.id, employee: "Leo", commissionAmount: 10 },
    { professionalId: "otra-profesional", employee: "Leo", commissionAmount: 20 },
  ];
  assert.deepEqual(filterOwnPositiveCommissions(rows, leo.id).map((row) => row.commissionAmount), [10]);
});

test("una venta con comisión 0 no aparece", () => {
  assert.equal(filterOwnPositiveCommissions([{ professionalId: leo.id, commissionAmount: 0 }], leo.id).length, 0);
});

test("una venta con comisión positiva sí aparece", () => {
  assert.equal(filterOwnPositiveCommissions([{ professionalId: leo.id, commissionAmount: 0.01 }], leo.id).length, 1);
});

test("editar una comisión exige motivo", () => {
  assert.throws(() => assertCommissionEditReason({ commissionAmount: 0 }, { commissionAmount: 20 }, ""), /motivo/);
  assert.doesNotThrow(() => assertCommissionEditReason({ commissionAmount: 0 }, { commissionAmount: 20 }, "Corrección verificada"));
});

test("auditoría conserva antes, después, usuario, fecha y motivo", () => {
  const entry = createCommissionAuditEntry({
    id: "audit-1",
    editedAt: "2026-08-29T10:00:00+02:00",
    editedBy: "admin@example.com",
    reason: "Hora real corregida",
    previousValues: { commissionAmount: 0, serviceTime: "14:00" },
    newValues: { commissionAmount: 40, serviceTime: "16:00" },
    changes: [{ field: "commissionAmount", before: 0, after: 40 }],
  });
  assert.equal(entry.editedBy, "admin@example.com");
  assert.equal(entry.editedAt, "2026-08-29T10:00:00+02:00");
  assert.equal(entry.reason, "Hora real corregida");
  assert.equal(entry.previousValues.commissionAmount, 0);
  assert.equal(entry.newValues.commissionAmount, 40);
});

test("sin cita ni hora de servicio queda marcado el fallback de creación", () => {
  const result = resolveSaleCommissionSnapshot({ ...saleAt("2026-09-01", ""), serviceDate: "", serviceTime: "", horaCreacion: "2026-09-01T14:30:00" }, { professionals: [leo] });
  assert.equal(result.commissionSource, "sale_created_at_fallback");
  assert.equal(result.serviceTime, "14:30");
  assert.equal(result.commissionRateApplied, 0);
});
