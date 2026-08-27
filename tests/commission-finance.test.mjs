import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const helperSource = await readFile(new URL("../src/utils/commissionFinance.js", import.meta.url), "utf8");
const {
  buildCommissionPaymentFields,
  calculateOperatingResult,
  calculatePaymentMethodReconciliation,
  calculateTreasuryResult,
  commissionFinancialSummary,
  findPotentialCommissionExpenseDuplicates,
  formatFinancialInput,
  normalizeCommissionPaymentMethod,
  parseFinancialInput,
  resolveFinancialInput,
  requiresPaymentMethodConfirmation,
  selectPayableCommissions,
} = await import(`data:text/javascript;base64,${Buffer.from(helperSource).toString("base64")}`);

const july = { from: "2026-07-01", to: "2026-07-31" };
const august = { from: "2026-08-01", to: "2026-08-31" };

test("resultado usa fecha de generacion y tesoreria usa fecha de pago", () => {
  const rows = [{
    saleId: "sale-july",
    date: "2026-07-28",
    status: "pagada",
    paymentDate: "2026-08-05",
    paymentMethod: "Tarjeta",
    commissionAmount: 100,
  }];

  const julySummary = commissionFinancialSummary(rows, july);
  const augustSummary = commissionFinancialSummary(rows, august);
  assert.equal(julySummary.generatedTotal, 100);
  assert.equal(julySummary.paidTotal, 0);
  assert.equal(augustSummary.generatedTotal, 0);
  assert.equal(augustSummary.paidTotal, 100);
  assert.equal(augustSummary.paidByMethod.Tarjeta, 100);
});

test("una comision pagada sin paymentDate no crea salida de tesoreria", () => {
  const summary = commissionFinancialSummary([{
    saleId: "legacy",
    date: "2026-07-10",
    status: "pagada",
    commissionAmount: 75,
  }], july);
  assert.equal(summary.generatedTotal, 75);
  assert.equal(summary.paidTotal, 0);
});

test("efectivo, tarjeta y transferencia permanecen separados", () => {
  assert.equal(normalizeCommissionPaymentMethod("efectivo"), "Efectivo");
  assert.equal(normalizeCommissionPaymentMethod("Tarjeta bancaria"), "Tarjeta");
  assert.equal(normalizeCommissionPaymentMethod("card"), "Tarjeta");
  assert.equal(normalizeCommissionPaymentMethod("Transferencia bancaria"), "Transferencia");
  assert.equal(normalizeCommissionPaymentMethod("banco"), "Transferencia");
});

test("pago individual y masivo comparten los mismos campos financieros normalizados", () => {
  const input = {
    paymentDate: "2026-08-05",
    paymentMethod: "Tarjeta bancaria",
    actor: "Admin",
    notes: "Pago revisado",
    paidAt: "2026-08-05T10:00:00+02:00",
  };
  assert.deepEqual(buildCommissionPaymentFields(input), {
    paidAt: input.paidAt,
    paidBy: "Admin",
    paidObservation: "Pago revisado",
    paymentDate: "2026-08-05",
    paymentMethod: "Tarjeta",
    fechaPago: "2026-08-05",
    metodoPagoComision: "Tarjeta",
    usuarioQuePago: "Admin",
    observacionesPago: "Pago revisado",
  });
  assert.equal(buildCommissionPaymentFields({ paymentDate: "", paymentMethod: "Efectivo" }), null);
});

test("escenario contable 10000 - 3000 - 1200 produce 5800", () => {
  assert.equal(calculateOperatingResult({ income: 10000, expenses: 3000, generatedCommissions: 1200 }), 5800);
  assert.equal(calculateTreasuryResult({ collections: 10000, paidExpenses: 3000, paidCommissions: 1200 }), 5800);
});

test("efectivo se concilia contra caja esperada y tarjeta contra cobros brutos", () => {
  const cash = calculatePaymentMethodReconciliation({
    method: "Efectivo",
    registered: 1641.50,
    paidExpenses: 500,
    paidCommissions: 634.80,
    real: 506.70,
  });
  const card = calculatePaymentMethodReconciliation({
    method: "Tarjeta",
    registered: 1748,
    paidExpenses: 992.54,
    paidCommissions: 0,
    real: 1748,
  });

  assert.equal(Number(cash.expectedBalance.toFixed(2)), 506.70);
  assert.equal(Number(cash.difference.toFixed(2)), 0);
  assert.equal(Number(cash.treasuryBalance.toFixed(2)), 506.70);
  assert.equal(card.reconciliationTarget, 1748);
  assert.equal(card.difference, 0);
  assert.equal(Number(card.treasuryBalance.toFixed(2)), 755.46);
});

test("tarjeta conserva 10 euros de cobros aunque haya 10 euros de gastos", () => {
  const card = calculatePaymentMethodReconciliation({
    method: "Tarjeta",
    registered: 10,
    paidExpenses: 10,
    real: 10,
  });

  assert.equal(card.registered, 10);
  assert.equal(card.reconciliationTarget, 10);
  assert.equal(card.difference, 0);
  assert.equal(card.outflows, 10);
  assert.equal(card.treasuryBalance, 0);
});

