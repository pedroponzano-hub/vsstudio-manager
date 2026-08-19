import test from "node:test";
import assert from "node:assert/strict";

import {
  canAccessDashboardSection,
  defaultPageForRole,
} from "../src/permissions.js";

test("direccion inicia en la agenda operativa", () => {
  assert.equal(defaultPageForRole("direccion"), "pos.agendaV2");
});

test("direccion puede ver el dashboard diario pero no el mensual", () => {
  assert.equal(canAccessDashboardSection("direccion", "today"), true);
  assert.equal(canAccessDashboardSection("direccion", "month"), false);
});

test("el administrador conserva ambos dashboards", () => {
  assert.equal(canAccessDashboardSection("admin", "today"), true);
  assert.equal(canAccessDashboardSection("admin", "month"), true);
});
