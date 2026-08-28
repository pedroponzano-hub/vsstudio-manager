const ROLE_PERMISSIONS = Object.freeze({
  profesional: ["agenda.own", "commissions.own"],
  recepcion: ["agenda.create", "agenda.edit", "sales.charge", "clients.view"],
  operador_centro: ["agenda.all", "sales.today", "clients.manage", "cashClosing"],
  caja: ["sales.charge", "expenses", "cashClosing"],
  direccion: ["agenda.all", "sales.today", "clients.manage", "expenses", "cashClosing", "commissions"],
});

const ROLE_ALIASES = Object.freeze({
  admin: "admin",
  administrador: "admin",
  administradora: "admin",
  profesional: "profesional",
  professional: "profesional",
  recepcion: "recepcion",
  "recepción": "recepcion",
  operador: "operador_centro",
  operador_centro: "operador_centro",
  encargada: "operador_centro",
  caja: "caja",
  direccion: "direccion",
  "dirección": "direccion",
});

export class ProfessionalAccessError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProfessionalAccessError";
    this.code = code;
  }
}

export function normalizeAccessEmail(value = "") {
  return String(value).trim().toLowerCase();
}

export function normalizeAccessRole(value = "") {
  return ROLE_ALIASES[String(value).trim().toLowerCase()] || "";
}

export function permissionsForRole(role) {
  return [...(ROLE_PERMISSIONS[normalizeAccessRole(role)] || [])];
}

export function isAuthorizedAdminProfile(profile = {}, token = {}) {
  const profileIsAdmin = profile.active !== false && normalizeAccessRole(profile.role) === "admin";
  const claimIsAdmin = token.admin === true || String(token.role || "").trim().toLowerCase() === "admin";
  return Boolean(profileIsAdmin && claimIsAdmin);
}

export function validateProfessionalAccessInput(input = {}) {
  const professionalId = String(input.professionalId || "").trim();
  const email = normalizeAccessEmail(input.email);
  const role = normalizeAccessRole(input.role);
  const requestedPermissions = Array.isArray(input.permissions) ? input.permissions : permissionsForRole(role);
  const permissions = [...new Set(requestedPermissions.map((item) => String(item).trim()).filter(Boolean))];

  if (!professionalId) throw new ProfessionalAccessError("invalid-argument", "El profesional es obligatorio.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ProfessionalAccessError("invalid-argument", "Introduce un correo electrónico válido.");
  }
  if (!role || !ROLE_PERMISSIONS[role]) {
    throw new ProfessionalAccessError("invalid-argument", "El rol seleccionado no está permitido.");
  }

  const allowedPermissions = new Set(ROLE_PERMISSIONS[role]);
  if (permissions.some((permission) => !allowedPermissions.has(permission))) {
    throw new ProfessionalAccessError("permission-denied", "Los permisos no corresponden al rol seleccionado.");
  }

  return { professionalId, email, role, permissions };
}

export function buildCanonicalUserProfile({ authUser, existingProfile = {}, input, actor, now }) {
  const createdAt = existingProfile.createdAt || now;
  const createdBy = existingProfile.createdBy || actor.uid;
  return {
    ...existingProfile,
    uid: authUser.uid,
    email: normalizeAccessEmail(authUser.email || input.email),
    role: input.role,
    professionalId: input.professionalId,
    permissions: [...input.permissions],
    active: true,
    createdAt,
    createdBy,
    updatedAt: now,
    updatedBy: actor.uid,
  };
}

function linkedProfessionalId(profile = {}) {
  const source = profile || {};
  return String(source.professionalId || source.employeeId || source.empleadaId || "").trim();
}

