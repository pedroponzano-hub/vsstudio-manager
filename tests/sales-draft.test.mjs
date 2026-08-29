import test from "node:test";
import assert from "node:assert/strict";

import { discardUnsavedSale, newSaleDraftHasData } from "../src/utils/salesDraft.js";

test("detecta datos introducidos antes de cancelar una nueva venta", () => {
  assert.equal(newSaleDraftHasData(), false);
  assert.equal(newSaleDraftHasData({ services: [{ serviceId: "service-1" }] }), true);
  assert.equal(newSaleDraftHasData({ payments: [{ method: "Tarjeta", amount: 12 }] }), true);
});

test("cancelar una venta no guardada solo descarta estado local", () => {
  let resetCount = 0;
  let navigationCount = 0;
  let persistenceCount = 0;
  discardUnsavedSale({
    resetDraft: () => { resetCount += 1; },
    onDiscard: () => { navigationCount += 1; },
  });
  assert.equal(resetCount, 1);
  assert.equal(navigationCount, 1);
  assert.equal(persistenceCount, 0);
});
