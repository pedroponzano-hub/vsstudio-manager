import test from "node:test";
import assert from "node:assert/strict";

import {
  professionalMatchesAppointment,
  realAgendaProfessionals,
  realAgendaServices,
} from "../src/utils/agendaRealConfig.js";

const config = {
  employees: ["Marianne", "Ámbar", "Leidy", "Leo", "Inactiva", "Administración"],
  employeeSettings: [
    { id: "professional-marianne", name: "Marianne", active: true, offersServices: true, assignedServiceIds: ["service-facial", "product-cream"] },
    { id: "professional-ambar", name: "Ámbar", active: true, offersServices: true, assignedServiceIds: ["service-nails"] },
    { id: "professional-leidy", name: "Leidy", active: true, offersServices: true, assignedServiceIds: ["service-facial"] },
    { id: "professional-leo", name: "Leo", active: true, offersServices: true, assignedServiceIds: ["service-nails"] },
    { id: "professional-inactive", name: "Inactiva", active: false, offersServices: true, assignedServiceIds: ["service-facial"] },
    { id: "professional-admin", name: "Administración", active: true, offersServices: false, assignedServiceIds: [] },
  ],
  services: [
    { id: "service-facial", name: "Facial", active: true, type: "service" },
    { id: "service-nails", name: "Manicura", active: true, type: "service" },
    { id: "service-inactive", name: "Servicio inactivo", active: false, type: "service" },
    { id: "product-cream", name: "Crema", active: true, type: "product" },
  ],
};

test("Agenda obtiene únicamente servicios reales activos y excluye productos", () => {
  assert.deepEqual(realAgendaServices(config).map((service) => service.id), ["service-facial", "service-nails"]);
});

test("Agenda obtiene profesionales reales activos que ofrecen servicios sin inyectar demos", () => {
  const professionals = realAgendaProfessionals(config);
  assert.deepEqual(professionals.map((professional) => professional.name), ["Marianne", "Ámbar", "Leidy", "Leo"]);
  assert.equal(professionals.some((professional) => ["Grace", "Claudia"].includes(professional.name)), false);
  assert.equal(professionals[0].id, "professional-marianne");
  assert.deepEqual(professionals[0].serviceIds, ["service-facial"]);
});

test("Agenda relaciona citas por ID real y conserva compatibilidad con nombres acentuados", () => {
  const professionals = realAgendaProfessionals(config);
  const ambar = professionals.find((professional) => professional.name === "Ámbar");
  assert.equal(professionalMatchesAppointment(ambar, { professionalId: "professional-ambar" }), true);
  assert.equal(professionalMatchesAppointment(ambar, { professionalName: "Ambar" }), true);
  assert.equal(professionalMatchesAppointment(ambar, { professionalId: "professional-leo" }), false);
});
