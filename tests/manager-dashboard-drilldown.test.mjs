import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildDashboardDetailUrl, dashboardDetailRows, dashboardDetailTotal, parseDashboardDetailSearch } from "../src/utils/managerDashboardDrilldown.js";
import { deriveManagerDashboard, periodBounds } from "../src/utils/managerDashboard.js";

const context = { bounds: { from: "2026-08-29", to: "2026-08-29" }, period: "today", professional: "professional-leo-real", category: "Pestañas" };
const dashboardSource = await readFile(new URL("../src/components/ManagerDashboard.jsx", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");

test("D1 Hoy conserva la fecha exacta en el detalle", () => {
  const url = buildDashboardDetailUrl("sales", context);
  const parsed = parseDashboardDetailSearch(url.split("?")[1]);
  assert.deepEqual(parsed, { metric: "sales", ...context });
  assert.match(url, /professionalId=professional-leo-real/);
  assert.notEqual(url, "/manager/ventas");
});

test("D2 Esta semana conserva el mismo rango calculado por el Dashboard", () => {
  const bounds = periodBounds("week", "2026-09-03");
  const parsed = parseDashboardDetailSearch(buildDashboardDetailUrl("operations", { ...context, bounds, period: "week" }).split("?")[1]);
  assert.deepEqual(parsed.bounds, { from: "2026-08-31", to: "2026-09-03" });
  assert.equal(parsed.period, "week");
});

test("D3 Personalizado conserva from y to exactos", () => {
  const parsed = parseDashboardDetailSearch(buildDashboardDetailUrl("services", {
    ...context,
    bounds: { from: "2026-08-10", to: "2026-08-23" },
    period: "custom",
  }).split("?")[1]);
  assert.deepEqual(parsed.bounds, { from: "2026-08-10", to: "2026-08-23" });
  assert.equal(parsed.period, "custom");
});

test("D4 Profesional conserva el professionalId real", () => {
  const url = buildDashboardDetailUrl("sales", context);
  const parsed = parseDashboardDetailSearch(url.split("?")[1]);
  assert.equal(parsed.professional, "professional-leo-real");
  assert.equal(new URLSearchParams(url.split("?")[1]).get("professionalId"), "professional-leo-real");
});

test("D5 Categoría conserva Pestañas", () => {
  const parsed = parseDashboardDetailSearch(buildDashboardDetailUrl("sales", context).split("?")[1]);
  assert.equal(parsed.category, "Pestañas");
});

test("D8-D9 Comisiones conserva estado contextual y total correcto", () => {
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
  assert.equal(dashboardDetailTotal(dashboardDetailRows(dashboard, paidMetric), paidMetric), 12);
});

test("D6-D7 Ventas y operaciones coinciden matemáticamente con sus KPI filtrados", () => {
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
  assert.equal(dashboardDetailTotal(dashboardDetailRows(dashboard, "operations"), "operations"), 2);
  assert.deepEqual(rows.map((row) => row.id), ["a", "b"]);
});

test("el detalle de servicios explica el mismo número de unidades del KPI", () => {
  const dashboard = { serviceLines: [{ quantity: 2, amount: 30 }, { quantity: 1, amount: 20 }] };
  assert.equal(dashboardDetailTotal(dashboardDetailRows(dashboard, "services"), "services"), 3);
});

test("Ticket medio abre las mismas ventas y conserva la fórmula", () => {
  const rows = [{ total: 15 }, { total: 30 }];
  assert.equal(dashboardDetailTotal(rows, "average-ticket"), 22.5);
  assert.match(dashboardSource, /navigate\("average-ticket"\)/);
});

test("D10 Gastos suma únicamente los registros del periodo", () => {
  const source = {
    sales: [], clients: [], commissionRows: [], cashClosings: [], config: { services: [] },
    expenses: [
      { id: "period", date: "2026-08-29", amount: 30 },
      { id: "outside", date: "2026-08-30", amount: 90 },
    ],
  };
  const dashboard = deriveManagerDashboard(source, context);
  const rows = dashboardDetailRows(dashboard, "expenses");
  assert.deepEqual(rows.map((row) => row.id), ["period"]);
  assert.equal(dashboard.metrics.expenses, 30);
  assert.equal(dashboardDetailTotal(rows, "expenses"), 30);
});

test("D11-D12 Clientes nuevos y recurrentes reutilizan la definición del Dashboard", () => {
  const source = {
    sales: [
      { id: "a", saleDate: "2026-08-29", status: "cobrado", total: 10, clientId: "new", professionalId: "professional-leo-real", services: [{ category: "Pestañas" }] },
      { id: "b", saleDate: "2026-08-29", status: "cobrado", total: 20, clientId: "repeat", professionalId: "professional-leo-real", services: [{ category: "Pestañas" }] },
      { id: "c", saleDate: "2026-08-29", status: "cobrado", total: 25, clientId: "repeat", professionalId: "professional-leo-real", services: [{ category: "Pestañas" }] },
    ],
    expenses: [], commissionRows: [], cashClosings: [],
    clients: [
      { id: "new", name: "Nueva", createdAt: "2026-08-29T10:00:00" },
      { id: "repeat", name: "Recurrente", createdAt: "2026-01-01T10:00:00" },
    ],
    config: { services: [], employeeSettings: [{ id: "professional-leo-real", name: "Leo" }] },
  };
  const dashboard = deriveManagerDashboard(source, context);
  const newRows = dashboardDetailRows(dashboard, "new-clients");
  const recurringRows = dashboardDetailRows(dashboard, "recurring-clients");
  assert.equal(newRows.length, dashboard.metrics.clientsNew);
  assert.deepEqual(newRows.map((row) => row.id), ["new"]);
  assert.equal(recurringRows.length, dashboard.metrics.clientsRecurring);
  assert.deepEqual(recurringRows.map((row) => row.id), ["repeat"]);
});

test("Resultado estimado muestra un desglose que suma exactamente el KPI", () => {
  const dashboard = {
    resultBreakdown: { netIncomeAfterCommissions: 75, expenses: 30 },
  };
  const rows = dashboardDetailRows(dashboard, "result-estimated");
  assert.equal(dashboardDetailTotal(rows, "result-estimated"), 45);
  assert.match(dashboardSource, /navigate\("result-estimated"\)/);
});

test("D13 todos los KPI accionables navegan a detalle contextual", () => {
  for (const target of ["sales", "operations", "services", "average-ticket", "clients", "expenses", "result-estimated", "pending-commissions", "new-clients", "recurring-clients", "paid-commissions"]) {
    assert.match(dashboardSource, new RegExp(`navigate\\(\\"${target}\\"\\)`));
    assert.ok(buildDashboardDetailUrl(target, context).startsWith("/manager/dashboard/detail?"));
  }
  assert.match(appSource, /split\(\/\[\?\#\]\//);
  assert.match(appSource, /dashboard\.detail/);
});
