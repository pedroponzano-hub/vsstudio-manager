const METRICS = new Set(["sales", "operations", "services", "average-ticket", "clients", "expenses", "result-estimated", "pending-commissions", "paid-commissions", "new-clients", "recurring-clients"]);
const PERIODS = new Set(["today", "week", "month", "previousMonth", "custom"]);

function validDate(value = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

export function buildDashboardDetailUrl(metric, context = {}) {
  if (!METRICS.has(metric)) return "";
  const params = new URLSearchParams({
    metric,
    from: validDate(context.bounds?.from),
    to: validDate(context.bounds?.to),
  });
  if (PERIODS.has(context.period)) params.set("period", context.period);
  if (context.professional && context.professional !== "all") params.set("professionalId", context.professional);
  if (context.category && context.category !== "all") params.set("category", context.category);
  return `/manager/dashboard/detail?${params.toString()}`;
}

export function parseDashboardDetailSearch(search = "") {
  const params = new URLSearchParams(search);
  const metric = params.get("metric") || "sales";
  return {
    metric: METRICS.has(metric) ? metric : "sales",
    bounds: {
      from: validDate(params.get("from") || ""),
      to: validDate(params.get("to") || ""),
    },
    period: PERIODS.has(params.get("period")) ? params.get("period") : "custom",
    professional: params.get("professionalId") || params.get("professional") || "all",
    category: params.get("category") || "all",
  };
}

export function dashboardDetailRows(dashboard = {}, metric = "sales") {
  if (metric === "expenses") return dashboard.expenses || [];
  if (metric === "services") return dashboard.serviceLines || [];
  if (metric === "result-estimated") return [
    { id: "net-income", concept: "Ingresos netos tras comisiones e impuestos", amount: Number(dashboard.resultBreakdown?.netIncomeAfterCommissions || 0) },
    { id: "expenses", concept: "Gastos del periodo", amount: -Number(dashboard.resultBreakdown?.expenses || 0) },
  ];
  if (metric === "pending-commissions") return dashboard.pendingCommissions || [];
  if (metric === "paid-commissions") return dashboard.paidCommissions || [];
  if (metric === "clients") return dashboard.clientsInSales || [];
  if (metric === "new-clients") return dashboard.newClients || [];
  if (metric === "recurring-clients") return dashboard.recurringClients || [];
  return dashboard.sales || [];
}

export function dashboardDetailTotal(rows = [], metric = "sales") {
  if (["clients", "new-clients", "recurring-clients", "operations"].includes(metric)) return rows.length;
  if (metric === "services") return rows.reduce((sum, row) => sum + Number(row.quantity || 1), 0);
  if (metric === "average-ticket") return rows.length ? rows.reduce((sum, row) => sum + Number(row.total ?? row.amount ?? 0), 0) / rows.length : 0;
  const field = metric === "expenses" ? "amount" : metric.includes("commissions") ? "commissionAmount" : "total";
  return rows.reduce((sum, row) => sum + Number(row[field] ?? (field === "total" ? row.amount : 0) ?? 0), 0);
}
