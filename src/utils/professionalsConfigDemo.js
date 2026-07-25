import { DEMO_SERVICES, durationToMinutes, formatMinutes } from "./availabilityDemo.js";

export const PROFESSIONAL_DEMO_USER = "Pedro - Admin";

export const professionalDemoRoles = {
  Profesional: ["agenda.own", "agenda.manageOwnSchedule"],
  Recepción: ["agenda.create", "agenda.edit", "sales.charge", "clients.view"],
  Encargada: ["agenda.all", "sales.today", "cashClosing", "clients.manage"],
  Administradora: ["agenda.all", "sales.all", "clients.manage", "finance.view", "settings.professionals"],
  "Solo consulta": ["agenda.own", "clients.view"],
  Personalizado: [],
};

export const professionalPermissionGroups = {
  Agenda: [
    ["agenda.own", "Ver su propia agenda"],
    ["agenda.all", "Ver agendas de otras profesionales"],
    ["agenda.create", "Crear citas"],
    ["agenda.edit", "Editar citas"],
    ["agenda.cancel", "Cancelar citas"],
    ["agenda.status", "Cambiar estados"],
    ["agenda.clientFull", "Ver datos completos del cliente"],
    ["agenda.manageOwnSchedule", "Gestionar su horario"],
  ],
  Ventas: [
    ["sales.charge", "Cobrar citas"],
    ["sales.products", "Crear ventas de productos"],
    ["sales.today", "Ver ventas del día"],
    ["sales.history", "Ver historial"],
    ["sales.edit", "Editar ventas"],
    ["sales.discounts", "Aplicar descuentos"],
  ],
  Gestión: [
    ["clients.manage", "Clientes"],
    ["expenses", "Gastos"],
    ["cashClosing", "Cierre de caja"],
    ["commissions", "Comisiones"],
    ["finance.view", "Finanzas"],
    ["statistics", "Estadísticas"],
    ["settings", "Configuración"],
    ["settings.professionals", "Profesionales"],
    ["settings.services", "Servicios"],
  ],
};

export const demoServiceCategories = [
  "Manicura y pedicura",
  "Cejas",
  "Pestañas",
  "Facial",
  "Corporal",
  "Masajes",
  "Depilación",
  "Cursos",
  "Otros servicios",
];

export const professionalServiceCategoryOrder = demoServiceCategories;

export const LEGACY_DEMO_SERVICE_ID_TARGETS = {
  "mani-semi": ["Mujer - Manicura completa - Semipermanente", "Mujer - Manicura semipermanente completa"],
  "cejas-diseno": ["Mujer - Diseno y tinte de cejas", "Mujer - Diseno de cejas con cera"],
  "lifting-pestanas": ["Mujer - Lifting y tinte de pestanas"],
  "pedicura-completa": ["Mujer - Pedicura completa - Limpieza", "Mujer - Pedicura semipermanente"],
  "facial-demo": ["Limpieza facial profunda"],
  "masaje-demo": ["Masaje relajante"],
};

export const weekDaysDemo = [
  ["monday", "Lunes"],
  ["tuesday", "Martes"],
  ["wednesday", "Miércoles"],
  ["thursday", "Jueves"],
  ["friday", "Viernes"],
  ["saturday", "Sábado"],
  ["sunday", "Domingo"],
];

