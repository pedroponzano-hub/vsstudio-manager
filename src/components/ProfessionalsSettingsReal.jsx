import { useEffect, useMemo, useState } from "react";

import ProfessionalHistoryDemo from "./ProfessionalHistoryDemo.jsx";
import ProfessionalAccessPanel from "./ProfessionalAccessPanel.jsx";
import ProfessionalModalDemo from "./ProfessionalModalDemo.jsx";
import ProfessionalsListDemo from "./ProfessionalsListDemo.jsx";
import {
  buildProfessional,
  createProfessionalId,
  defaultWeeklySchedule,
  getAvailableProfessionalServices,
} from "../utils/professionalsConfigDemo.js";
import { normalizeRealEmployeeSettings } from "../utils/managerConfiguration.js";
import { normalizeProfessionalCommissionPolicy } from "../utils/commissionSchedule.js";
import {
  createOrLinkProfessionalAccess,
  listProfessionalAccesses,
  setProfessionalAccessActive,
} from "../services/ProfessionalAccessService.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function employeeToProfessional(employee = {}) {
  const commissionPolicy = normalizeProfessionalCommissionPolicy(employee);
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
      defaultServiceCommissionPercent: commissionPolicy.defaultCommissionPercent,
      commissionMode: commissionPolicy.commissionMode,
      commissionSchedule: commissionPolicy.commissionSchedule,
      commissionRuleEffectiveFrom: commissionPolicy.commissionRuleEffectiveFrom,
      outsideSchedule: commissionPolicy.outsideSchedule,
    },
    publicProfile: employee.publicProfile,
  });
  return {
    ...base,
    professionalServiceSettings: employee.professionalServiceSettings || base.professionalServiceSettings,
  };
}

function changedFields(previous = {}, next = {}) {
  return ["displayName", "active", "offersServices", "assignedServiceIds", "professionalServiceSettings", "weeklySchedule", "scheduleExceptions", "economics", "publicProfile"]
    .filter((field) => JSON.stringify(previous[field]) !== JSON.stringify(next[field]));
}

