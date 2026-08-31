import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const helperSource = await readFile(new URL("../src/utils/commissionFinance.js", import.meta.url), "utf8");
const {
  buildCommissionPaymentFields,
  calculateDailyPaymentMethodReconciliation,
  calculateOperatingResult,
  calculatePaymentMethodReconciliation,
  calculateTreasuryResult,
  commissionFinancialSummary,
  findPotentialCommissionExpenseDuplicates,
  formatFinancialInput,
  normalizeCommissionPaymentMethod,
  parseFinancialInput,
  resolveFinancialInput,
  selectPayableCommissions,
} = await import(`data:text/javascript;base64,${Buffer.from(helperSource).toString("base64")}`);
const cashClosingSource = await readFile(new URL("../src/components/CashClosing.jsx", import.meta.url), "utf8");

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

test("el cierre diario de efectivo concilia solo cobros aunque haya gastos y comisiones", () => {
  const cash = calculateDailyPaymentMethodReconciliation({
    method: "Efectivo",
    registered: 35,
    paidExpenses: 12,
    paidCommissions: 339.60,
    real: 35,
  });

  assert.equal(cash.reconciliationTarget, 35);
  assert.equal(cash.difference, 0);
});

test("el cierre diario de tarjeta no resta gastos de los cobros", () => {
  const card = calculateDailyPaymentMethodReconciliation({
    method: "Tarjeta",
    registered: 90,
    paidExpenses: 588.50,
    real: 90,
  });

  assert.equal(card.reconciliationTarget, 90);
  assert.equal(card.difference, 0);
});

test("gastos y comisiones son informativos y no intervienen en el esperado diario", () => {
  const cash = calculateDailyPaymentMethodReconciliation({ method: "Efectivo", registered: 35, real: 35 });
  const card = calculateDailyPaymentMethodReconciliation({ method: "Tarjeta", registered: 90, real: 90 });

  assert.equal(cash.reconciliationTarget, 35);
  assert.equal(card.reconciliationTarget, 90);
  assert.match(cashClosingSource, /Gastos pagados/);
  assert.match(cashClosingSource, /Comisiones pagadas/);
});

test("el cierre diario no depende de fondo inicial ni muestra tesoreria neta", () => {
  assert.doesNotMatch(cashClosingSource, /Fondo inicial de caja/);
  assert.doesNotMatch(cashClosingSource, /Pendiente de fondo inicial/);
  assert.doesNotMatch(cashClosingSource, /Tesoreria neta/);
});

test("fondo inicial, cobros y salidas producen el efectivo esperado sin alterar cobros", () => {
  const cash = calculatePaymentMethodReconciliation({
    method: "Efectivo",
    openingBalance: 500,
    registered: 35,
    paidExpenses: 12,
    paidCommissions: 339.60,
    real: 183.40,
  });

  assert.equal(cash.registered, 35);
  assert.equal(cash.openingBalance, 500);
  assert.equal(Number(cash.expectedBalance.toFixed(2)), 183.40);
  assert.equal(Number(cash.difference.toFixed(2)), 0);
});

test("gastos y comisiones de efectivo reducen caja esperada pero nunca los cobros", () => {
  const expenseOnly = calculatePaymentMethodReconciliation({ method: "Efectivo", openingBalance: 100, registered: 35, paidExpenses: 12 });
  const commissionOnly = calculatePaymentMethodReconciliation({ method: "Efectivo", openingBalance: 100, registered: 35, paidCommissions: 20 });
  assert.equal(expenseOnly.registered, 35);
  assert.equal(expenseOnly.expectedBalance, 123);
  assert.equal(commissionOnly.registered, 35);
  assert.equal(commissionOnly.expectedBalance, 115);
});

test("una comisión por transferencia no modifica el efectivo esperado", () => {
  const cash = calculatePaymentMethodReconciliation({ method: "Efectivo", openingBalance: 100, registered: 35, paidCommissions: 0 });
  const transfer = calculatePaymentMethodReconciliation({ method: "Transferencia", registered: 50, paidCommissions: 20, real: 50 });
  assert.equal(cash.expectedBalance, 135);
  assert.equal(transfer.registered, 50);
  assert.equal(transfer.expectedBalance, 30);
  assert.equal(transfer.reconciliationTarget, 50);
});

test("fondo inicial cero explícito permite mostrar un movimiento neto negativo sin cambiar ventas", () => {
  const cash = calculatePaymentMethodReconciliation({ method: "Efectivo", openingBalance: 0, registered: 35, paidExpenses: 12, paidCommissions: 339.60 });
  assert.equal(cash.registered, 35);
  assert.equal(Number(cash.expectedBalance.toFixed(2)), -316.60);
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

test("tarjeta conserva 90 euros de cobros y refleja -498,50 de tesorería", () => {
  const card = calculatePaymentMethodReconciliation({
    method: "Tarjeta",
    registered: 90,
    paidExpenses: 588.50,
    real: 90,
  });

  assert.equal(card.registered, 90);
  assert.equal(card.reconciliationTarget, 90);
  assert.equal(card.difference, 0);
  assert.equal(Number(card.treasuryBalance.toFixed(2)), -498.50);
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