export const exceptionTypesDemo = [
  "Día libre",
  "Vacaciones",
  "Ausencia",
  "Formación",
  "Descanso",
  "Comida",
  "Bloqueo manual",
  "Horario especial",
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createProfessionalId() {
  return `professional-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function schedule(enabled, shifts = []) {
  return { enabled, shifts };
}

export function defaultWeeklySchedule(type = "full") {
  const full = {
    monday: schedule(true, [{ start: "10:00", end: "14:00" }, { start: "15:00", end: "20:00" }]),
    tuesday: schedule(true, [{ start: "10:00", end: "14:00" }, { start: "15:00", end: "20:00" }]),
    wednesday: schedule(true, [{ start: "10:00", end: "14:00" }, { start: "15:00", end: "20:00" }]),
    thursday: schedule(true, [{ start: "10:00", end: "14:00" }, { start: "15:00", end: "20:00" }]),
    friday: schedule(true, [{ start: "10:00", end: "14:00" }, { start: "15:00", end: "20:00" }]),
    saturday: schedule(true, [{ start: "10:00", end: "14:00" }]),
    sunday: schedule(false, []),
  };
  if (type === "morning") return { ...full, monday: schedule(true, [{ start: "09:00", end: "14:00" }]), tuesday: schedule(true, [{ start: "09:00", end: "14:00" }]), wednesday: schedule(true, [{ start: "09:00", end: "14:00" }]), thursday: schedule(true, [{ start: "09:00", end: "14:00" }]), friday: schedule(true, [{ start: "09:00", end: "14:00" }]) };
  if (type === "afternoon") return { ...full, monday: schedule(true, [{ start: "15:00", end: "20:00" }]), tuesday: schedule(true, [{ start: "15:00", end: "20:00" }]), wednesday: schedule(true, [{ start: "15:00", end: "20:00" }]), thursday: schedule(true, [{ start: "15:00", end: "20:00" }]), friday: schedule(true, [{ start: "15:00", end: "20:00" }]) };
  return full;
}

export function buildProfessional({
  id,
  firstName,
  lastName = "",
  displayName,
  email = "",
  phone = "",
  active = true,
  offersServices = true,
  employmentType = "Empleada",
  calendarColor = "#c9aa63",
  internalNotes = "",
  assignedServiceIds = [],
  weeklySchedule = defaultWeeklySchedule(),
  scheduleExceptions = [],
  access = { enabled: false, role: "Profesional", permissions: [] },
  economics = {},
  publicProfile = {},
}) {
  return {
    id: id || createProfessionalId(),
    firstName,
    lastName,
    displayName: displayName || firstName,
    email,
    phone,
    active,
    offersServices,
    employmentType,
    calendarColor,
    internalNotes,
    assignedServiceIds,
    professionalServiceSettings: assignedServiceIds.map((serviceId) => ({ serviceId, enabled: true, customDurationMinutes: "" })),
    weeklySchedule,
    scheduleExceptions,
    access: {
      enabled: Boolean(access.enabled),
      role: access.role || "Profesional",
      permissions: access.permissions || professionalDemoRoles[access.role || "Profesional"] || [],
    },
    economics: {
      defaultServiceCommissionPercent: Number(economics.defaultServiceCommissionPercent || 0),
      productCommissionPercent: Number(economics.productCommissionPercent || 0),
      hasFixedSalary: Boolean(economics.hasFixedSalary),
      serviceCommissionOverrides: economics.serviceCommissionOverrides || [],
      internalEconomicNotes: economics.internalEconomicNotes || "",
    },
    publicProfile: {
      publicName: publicProfile.publicName || displayName || firstName,
      professionalTitle: publicProfile.professionalTitle || "",
      shortBio: publicProfile.shortBio || "",
      visibleSpecialties: publicProfile.visibleSpecialties || [],
      photoDemo: publicProfile.photoDemo || "",
      visibleOnline: Boolean(publicProfile.visibleOnline),
      displayOrder: Number(publicProfile.displayOrder || 0),
    },
  };
}

export const initialProfessionalsDemo = [
  buildProfessional({ id: "prof-marianne", firstName: "Marianne", displayName: "Marianne", email: "marianne.demo@vsstudio.test", phone: "600 200 101", assignedServiceIds: ["mani-semi", "cejas-diseno", "lifting-pestanas"], calendarColor: "#3b82f6", access: { enabled: true, role: "Profesional" }, economics: { defaultServiceCommissionPercent: 40 }, publicProfile: { professionalTitle: "Especialista en uñas y mirada", visibleOnline: true, displayOrder: 1 } }),
  buildProfessional({ id: "prof-ambar", firstName: "Ámbar", displayName: "Ámbar", phone: "600 200 202", assignedServiceIds: ["mani-semi", "pedicura-completa"], weeklySchedule: defaultWeeklySchedule("morning"), calendarColor: "#f59e0b", economics: { defaultServiceCommissionPercent: 0 }, publicProfile: { professionalTitle: "Manicura y pedicura", visibleOnline: true, displayOrder: 2 } }),
  buildProfessional({ id: "prof-grace", firstName: "Grace", displayName: "Grace", email: "grace.demo@vsstudio.test", assignedServiceIds: ["lifting-pestanas", "cejas-diseno"], weeklySchedule: defaultWeeklySchedule("afternoon"), calendarColor: "#22c55e", access: { enabled: true, role: "Profesional" }, economics: { defaultServiceCommissionPercent: 35 }, publicProfile: { professionalTitle: "Pestañas y cejas", visibleOnline: true, displayOrder: 3 } }),
  buildProfessional({ id: "prof-leidys", firstName: "Leidys", displayName: "Leidys", assignedServiceIds: ["facial-demo", "masaje-demo"], calendarColor: "#a855f7", access: { enabled: false, role: "Solo consulta" }, economics: { defaultServiceCommissionPercent: 40 }, publicProfile: { professionalTitle: "Facial, corporal y masajes", visibleOnline: false, displayOrder: 4 } }),
  buildProfessional({ id: "prof-demo-inactiva", firstName: "Claudia", displayName: "Claudia demo", active: false, assignedServiceIds: ["masaje-demo"], calendarColor: "#94a3b8", scheduleExceptions: [{ id: "exception-demo-1", professionalId: "prof-demo-inactiva", startDate: "2026-07-20", endDate: "2026-07-20", allDay: true, startTime: "", endTime: "", type: "Día libre", reason: "Demo de día libre" }, { id: "exception-demo-2", professionalId: "prof-demo-inactiva", startDate: "2026-07-21", endDate: "2026-07-21", allDay: false, startTime: "12:00", endTime: "13:00", type: "Bloqueo manual", reason: "Bloqueo demo" }], economics: { defaultServiceCommissionPercent: 20 } }),
];

export function normalizeText(value = "") {
  return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(String(value).replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

export function getServiceDefaultDurationMinutes(service = {}) {
  const candidates = [
    service.defaultDurationMinutes,
    service.durationMinutes,
    service.durationInMinutes,
    service.duration,
    service.duracion,
  ];
  return candidates.reduce((duration, candidate) => duration || durationToMinutes(candidate), 0);
}

export function getServiceDisplayPrice(service = {}) {
  const price = numberOrNull(firstDefined(service.price, service.amount, service.total, service.basePrice));
  if (price === null) return "Precio no configurado";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(price);
}

function isDeletedService(service = {}) {
  return service.deleted === true || service.removed === true || service.archived === true || service.status === "deleted";
}

export function isAssignableProfessionalService(service = {}) {
  if (!service?.id || !service?.name || isDeletedService(service)) return false;
  const typeText = normalizeText(`${service.type || ""} ${service.categoryType || ""} ${service.kind || ""}`);
  const text = normalizeText(`${service.name} ${service.categoryName || service.category || ""}`);
  if (typeText.includes("product") || typeText.includes("producto")) return false;
  if (typeText.includes("gift") || typeText.includes("bono") || typeText.includes("voucher")) return false;
  if (typeText.includes("payment") || typeText.includes("pago") || typeText.includes("accounting")) return false;
  return ![
    "producto",
    "tarjeta regalo",
    "gift card",
    "bono",
    "propina",
    "descuento",
    "cargo administrativo",
    "caja",
    "saldo",
    "ajuste contable",
  ].some((term) => text.includes(normalizeText(term)));
}

function operationalCategoryForService(service = {}) {
  const categoryText = normalizeText(`${service.categoryName || service.category || ""} ${service.categoryId || ""}`);
  const subcategoryText = normalizeText(`${service.subcategory || service.subCategory || service.subcategoryName || ""}`);
  const nameText = normalizeText(service.name || "");
  const text = `${categoryText} ${subcategoryText} ${nameText}`;
  if (categoryText.includes("curso") || categoryText.includes("academia") || nameText.includes("curso") || nameText.includes("formacion") || nameText.includes("masterclass")) return "Cursos";
  if (categoryText.includes("manicura") || categoryText.includes("pedicura") || nameText.includes("manicura") || nameText.includes("pedicura") || nameText.includes("una") || nameText.includes("soft gel") || nameText.includes("acrilic") || nameText.includes("rubber")) return "Manicura y pedicura";
  if (categoryText.includes("cejas") && categoryText.includes("pestanas")) {
    if (subcategoryText.includes("pestana") || nameText.includes("pestana") || nameText.includes("lifting") || nameText.includes("extension") || nameText.includes("volumen") || nameText.includes("clasico")) return "PestaÃ±as";
    if (subcategoryText.includes("ceja") || nameText.includes("ceja") || nameText.includes("henna") || nameText.includes("microblading") || nameText.includes("micropigmentacion") || nameText.includes("powder")) return "Cejas";
  }
  if (text.includes("pestana") || text.includes("lifting") || text.includes("extension") || text.includes("volumen ruso")) return "PestaÃ±as";
  if (text.includes("ceja") || text.includes("henna") || text.includes("microblading") || text.includes("micropigmentacion") || text.includes("powder brows")) return "Cejas";
  if (text.includes("masaje") || text.includes("maderoterapia") || text.includes("drenaje")) return "Masajes";
  if (text.includes("depilacion")) return "DepilaciÃ³n";
  if (text.includes("facial") || text.includes("dermapen") || text.includes("peeling")) return "Facial";
  if (text.includes("corporal") || text.includes("presoterapia") || text.includes("cavitacion") || text.includes("radiofrecuencia")) return "Corporal";
  return "Otros servicios";
}

function normalizeOperationalCategoryName(category = "") {
  const normalizedCategory = normalizeText(category);
  if (normalizedCategory.includes("pesta")) return demoServiceCategories[2];
  if (normalizedCategory.includes("depil")) return demoServiceCategories[6];
  return professionalServiceCategoryOrder.find((item) => normalizeText(item) === normalizedCategory) || "Otros servicios";
}

export function normalizeServiceForProfessionalAssignment(service = {}) {
  const id = String(firstDefined(service.id, service.serviceId, service.documentId, service.docId) || "").trim();
  if (!id) {
    if (import.meta.env.DEV) console.warn("Servicio omitido para profesionales: no tiene id valido.", service);
    return null;
  }
  const name = String(firstDefined(service.name, service.serviceName, service.title, service.nombre) || "").trim();
  if (!name) return null;
  const categoryName = String(firstDefined(service.categoryName, service.category, service.categoryId, "Otros servicios")).trim();
  const defaultDurationMinutes = getServiceDefaultDurationMinutes(service);
  const operationalCategoryName = normalizeOperationalCategoryName(operationalCategoryForService({ ...service, id, name, categoryName }));
  return {
    id,
    name,
    categoryId: String(firstDefined(service.categoryId, categoryName)).trim(),
    categoryName,
    category: categoryName,
    operationalCategoryId: normalizeText(operationalCategoryName).replace(/\s+/g, "-"),
    operationalCategoryName,
    active: service.active !== false && service.enabled !== false,
    defaultDurationMinutes,
    duration: firstDefined(service.duration, service.duracion, defaultDurationMinutes),
    price: numberOrNull(firstDefined(service.price, service.amount, service.total, service.basePrice)),
    type: firstDefined(service.type, service.categoryType, service.kind, "service"),
    originalService: service,
  };
}

export function getAvailableProfessionalServices(catalog = []) {
  const source = Array.isArray(catalog) && catalog.length > 0 ? catalog : DEMO_SERVICES;
  if (source === DEMO_SERVICES && import.meta.env.DEV) {
    console.info("CatÃ¡logo demo utilizado porque no hay servicios disponibles.");
  }
  const seen = new Set();
  return source
    .map(normalizeServiceForProfessionalAssignment)
    .filter(Boolean)
    .filter(isAssignableProfessionalService)
    .filter((service) => {
      if (seen.has(service.id)) return false;
      seen.add(service.id);
      return true;
    })
    .sort((a, b) => {
      const categoryA = professionalServiceCategoryOrder.indexOf(a.operationalCategoryName);
      const categoryB = professionalServiceCategoryOrder.indexOf(b.operationalCategoryName);
      if (categoryA !== categoryB) return categoryA - categoryB;
      return a.name.localeCompare(b.name, "es");
    });
}

export function groupServicesByOperationalCategory(services = []) {
  const normalizedServices = services.length ? services : getAvailableProfessionalServices();
  const groups = Object.fromEntries(professionalServiceCategoryOrder.map((category) => [category, []]));
  normalizedServices.forEach((service) => {
    const category = service.operationalCategoryName || operationalCategoryForService(service);
    groups[category] = groups[category] || [];
    groups[category].push(service);
  });
  return groups;
}

function legacyDemoServiceIdFor(serviceId, services = []) {
  const normalizedServices = services.length ? services : getAvailableProfessionalServices();
  if (normalizedServices.some((service) => service.id === serviceId)) return serviceId;
  const targetNames = LEGACY_DEMO_SERVICE_ID_TARGETS[serviceId] || [];
  const target = targetNames
    .map((name) => normalizeText(name))
    .map((name) => normalizedServices.find((service) => normalizeText(service.name) === name)?.id)
    .find(Boolean);
  return target || serviceId;
}

export function migrateDemoProfessionalsToCatalog(professionals = [], services = []) {
  const normalizedServices = services.length ? services : getAvailableProfessionalServices();
  const realIds = new Set(normalizedServices.map((service) => service.id));
  const migratedIds = new Set();
  const missingIds = new Set();
  const migrated = professionals.map((professional) => {
    const mappedAssignedIds = (professional.assignedServiceIds || []).map((serviceId) => {
      const mappedId = legacyDemoServiceIdFor(serviceId, normalizedServices);
      if (mappedId !== serviceId) migratedIds.add(serviceId);
      if (!realIds.has(mappedId)) missingIds.add(serviceId);
      return mappedId;
    });
    const mappedSettings = (professional.professionalServiceSettings || []).map((setting) => ({
      ...setting,
      serviceId: legacyDemoServiceIdFor(setting.serviceId, normalizedServices),
    }));
    const assignedServiceIds = normalizeAssignedServiceIds(mappedAssignedIds, normalizedServices);
    return {
      ...professional,
      assignedServiceIds,
      professionalServiceSettings: synchronizeProfessionalServiceSettings(assignedServiceIds, mappedSettings, { services: normalizedServices }),
    };
  });
  if (import.meta.env.DEV && (migratedIds.size || missingIds.size)) {
    console.info("Servicios demo migrados a catalogo real:", {
      migrated: Array.from(migratedIds),
      missing: Array.from(missingIds),
      realServicesUsed: normalizedServices.filter((service) => migrated.some((professional) => professional.assignedServiceIds.includes(service.id))).map((service) => service.id),
    });
  }
  return migrated;
}

export function servicesByDemoCategory(services = DEMO_SERVICES) {
  return groupServicesByOperationalCategory(getAvailableProfessionalServices(services));
  const groups = Object.fromEntries(demoServiceCategories.map((category) => [category, []]));
  services.forEach((service) => {
    const text = normalizeText(`${service.category} ${service.name}`);
    let category = "Cursos";
    if (text.includes("mani") || text.includes("pedi")) category = "Manicura y pedicura";
    else if (text.includes("ceja")) category = "Cejas";
    else if (text.includes("pestana") || text.includes("pestaña") || text.includes("lifting")) category = "Pestañas";
    else if (text.includes("facial")) category = "Facial";
    else if (text.includes("masaje")) category = "Masajes";
    else if (text.includes("corporal")) category = "Corporal";
    else if (text.includes("depil")) category = "Depilación";
    groups[category] = groups[category] || [];
    groups[category].push(service);
  });
  return groups;
}

export function isServiceActive(service = {}) {
  return service.active !== false;
}

export function normalizeAssignedServiceIds(assignedServiceIds = [], services = DEMO_SERVICES) {
  const normalizedServices = services.length ? services : getAvailableProfessionalServices();
  const validIds = new Set(normalizedServices.map((service) => service.id));
  return assignedServiceIds.filter((serviceId, index, list) => (
    validIds.has(serviceId) && list.indexOf(serviceId) === index
  ));
}

function serviceSettingFor(serviceId, settings = [], enabled = true) {
  const existing = settings.find((setting) => setting.serviceId === serviceId);
  return {
    serviceId,
    enabled,
    customDurationMinutes: existing?.customDurationMinutes || "",
  };
}

export function synchronizeProfessionalServiceSettings(
  assignedServiceIds = [],
  professionalServiceSettings = [],
  { keepDisabled = false, services = DEMO_SERVICES } = {},
) {
  const normalizedServices = services.length ? services : getAvailableProfessionalServices();
  const normalizedAssignedIds = normalizeAssignedServiceIds(assignedServiceIds, normalizedServices);
  const validIds = new Set(normalizedServices.map((service) => service.id));
  const assignedSet = new Set(normalizedAssignedIds);
  const enabledSettings = normalizedAssignedIds.map((serviceId) => serviceSettingFor(serviceId, professionalServiceSettings, true));
  const disabledSettings = keepDisabled
    ? professionalServiceSettings
      .filter((setting) => validIds.has(setting.serviceId) && !assignedSet.has(setting.serviceId))
      .filter((setting, index, list) => list.findIndex((item) => item.serviceId === setting.serviceId) === index)
      .map((setting) => ({ ...setting, enabled: false }))
    : [];
  return enabledSettings.concat(disabledSettings);
}

export function toggleProfessionalService(draft, serviceId, services = DEMO_SERVICES) {
  const normalizedServices = services.length ? services : getAvailableProfessionalServices();
  const service = normalizedServices.find((item) => item.id === serviceId);
  const currentlyAssigned = draft.assignedServiceIds.includes(serviceId);
  if (!service || (!currentlyAssigned && !isServiceActive(service))) return draft;
  const assignedServiceIds = currentlyAssigned
    ? draft.assignedServiceIds.filter((id) => id !== serviceId)
    : [...draft.assignedServiceIds, serviceId];
  return {
    ...draft,
    assignedServiceIds: normalizeAssignedServiceIds(assignedServiceIds, normalizedServices),
    professionalServiceSettings: synchronizeProfessionalServiceSettings(
      assignedServiceIds,
      draft.professionalServiceSettings,
      { keepDisabled: true, services: normalizedServices },
    ),
  };
}

export function selectEntireCategory(draft, categoryServices = [], services = DEMO_SERVICES) {
  const normalizedServices = services.length ? services : getAvailableProfessionalServices();
  const activeIds = categoryServices.filter(isServiceActive).map((service) => service.id);
  const assignedServiceIds = normalizeAssignedServiceIds([...draft.assignedServiceIds, ...activeIds], normalizedServices);
  return {
    ...draft,
    assignedServiceIds,
    professionalServiceSettings: synchronizeProfessionalServiceSettings(
      assignedServiceIds,
      draft.professionalServiceSettings,
      { keepDisabled: true, services: normalizedServices },
    ),
  };
}

export function clearEntireCategory(draft, categoryServices = [], services = DEMO_SERVICES) {
  const normalizedServices = services.length ? services : getAvailableProfessionalServices();
  const categoryIds = new Set(categoryServices.filter(isServiceActive).map((service) => service.id));
  const assignedServiceIds = normalizeAssignedServiceIds(
    draft.assignedServiceIds.filter((serviceId) => !categoryIds.has(serviceId)),
    normalizedServices,
  );
  return {
    ...draft,
    assignedServiceIds,
    professionalServiceSettings: synchronizeProfessionalServiceSettings(
      assignedServiceIds,
      draft.professionalServiceSettings,
      { keepDisabled: true, services: normalizedServices },
    ),
  };
}

export function getCategorySelectionState(categoryServices = [], assignedServiceIds = []) {
  const activeServices = categoryServices.filter(isServiceActive);
  const activeIds = activeServices.map((service) => service.id);
  const selectedCount = activeIds.filter((serviceId) => assignedServiceIds.includes(serviceId)).length;
  const totalCount = activeIds.length;
  return {
    checked: totalCount > 0 && selectedCount === totalCount,
    disabled: totalCount === 0,
    indeterminate: selectedCount > 0 && selectedCount < totalCount,
    selectedCount,
    totalCount,
  };
}

export function getActiveProfessionals(professionals = initialProfessionalsDemo) {
  return professionals.filter((professional) => professional.active !== false);
}

export function getProfessionalsForService(serviceId, professionals = initialProfessionalsDemo) {
  return getActiveProfessionals(professionals).filter((professional) => professional.assignedServiceIds.includes(serviceId));
}

export function canProfessionalPerformService(professionalId, serviceId, professionals = initialProfessionalsDemo) {
  return Boolean(professionals.find((professional) => professional.id === professionalId)?.assignedServiceIds.includes(serviceId));
}

export function getProfessionalScheduleForDate(professionalId, date, professionals = initialProfessionalsDemo) {
  const professional = professionals.find((item) => item.id === professionalId);
  if (!professional) return null;
  const dayIndex = new Date(`${date}T12:00:00`).getDay();
  const keys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return professional.weeklySchedule[keys[dayIndex]] || null;
}

export function getProfessionalPermissions(professionalId, professionals = initialProfessionalsDemo) {
  return professionals.find((professional) => professional.id === professionalId)?.access?.permissions || [];
}

export function getProfessionalServiceDuration(professionalId, serviceId, professionals = initialProfessionalsDemo, services = DEMO_SERVICES) {
  const normalizedServices = services.length ? services : getAvailableProfessionalServices();
  const professional = professionals.find((item) => item.id === professionalId);
  const setting = professional?.professionalServiceSettings?.find((item) => item.serviceId === serviceId);
  const service = normalizedServices.find((item) => item.id === serviceId);
  return Number(setting?.customDurationMinutes || getServiceDefaultDurationMinutes(service));
}

export function professionalSpecialtiesText(professional, services = DEMO_SERVICES) {
  const normalizedServices = services.length ? services : getAvailableProfessionalServices();
  return professional.assignedServiceIds
    .map((serviceId) => normalizedServices.find((service) => service.id === serviceId)?.operationalCategoryName)
    .filter(Boolean)
    .filter((category, index, categories) => categories.indexOf(category) === index)
    .join(", ") || "Sin servicios";
}

export function todayScheduleText(professional, date = "2026-07-20") {
  const schedule = getProfessionalScheduleForDate(professional.id, date, [professional]);
  if (!schedule?.enabled || schedule.shifts.length === 0) return "No trabaja";
  return schedule.shifts.map((shift) => `${shift.start}-${shift.end}`).join(" / ");
}

export function cloneProfessionalsDemo() {
  return clone(initialProfessionalsDemo);
}

export function formatServiceDuration(service) {
  const duration = getServiceDefaultDurationMinutes(service);
  return duration ? formatMinutes(duration) : "DuraciÃ³n no configurada";
}
