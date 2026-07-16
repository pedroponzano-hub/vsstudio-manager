export const DEMO_SLOT_INTERVALS = [5, 10, 15, 30];

export const DEMO_APPOINTMENT_SOURCES = [
  "Walk-in",
  "Treatwell",
  "Instagram",
  "Google",
  "WhatsApp",
  "Web",
  "Recomendación",
  "Otros",
];

export const DEMO_SERVICES = [
  { id: "mani-semi", category: "Manicura", name: "Manicura semipermanente demo", duration: 45, price: 20 },
  { id: "cejas-diseno", category: "Cejas", name: "Diseno de cejas demo", duration: 30, price: 18 },
  { id: "lifting-pestanas", category: "Pestanas", name: "Lifting de pestanas demo", duration: 60, price: 35 },
  { id: "pedicura-completa", category: "Pedicura", name: "Pedicura completa demo", duration: 75, price: 28 },
  { id: "facial-demo", category: "Facial", name: "Tratamiento facial demo", duration: 60, price: 60 },
  { id: "masaje-demo", category: "Corporal", name: "Masaje corporal demo", duration: 45, price: 35 },
];

export const DEMO_PROFESSIONALS = [
  { id: "marianne", name: "Marianne", workStart: "09:00", workEnd: "19:00", serviceIds: ["mani-semi", "cejas-diseno", "facial-demo"] },
  { id: "ambar", name: "Ambar", workStart: "10:00", workEnd: "18:30", serviceIds: ["cejas-diseno", "lifting-pestanas", "pedicura-completa"] },
  { id: "grace", name: "Grace", workStart: "09:30", workEnd: "20:00", serviceIds: ["lifting-pestanas", "masaje-demo", "facial-demo"] },
  { id: "leidys", name: "Leidys", workStart: "11:00", workEnd: "19:30", serviceIds: ["mani-semi", "pedicura-completa"] },
];

export const DEMO_CLIENTS = [
  { id: "demo-client-1", name: "Cliente Demo Iris", phone: "600 100 101" },
  { id: "demo-client-2", name: "Cliente Demo Vega", phone: "600 100 202" },
  { id: "demo-client-3", name: "Cliente Demo Luna", phone: "600 100 303" },
];

export function valueOrFallback(value, fallback = "Sin asignar") {
  const text = String(value || "").trim();
  return text || fallback;
}

export function normalizeTime(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (!match) return text;
  return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
}

export function formatDuration(value) {
  if (value === undefined || value === null || value === "") return "No disponible";
  if (typeof value === "number") return value > 0 ? `${value} min` : "No disponible";

  const text = String(value).trim();
  if (!text) return "No disponible";
  if (/^\d+$/.test(text)) return `${text} min`;
  return text;
}

export function durationToMinutes(value) {
  if (typeof value === "number") return value;
  const text = String(value || "").toLowerCase();
  if (!text) return 0;
  if (/^\d+$/.test(text.trim())) return Number(text);

  const hourMatch = text.match(/(\d+)\s*h/);
  const minuteMatch = text.match(/(\d+)\s*min/);
  return (hourMatch ? Number(hourMatch[1]) * 60 : 0) + (minuteMatch ? Number(minuteMatch[1]) : 0);
}

