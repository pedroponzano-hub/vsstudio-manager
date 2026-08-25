import { isProductCatalogItem, normalizeRealEmployeeSettings } from "./managerConfiguration.js";

export function realAgendaServices(config = {}) {
  return (config.services || []).filter((service) => service.active !== false && !isProductCatalogItem(service));
}

export function realAgendaProfessionals(config = {}, services = realAgendaServices(config)) {
  const realServiceIds = new Set(services.map((service) => service.id));
  return normalizeRealEmployeeSettings(config)
    .filter((professional) => professional.active !== false && professional.offersServices !== false)
    .map((professional) => {
      const assignedServiceIds = (professional.assignedServiceIds || professional.serviceIds || [])
        .filter((serviceId) => realServiceIds.has(serviceId));
      return {
        ...professional,
        name: professional.displayName || professional.name,
        systemName: professional.name,
        serviceIds: assignedServiceIds,
      };
    });
}

export function professionalMatchesAppointment(professional = {}, appointment = {}) {
  if (professional.id && appointment.professionalId) return professional.id === appointment.professionalId;
  const normalize = (value) => String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const appointmentName = normalize(appointment.professionalName || appointment.employee);
  return Boolean(appointmentName && [professional.name, professional.systemName].some((name) => normalize(name) === appointmentName));
}
