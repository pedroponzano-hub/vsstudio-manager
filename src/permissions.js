const permissionsByRole = {
  admin: {
    tabs: ["dashboard", "sales", "expenses", "commissions", "clients", "loyalty", "agenda", "statistics", "finance", "cashClosing", "settings"],
    actions: ["manageSales", "manageExpenses", "manageClients", "manageAppointments", "manageCommissions", "manageSettings", "manageServices", "restoreData", "importClients", "viewFinance", "manageCashClosing"],
  },
  direccion: {
    tabs: ["dashboard", "sales", "expenses", "clients", "loyalty", "agenda", "cashClosing"],
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
  profesional: {
    tabs: ["agenda", "commissions", "clients"],
    actions: ["manageOwnAppointments", "viewOwnCommissions", "readClients"],
    ownEmployeeOnly: true,
  },
};

const userRoleOverrides = {};

function effectiveRoleForUser(user) {
  const email = String(user?.email || "").trim().toLowerCase();
  return userRoleOverrides[email] || user?.role || "profesional";
}

function rolePermissions(role) {
  return permissionsByRole[role] || permissionsByRole.profesional;
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
  return String(user?.employeeName || user?.nombre || "").trim().toLowerCase();
}

function onlyOwnEmployeeItems(items, user) {
  const employeeName = employeeNameForUser(user);
  if (!employeeName) return [];
  return (items || []).filter((item) => String(item.employee || "").trim().toLowerCase() === employeeName);
}

export {
  allowedTabsForRole,
  canAccessTab,
  canPerform,
  effectiveRoleForUser,
  employeeNameForUser,
  isOwnEmployeeOnly,
  onlyOwnEmployeeItems,
};
