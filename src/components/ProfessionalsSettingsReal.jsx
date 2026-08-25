import { useMemo, useState } from "react";

import ProfessionalHistoryDemo from "./ProfessionalHistoryDemo.jsx";
import ProfessionalModalDemo from "./ProfessionalModalDemo.jsx";
import ProfessionalsListDemo from "./ProfessionalsListDemo.jsx";
import {
  buildProfessional,
  createProfessionalId,
  defaultWeeklySchedule,
  getAvailableProfessionalServices,
} from "../utils/professionalsConfigDemo.js";
import { normalizeRealEmployeeSettings } from "../utils/managerConfiguration.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function employeeToProfessional(employee = {}) {
  const base = buildProfessional({
    id: employee.id,
    firstName: employee.firstName || employee.name || "",
    lastName: employee.lastName || "",
    displayName: employee.displayName || employee.name || "",
    email: employee.email || "",
    phone: employee.phone || "",
    active: employee.active !== false,
    offersServices: employee.offersServices !== false,
    employmentType: employee.employmentType || "Empleada",
    calendarColor: employee.calendarColor || "#c9aa63",
    internalNotes: employee.internalNotes || "",
    assignedServiceIds: employee.assignedServiceIds || employee.serviceIds || [],
    weeklySchedule: employee.weeklySchedule || defaultWeeklySchedule(),
    scheduleExceptions: employee.scheduleExceptions || [],
    access: employee.access,
    economics: {
      ...(employee.economics || {}),
      defaultServiceCommissionPercent: Number(employee.commissionPercent || 0),
    },
    publicProfile: employee.publicProfile,
  });
  return {
    ...base,
    professionalServiceSettings: employee.professionalServiceSettings || base.professionalServiceSettings,
  };
}

function changedFields(previous = {}, next = {}) {
  return ["displayName", "active", "offersServices", "assignedServiceIds", "professionalServiceSettings", "weeklySchedule", "scheduleExceptions", "access", "economics", "publicProfile"]
    .filter((field) => JSON.stringify(previous[field]) !== JSON.stringify(next[field]));
}

function ProfessionalsSettingsReal({ config = {}, currentUser, onSave }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [modalState, setModalState] = useState(null);
  const [notice, setNotice] = useState("");
  const employees = useMemo(() => normalizeRealEmployeeSettings(config), [config]);
  const professionals = useMemo(() => employees.map(employeeToProfessional), [employees]);
  const services = useMemo(() => getAvailableProfessionalServices(config.services || []), [config.services]);
  const history = useMemo(() => employees.flatMap((employee) => employee.professionalHistory || []).sort((first, second) => String(second.changedAt).localeCompare(String(first.changedAt))), [employees]);
  const actor = currentUser?.email || currentUser?.nombre || "Usuario no identificado";
  const totals = {
    total: professionals.length,
    active: professionals.filter((professional) => professional.active !== false).length,
    serviceProviders: professionals.filter((professional) => professional.offersServices).length,
    withAccess: professionals.filter((professional) => professional.access?.enabled).length,
  };

  const persistEmployees = (nextEmployees) => {
    onSave({
      employeeSettings: nextEmployees,
      employees: nextEmployees.filter((employee) => employee.active !== false).map((employee) => employee.name),
    });
  };

  const saveProfessional = (draft) => {
    const existing = employees.find((employee) => employee.id === draft.id);
    const now = new Date().toISOString();
    const nextCommission = Number(draft.economics?.defaultServiceCommissionPercent || 0);
    const commissionChanged = existing && nextCommission !== Number(existing.commissionPercent || 0);
    const nextEmployee = {
      ...(existing || {}),
      id: existing?.id || draft.id || createProfessionalId(),
      name: existing?.name || draft.displayName.trim(),
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      displayName: draft.displayName.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      active: draft.active !== false,
      offersServices: draft.offersServices !== false,
      employmentType: draft.employmentType,
      calendarColor: draft.calendarColor,
      internalNotes: draft.internalNotes,
      assignedServiceIds: draft.assignedServiceIds,
      professionalServiceSettings: draft.professionalServiceSettings,
      weeklySchedule: draft.weeklySchedule,
      scheduleExceptions: draft.scheduleExceptions,
      access: draft.access,
      economics: { ...draft.economics, defaultServiceCommissionPercent: nextCommission },
      commissionPercent: nextCommission,
      commissionHistory: commissionChanged ? [{ id: `employee-commission-${Date.now()}`, date: now, user: actor, previousValue: Number(existing.commissionPercent || 0), newValue: nextCommission }, ...(existing.commissionHistory || [])] : existing?.commissionHistory || [],
      publicProfile: draft.publicProfile,
      professionalHistory: [{ action: existing ? "professional_updated" : "professional_created", changedAt: now, changedBy: actor, professionalId: existing?.id || draft.id, professionalName: draft.displayName.trim(), changedFields: changedFields(existing ? employeeToProfessional(existing) : {}, draft) }, ...(existing?.professionalHistory || [])],
    };
    persistEmployees(existing ? employees.map((employee) => employee.id === existing.id ? nextEmployee : employee) : [...employees, nextEmployee]);
    setModalState(null);
    setNotice(`${nextEmployee.displayName || nextEmployee.name} guardada correctamente.`);
  };

  const handleAction = (action, professional) => {
    if (action === "edit") {
      setModalState({ mode: "edit", professional: clone(professional) });
      return;
    }
    if (action === "activate" || action === "deactivate") {
      saveProfessional({ ...professional, active: action === "activate" });
      return;
    }
    if (action === "agenda") setNotice("La Agenda utilizará esta configuración en una fase posterior.");
  };

  return <section className="module professionals-settings-demo">
    <div className="section-title"><div><h2>Profesionales</h2><span>Equipo real, servicios, horarios y datos económicos.</span></div><button type="button" onClick={() => setModalState({ mode: "create", professional: employeeToProfessional({ id: createProfessionalId(), name: "", active: true }) })}>Añadir profesional</button></div>
    {notice && <p className="success-message">{notice}</p>}
    <section className="summary-grid compact"><article className="metric"><span>Total profesionales</span><strong>{totals.total}</strong></article><article className="metric"><span>Activas</span><strong>{totals.active}</strong></article><article className="metric"><span>Ofrecen servicios</span><strong>{totals.serviceProviders}</strong></article><article className="metric"><span>Con acceso configurado</span><strong>{totals.withAccess}</strong></article></section>
    <section className="panel professional-demo-controls"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar profesional..." /><div className="segmented-controls"><button className={filter === "all" ? "active" : ""} type="button" onClick={() => setFilter("all")}>Todas</button><button className={filter === "active" ? "active" : ""} type="button" onClick={() => setFilter("active")}>Activas</button><button className={filter === "inactive" ? "active" : ""} type="button" onClick={() => setFilter("inactive")}>Inactivas</button></div></section>
    <ProfessionalsListDemo filter={filter} onAction={handleAction} professionals={professionals} query={query} servicesCatalog={services} allowDuplicate={false} />
    <ProfessionalHistoryDemo history={history} />
    {modalState && <ProfessionalModalDemo mode={modalState.mode} onClose={() => setModalState(null)} onSave={saveProfessional} professional={modalState.professional} servicesCatalog={services} persistent />}
  </section>;
}

export default ProfessionalsSettingsReal;
