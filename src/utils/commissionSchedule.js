const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function cleanText(value = "") {
  return String(value ?? "").trim();
}

function normalized(value = "") {
  return cleanText(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function validTime(value = "") {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(cleanText(value));
}

function localDateTimeParts(value = "") {
  const match = cleanText(value).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  return match ? { date: match[1], time: match[2] } : { date: "", time: "" };
}

export function normalizeProfessionalCommissionPolicy(professional = {}) {
  const economics = professional.economics || {};
  const explicitMode = economics.commissionMode || professional.commissionMode;
  const commissionMode = ["always", "none", "mixed_schedule"].includes(explicitMode)
    ? explicitMode
    : "always";
  const defaultCommissionPercent = Number(
    economics.defaultServiceCommissionPercent ?? professional.commissionPercent ?? 0,
  );
  const rawSchedule = economics.commissionSchedule || professional.commissionSchedule || {};
  const commissionSchedule = Object.fromEntries(DAY_KEYS.map((dayKey) => {
    const entry = rawSchedule[dayKey] || {};
    return [dayKey, {
      enabled: Boolean(entry.enabled),
      start: validTime(entry.start) ? entry.start : "",
      end: validTime(entry.end) ? entry.end : "",
      commissionPercent: Number(entry.commissionPercent ?? 0),
    }];
  }));

  return {
    commissionMode,
    defaultCommissionPercent,
    commissionSchedule,
    commissionRuleEffectiveFrom: cleanText(
      economics.commissionRuleEffectiveFrom
      || economics.effectiveFrom
      || professional.commissionRuleEffectiveFrom,
    ),
    outsideSchedule: "standard",
  };
}

export function resolveCommissionServiceMoment(sale = {}, appointments = []) {
  const appointmentId = cleanText(sale.appointmentId);
  const appointment = appointmentId
    ? appointments.find((item) => cleanText(item.id) === appointmentId)
    : null;
  if (appointment?.date && (appointment.startTime || appointment.time)) {
    return {
      appointmentId,
      serviceDate: cleanText(appointment.date),
      serviceTime: cleanText(appointment.startTime || appointment.time).slice(0, 5),
      commissionSource: "appointment",
    };
  }

  if (appointmentId && sale.serviceDate && sale.serviceTime) {
    return {
      appointmentId,
      serviceDate: cleanText(sale.serviceDate),
      serviceTime: cleanText(sale.serviceTime).slice(0, 5),
      commissionSource: "appointment",
    };
  }

  if (sale.serviceDate && sale.serviceTime) {
    return {
      appointmentId,
      serviceDate: cleanText(sale.serviceDate),
      serviceTime: cleanText(sale.serviceTime).slice(0, 5),
      commissionSource: "service_time",
    };
  }

  const created = localDateTimeParts(
    sale.commissionCalculationTimestamp
    || sale.horaCreacion
    || sale.createdAt
    || sale.createdAtLocal,
  );
  return {
    appointmentId,
    serviceDate: created.date || cleanText(sale.saleDate || sale.fechaOperativa || sale.date),
    serviceTime: created.time || cleanText(sale.horaCreacionLocal || sale.createdTime).slice(0, 5),
    commissionSource: "sale_created_at_fallback",
  };
}

function dayKeyForDate(date = "") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? "" : DAY_KEYS[parsed.getDay()];
}

export function commissionRateForMoment(policy, serviceDate, serviceTime) {
  if (policy.commissionMode === "none") return { commissionRateApplied: 0, commissionRule: "no_commission" };
  if (policy.commissionMode !== "mixed_schedule") {
    return { commissionRateApplied: policy.defaultCommissionPercent, commissionRule: "standard" };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(policy.commissionRuleEffectiveFrom || "")) {
    return { commissionRateApplied: policy.defaultCommissionPercent, commissionRule: "standard" };
  }

  if (policy.commissionRuleEffectiveFrom && serviceDate < policy.commissionRuleEffectiveFrom) {
    return { commissionRateApplied: policy.defaultCommissionPercent, commissionRule: "standard" };
  }

  const schedule = policy.commissionSchedule[dayKeyForDate(serviceDate)];
  const insideSchedule = Boolean(
    schedule?.enabled
    && validTime(serviceTime)
    && schedule.start <= serviceTime
    && serviceTime < schedule.end,
  );
  return insideSchedule
    ? { commissionRateApplied: Number(schedule.commissionPercent || 0), commissionRule: "salaried_schedule" }
    : { commissionRateApplied: policy.defaultCommissionPercent, commissionRule: "standard" };
}

export function resolveSaleCommissionSnapshot(sale = {}, {
  appointments = [],
  professionals = [],
  appliedAt = new Date().toISOString(),
} = {}) {
  const professionalId = cleanText(sale.professionalId || sale.employeeId);
  const professionalName = cleanText(sale.professionalName || sale.employee);
  const professional = professionals.find((item) => professionalId && cleanText(item.id) === professionalId)
    || professionals.find((item) => normalized(item.displayName || item.name) === normalized(professionalName));
  const policy = normalizeProfessionalCommissionPolicy(professional || {
    name: professionalName,
    commissionPercent: sale.commissionPercent,
  });
  const moment = resolveCommissionServiceMoment(sale, appointments);
  const rate = commissionRateForMoment(policy, moment.serviceDate, moment.serviceTime);
  const total = Number(sale.total ?? sale.amount ?? 0);

  return {
    ...moment,
    ...rate,
    commissionPercent: rate.commissionRateApplied,
    commissionAmount: total * (rate.commissionRateApplied / 100),
    commissionAppliedAt: appliedAt,
    commissionRuleEffectiveFrom: policy.commissionRuleEffectiveFrom,
    commissionScheduleSnapshot: policy,
    commissionSnapshotLocked: true,
  };
}

export function commissionFieldsChanged(previous = {}, next = {}) {
  return ["commissionPercent", "commissionAmount", "serviceDate", "serviceTime", "appointmentId", "professionalId", "employee"]
    .some((field) => String(previous[field] ?? "") !== String(next[field] ?? ""));
}

export function assertCommissionEditReason(previous = {}, next = {}, reason = "") {
  if (commissionFieldsChanged(previous, next) && !cleanText(reason)) {
    throw new Error("Debes indicar el motivo de la corrección de comisión.");
  }
}

export function createCommissionAuditEntry({
  id,
  editedAt,
  editedBy,
  reason,
  previousValues,
  newValues,
  changes = [],
} = {}) {
  if (!cleanText(reason)) throw new Error("Debes indicar el motivo de la corrección de comisión.");
  return {
    id,
    editedAt,
    editedBy: cleanText(editedBy),
    reason: cleanText(reason),
    previousValues,
    newValues,
    changes,
  };
}

export function buildManualCommissionOverride(previous = {}, updates = {}, {
  appointments = [],
  professionals = [],
  appliedAt = new Date().toISOString(),
} = {}) {
  const next = { ...previous, ...updates };
  const automatic = resolveSaleCommissionSnapshot(next, { appointments, professionals, appliedAt });
  const rateWasExplicit = updates.commissionPercent !== undefined || updates.commissionRateApplied !== undefined;
  const amountWasExplicit = updates.commissionAmount !== undefined;
  const commissionPercent = Number(rateWasExplicit
    ? updates.commissionPercent ?? updates.commissionRateApplied
    : automatic.commissionRateApplied);
  const total = Number(next.total || 0);
  return {
    ...automatic,
    commissionPercent,
    commissionRateApplied: commissionPercent,
    commissionAmount: Number(amountWasExplicit ? updates.commissionAmount : total * (commissionPercent / 100)),
    commissionRule: "manual_override",
    commissionSnapshotLocked: true,
  };
}

export function filterOwnPositiveCommissions(rows = [], professionalId = "") {
  const safeProfessionalId = cleanText(professionalId).toLowerCase();
  if (!safeProfessionalId) return [];
  return rows.filter((row) => (
    cleanText(row.professionalId).toLowerCase() === safeProfessionalId
    && Number(row.commissionAmount || 0) > 0
  ));
}

export { DAY_KEYS };
