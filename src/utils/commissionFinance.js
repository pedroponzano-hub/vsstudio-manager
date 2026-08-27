export const commissionPaymentMethods = ["Efectivo", "Tarjeta", "Transferencia", "Bizum", "Otro"];

export const commissionPaymentOptions = [
  { value: "Efectivo", label: "Efectivo" },
  { value: "Tarjeta", label: "Tarjeta bancaria" },
  { value: "Transferencia", label: "Transferencia bancaria" },
  { value: "Bizum", label: "Bizum" },
  { value: "Otro", label: "Otro" },
];

function normalizedText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeCommissionPaymentMethod(method = "") {
  const value = normalizedText(method);
  if (!value) return "";
  if (value.includes("efectivo") || value === "cash") return "Efectivo";
  if (value.includes("transfer") || value.includes("bank transfer") || value === "banco") return "Transferencia";
  if (value.includes("tarjeta") || value.includes("card") || value.includes("datafono")) return "Tarjeta";
  if (value.includes("bizum")) return "Bizum";
  return "Otro";
}

export function isValidBusinessDate(value = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

export function parseFinancialInput(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const compact = String(value ?? "").trim().replace(/\s/g, "");
  if (!compact) return null;

  const lastComma = compact.lastIndexOf(",");
  const lastPoint = compact.lastIndexOf(".");
  let normalized = compact;
  if (lastComma >= 0 && lastPoint >= 0) {
    normalized = lastComma > lastPoint
      ? compact.replace(/\./g, "").replace(",", ".")
      : compact.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = compact.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveFinancialInput(value, fallback = 0) {
  const parsed = parseFinancialInput(value);
  return parsed === null ? Number(fallback || 0) : parsed;
}

export function formatFinancialInput(value) {
  const parsed = parseFinancialInput(value);
  return parsed === null ? "" : parsed.toFixed(2);
}

export function buildCommissionPaymentFields({ paymentDate = "", paymentMethod = "", actor = "", notes = "", paidAt = "" } = {}) {
  const normalizedMethod = normalizeCommissionPaymentMethod(paymentMethod);
  if (!isValidBusinessDate(paymentDate) || !normalizedMethod) return null;

  return {
    paidAt,
    paidBy: actor,
    paidObservation: notes,
    paymentDate,
    paymentMethod: normalizedMethod,
    fechaPago: paymentDate,
    metodoPagoComision: normalizedMethod,
    usuarioQuePago: actor,
    observacionesPago: notes,
  };
}

export function commissionGenerationDate(commission = {}) {
  return commission.saleDate || commission.fechaGeneracion || commission.fechaOperativa || commission.date || "";
}

export function commissionPaymentDate(commission = {}) {
  const value = commission.paymentDate || commission.fechaPago || "";
  return isValidBusinessDate(value) ? value : "";
}

export function dateInRange(date, range = {}) {
  if (!date) return false;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

export function generatedCommissionsInRange(rows = [], range = {}) {
  return rows.filter((row) => dateInRange(commissionGenerationDate(row), range));
}

export function paidCommissionsInRange(rows = [], range = {}) {
  return rows.filter((row) => (
    row.status === "pagada"
    && Boolean(commissionPaymentDate(row))
    && dateInRange(commissionPaymentDate(row), range)
  ));
}

export function selectPayableCommissions(rows = [], commissionIds = []) {
  const rowsById = new Map(rows.map((row) => [row.saleId || row.id, row]));
  return [...new Set((commissionIds || []).filter(Boolean))]
    .map((id) => rowsById.get(id))
    .filter((row) => row && row.status !== "pagada");
}

export function groupPaidCommissionsByMethod(rows = [], methods = commissionPaymentMethods) {
  return rows.reduce((groups, row) => {
    const normalizedMethod = normalizeCommissionPaymentMethod(row.metodoPagoComision || row.paymentMethod);
    const method = methods.includes(normalizedMethod) ? normalizedMethod : "Otro";
    groups[method] = (groups[method] || 0) + Number(row.commissionAmount || 0);
    return groups;
  }, Object.fromEntries(methods.map((method) => [method, 0])));
}

export function commissionFinancialSummary(rows = [], range = {}) {
  const generated = generatedCommissionsInRange(rows, range);
  const paidForTreasury = paidCommissionsInRange(rows, range);
  return {
    generated,
    paidForTreasury,
    generatedTotal: generated.reduce((total, row) => total + Number(row.commissionAmount || 0), 0),
    pendingGeneratedTotal: generated
      .filter((row) => row.status !== "pagada")
      .reduce((total, row) => total + Number(row.commissionAmount || 0), 0),
    paidTotal: paidForTreasury.reduce((total, row) => total + Number(row.commissionAmount || 0), 0),
    paidByMethod: groupPaidCommissionsByMethod(paidForTreasury),
  };
}

export function calculateOperatingResult({ income = 0, expenses = 0, generatedCommissions = 0, platformCommissions = 0 } = {}) {
  return Number(income || 0)
    - Number(expenses || 0)
    - Number(generatedCommissions || 0)
    - Number(platformCommissions || 0);
}

export function calculateTreasuryResult({ collections = 0, paidExpenses = 0, paidCommissions = 0, platformPayments = 0 } = {}) {
  return Number(collections || 0)
    - Number(paidExpenses || 0)
    - Number(paidCommissions || 0)
    - Number(platformPayments || 0);
}

export function calculatePaymentMethodReconciliation({ method = "", registered = 0, paidExpenses = 0, paidCommissions = 0, otherOutflows = 0, real } = {}) {
  const registeredAmount = Number(registered || 0);
  const outflows = Number(paidExpenses || 0) + Number(paidCommissions || 0) + Number(otherOutflows || 0);
  const treasuryExpectedBalance = registeredAmount - outflows;
  const isCash = normalizeCommissionPaymentMethod(method) === "Efectivo";
  // Solo el efectivo se concilia contra su saldo fisico tras salidas.
  // Los metodos bancarios siempre se concilian contra los cobros brutos registrados.
  const reconciliationTarget = isCash ? treasuryExpectedBalance : registeredAmount;
  const hasRealAmount = real !== undefined && real !== null && real !== "";
  const confirmedAmount = hasRealAmount ? Number(real || 0) : reconciliationTarget;
  const rawDifference = confirmedAmount - reconciliationTarget;

  return {
    method,
    isCash,
    registered: registeredAmount,
    outflows,
    expectedBalance: treasuryExpectedBalance,
    treasuryExpectedBalance,
    reconciliationTarget,
    confirmedAmount,
    real: hasRealAmount ? confirmedAmount : 0,
    difference: Math.abs(rawDifference) < 0.000001 ? 0 : rawDifference,
    treasuryBalance: isCash ? confirmedAmount : confirmedAmount - outflows,
    finalBalance: hasRealAmount ? (isCash ? confirmedAmount : confirmedAmount - outflows) : treasuryExpectedBalance,
  };
}

export function requiresPaymentMethodConfirmation({ method = "", registered = 0, outflows = 0 } = {}) {
  const hasCollections = Math.abs(Number(registered || 0)) > 0.009;
  const hasCashOutflows = normalizeCommissionPaymentMethod(method) === "Efectivo"
    && Math.abs(Number(outflows || 0)) > 0.009;
  return hasCollections || hasCashOutflows;
}

export function findPotentialCommissionExpenseDuplicates(expenses = [], paidCommissions = []) {
  return paidCommissions.flatMap((commission) => {
    const paymentDate = commissionPaymentDate(commission);
    const amount = Number(commission.commissionAmount || 0);
    if (!paymentDate || amount <= 0) return [];

    return expenses
      .filter((expense) => {
        const description = normalizedText(`${expense.category || ""} ${expense.concept || ""}`);
        return expense.date === paymentDate
          && Math.abs(Number(expense.amount || 0) - amount) < 0.005
          && description.includes("comision");
      })
      .map((expense) => ({ commission, expense }));
  });
}
