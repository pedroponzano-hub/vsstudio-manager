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
];

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

function normalizeText(value = "") {
  return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function servicesByDemoCategory(services = DEMO_SERVICES) {
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
  const professional = professionals.find((item) => item.id === professionalId);
  const setting = professional?.professionalServiceSettings?.find((item) => item.serviceId === serviceId);
  const service = services.find((item) => item.id === serviceId);
  return Number(setting?.customDurationMinutes || durationToMinutes(service?.duration));
}

export function professionalSpecialtiesText(professional, services = DEMO_SERVICES) {
  return professional.assignedServiceIds
    .map((serviceId) => services.find((service) => service.id === serviceId)?.category)
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
  return formatMinutes(durationToMinutes(service?.duration));
}
