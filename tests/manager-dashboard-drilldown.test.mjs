import test from "node:test";
import assert from "node:assert/strict";

import { buildDashboardDetailUrl, dashboardDetailRows, dashboardDetailTotal, parseDashboardDetailSearch } from "../src/utils/managerDashboardDrilldown.js";
import { deriveManagerDashboard } from "../src/utils/managerDashboard.js";

const context = { bounds: { from: "2026-08-29", to: "2026-08-29" }, professional: "professional-leo-real", category: "Pestañas" };

test("D1-D3 Ventas conserva rango, professionalId y categoría en la URL", () => {
  const url = buildDashboardDetailUrl("sales", context);
  const parsed = parseDashboardDetailSearch(url.split("?")[1]);
  assert.deepEqual(parsed, { metric: "sales", ...context });
  assert.notEqual(url, "/manager/ventas");
});

test("D4-D5 Comisiones conserva estado contextual en el tipo de detalle", () => {
  const pendingMetric = parseDashboardDetailSearch(buildDashboardDetailUrl("pending-commissions", context).split("?")[1]).metric;
  const paidMetric = parseDashboardDetailSearch(buildDashboardDetailUrl("paid-commissions", context).split("?")[1]).metric;
  const dashboard = {
    pendingCommissions: [{ id: "pending", status: "pendiente", commissionAmount: 18 }],
    paidCommissions: [{ id: "paid", status: "pagada", commissionAmount: 12 }],
  };
  assert.equal(pendingMetric, "pending-commissions");
  assert.deepEqual(dashboardDetailRows(dashboard, pendingMetric).map((row) => row.status), ["pendiente"]);
  assert.equal(dashboardDetailTotal(dashboardDetailRows(dashboard, pendingMetric), pendingMetric), 18);
  assert.equal(paidMetric, "paid-commissions");
  assert.deepEqual(dashboardDetailRows(dashboard, paidMetric).map((row) => row.status), ["pagada"]);
});

test("D6-D7 el detalle de ventas coincide matemáticamente con el KPI filtrado", () => {
  const source = {
    sales: [
      { id: "a", saleDate: "2026-08-29", status: "cobrado", total: 15, professionalId: "professional-leo-real", employee: "Leo", services: [{ serviceName: "Lifting", category: "Pestañas", quantity: 1, price: 15 }] },
      { id: "b", saleDate: "2026-08-29", status: "cobrado", total: 30, professionalId: "professional-leo-real", employee: "Leo", services: [{ serviceName: "Extensión", category: "Pestañas", quantity: 1, price: 30 }] },
      { id: "c", saleDate: "2026-08-29", status: "cobrado", total: 90, professionalId: "otra", employee: "Marianne", services: [{ serviceName: "Facial", category: "Facial", quantity: 1, price: 90 }] },
    ],
    expenses: [], clients: [], config: { services: [] }, commissionRows: [], cashClosings: [],
  };
  const dashboard = deriveManagerDashboard(source, { ...context, period: "today" });
  const rows = dashboardDetailRows(dashboard, "sales");
  assert.equal(dashboard.metrics.totalSales, 45);
  assert.equal(dashboardDetailTotal(rows, "sales"), 45);
  assert.deepEqual(rows.map((row) => row.id), ["a", "b"]);
});

test("el detalle de servicios explica el mismo número de unidades del KPI", () => {
  const dashboard = { serviceLines: [{ quantity: 2, amount: 30 }, { quantity: 1, amount: 20 }] };
  assert.equal(dashboardDetailTotal(dashboardDetailRows(dashboard, "services"), "services"), 3);
});