export function timeToMinutes(value = "") {
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatMinutes(value) {
  if (!value) return "0 min";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function proximityLabel(slotStart, requestedTime) {
  const difference = slotStart - timeToMinutes(requestedTime);
  if (difference === 0) return "A la hora solicitada";
  const prefix = difference > 0 ? "+" : "-";
  return `${prefix}${formatMinutes(Math.abs(difference))}`;
}

export function getStatusClassName(status = "") {
  const normalizedStatus = String(status)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalizedStatus.includes("confirmada")) return "agenda-status-confirmada";
  if (normalizedStatus.includes("cliente llegado")) return "agenda-status-llegado";
  if (normalizedStatus.includes("en servicio")) return "agenda-status-servicio";
  if (normalizedStatus.includes("pendiente de cobro")) return "agenda-status-cobro";
  if (normalizedStatus.includes("finalizada")) return "agenda-status-finalizada";
  if (normalizedStatus.includes("cancelada")) return "agenda-status-cancelada";
  return "agenda-status-default";
}

export function demoAppointmentsForDate(date) {
  return [
    {
      id: "demo-agenda-confirmada",
      date,
      serviceId: "mani-semi",
      startTime: "09:15",
      clientName: "Cliente Demo Aurora",
      clientPhone: "600 000 101",
      serviceName: "Manicura semipermanente demo",
      employee: "Marianne",
      duration: "45 min",
      status: "Confirmada",
    },
    {
      id: "demo-agenda-llegado",
      date,
      serviceId: "cejas-diseno",
      startTime: "10:20",
      clientName: "Cliente Demo Brisa",
      clientPhone: "600 000 202",
      serviceName: "Diseno de cejas demo",
      employee: "Ambar",
      duration: "30 min",
      status: "Cliente llegado",
    },
    {
      id: "demo-agenda-servicio",
      date,
      serviceId: "lifting-pestanas",
      startTime: "11:30",
      clientName: "Cliente Demo Coral",
      clientPhone: "600 000 303",
      serviceName: "Lifting de pestanas demo",
      employee: "Grace",
      duration: "1 h",
      status: "En servicio",
    },
    {
      id: "demo-agenda-cobro",
      date,
      serviceId: "pedicura-completa",
      startTime: "13:00",
      clientName: "Cliente Demo Dalia",
      clientPhone: "600 000 404",
      serviceName: "Pedicura completa demo",
      employee: "Leidys",
      duration: "1 h 15 min",
      status: "Pendiente de cobro",
    },
    {
      id: "demo-agenda-finalizada",
      date,
      serviceId: "facial-demo",
      startTime: "16:10",
      clientName: "Cliente Demo Elara",
      clientPhone: "600 000 505",
      serviceName: "Tratamiento facial demo",
      employee: "Marianne",
      duration: "1 h",
      status: "Finalizada",
    },
    {
      id: "demo-agenda-cancelada",
      date,
      serviceId: "masaje-demo",
      startTime: "18:30",
      clientName: "Cliente Demo Fenix",
      clientPhone: "600 000 606",
      serviceName: "Masaje corporal demo",
      employee: "Grace",
      duration: "45 min",
      status: "Cancelada",
    },
  ];
}

export function calculateDemoAvailability({ appointments, interval, professionalId, requestedTime, selectedDate, serviceId }) {
  const service = DEMO_SERVICES.find((item) => item.id === serviceId);
  if (!service) return [];

  const enabledProfessionals = DEMO_PROFESSIONALS.filter((professional) => (
    professional.serviceIds.includes(service.id)
    && (professionalId === "any" || professional.id === professionalId)
  ));

  const dayAppointments = (appointments || [])
    .filter((appointment) => (appointment.date || appointment.fechaOperativa || "") === selectedDate)
    .filter((appointment) => !String(appointment.status || "").toLowerCase().includes("cancelada"));

  const slots = enabledProfessionals.flatMap((professional) => {
    const busyBlocks = dayAppointments
      .filter((appointment) => appointment.employee === professional.name)
      .map((appointment) => {
        const start = timeToMinutes(appointment.startTime || appointment.time);
        const appointmentService = DEMO_SERVICES.find((item) => item.id === appointment.serviceId);
        const duration = appointmentService?.duration || durationToMinutes(appointment.duration);
        return { start, end: start + duration };
      })
      .sort((first, second) => first.start - second.start);

    const workStart = timeToMinutes(professional.workStart);
    const workEnd = timeToMinutes(professional.workEnd);
    const gaps = [];
    let cursor = workStart;

    busyBlocks.forEach((block) => {
      if (block.start > cursor) gaps.push({ start: cursor, end: block.start });
      cursor = Math.max(cursor, block.end);
    });
    if (cursor < workEnd) gaps.push({ start: cursor, end: workEnd });

    return gaps.flatMap((gap) => {
      const results = [];
      for (let start = gap.start; start + service.duration <= gap.end; start += interval) {
        results.push({
          id: `${professional.id}-${service.id}-${start}`,
          start,
          end: start + service.duration,
          professionalId: professional.id,
          professionalName: professional.name,
          serviceId: service.id,
          serviceName: service.name,
          duration: service.duration,
          proximity: Math.abs(start - timeToMinutes(requestedTime)),
          proximityText: proximityLabel(start, requestedTime),
        });
      }
      return results;
    });
  });

  return slots
    .sort((first, second) => first.proximity - second.proximity || first.start - second.start || first.professionalName.localeCompare(second.professionalName))
    .slice(0, 12);
}