test("tarjeta conserva 100 euros de cobros aunque haya 30 euros de gastos", () => {
  const card = calculatePaymentMethodReconciliation({
    method: "Tarjeta",
    registered: 100,
    paidExpenses: 30,
    real: 100,
  });

  assert.equal(card.registered, 100);
  assert.equal(card.reconciliationTarget, 100);
  assert.equal(card.difference, 0);
  assert.equal(card.outflows, 30);
  assert.equal(card.treasuryBalance, 70);
});

test("un gasto con tarjeta reduce tesoreria pero no los cobros ni la conciliacion TPV", () => {
  const card = calculatePaymentMethodReconciliation({
    method: "Tarjeta",
    registered: 1500,
    paidExpenses: 300,
    real: 1500,
  });

  assert.equal(card.registered, 1500);
  assert.equal(card.reconciliationTarget, 1500);
  assert.equal(card.difference, 0);
  assert.equal(card.treasuryExpectedBalance, 1200);
  assert.equal(card.treasuryBalance, 1200);
});

test("efectivo descuenta gastos y comisiones antes de comparar el contado", () => {
  const cash = calculatePaymentMethodReconciliation({
    method: "Efectivo",
    registered: 1000,
    paidExpenses: 200,
    paidCommissions: 100,
    real: 700,
  });

  assert.equal(cash.reconciliationTarget, 700);
  assert.equal(cash.treasuryExpectedBalance, 700);
  assert.equal(cash.difference, 0);
  assert.equal(cash.treasuryBalance, 700);
});

test("una salida bancaria aislada no obliga a conciliar cobros de otro periodo", () => {
  const card = calculatePaymentMethodReconciliation({
    method: "Tarjeta",
    registered: 0,
    paidExpenses: 300,
  });

  assert.equal(card.registered, 0);
  assert.equal(card.reconciliationTarget, 0);
  assert.equal(card.difference, 0);
  assert.equal(card.treasuryExpectedBalance, -300);
  assert.equal(requiresPaymentMethodConfirmation(card), false);
  assert.equal(requiresPaymentMethodConfirmation({ method: "Tarjeta", registered: 1500, outflows: 300 }), true);
  assert.equal(requiresPaymentMethodConfirmation({ method: "Efectivo", registered: 0, outflows: 300 }), true);
});

test("bizum y transferencia concilian cobros antes de aplicar sus salidas", () => {
  for (const method of ["Bizum", "Transferencia"]) {
    const row = calculatePaymentMethodReconciliation({
      method,
      registered: 1000,
      paidExpenses: 200,
      paidCommissions: 100,
      real: 1000,
    });
    assert.equal(row.reconciliationTarget, 1000);
    assert.equal(row.difference, 0);
    assert.equal(row.treasuryBalance, 700);
  }
});

test("Treatwell mantiene la conciliacion de cobros separada de sus salidas", () => {
  const row = calculatePaymentMethodReconciliation({
    method: "Treatwell",
    registered: 800,
    otherOutflows: 200,
    real: 800,
  });

  assert.equal(row.reconciliationTarget, 800);
  assert.equal(row.difference, 0);
  assert.equal(row.treasuryExpectedBalance, 600);
  assert.equal(row.treasuryBalance, 600);
});

test("los importes manuales admiten coma o punto y se normalizan a dos decimales", () => {
  assert.equal(parseFinancialInput("506,70"), 506.70);
  assert.equal(parseFinancialInput("506.70"), 506.70);
  assert.equal(parseFinancialInput("1.641,50"), 1641.50);
  assert.equal(formatFinancialInput(506.70000000001), "506.70");
});

test("un valor manual guardado prevalece sobre el teorico incluso si es cero", () => {
  const savedControls = { Efectivo: 512.35, Tarjeta: 1748, Bizum: 0 };
  const reloadedControls = JSON.parse(JSON.stringify(savedControls));
  assert.equal(resolveFinancialInput(reloadedControls.Efectivo, 506.70), 512.35);
  assert.equal(resolveFinancialInput(reloadedControls.Tarjeta, 1000), 1748);
  assert.equal(resolveFinancialInput(reloadedControls.Bizum, 250), 0);
  reloadedControls.Efectivo = "513,40";
  assert.equal(resolveFinancialInput(reloadedControls.Efectivo, 506.70), 513.40);
  assert.equal(resolveFinancialInput("755,46", 1748), 755.46);
});

test("la seleccion masiva elimina ids repetidos y excluye comisiones pagadas", () => {
  const rows = [
    { saleId: "pending", status: "pendiente" },
    { saleId: "paid", status: "pagada" },
  ];
  assert.deepEqual(selectPayableCommissions(rows, ["pending", "pending", "paid"]).map((row) => row.saleId), ["pending"]);
});

test("detecta posible duplicidad con un gasto manual de comision", () => {
  const commissions = [{
    saleId: "sale-1",
    status: "pagada",
    paymentDate: "2026-08-10",
    commissionAmount: 50,
  }];
  const expenses = [{ id: "expense-1", date: "2026-08-10", amount: 50, category: "Comisiones", concept: "Pago profesional" }];
  assert.equal(findPotentialCommissionExpenseDuplicates(expenses, commissions).length, 1);
});
