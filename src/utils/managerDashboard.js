const PAYMENT_METHODS = ["Efectivo", "Tarjeta", "Bizum", "Transferencia", "Treatwell", "Bono / tarjeta regalo", "Otros"];

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalized(value = "") {
  return String(value).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function operationalDate(item = {}) {
  return item.saleDate || item.fechaOperativa || item.operationalDate || item.date || item.fecha || String(item.createdAt || "").slice(0, 10);
}

export function normalizePaymentMethod(method = "") {
  const value = normalized(method);
  if (value.includes("efectivo")) return "Efectivo";
  if (value.includes("treatwell")) return "Treatwell";
  if (value.includes("bizum")) return "Bizum";
  if (value.includes("transfer")) return "Transferencia";
  if (value.includes("bono") || value.includes("regalo")) return "Bono / tarjeta regalo";
  if (value.includes("tarjeta")) return "Tarjeta";
  return "Otros";
}

export function isCollectedSale(sale = {}) {
  const status = normalized(sale.status || sale.estado || sale.estadoVenta || "cobrado");
  return !["pendiente_pago", "cancelado", "anulada", "servicio_interno"].includes(status);
}

export function saleServices(sale = []) {
  if (Array.isArray(sale.services) && sale.services.length) return sale.services;
  if (sale.service || sale.serviceName) return [{
    serviceId: sale.serviceId || "",
    serviceName: sale.serviceName || sale.service,
    category: sale.category || sale.serviceCategory || "Sin categoría",
    quantity: 1,
    price: number(sale.total || sale.amount),
  }];
  return [];
}

export function saleAmount(sale = {}) {
  return number(sale.total ?? sale.amount);
}

function salePayments(sale = {}) {
  if (Array.isArray(sale.payments) && sale.payments.length) return sale.payments;
  return sale.paymentMethod ? [{ method: sale.paymentMethod, amount: saleAmount(sale) }] : [];
}

function shiftDate(dateString, days) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthBounds(dateString, monthOffset = 0) {
  const date = new Date(`${dateString}T12:00:00`);
  const first = new Date(date.getFullYear(), date.getMonth() + monthOffset, 1, 12);
  const last = new Date(date.getFullYear(), date.getMonth() + monthOffset + 1, 0, 12);
  const format = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  return { from: format(first), to: format(last) };
}

export function periodBounds(period, today, custom = {}) {
  if (period === "today") return { from: today, to: today };
  if (period === "week") {
    const weekday = new Date(`${today}T12:00:00`).getDay() || 7;
    return { from: shiftDate(today, 1 - weekday), to: today };
  }
  if (period === "previousMonth") return monthBounds(today, -1);
  if (period === "custom") {
    const from = custom.from || today;
    const to = custom.to || from;
    return to < from ? { from: to, to: from } : { from, to };
  }
  return monthBounds(today, 0);
}

export function periodLabel(period, bounds) {
  const labels = { today: "Hoy", week: "Esta semana", month: "Este mes", previousMonth: "Mes anterior", custom: "Rango personalizado" };
  const formatter = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" });
  const from = formatter.format(new Date(`${bounds.from}T12:00:00`));
  const to = formatter.format(new Date(`${bounds.to}T12:00:00`));
  return `${labels[period] || labels.month} · ${from}${bounds.from === bounds.to ? "" : ` – ${to}`}`;
}

function inRange(item, bounds) {
  const date = operationalDate(item);
  return Boolean(date && date >= bounds.from && date <= bounds.to);
}

function serviceCatalogMap(config = {}) {
  return new Map((config.services || []).map((service) => [service.id, service]));
}

function resolvedServices(sale, catalog) {
  return saleServices(sale).map((service) => {
    const catalogService = catalog.get(service.serviceId || service.id) || {};
    return { ...catalogService, ...service, category: service.category || catalogService.category || "Sin categoría" };
  });
}

function matchesProfessional(sale, professional, config = {}) {
  if (!professional || professional === "all") return true;
  const configured = (config.employeeSettings || []).find((item) => item.id === professional || item.professionalId === professional);
  const names = [professional, configured?.name, configured?.displayName].filter(Boolean);
  return sale.professionalId === professional || sale.employeeId === professional || names.includes(sale.employee) || names.includes(sale.professionalName);
}

function matchesCategory(sale, category, catalog) {
  if (!category || category === "all") return true;
  return resolvedServices(sale, catalog).some((service) => service.category === category);
}

function groupSeries(sales, bounds, period) {
  const byHour = period === "today";
  const groups = new Map();
  sales.forEach((sale) => {
    const date = operationalDate(sale);
    const hour = String(sale.horaCierreLocal || sale.horaCreacionLocal || sale.time || sale.hora || "00:00").slice(0, 2);
    const key = byHour ? `${hour}:00` : date;
    const current = groups.get(key) || { key, amount: 0, count: 0 };
    current.amount += saleAmount(sale);
    current.count += 1;
    groups.set(key, current);
  });
  if (byHour) return Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
  const rows = [];
  for (let date = bounds.from; date <= bounds.to; date = shiftDate(date, 1)) {
    rows.push(groups.get(date) || { key: date, amount: 0, count: 0 });
  }
  return rows;
}

function commissionDate(row = {}) {
  return row.generationDate || row.fechaGeneracion || row.saleDate || row.fechaOperativa || row.date || "";
}

function commissionPaymentDate(row = {}) {
  return row.paymentDate || row.fechaPago || row.fechaPagoComision || row.commissionPaymentDate || "";
}

export function deriveManagerDashboard(source = {}, options = {}) {
  const { bounds, period = "month", professional = "all", category = "all" } = options;
  const catalog = serviceCatalogMap(source.config);
  const allSales = source.sales || [];
  const sales = allSales.filter(isCollectedSale).filter((sale) => inRange(sale, bounds)).filter((sale) => matchesProfessional(sale, professional, source.config)).filter((sale) => matchesCategory(sale, category, catalog));
  const expenses = (source.expenses || []).filter((expense) => inRange(expense, bounds));
  const pendingSales = allSales.filter((sale) => normalized(sale.status || sale.estadoVenta) === "pendiente_pago" && inRange(sale, bounds));
  const salesById = new Map(allSales.map((sale) => [sale.id, sale]));
  const commissions = (source.commissionRows || []).filter((row) => {
    const linkedSale = salesById.get(row.saleId || row.id) || row;
    return (matchesProfessional(row, professional, source.config) || matchesProfessional(linkedSale, professional, source.config)) && matchesCategory(linkedSale, category, catalog);
  });
  const totalSales = sales.reduce((sum, sale) => sum + saleAmount(sale), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + number(expense.amount), 0);
  const servicesCount = sales.reduce((sum, sale) => sum + resolvedServices(sale, catalog).reduce((serviceSum, service) => serviceSum + number(service.quantity || 1), 0), 0);
  const commissionGenerated = sales.reduce((sum, sale) => sum + number(sale.commissionAmount), 0);
  const hasDimensionFilter = professional !== "all" || category !== "all";
  const netIncomeAfterCommissions = sales.reduce((sum, sale) => sum + number(sale.netAfterCommission ?? sale.netWithoutVat ?? saleAmount(sale) - number(sale.commissionAmount)), 0);
  const resultEstimated = hasDimensionFilter ? null : netIncomeAfterCommissions - totalExpenses;
  const clientIds = new Set(sales.map((sale) => sale.clientId).filter(Boolean));
  const clientSaleCounts = sales.reduce((counts, sale) => {
    if (sale.clientId) counts[sale.clientId] = (counts[sale.clientId] || 0) + 1;
    return counts;
  }, {});
  const clientsCreatedInPeriod = (source.clients || []).filter((client) => {
    const date = String(client.createdAt || client.firstVisit || client.createdDate || "").slice(0, 10);
    return date && date >= bounds.from && date <= bounds.to;
  });
  const newClients = hasDimensionFilter ? clientsCreatedInPeriod.filter((client) => clientIds.has(client.id)) : clientsCreatedInPeriod;
  const recurringClientIds = new Set(Object.entries(clientSaleCounts).filter(([, count]) => count > 1).map(([clientId]) => clientId));
  const clientsById = new Map((source.clients || []).map((client) => [client.id, client]));
  const clientFromSale = (clientId) => {
    const sale = sales.find((item) => item.clientId === clientId);
    return clientsById.get(clientId) || { id: clientId, name: sale?.clientName || "Cliente" };
  };
  const recurringClients = Array.from(recurringClientIds).map(clientFromSale);
  const clientsInSales = Array.from(clientIds).map(clientFromSale);
  const paymentMethods = Object.fromEntries(PAYMENT_METHODS.map((method) => [method, 0]));
  sales.flatMap(salePayments).forEach((payment) => {
    const method = normalizePaymentMethod(payment.method || payment.paymentMethod);
    paymentMethods[method] += number(payment.amount);
  });

  const byCategory = {};
  const byService = {};
  const byProfessional = {};
  const serviceLines = [];
  sales.forEach((sale) => {
    const amount = saleAmount(sale);
    const services = resolvedServices(sale, catalog);
    const quantity = services.reduce((sum, service) => sum + number(service.quantity || 1), 0) || 1;
    services.forEach((service) => {
      const units = number(service.quantity || 1);
      const serviceAmount = number(service.total ?? service.amount ?? service.price * units) || amount * (units / quantity);
      const serviceName = service.serviceName || service.name || "Sin servicio";
      serviceLines.push({
        id: `${sale.id || operationalDate(sale)}-${service.serviceId || serviceName}`,
        saleId: sale.id || "",
        date: operationalDate(sale),
        clientId: sale.clientId || "",
        clientName: sale.clientName || "Cliente mostrador",
        professionalId: sale.professionalId || sale.employeeId || "",
        professionalName: sale.employee || sale.professionalName || "Sin profesional",
        serviceName,
        category: service.category || "Sin categoría",
        quantity: units,
        amount: serviceAmount,
      });
      const serviceRow = byService[serviceName] || { name: serviceName, units: 0, amount: 0 };
      serviceRow.units += units;
      serviceRow.amount += serviceAmount;
      byService[serviceName] = serviceRow;
      const categoryName = service.category || "Sin categoría";
      const categoryRow = byCategory[categoryName] || { name: categoryName, units: 0, amount: 0 };
      categoryRow.units += units;
      categoryRow.amount += serviceAmount;
      byCategory[categoryName] = categoryRow;
    });
    const professionalName = sale.employee || sale.professionalName || "Sin profesional";
    const row = byProfessional[professionalName] || { name: professionalName, sales: 0, services: 0, commission: 0, operations: 0 };
    row.sales += amount;
    row.services += quantity;
    row.commission += number(sale.commissionAmount);
    row.operations += 1;
    byProfessional[professionalName] = row;
  });

  const pendingCommissions = commissions.filter((row) => {
    const date = commissionDate(row);
    return normalized(row.status || row.commissionStatus) !== "pagada" && date >= bounds.from && date <= bounds.to;
  });
  const paidCommissions = commissions.filter((row) => {
    const date = commissionPaymentDate(row);
    return normalized(row.status || row.commissionStatus) === "pagada" && date >= bounds.from && date <= bounds.to;
  });
  const closings = (source.cashClosings || []).filter((closing) => inRange(closing, bounds)).sort((a, b) => operationalDate(b).localeCompare(operationalDate(a)));
  const closingsWithDifference = closings.filter((closing) => Math.abs(number(closing.totalDifference ?? closing.summary?.totalDifference)) >= 0.01);
  const pendingExpenses = expenses.filter((expense) => normalized(expense.status) === "pendiente");
  const alerts = [
    pendingCommissions.length ? { type: "warning", label: `${pendingCommissions.length} comisiones pendientes`, target: "commissions" } : null,
    pendingSales.length ? { type: "warning", label: `${pendingSales.length} ventas pendientes de cobro`, target: "sales" } : null,
    pendingExpenses.length ? { type: "warning", label: `${pendingExpenses.length} gastos pendientes`, target: "expenses" } : null,
    closingsWithDifference.length ? { type: "danger", label: `${closingsWithDifference.length} cierres con diferencias`, target: "closing" } : null,
  ].filter(Boolean);

  return {
    metrics: {
      totalSales,
      salesCount: sales.length,
      servicesCount,
      averageTicket: sales.length ? totalSales / sales.length : 0,
      clients: clientIds.size,
      expenses: totalExpenses,
      resultEstimated,
      commissionGenerated,
      pendingCommissionAmount: pendingCommissions.reduce((sum, row) => sum + number(row.commissionAmount), 0),
      pendingCommissions: pendingCommissions.length,
      paidCommissions: paidCommissions.length,
      paidCommissionAmount: paidCommissions.reduce((sum, row) => sum + number(row.commissionAmount), 0),
      clientsNew: newClients.length,
      clientsRecurring: recurringClients.length,
    },
    sales,
    expenses,
    serviceLines,
    pendingCommissions,
    paidCommissions,
    clientsInSales,
    newClients,
    recurringClients,
    resultBreakdown: {
      grossCollections: totalSales,
      generatedCommissions: commissionGenerated,
      netIncomeAfterCommissions,
      expenses: totalExpenses,
      result: resultEstimated,
    },
    paymentMethods: Object.entries(paymentMethods).map(([name, amount]) => ({ name, amount })).filter((row) => row.amount > 0),
    salesSeries: groupSeries(sales, bounds, period),
    categories: Object.values(byCategory).sort((a, b) => b.amount - a.amount),
    services: Object.values(byService).sort((a, b) => b.units - a.units),
    professionals: Object.values(byProfessional).sort((a, b) => b.sales - a.sales).map((row) => ({ ...row, share: totalSales ? (row.sales / totalSales) * 100 : 0 })),
    alerts,
    latestClosing: closings[0] || null,
    hasDimensionFilter,
  };
}

export function managerFilterOptions(source = {}) {
  const professionals = (source.config?.employeeSettings || []).filter((item) => item.active !== false && item.offersServices !== false).map((item) => ({ value: item.id || item.professionalId || item.name || item.displayName, label: item.displayName || item.name })).filter((item) => item.label && item.value);
  const categories = Array.from(new Set((source.config?.services || []).filter((service) => service.active !== false).map((service) => service.category).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return { professionals, categories };
}

export { PAYMENT_METHODS };
