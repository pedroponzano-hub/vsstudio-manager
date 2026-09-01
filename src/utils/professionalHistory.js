function normalized(value = "") {
  return String(value).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function unique(values = []) {
  return [...new Set(values.map(normalized).filter(Boolean))];
}

export function resolveProfessionalIdentity(user = {}, professionals = []) {
  const safeUser = user || {};
  const requestedIds = unique([safeUser.professionalId, safeUser.employeeId, safeUser.empleadaId]);
  const requestedNames = unique([safeUser.professionalName, safeUser.employeeName, safeUser.empleada, safeUser.nombre, safeUser.name]);
  const activeProfessionals = (professionals || []).filter((professional) => professional && professional.active !== false);
  const byId = activeProfessionals.find((professional) => requestedIds.includes(normalized(professional.id || professional.professionalId)));
  const nameMatches = activeProfessionals.filter((professional) => requestedNames.includes(normalized(professional.name || professional.displayName || professional.professionalName)));
  const resolved = byId || (nameMatches.length === 1 ? nameMatches[0] : null);

  return {
    professionalId: String(resolved?.id || resolved?.professionalId || safeUser.professionalId || safeUser.employeeId || safeUser.empleadaId || "").trim(),
    displayName: String(resolved?.displayName || resolved?.name || safeUser.professionalName || safeUser.employeeName || safeUser.nombre || "").trim(),
    names: unique([
      resolved?.name,
      resolved?.displayName,
      resolved?.professionalName,
      safeUser.professionalName,
      safeUser.employeeName,
      safeUser.empleada,
      safeUser.nombre,
      safeUser.name,
    ]),
  };
}

export function professionalHistoryMatches(item = {}, identity = {}) {
  const expectedId = normalized(identity.professionalId);
  const itemIds = unique([
    item.professionalId,
    item.employeeId,
    item.empleadaId,
    item.professionalSnapshot?.professionalId,
    item.professionalSnapshot?.id,
  ]);

  if (itemIds.length > 0) return Boolean(expectedId && itemIds.includes(expectedId));

  const expectedNames = unique(identity.names || []);
  const itemNames = unique([
    item.professionalName,
    item.employeeName,
    item.employee,
    item.empleada,
    item.professionalSnapshot?.professionalName,
    item.professionalSnapshot?.name,
  ]);
  return expectedNames.length > 0 && itemNames.some((name) => expectedNames.includes(name));
}

export function filterOwnSales(rows = [], identity = {}) {
  return (rows || []).filter((row) => professionalHistoryMatches(row, identity));
}

export function filterOwnCommissions(rows = [], identity = {}) {
  return filterOwnSales(rows, identity).filter((row) => Number(row.commissionAmount || 0) > 0);
}

export function professionalBusinessDate(item = {}) {
  return item.saleDate || item.fechaOperativa || item.serviceDate || item.generationDate || item.fechaGeneracion || item.date || item.fecha || "";
}
