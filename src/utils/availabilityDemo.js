export const DEMO_SLOT_INTERVALS = [5, 10, 15, 30];
export const DEMO_AGENDA_BASE_DATE = "2026-07-20";

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

export const DEMO_TREATWELL_BOOKING_TYPES = [
  {
    id: "commission_25",
    label: "Reserva Treatwell con comision del 25 %",
    commissionPercent: 25,
    isPrepaid: false,
    prepaidMethod: null,
  },
  {
    id: "prepaid_2",
    label: "Reserva pagada en Treatwell - comision del 2 %",
    commissionPercent: 2,
    isPrepaid: true,
    prepaidMethod: "Treatwell",
  },
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

export const DEMO_APPOINTMENT_TRANSITIONS = {
  Confirmada: ["En servicio", "Cancelada", "No se presentó"],
  "En servicio": ["Finalizada"],
  Finalizada: [],
  Cancelada: [],
  "No se presentó": [],
};

export function valueOrFallback(value, fallback = "Sin asignar") {
  const text = String(value || "").trim();
  return text || fallback;
}

export function normalizeDemoDate(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return text;

  const spanishMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (spanishMatch) {
    return `${spanishMatch[3]}-${String(spanishMatch[2]).padStart(2, "0")}-${String(spanishMatch[1]).padStart(2, "0")}`;
  }

  return text;
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
  if (normalizedStatus.includes("en servicio")) return "agenda-status-servicio";
  if (normalizedStatus.includes("finalizada")) return "agenda-status-finalizada";
  if (normalizedStatus.includes("cancelada")) return "agenda-status-cancelada";
  if (normalizedStatus.includes("no se presento")) return "agenda-status-no-show";
  return "agenda-status-default";
}

export function normalizeDemoAppointmentStatus(appointment = {}) {
  const status = appointment.appointmentStatus || appointment.status || "Confirmada";
  if (status === "Cliente llegado") return "Confirmada";
  if (status === "Pendiente de cobro") return "En servicio";
  if (status === "No asistió") return "No se presentó";
  return status;
}

export function normalizeDemoPaymentStatus(appointment = {}) {
  if (appointment.paymentStatus) return appointment.paymentStatus;
  if (appointment.isPrepaid) return "prepaid";
  if (normalizeDemoAppointmentStatus(appointment) === "Finalizada") return "paid";
  return "pending";
}

export function demoAppointmentsForDate(date = DEMO_AGENDA_BASE_DATE) {
  const normalizedDate = normalizeDemoDate(date);
  if (normalizedDate !== DEMO_AGENDA_BASE_DATE) return [];

  return [
    {
      id: "demo-agenda-confirmada",
      date: DEMO_AGENDA_BASE_DATE,
      serviceId: "mani-semi",
      startTime: "09:15",
      clientName: "Cliente Demo Aurora",
      clientPhone: "600 000 101",
      serviceName: "Manicura semipermanente demo",
      employee: "Marianne",
      serviceDefaultDuration: 45,
      appointmentDuration: 45,
      duration: "45 min",
      appointmentStatus: "Confirmada",
      paymentStatus: "pending",
      status: "Confirmada",
    },
    {
      id: "demo-agenda-llegado",
      date: DEMO_AGENDA_BASE_DATE,
      serviceId: "cejas-diseno",
      startTime: "10:20",
      clientName: "Cliente Demo Brisa",
      clientPhone: "600 000 202",
      serviceName: "Diseno de cejas demo",
      employee: "Ambar",
      serviceDefaultDuration: 30,
      appointmentDuration: 30,
      duration: "30 min",
      appointmentStatus: "Confirmada",
      paymentStatus: "pending",
      status: "Confirmada",
      appointmentSource: "Treatwell",
      treatwellBookingType: "commission_25",
      treatwellCommissionPercent: 25,
      isPrepaid: false,
      prepaidMethod: null,
      prepaidAmount: 0,
      amountDueAtSalon: 18,
    },
    {
      id: "demo-agenda-servicio",
      date: DEMO_AGENDA_BASE_DATE,
      serviceId: "lifting-pestanas",
      startTime: "11:30",
      clientName: "Cliente Demo Coral",
      clientPhone: "600 000 303",
      serviceName: "Lifting de pestanas demo",
      employee: "Grace",
      serviceDefaultDuration: 60,
      appointmentDuration: 60,
      duration: "1 h",
      appointmentStatus: "En servicio",
      paymentStatus: "pending",
      status: "En servicio",
    },
    {
      id: "demo-agenda-cobro",
      date: DEMO_AGENDA_BASE_DATE,
      serviceId: "pedicura-completa",
      startTime: "13:00",
      clientName: "Cliente Demo Dalia",
      clientPhone: "600 000 404",
      serviceName: "Pedicura completa demo",
      employee: "Leidys",
      serviceDefaultDuration: 75,
      appointmentDuration: 75,
      duration: "1 h 15 min",
      appointmentStatus: "En servicio",
      paymentStatus: "prepaid",
      status: "En servicio",
      appointmentSource: "Treatwell",
      treatwellBookingType: "prepaid_2",
      treatwellCommissionPercent: 2,
      isPrepaid: true,
      prepaidMethod: "Treatwell",
      prepaidAmount: 28,
      amountDueAtSalon: 0,
    },
    {
      id: "demo-agenda-finalizada",
      date: DEMO_AGENDA_BASE_DATE,
      serviceId: "facial-demo",
      startTime: "16:10",
      clientName: "Cliente Demo Elara",
      clientPhone: "600 000 505",
      serviceName: "Tratamiento facial demo",
      employee: "Marianne",
      serviceDefaultDuration: 60,
      appointmentDuration: 60,
      duration: "1 h",
      appointmentStatus: "Finalizada",
      paymentStatus: "paid",
      status: "Finalizada",
    },
    {
      id: "demo-agenda-cancelada",
      date: DEMO_AGENDA_BASE_DATE,
      serviceId: "masaje-demo",
      startTime: "18:30",
      clientName: "Cliente Demo Fenix",
      clientPhone: "600 000 606",
      serviceName: "Masaje corporal demo",
      employee: "Grace",
      serviceDefaultDuration: 45,
      appointmentDuration: 45,
      duration: "45 min",
      appointmentStatus: "Cancelada",
      paymentStatus: "pending",
      status: "Cancelada",
    },
  ];
}

export function calculateDemoAvailability({ appointments, durationOverride, interval, professionalId, requestedTime, selectedDate, serviceId }) {
  const service = DEMO_SERVICES.find((item) => item.id === serviceId);
  if (!service) return [];
  const serviceDuration = Math.max(5, durationToMinutes(durationOverride || service.duration));

  const enabledProfessionals = DEMO_PROFESSIONALS.filter((professional) => (
    professional.serviceIds.includes(service.id)
    && (professionalId === "any" || professional.id === professionalId)
  ));

  const dayAppointments = (appointments || [])
    .filter((appointment) => normalizeDemoDate(appointment.date || appointment.fechaOperativa || "") === normalizeDemoDate(selectedDate))
    .filter((appointment) => {
      const status = normalizeDemoAppointmentStatus(appointment)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return !status.includes("cancelada") && !status.includes("no se present");
    });

  const slots = enabledProfessionals.flatMap((professional) => {
    const busyBlocks = dayAppointments
      .filter((appointment) => appointment.employee === professional.name)
      .map((appointment) => {
        const start = timeToMinutes(appointment.startTime || appointment.time);
        const appointmentService = DEMO_SERVICES.find((item) => item.id === appointment.serviceId);
        const duration = durationToMinutes(appointment.appointmentDuration || appointment.duration || appointmentService?.duration);
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
      for (let start = gap.start; start + serviceDuration <= gap.end; start += interval) {
        results.push({
          id: `${professional.id}-${service.id}-${start}`,
          start,
          end: start + serviceDuration,
          professionalId: professional.id,
          professionalName: professional.name,
          serviceId: service.id,
          serviceName: service.name,
          duration: serviceDuration,
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
