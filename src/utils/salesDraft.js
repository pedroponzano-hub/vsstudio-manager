export function newSaleDraftHasData({ clientId = "", clientQuery = "", employee = "", payments = [], services = [] } = {}) {
  return Boolean(
    services.length
    || String(clientId).trim()
    || String(clientQuery).trim()
    || String(employee).trim()
    || payments.some((payment) => String(payment.method || "").trim() || Number(payment.amount || 0) > 0),
  );
}

export function discardUnsavedSale({ onDiscard, resetDraft } = {}) {
  resetDraft?.();
  onDiscard?.();
}

export function startSaleDraftTimestamp(currentTimestamp = "", nowTimestamp = "") {
  return String(currentTimestamp || "").trim() || String(nowTimestamp || "").trim();
}
