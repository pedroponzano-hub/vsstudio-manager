import {
  DEMO_PROFESSIONALS,
  DEMO_SERVICES,
  durationToMinutes,
  minutesToTime,
  normalizeDemoAppointmentStatus,
  normalizeDemoDate,
  timeToMinutes,
} from "./availabilityDemo.js";
import { getTodayLocalDateString } from "./date.js";

export const DEMO_CALENDAR_START = "09:00";
export const DEMO_CALENDAR_END = "20:00";
export const DEMO_CALENDAR_INTERVAL = 15;

export const DEMO_BUSINESS_AREAS = [
  "Todas",
  "Uñas",
  "Cejas y pestañas",
  "Facial y corporal",
  "Cursos",
];

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getServiceBusinessArea(service = {}) {
  const text = normalizeText(`${service.category || ""} ${service.name || ""}`);
  if (text.includes("curso") || text.includes("formacion") || text.includes("academia")) return "Cursos";
  if (text.includes("mani") || text.includes("pedi") || text.includes("una") || text.includes("soft gel")) return "Uñas";
  if (text.includes("ceja") || text.includes("pestana") || text.includes("lifting")) return "Cejas y pestañas";
  if (text.includes("facial") || text.includes("corporal") || text.includes("masaje")) return "Facial y corporal";
  return "Todas";
}

export function getProfessionalBusinessAreas(professional, services = DEMO_SERVICES) {
  const areas = new Set();
  professional.serviceIds.forEach((serviceId) => {
    const service = services.find((item) => item.id === serviceId);
    const area = getServiceBusinessArea(service);
    if (area !== "Todas") areas.add(area);
  });
  return Array.from(areas);
}

export function filterDemoProfessionals({ area = "Todas", professionalId = "all", query = "", professionals = DEMO_PROFESSIONALS, services = DEMO_SERVICES } = {}) {
  const search = normalizeText(query);
  return professionals.filter((professional) => {
    const areas = getProfessionalBusinessAreas(professional, services);
    const areaMatches = area === "Todas" || areas.includes(area);
    const professionalMatches = professionalId === "all" || professional.id === professionalId;
    const queryMatches = !search || normalizeText(professional.name).includes(search);
    return areaMatches && professionalMatches && queryMatches;
  });
}

export function createCalendarSlots(startTime = DEMO_CALENDAR_START, endTime = DEMO_CALENDAR_END, interval = DEMO_CALENDAR_INTERVAL) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const slots = [];
  for (let minute = start; minute < end; minute += interval) {
    slots.push({ minute, label: minutesToTime(minute) });
  }
  return slots;
}

export function getAppointmentLayout(row, services = DEMO_SERVICES) {
  const dayStart = timeToMinutes(DEMO_CALENDAR_START);
  const start = timeToMinutes(row.time);
  const duration = getAppointmentDurationMinutes(row, services);
  const startOffset = Math.max(0, start - dayStart);
  const rowStart = Math.floor(startOffset / DEMO_CALENDAR_INTERVAL) + 1;
  const rowSpan = Math.max(1, Math.ceil(duration / DEMO_CALENDAR_INTERVAL));
  return { rowStart, rowSpan, endTime: minutesToTime(start + duration) };
}

export function getAppointmentDurationMinutes(row = {}, services = DEMO_SERVICES) {
  const service = services.find((item) => item.id === row.serviceId || item.name === row.serviceName);
  return durationToMinutes(row.appointmentDuration || row.duration || service?.duration);
}

export function getAppointmentEndMinute(row = {}) {
  const start = timeToMinutes(row.startTime || row.time);
  const explicitEnd = timeToMinutes(row.endTime);
  return explicitEnd > start ? explicitEnd : start + getAppointmentDurationMinutes(row);
}

export function appointmentBlocksSlot({
  appointments = [],
  durationMinutes,
  excludeId,
  professionalId,
  professionalName,
  selectedDate,
  startMinute,
}) {
  const endMinute = startMinute + Number(durationMinutes || 0);
  if (!selectedDate || !professionalName || startMinute === undefined || startMinute === null || !durationMinutes) return false;

  return appointments.some((appointment) => {
    const appointmentDate = normalizeDemoDate(appointment.date || appointment.fechaOperativa || "");
    if (appointmentDate !== normalizeDemoDate(selectedDate) || appointment.id === excludeId) return false;

    const status = normalizeText(normalizeDemoAppointmentStatus(appointment));
    if (status.includes("cancelada") || status.includes("no se present")) return false;

    const appointmentProfessionalMatches = (
      appointment.professionalId === professionalId
      || appointment.professionalName === professionalName
      || appointment.employee === professionalName
    );
    if (!appointmentProfessionalMatches) return false;

    const appointmentStart = timeToMinutes(appointment.startTime || appointment.time);
    const appointmentEnd = getAppointmentEndMinute(appointment);
    return startMinute < appointmentEnd && endMinute > appointmentStart;
  });
}

export function shiftLocalDate(dateText, days) {
  const [year, month, day] = String(dateText || getTodayLocalDateString()).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
