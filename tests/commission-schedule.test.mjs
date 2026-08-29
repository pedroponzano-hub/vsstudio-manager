import test from "node:test";
import assert from "node:assert/strict";

import {
  assertCommissionEditReason,
  buildManualCommissionOverride,
  commissionRateForMoment,
  createCommissionAuditEntry,
  filterOwnPositiveCommissions,
  normalizeProfessionalCommissionPolicy,
  resolveSaleCommissionSnapshot,
} from "../src/utils/commissionSchedule.js";

const configuredProfessional = {
  id: "professional-leo-real",
  name: "Leo",
  commissionPercent: 40,
  economics: {
    commissionMode: "mixed_schedule",
    defaultServiceCommissionPercent: 40,
    commissionRuleEffectiveFrom: "2026-09-01",
    commissionSchedule: {
      monday: { enabled: true, start: "10:00", end: "15:00", commissionPercent: 0 },
      tuesday: { enabled: true, start: "10:00", end: "15:00", commissionPercent: 0 },
    },
  },
};
const leo = configuredProfessional;
const appointments = [
  { id: "appointment-14", date: "2026-09-01", startTime: "14:00", professionalId: leo.id },
  { id: "appointment-16", date: "2026-09-01", startTime: "16:00", professionalId: leo.id },
];

const saturdayTestProfessional = {
  id: "professional-leo-real",
  name: "Leo",
  commissionPercent: 40,
  economics: {
    commissionMode: "mixed_schedule",
    defaultServiceCommissionPercent: 40,
    commissionRuleEffectiveFrom: "2026-08-29",
    commissionSchedule: {
      saturday: { enabled: true, start: "10:00", end: "15:00", commissionPercent: 0 },
      sunday: { enabled: false, start: "10:00", end: "15:00", commissionPercent: 0 },
    },
  },
};

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

test("la regla configurada aplica 0% desde su fecha de vigencia", () => {
  const result = resolveSaleCommissionSnapshot(saleAt("2026-09-01", "14:00"), { professionals: [leo] });
  assert.equal(result.commissionRateApplied, 0);
  assert.equal(result.commissionRule, "salaried_schedule");
  assert.equal(resolveSaleCommissionSnapshot(saleAt("2026-09-01", "14:59"), { professionals: [leo] }).commissionRateApplied, 0);
});

test("caso real: sábado 29/08/2026 a las 11:00 genera 0 sobre una venta de 12 EUR", () => {
  const result = resolveSaleCommissionSnapshot({
    total: 12,
    professionalId: saturdayTestProfessional.id,
    employee: "Leo",
    commissionCalculationTimestamp: "2026-08-29T11:00:00",
  }, { professionals: [saturdayTestProfessional] });
  assert.equal(result.serviceDate, "2026-08-29");
  assert.equal(result.serviceTime, "11:00");
  assert.equal(result.commissionRateApplied, 0);
  assert.equal(result.commissionAmount, 0);
  assert.equal(result.commissionRule, "salaried_schedule");
});

test("una comisión interior de 0 no cae al porcentaje predeterminado", () => {
  const policy = normalizeProfessionalCommissionPolicy(saturdayTestProfessional);
  const result = commissionRateForMoment(policy, "2026-08-29", "11:00");
  assert.equal(policy.commissionSchedule.saturday.commissionPercent, 0);
  assert.equal(result.commissionRateApplied, 0);
});

test("sábado 29/08/2026 a las 16:00 conserva 40% y 4,80 EUR", () => {
  const result = resolveSaleCommissionSnapshot({
    total: 12,
    professionalId: saturdayTestProfessional.id,
    employee: "Leo",
    serviceDate: "2026-08-29",
    serviceTime: "16:00",
  }, { professionals: [saturdayTestProfessional] });
  assert.equal(result.commissionRateApplied, 40);
  assert.equal(result.commissionAmount.toFixed(2), "4.80");
  assert.equal(result.commissionRule, "standard");
});

test("un domingo no habilitado conserva la comisión normal", () => {
  const result = resolveSaleCommissionSnapshot({
    total: 12,
    professionalId: saturdayTestProfessional.id,
    employee: "Leo",
    serviceDate: "2026-08-30",
    serviceTime: "11:00",
  }, { professionals: [saturdayTestProfessional] });
  assert.equal(result.commissionRateApplied, 40);
});

