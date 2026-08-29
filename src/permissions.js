const permissionsByRole = {
  admin: {
    tabs: ["dashboard", "sales", "expenses", "commissions", "clients", "loyalty", "agenda", "statistics", "finance", "cashClosing", "settings"],
    actions: ["manageSales", "manageExpenses", "manageClients", "manageAppointments", "manageCommissions", "manageSettings", "manageServices", "restoreData", "importClients", "viewFinance", "manageCashClosing", "sales.create_backdated", "commissions.pay_bulk", "commissions.reverse_payment_batch"],
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
    tabs: ["professionalAgenda", "professionalSales", "professionalCommissions"],
    actions: ["viewOwnAgenda", "viewOwnSales", "viewOwnCommissions"],
    ownEmployeeOnly: true,
  },
};

const userRoleOverrides = {};
const emptyRolePermissions = { tabs: [], actions: [], ownEmployeeOnly: false };

function effectiveRoleForUser(user) {
  const email = String(user?.email || "").trim().toLowerCase();
  return String(userRoleOverrides[email] || user?.role || "profesional").trim().toLowerCase();
}

function rolePermissions(role) {
  const normalizedRole = String(role || "").trim().toLowerCase();
  return permissionsByRole[normalizedRole] || emptyRolePermissions;
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

function canAccessDashboardSection(role, section) {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (!canAccessTab(normalizedRole, "dashboard")) return false;
  return section !== "month" || normalizedRole !== "direccion";
}

function defaultPageForRole(role) {
  return String(role || "").trim().toLowerCase() === "direccion" ? "pos.agendaV2" : "";
}

function getDefaultRouteForUser(user = {}) {
  if (!user || user.active === false) return "/no-permissions";
  const role = effectiveRoleForUser(user);
  const tabs = allowedTabsForRole(role);
  if (role === "admin") return "/manager";
  if (role === "direccion") return "/pos/agenda-v2";
  if (tabs.includes("professionalAgenda")) return "/pos/my-agenda";
  if (tabs.includes("professionalCommissions")) return "/pos/my-commissions";

  const posTabs = ["sales", "expenses", "clients", "loyalty", "agenda", "cashClosing"];
  if (tabs.some((tab) => posTabs.includes(tab))) return "/pos";
  const managerTabs = ["dashboard", "finance", "statistics", "commissions", "settings"];
  if (tabs.some((tab) => managerTabs.includes(tab))) return "/manager";
  return "/no-permissions";
}

function canAccessRouteForUser(user = {}, pathname = "") {
  if (!user || user.active === false) return false;
  const role = effectiveRoleForUser(user);
  const tabs = allowedTabsForRole(role);
  const path = String(pathname || "/").toLowerCase();
  if (path === "/no-permissions" || path.startsWith("/no-permissions/")) return tabs.length === 0;
  if (path === "/pos/my-agenda" || path.startsWith("/pos/my-agenda/")) return tabs.includes("professionalAgenda");
  if (path === "/pos/my-sales" || path.startsWith("/pos/my-sales/")) return tabs.includes("professionalSales");
  if (path === "/pos/my-commissions" || path.startsWith("/pos/my-commissions/")) return tabs.includes("professionalCommissions");
  if (path === "/manager/dashboard/detail" || path.startsWith("/manager/dashboard/detail/")) return role === "admin";
  if (path === "/manager" || path.startsWith("/manager/")) {
    const managerTabs = ["dashboard", "finance", "statistics", "commissions", "settings"];
    return tabs.some((tab) => managerTabs.includes(tab));
  }
  if (path === "/pos" || path.startsWith("/pos/")) {
    const posTabs = ["sales", "expenses", "clients", "loyalty", "agenda", "cashClosing", "professionalAgenda", "professionalSales", "professionalCommissions"];
    return tabs.some((tab) => posTabs.includes(tab));
  }
  return false;
}

function resolveRouteForUser(user = {}, requestedPath = "") {
  return canAccessRouteForUser(user, requestedPath) ? requestedPath : getDefaultRouteForUser(user);
}

function accessDeniedMessageForRoute(user = {}, requestedPath = "") {
  if (canAccessRouteForUser(user, requestedPath)) return "";
  const path = String(requestedPath || "/").toLowerCase();
  if (path === "/manager" || path.startsWith("/manager/")) {
    return "No tienes permisos para acceder a Manager.";
  }
  return "No tienes permisos para acceder a esta sección.";
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
  accessDeniedMessageForRoute,
  allowedTabsForRole,
  canAccessRouteForUser,
  canAccessDashboardSection,
  canAccessTab,
  canPerform,
  defaultPageForRole,
  effectiveRoleForUser,
  employeeNameForUser,
  getDefaultRouteForUser,
  isOwnEmployeeOnly,
  onlyOwnEmployeeItems,
  professionalMatchesItem,
  resolveRouteForUser,
};