export async function createOrLinkProfessionalUserCore({ input, actor, adapters, now = new Date().toISOString() }) {
  const normalizedInput = validateProfessionalAccessInput(input);
  const professional = await adapters.getProfessional(normalizedInput.professionalId);
  if (!professional) throw new ProfessionalAccessError("not-found", "El profesional no existe.");

  const authUser = await adapters.findAuthUserByEmail(normalizedInput.email);
  const profileByEmail = authUser
    ? await adapters.findProfileByUid(authUser.uid) || await adapters.findProfileByEmail(normalizedInput.email)
    : await adapters.findProfileByEmail(normalizedInput.email);
  const profileByProfessional = await adapters.findProfileByProfessionalId(normalizedInput.professionalId);

  const emailProfileProfessionalId = linkedProfessionalId(profileByEmail);
  if (emailProfileProfessionalId && emailProfileProfessionalId !== normalizedInput.professionalId) {
    throw new ProfessionalAccessError("already-exists", "El correo ya está vinculado a otro profesional.");
  }

  if (profileByProfessional) {
    const linkedUid = String(profileByProfessional.uid || profileByProfessional.id || "");
    const linkedEmail = normalizeAccessEmail(profileByProfessional.email);
    if ((authUser && linkedUid && linkedUid !== authUser.uid) || (!authUser && linkedEmail && linkedEmail !== normalizedInput.email)) {
      throw new ProfessionalAccessError("already-exists", "El profesional ya tiene otro usuario vinculado.");
    }
  }

  let resolvedAuthUser = authUser;
  let created = false;
  if (!resolvedAuthUser) {
    const creationResult = await adapters.createAuthUser({
      email: normalizedInput.email,
      displayName: professional.displayName || professional.name || normalizedInput.email,
    });
    resolvedAuthUser = creationResult.user || creationResult;
    created = creationResult.created !== false;
  }

  const existingProfile = await adapters.findProfileByUid(resolvedAuthUser.uid)
    || profileByEmail
    || profileByProfessional
    || {};
  const existingProfessionalId = linkedProfessionalId(existingProfile);
  if (existingProfessionalId && existingProfessionalId !== normalizedInput.professionalId) {
    throw new ProfessionalAccessError("already-exists", "El usuario ya está vinculado a otro profesional.");
  }

  const profile = buildCanonicalUserProfile({
    authUser: resolvedAuthUser,
    existingProfile,
    input: normalizedInput,
    actor,
    now,
  });

  await adapters.setAuthDisabled(resolvedAuthUser.uid, false);
  await adapters.setAuthClaims(resolvedAuthUser.uid, {
    domiaAccess: true,
    role: normalizedInput.role,
    professionalId: normalizedInput.professionalId,
  });
  await adapters.saveUserProfile(resolvedAuthUser.uid, profile);

  return {
    created,
    requiresPasswordSetup: created,
    access: {
      uid: resolvedAuthUser.uid,
      email: profile.email,
      role: profile.role,
      professionalId: profile.professionalId,
      permissions: profile.permissions,
      active: true,
      status: created ? "pending" : "active",
    },
  };
}

export async function setProfessionalUserAccessStateCore({ input, actor, adapters, now = new Date().toISOString() }) {
  const professionalId = String(input?.professionalId || "").trim();
  const active = input?.active;
  if (!professionalId || typeof active !== "boolean") {
    throw new ProfessionalAccessError("invalid-argument", "Profesional y estado son obligatorios.");
  }

  const professional = await adapters.getProfessional(professionalId);
  if (!professional) throw new ProfessionalAccessError("not-found", "El profesional no existe.");
  const profile = await adapters.findProfileByProfessionalId(professionalId);
  if (!profile?.uid) throw new ProfessionalAccessError("not-found", "El profesional no tiene un usuario vinculado.");

  const nextProfile = {
    ...profile,
    active,
    updatedAt: now,
    updatedBy: actor.uid,
  };
  await adapters.setAuthDisabled(profile.uid, !active);
  await adapters.saveUserProfile(profile.uid, nextProfile);

  return {
    access: {
      uid: profile.uid,
      email: normalizeAccessEmail(profile.email),
      role: normalizeAccessRole(profile.role),
      professionalId,
      permissions: Array.isArray(profile.permissions) ? profile.permissions : permissionsForRole(profile.role),
      active,
      status: active ? "active" : "disabled",
    },
  };
}

export { ROLE_PERMISSIONS };
