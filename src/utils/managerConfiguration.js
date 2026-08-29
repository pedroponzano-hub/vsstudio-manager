import { normalizeProfessionalCommissionPolicy } from "./commissionSchedule.js";

export function normalizeRealEmployeeSettings(config = {}) {
  const settings = Array.isArray(config.employeeSettings) ? config.employeeSettings : [];
  const names = [...(config.employees || []), ...settings.map((employee) => employee.name)].filter(Boolean);
  return Array.from(new Set(names.map((name) => String(name).trim()).filter(Boolean))).map((name) => {
    const existing = settings.find((employee) => String(employee.name || "").trim().toLowerCase() === name.toLowerCase()) || {};
    const normalizedEmployee = {
      ...existing,
      id: existing.id || `employee-${name.toLowerCase().replace(/\s+/g, "-")}`,
      name,
      active: existing.active !== false,
      commissionPercent: Number(existing.commissionPercent || 0),
      commissionHistory: Array.isArray(existing.commissionHistory) ? existing.commissionHistory : [],
      professionalHistory: Array.isArray(existing.professionalHistory) ? existing.professionalHistory : [],
    };
    const policy = normalizeProfessionalCommissionPolicy(normalizedEmployee);
    return {
      ...normalizedEmployee,
      commissionMode: policy.commissionMode,
      commissionSchedule: policy.commissionSchedule,
      economics: {
        ...(normalizedEmployee.economics || {}),
        defaultServiceCommissionPercent: policy.defaultCommissionPercent,
        commissionMode: policy.commissionMode,
        commissionSchedule: policy.commissionSchedule,
        outsideSchedule: policy.outsideSchedule,
      },
    };
  });
}

export function isProductCatalogItem(item = {}) {
  const text = `${item.type || ""} ${item.category || ""} ${item.name || ""}`.toLowerCase();
  return item.isProduct === true || item.type === "product" || text.includes("producto") || text.includes("retail");
}

export function historicalReferenceExists(sales = [], item = {}) {
  if (!item.id && !item.name) return false;
  return sales.some((sale) => {
    const serialized = JSON.stringify(sale);
    return Boolean((item.id && serialized.includes(item.id)) || (item.name && serialized.includes(item.name)));
  });
}
