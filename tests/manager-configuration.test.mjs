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

test("Leo recibe por defecto la modalidad mixta laborable sin cambiar su ID ni comisión normal", () => {
  const config = {
    employees: ["Leo"],
    employeeSettings: [{ id: "professional-leo-real", name: "Leo", active: true, commissionPercent: 40 }],
  };
  const [leo] = normalizeRealEmployeeSettings(config);
  assert.equal(leo.id, "professional-leo-real");
  assert.equal(leo.commissionPercent, 40);
  assert.equal(leo.economics.commissionMode, "mixed_schedule");
  assert.deepEqual(
    ["monday", "tuesday", "wednesday", "thursday", "friday"].map((day) => leo.economics.commissionSchedule[day]),
    Array.from({ length: 5 }, () => ({ enabled: true, start: "10:00", end: "15:00", commissionPercent: 0 })),
  );
  assert.equal(leo.economics.commissionSchedule.saturday.enabled, false);
  assert.equal(leo.economics.commissionSchedule.sunday.enabled, false);
});