test("la fecha de vigencia es inclusiva y bloquea fechas anteriores", () => {
  const futurePolicy = {
    ...saturdayTestProfessional,
    economics: { ...saturdayTestProfessional.economics, commissionRuleEffectiveFrom: "2026-09-01" },
  };
  const sale = { total: 12, professionalId: saturdayTestProfessional.id, employee: "Leo", serviceDate: "2026-08-29", serviceTime: "11:00" };
  assert.equal(resolveSaleCommissionSnapshot(sale, { professionals: [futurePolicy] }).commissionRateApplied, 40);
  assert.equal(resolveSaleCommissionSnapshot(sale, { professionals: [saturdayTestProfessional] }).commissionRateApplied, 0);
});

test("un servicio anterior a la vigencia conserva la comisión estándar", () => {
  const result = resolveSaleCommissionSnapshot(saleAt("2026-08-31", "14:00"), { professionals: [leo] });
  assert.equal(result.commissionRateApplied, 40);
  assert.equal(result.commissionRule, "standard");
  assert.equal(result.commissionRuleEffectiveFrom, "2026-09-01");
});

test("una regla mixta sin fecha de vigencia no se activa por accidente", () => {
  const withoutEffectiveDate = { ...leo, economics: { ...leo.economics, commissionRuleEffectiveFrom: "" } };
  assert.equal(resolveSaleCommissionSnapshot(saleAt("2026-09-01", "14:00"), { professionals: [withoutEffectiveDate] }).commissionRateApplied, 40);
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

test("los días obedecen la configuración y no el nombre de la profesional", () => {
  const saturdayEnabled = {
    ...leo,
    name: "Profesional configurable",
    economics: {
      ...leo.economics,
      commissionSchedule: {
        ...leo.economics.commissionSchedule,
        saturday: { enabled: true, start: "10:00", end: "15:00", commissionPercent: 0 },
      },
    },
  };
  assert.equal(resolveSaleCommissionSnapshot({ ...saleAt("2026-09-05", "11:00"), employee: saturdayEnabled.name }, { professionals: [saturdayEnabled] }).commissionRateApplied, 0);
  assert.equal(resolveSaleCommissionSnapshot(saleAt("2026-09-05", "11:00"), { professionals: [leo] }).commissionRateApplied, 40);
});

test("cita a las 14:00 prevalece sobre venta cerrada a las 18:00", () => {
  const result = resolveSaleCommissionSnapshot(saleAt("2026-09-01", "18:00", { appointmentId: "appointment-14" }), { appointments, professionals: [leo] });
  assert.equal(result.commissionSource, "appointment");
  assert.equal(result.serviceTime, "14:00");
  assert.equal(result.commissionRateApplied, 0);
});

test("una cita anterior a la vigencia usa la regla anterior aunque se cierre después", () => {
  const oldAppointment = { id: "appointment-old", date: "2026-08-31", startTime: "14:00", professionalId: leo.id };
  const result = resolveSaleCommissionSnapshot(saleAt("2026-09-01", "18:00", { appointmentId: oldAppointment.id }), { appointments: [oldAppointment], professionals: [leo] });
  assert.equal(result.commissionSource, "appointment");
  assert.equal(result.serviceDate, "2026-08-31");
  assert.equal(result.commissionRateApplied, 40);
});

test("previsualización y guardado usan el mismo fallback fijado al crear el borrador", () => {
  const directSale = {
    total: 12,
    professionalId: leo.id,
    employee: "Leo",
    commissionCalculationTimestamp: "2026-09-01T14:00:00",
  };
  const preview = resolveSaleCommissionSnapshot(directSale, { professionals: [leo] });
  const saved = resolveSaleCommissionSnapshot({ ...directSale, horaCreacion: "2026-09-01T18:00:00" }, { professionals: [leo] });
  assert.equal(preview.commissionSource, "sale_created_at_fallback");
  assert.equal(preview.commissionAmount, 0);
  assert.equal(saved.commissionAmount, preview.commissionAmount);
});

test("previsualización y guardado coinciden también fuera del tramo", () => {
  const directSale = {
    total: 12,
    professionalId: leo.id,
    employee: "Leo",
    commissionCalculationTimestamp: "2026-09-01T16:00:00",
  };
  const preview = resolveSaleCommissionSnapshot(directSale, { professionals: [leo] });
  const saved = resolveSaleCommissionSnapshot({ ...directSale, horaCreacion: "2026-09-01T18:00:00" }, { professionals: [leo] });
  assert.equal(preview.commissionAmount.toFixed(2), "4.80");
  assert.equal(saved.commissionAmount, preview.commissionAmount);
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
  const changedLeo = { ...leo, commissionPercent: 55, economics: { ...leo.economics, defaultServiceCommissionPercent: 55 } };
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
