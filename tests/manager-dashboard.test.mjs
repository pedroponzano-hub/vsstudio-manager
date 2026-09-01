import test from "node:test";
import assert from "node:assert/strict";

import { deriveManagerDashboard, managerFilterOptions, periodBounds } from "../src/utils/managerDashboard.js";

const source = {
  sales: [
    { id: "sale-1", saleDate: "2026-08-25", status: "cobrado", total: 100, netAfterCommission: 75, commissionAmount: 5, clientId: "client-1", employee: "Marianne", paymentMethod: "Tarjeta", services: [{ serviceId: "service-1", serviceName: "Manicura", category: "Uñas", price: 100, quantity: 1 }] },
    { id: "sale-2", saleDate: "2026-08-24", status: "cobrado", total: 50, netAfterCommission: 38, commissionAmount: 2, clientId: "client-1", employee: "Ámbar", paymentMethod: "Efectivo", services: [{ serviceId: "service-2", serviceName: "Facial", category: "Facial", price: 50, quantity: 1 }] },
    { id: "sale-pending", saleDate: "2026-08-25", status: "pendiente_pago", total: 40, employee: "Marianne" },
  ],
  expenses: [{ id: "expense-1", date: "2026-08-25", amount: 30, paymentMethod: "Tarjeta", status: "pagado" }],
  clients: [{ id: "client-1", createdAt: "2026-08-20T10:00:00" }],
  cashClosings: [{ id: "closing-1", date: "2026-08-25", totalDifference: 0 }],
  commissionRows: [
    { saleId: "sale-1", generationDate: "2026-08-25", employee: "Marianne", commissionAmount: 5, status: "pendiente" },
    { saleId: "paid-old-sale", generationDate: "2026-07-20", fechaPago: "2026-08-25", employee: "Marianne", commissionAmount: 4, status: "pagada" },
  ],
  config: {
    employeeSettings: [
      { id: "professional-1", name: "Marianne", active: true, offersServices: true },
      { id: "professional-2", name: "Inactiva", active: false, offersServices: true },
    ],
    services: [
      { id: "service-1", name: "Manicura", category: "Uñas", active: true },
      { id: "service-2", name: "Facial", category: "Facial", active: true },
    ],
  },
};

test("los periodos usan límites locales esperados", () => {
  assert.deepEqual(periodBounds("today", "2026-08-25"), { from: "2026-08-25", to: "2026-08-25" });
  assert.deepEqual(periodBounds("week", "2026-08-25"), { from: "2026-08-24", to: "2026-08-25" });
  assert.deepEqual(periodBounds("previousMonth", "2026-08-25"), { from: "2026-07-01", to: "2026-07-31" });
  assert.deepEqual(periodBounds("custom", "2026-08-25", { from: "2026-08-20", to: "2026-08-10" }), { from: "2026-08-10", to: "2026-08-20" });
});

test("Dashboard mantiene cobros con tarjeta separados de gastos con tarjeta", () => {
  const dashboard = deriveManagerDashboard(source, { bounds: { from: "2026-08-25", to: "2026-08-25" }, period: "today" });
  assert.equal(dashboard.metrics.totalSales, 100);
  assert.equal(dashboard.metrics.expenses, 30);
  assert.equal(dashboard.paymentMethods.find((row) => row.name === "Tarjeta").amount, 100);
  assert.equal(dashboard.metrics.resultEstimated, 45);
});

test("filtros de profesional y categoría actualizan todas las métricas", () => {
  const dashboard = deriveManagerDashboard(source, { bounds: { from: "2026-08-01", to: "2026-08-31" }, period: "month", professional: "Ámbar", category: "Facial" });
  assert.equal(dashboard.metrics.totalSales, 50);
  assert.equal(dashboard.metrics.salesCount, 1);
  assert.equal(dashboard.metrics.resultEstimated, null);
  assert.equal(dashboard.professionals[0].name, "Ámbar");
  assert.equal(dashboard.categories[0].name, "Facial");
});

test("comisiones pagadas se incluyen por fecha de pago y pendientes por devengo", () => {
  const dashboard = deriveManagerDashboard(source, { bounds: { from: "2026-08-25", to: "2026-08-25" }, period: "today" });
  assert.equal(dashboard.metrics.pendingCommissions, 1);
  assert.equal(dashboard.metrics.paidCommissions, 1);
  assert.equal(dashboard.metrics.paidCommissionAmount, 4);
});

test("opciones usan únicamente configuración real activa", () => {
  const options = managerFilterOptions(source);
  assert.deepEqual(options.professionals, [{ value: "professional-1", label: "Marianne" }]);
  assert.deepEqual(options.categories, ["Facial", "Uñas"]);
});

test("periodo vacío devuelve ceros finitos y estados vacíos", () => {
  const dashboard = deriveManagerDashboard(source, { bounds: { from: "2025-01-01", to: "2025-01-31" }, period: "month" });
  assert.equal(dashboard.metrics.totalSales, 0);
  assert.equal(dashboard.metrics.averageTicket, 0);
  assert.equal(Number.isFinite(dashboard.metrics.resultEstimated), true);
  assert.deepEqual(dashboard.paymentMethods, []);
});