function ProfessionalsSettingsReal({ config = {}, currentUser, onSave }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [modalState, setModalState] = useState(null);
  const [notice, setNotice] = useState("");
  const [accessNotice, setAccessNotice] = useState("");
  const [accessError, setAccessError] = useState("");
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessesByProfessionalId, setAccessesByProfessionalId] = useState({});
  const employees = useMemo(() => normalizeRealEmployeeSettings(config), [config]);
  const professionals = useMemo(() => employees.map((employee) => {
    const professional = employeeToProfessional(employee);
    const remoteAccess = accessesByProfessionalId[professional.id];
    return {
      ...professional,
      access: remoteAccess || { enabled: false, active: false, permissions: [], role: "profesional", status: "none" },
    };
  }), [accessesByProfessionalId, employees]);
  const services = useMemo(() => getAvailableProfessionalServices(config.services || []), [config.services]);
  const history = useMemo(() => employees.flatMap((employee) => employee.professionalHistory || []).sort((first, second) => String(second.changedAt).localeCompare(String(first.changedAt))), [employees]);
  const actor = currentUser?.email || currentUser?.nombre || "Usuario no identificado";
  const totals = {
    total: professionals.length,
    active: professionals.filter((professional) => professional.active !== false).length,
    serviceProviders: professionals.filter((professional) => professional.offersServices).length,
    withAccess: professionals.filter((professional) => ["active", "pending"].includes(professional.access?.status)).length,
  };

  const loadAccesses = async () => {
    const accesses = await listProfessionalAccesses();
    setAccessesByProfessionalId(Object.fromEntries(accesses.map((access) => [access.professionalId, access])));
    return accesses;
  };

  useEffect(() => {
    let active = true;
    setAccessBusy(true);
    listProfessionalAccesses()
      .then((accesses) => {
        if (!active) return;
        setAccessesByProfessionalId(Object.fromEntries(accesses.map((access) => [access.professionalId, access])));
        setAccessError("");
      })
      .catch((error) => {
        if (active) setAccessError(error.message);
      })
      .finally(() => {
        if (active) setAccessBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const persistEmployees = (nextEmployees) => {
    return onSave({
      employeeSettings: nextEmployees,
      employees: nextEmployees.filter((employee) => employee.active !== false).map((employee) => employee.name),
    });
  };

  const saveProfessional = async (draft) => {
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
      ...(existing?.access ? { access: existing.access } : {}),
      economics: { ...draft.economics, defaultServiceCommissionPercent: nextCommission },
      commissionMode: draft.economics.commissionMode,
      commissionSchedule: draft.economics.commissionSchedule,
      commissionPercent: nextCommission,
      commissionHistory: commissionChanged ? [{ id: `employee-commission-${Date.now()}`, date: now, user: actor, previousValue: Number(existing.commissionPercent || 0), newValue: nextCommission }, ...(existing.commissionHistory || [])] : existing?.commissionHistory || [],
      publicProfile: draft.publicProfile,
      professionalHistory: [{ action: existing ? "professional_updated" : "professional_created", changedAt: now, changedBy: actor, professionalId: existing?.id || draft.id, professionalName: draft.displayName.trim(), changedFields: changedFields(existing ? employeeToProfessional(existing) : {}, draft) }, ...(existing?.professionalHistory || [])],
    };
    await persistEmployees(existing ? employees.map((employee) => employee.id === existing.id ? nextEmployee : employee) : [...employees, nextEmployee]);
    setModalState(null);
    setNotice(`${nextEmployee.displayName || nextEmployee.name} guardada correctamente.`);
  };

  const handleAction = async (action, professional) => {
    if (action === "edit") {
      setAccessError("");
      setAccessNotice("");
      setModalState({ mode: "edit", professional: clone(professional) });
      return;
    }
    if (action === "activate" || action === "deactivate") {
      try {
        await saveProfessional({ ...professional, active: action === "activate" });
      } catch {
        setNotice("No se pudo confirmar el cambio del profesional en Firebase.");
      }
      return;
    }
    if (action === "agenda") setNotice("La Agenda utilizará esta configuración en una fase posterior.");
  };

  const saveProfessionalAccess = async (input) => {
    const professionalId = modalState?.professional?.id;
    if (!professionalId || modalState?.mode !== "edit") {
      setAccessError("Guarda primero el profesional antes de crear su acceso.");
      return;
    }
    setAccessBusy(true);
    setAccessError("");
    setAccessNotice("");
    try {
      const result = await createOrLinkProfessionalAccess({ professionalId, ...input });
      setAccessesByProfessionalId((current) => ({ ...current, [professionalId]: result.access }));
      let refreshWarning = "";
      try {
        await loadAccesses();
      } catch {
        refreshWarning = " El acceso se guardó, pero no se pudo refrescar la lista completa.";
      }
      setAccessNotice(`${result.invitationWarning || (result.created ? "Acceso creado. Se ha solicitado el establecimiento seguro de contraseña." : "Acceso vinculado y actualizado correctamente.")}${refreshWarning}`);
    } catch (error) {
      setAccessError(error.message);
    } finally {
      setAccessBusy(false);
    }
  };

  const changeProfessionalAccessState = async (active) => {
    const professionalId = modalState?.professional?.id;
    if (!professionalId) return;
    setAccessBusy(true);
    setAccessError("");
    setAccessNotice("");
    try {
      const result = await setProfessionalAccessActive(professionalId, active);
      setAccessesByProfessionalId((current) => ({ ...current, [professionalId]: result.access }));
      let refreshWarning = "";
      try {
        await loadAccesses();
      } catch {
        refreshWarning = " No se pudo refrescar la lista completa.";
      }
      setAccessNotice(`${active ? "Acceso reactivado correctamente." : "Acceso deshabilitado sin borrar el profesional ni su historial."}${refreshWarning}`);
    } catch (error) {
      setAccessError(error.message);
    } finally {
      setAccessBusy(false);
    }
  };

  return <section className="module professionals-settings-demo">
    <div className="section-title"><div><h2>Profesionales</h2><span>Equipo real, servicios, horarios y datos económicos.</span></div><button type="button" onClick={() => setModalState({ mode: "create", professional: employeeToProfessional({ id: createProfessionalId(), name: "", active: true }) })}>Añadir profesional</button></div>
    {notice && <p className="success-message">{notice}</p>}
    <section className="summary-grid compact"><article className="metric"><span>Total profesionales</span><strong>{totals.total}</strong></article><article className="metric"><span>Activas</span><strong>{totals.active}</strong></article><article className="metric"><span>Ofrecen servicios</span><strong>{totals.serviceProviders}</strong></article><article className="metric"><span>Con acceso configurado</span><strong>{totals.withAccess}</strong></article></section>
    <section className="panel professional-demo-controls"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar profesional..." /><div className="segmented-controls"><button className={filter === "all" ? "active" : ""} type="button" onClick={() => setFilter("all")}>Todas</button><button className={filter === "active" ? "active" : ""} type="button" onClick={() => setFilter("active")}>Activas</button><button className={filter === "inactive" ? "active" : ""} type="button" onClick={() => setFilter("inactive")}>Inactivas</button></div></section>
    <ProfessionalsListDemo filter={filter} onAction={handleAction} professionals={professionals} query={query} servicesCatalog={services} allowDuplicate={false} />
    <ProfessionalHistoryDemo history={history} />
    {modalState && <ProfessionalModalDemo
      accessPanel={<ProfessionalAccessPanel
        access={accessesByProfessionalId[modalState.professional.id]}
        disabled={accessBusy || modalState.mode !== "edit"}
        error={accessError}
        notice={accessNotice}
        onSave={saveProfessionalAccess}
        onSetActive={changeProfessionalAccessState}
        professionalEmail={modalState.professional.email}
      />}
      mode={modalState.mode}
      onClose={() => {
        setModalState(null);
        setAccessError("");
        setAccessNotice("");
      }}
      onSave={saveProfessional}
      professional={modalState.professional}
      servicesCatalog={services}
      persistent
    />}
  </section>;
}

export default ProfessionalsSettingsReal;
