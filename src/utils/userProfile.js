export function normalizeProfileEmail(value = "") {
  return String(value).trim().toLowerCase();
}

export function normalizeUserProfile(profile = {}, firebaseUser = {}, tokenClaims = {}) {
  const role = String(tokenClaims.role || (tokenClaims.admin === true ? "admin" : "") || profile.role || "profesional").trim().toLowerCase();
  const permissions = Array.isArray(profile.permissions)
    ? [...new Set(profile.permissions.map((permission) => String(permission).trim()).filter(Boolean))]
    : Array.isArray(profile.access?.permissions)
      ? [...new Set(profile.access.permissions.map((permission) => String(permission).trim()).filter(Boolean))]
      : [];

  return {
    uid: firebaseUser.uid || profile.uid || profile.id || "",
    id: profile.id || firebaseUser.uid || profile.uid || "",
    email: normalizeProfileEmail(profile.email || firebaseUser.email),
    nombre: profile.nombre || profile.name || firebaseUser.displayName || firebaseUser.email || "Usuario",
    professionalId: tokenClaims.professionalId || profile.professionalId || profile.employeeId || profile.empleadaId || "",
    professionalName: profile.professionalName || profile.employeeName || profile.empleada || profile.nombre || profile.name || "",
    employeeName: profile.professionalName || profile.employeeName || profile.empleada || profile.nombre || profile.name || "",
    role,
    permissions,
    active: profile.active !== false,
    companyId: profile.companyId || null,
  };
}
