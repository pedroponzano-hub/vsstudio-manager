import test from "node:test";
import assert from "node:assert/strict";

import {
  historicalReferenceExists,
  isProductCatalogItem,
  normalizeRealEmployeeSettings,
} from "../src/utils/managerConfiguration.js";

test("profesionales reales conservan ID, comisión e historial", () => {
  const config = {
    employees: ["Marianne"],
    employeeSettings: [{ id: "employee-marianne-real", name: "Marianne", active: true, commissionPercent: 40, commissionHistory: [{ id: "old" }], assignedServiceIds: ["service-1"] }],
  };
  const [professional] = normalizeRealEmployeeSettings(config);
  assert.equal(professional.id, "employee-marianne-real");
  assert.equal(professional.commissionPercent, 40);
  assert.deepEqual(professional.commissionHistory, [{ id: "old" }]);
  assert.deepEqual(professional.assignedServiceIds, ["service-1"]);
});

test("no duplica una profesional presente en employees y employeeSettings", () => {
  const result = normalizeRealEmployeeSettings({ employees: ["Ámbar"], employeeSettings: [{ id: "ambar", name: "Ámbar" }] });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "ambar");
});

test("productos son una vista del catálogo real de servicios", () => {
  assert.equal(isProductCatalogItem({ id: "p1", type: "product", name: "Champú" }), true);
  assert.equal(isProductCatalogItem({ id: "p2", category: "Productos", name: "Crema" }), true);
  assert.equal(isProductCatalogItem({ id: "s1", category: "Facial", name: "Limpieza" }), false);
});

test("detecta referencias históricas por ID sin modificar la venta", () => {
  const sales = [{ id: "sale-1", services: [{ serviceId: "service-1", serviceName: "Manicura" }] }];
  assert.equal(historicalReferenceExists(sales, { id: "service-1", name: "Manicura" }), true);
  assert.equal(historicalReferenceExists(sales, { id: "service-2", name: "Pedicura" }), false);
  assert.equal(sales[0].services[0].serviceId, "service-1");
});

test("la modalidad mixta solo procede de la configuración guardada, sin reglas por nombre", () => {
  const config = {
    employees: ["Leo"],
    employeeSettings: [{
      id: "professional-leo-real",
      name: "Leo",
      active: true,
      commissionPercent: 40,
      economics: {
        commissionMode: "mixed_schedule",
        commissionRuleEffectiveFrom: "2026-09-01",
        commissionSchedule: { tuesday: { enabled: true, start: "10:00", end: "15:00", commissionPercent: 0 } },
      },
    }],
  };
  const [leo] = normalizeRealEmployeeSettings(config);
  assert.equal(leo.id, "professional-leo-real");
  assert.equal(leo.commissionPercent, 40);
  assert.equal(leo.economics.commissionMode, "mixed_schedule");
  assert.deepEqual(leo.economics.commissionSchedule.tuesday, { enabled: true, start: "10:00", end: "15:00", commissionPercent: 0 });
  assert.equal(leo.economics.commissionRuleEffectiveFrom, "2026-09-01");
  assert.equal(leo.economics.commissionSchedule.monday.enabled, false);
  assert.equal(leo.economics.commissionSchedule.saturday.enabled, false);
  assert.equal(leo.economics.commissionSchedule.sunday.enabled, false);
});

test("un nombre Leo sin configuración explícita no activa reglas especiales", () => {
  const [leo] = normalizeRealEmployeeSettings({ employees: ["Leo"], employeeSettings: [{ id: "leo", name: "Leo", commissionPercent: 40 }] });
  assert.equal(leo.economics.commissionMode, "always");
  assert.equal(leo.economics.commissionRuleEffectiveFrom, "");
});
