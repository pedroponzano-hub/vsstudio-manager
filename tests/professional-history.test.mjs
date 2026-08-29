import test from "node:test";
import assert from "node:assert/strict";

import { filterOwnCommissions, filterOwnSales, professionalBusinessDate, resolveProfessionalIdentity } from "../src/utils/professionalHistory.js";

const professionals = [
  { id: "professional-leo-real", name: "Leo", active: true },
  { id: "professional-marianne-real", name: "Marianne", active: true },
];

test("L1 resuelve el professionalId real de Leo desde la configuración", () => {
  const identity = resolveProfessionalIdentity({ professionalId: "leo-legacy", professionalName: "Leo" }, professionals);
  assert.equal(identity.professionalId, "professional-leo-real");
});

test("L2-L4 Mis ventas incluye solo ventas propias, históricas y con comisión cero", () => {
  const identity = resolveProfessionalIdentity({ professionalName: "Leo" }, professionals);
  const rows = filterOwnSales([
    { id: "old", employee: "Leo", saleDate: "2026-08-20", commissionAmount: 12 },
    { id: "zero", professionalId: "professional-leo-real", employee: "Leo", saleDate: "2026-09-02", commissionAmount: 0 },
    { id: "other", professionalId: "professional-marianne-real", employee: "Marianne", commissionAmount: 20 },
  ], identity);
  assert.deepEqual(rows.map((row) => row.id), ["old", "zero"]);
  assert.equal(professionalBusinessDate(rows[0]), "2026-08-20");
});

test("L5-L7 Mis comisiones excluye cero y nunca acepta un ID ajeno por coincidir el nombre", () => {
  const identity = resolveProfessionalIdentity({ professionalName: "Leo" }, professionals);
  const rows = filterOwnCommissions([
    { id: "legacy", employee: "Leo", commissionAmount: 15 },
    { id: "zero", professionalId: "professional-leo-real", employee: "Leo", commissionAmount: 0 },
    { id: "spoof", professionalId: "professional-marianne-real", employee: "Leo", commissionAmount: 30 },
    { id: "other", professionalId: "professional-marianne-real", employee: "Marianne", commissionAmount: 20 },
  ], identity);
  assert.deepEqual(rows.map((row) => row.id), ["legacy"]);
});
