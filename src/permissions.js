const permissionsByRole = {
  admin: {
    tabs: ["dashboard", "sales", "expenses", "commissions", "clients", "loyalty", "agenda", "statistics", "finance", "cashClosing", "settings"],
    actions: ["manageSales", "manageExpenses", "manageClients", "manageAppointments", "manageCommissions", "manageSettings", "manageServices", "restoreData", "importClients", "viewFinance", "manageCashClosing"],
  },
  direccion: {
    tabs: ["dashboard", "sales", "expenses", "clients", "loyalty", "agenda", "cashClosing", "commissions", "salesHistory"],
    actions: ["manageSales", "manageExpenses", "manageClients", "manageAppointments", "manageServices", "manageCashClosing"],
  },
  recepcion: {
    tabs: ["sales", "clients", "loyalty", "agenda", "cashClosing"],
    actions: ["manageSales", "manageClients", "manageAppointments", "manageCashClosing"],
  },
  operador_centro: {
    tabs: ["dashboard", "sales", "clients", "loyalty", "agenda", "cashClosing"],
    actions: ["manageSales", "manageClients", "manageAppointments", "manageCashClosing"],
  },
  caja: {
    tabs: ["sales", "expenses", "cashClosing"],
    actions: ["manageSales", "manageExpenses", "manageCashClosing"],
  },
  profesional: {
    tabs: ["professionalAgenda", "professionalCommissions"],
    actions: ["viewOwnAgenda", "viewOwnCommissions"],
    ownEmployeeOnly: true,
  },
};

const userRoleOverrides = {};

function effectiveRoleForUser(user) {
  const email = String(user?.email || "").trim().toLowerCase();
  return String(userRoleOverrides[email] || user?.role || "profesional").trim().toLowerCase();
}

function rolePermissions(role) {
  const normalizedRole = String(role || "").trim().toLowerCase();
  return permissionsByRole[normalizedRole] || permissionsByRole.profesional;
}

function allowedTabsForRole(role) {
  return rolePermissions(role).tabs;
}

function canAccessTab(role, tabId) {
  return allowedTabsForRole(role).includes(tabId);
}

function canPerform(role, action) {
  return rolePermissions(role).actions.includes(action);
}

function isOwnEmployeeOnly(role) {
  return Boolean(rolePermissions(role).ownEmployeeOnly);
}

function employeeNameForUser(user) {
  return String(user?.professionalName || user?.employeeName || user?.nombre || "").trim().toLowerCase();
}

function professionalIdForUser(user) {
  return String(user?.professionalId || user?.employeeId || "").trim().toLowerCase();
}

function professionalMatchesItem(item, user) {
  const professionalId = professionalIdForUser(user);
  const itemProfessionalId = String(item?.professionalId || item?.employeeId || item?.empleadaId || "").trim().toLowerCase();
  if (professionalId && itemProfessionalId && professionalId === itemProfessionalId) return true;

  const employeeName = employeeNameForUser(user);
  const itemEmployeeName = String(item?.professionalName || item?.employeeName || item?.employee || item?.empleada || "").trim().toLowerCase();
  return Boolean(employeeName && itemEmployeeName && employeeName === itemEmployeeName);
}

function onlyOwnEmployeeItems(items, user) {
  return (items || []).filter((item) => professionalMatchesItem(item, user));
}

export {
  allowedTabsForRole,
  canAccessTab,
  canPerform,
  effectiveRoleForUser,
  employeeNameForUser,
  isOwnEmployeeOnly,
  onlyOwnEmployeeItems,
  professionalMatchesItem,
};
