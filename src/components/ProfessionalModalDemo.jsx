import { useMemo, useState } from "react";

import {
  demoServiceCategories,
  exceptionTypesDemo,
  formatServiceDuration,
  professionalDemoRoles,
  professionalPermissionGroups,
  servicesByDemoCategory,
  weekDaysDemo,
} from "../utils/professionalsConfigDemo.js";

const tabs = [
  ["basic", "Información básica"],
  ["services", "Servicios"],
  ["schedule", "Horarios"],
  ["permissions", "Permisos"],
  ["economics", "Datos económicos"],
  ["public", "Perfil público"],
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateSchedule(weeklySchedule) {
  for (const [dayKey, dayLabel] of weekDaysDemo) {
    const shifts = weeklySchedule[dayKey]?.shifts || [];
    for (const shift of shifts) {
      if (shift.end <= shift.start) return `${dayLabel}: la hora final debe ser posterior a la inicial.`;
    }
    const sorted = [...shifts].sort((a, b) => a.start.localeCompare(b.start));
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index].start < sorted[index - 1].end) return `${dayLabel}: hay turnos solapados.`;
      if (sorted[index].start === sorted[index - 1].start && sorted[index].end === sorted[index - 1].end) return `${dayLabel}: hay turnos duplicados.`;
    }
  }
  return "";
}

function ProfessionalModalDemo({ mode = "create", onClose, onSave, professional }) {
  const [draft, setDraft] = useState(() => clone(professional));
  const [activeTab, setActiveTab] = useState("basic");
  const [serviceQuery, setServiceQuery] = useState("");
  const [openCategories, setOpenCategories] = useState(Object.fromEntries(demoServiceCategories.map((category, index) => [category, index === 0])));
  const [error, setError] = useState("");
  const groupedServices = useMemo(() => servicesByDemoCategory(), []);
  const selectedCount = draft.assignedServiceIds.length;

  const update = (updates) => {
    setDraft((current) => ({ ...current, ...updates }));
    setError("");
  };
  const updateNested = (section, updates) => {
    setDraft((current) => ({ ...current, [section]: { ...current[section], ...updates } }));
    setError("");
  };
  const toggleService = (serviceId) => {
    const enabled = draft.assignedServiceIds.includes(serviceId);
    const assignedServiceIds = enabled
      ? draft.assignedServiceIds.filter((id) => id !== serviceId)
      : [...draft.assignedServiceIds, serviceId];
    const professionalServiceSettings = assignedServiceIds.map((id) => (
      draft.professionalServiceSettings.find((item) => item.serviceId === id) || { serviceId: id, enabled: true, customDurationMinutes: "" }
    ));
    update({ assignedServiceIds, professionalServiceSettings });
  };
  const setCategoryServices = (services, selected) => {
    const ids = services.map((service) => service.id);
    const assignedServiceIds = selected
      ? Array.from(new Set([...draft.assignedServiceIds, ...ids]))
      : draft.assignedServiceIds.filter((id) => !ids.includes(id));
    const professionalServiceSettings = assignedServiceIds.map((id) => (
      draft.professionalServiceSettings.find((item) => item.serviceId === id) || { serviceId: id, enabled: true, customDurationMinutes: "" }
    ));
    update({ assignedServiceIds, professionalServiceSettings });
  };
  const updateServiceDuration = (serviceId, value) => {
    update({
      professionalServiceSettings: draft.professionalServiceSettings.map((setting) => (
        setting.serviceId === serviceId ? { ...setting, customDurationMinutes: value } : setting
      )),
    });
  };
  const updateShift = (dayKey, shiftIndex, updates) => {
    const day = draft.weeklySchedule[dayKey];
    const shifts = day.shifts.map((shift, index) => (index === shiftIndex ? { ...shift, ...updates } : shift));
    update({ weeklySchedule: { ...draft.weeklySchedule, [dayKey]: { ...day, shifts } } });
  };
  const addShift = (dayKey) => {
    const day = draft.weeklySchedule[dayKey];
    update({ weeklySchedule: { ...draft.weeklySchedule, [dayKey]: { ...day, enabled: true, shifts: [...day.shifts, { start: "10:00", end: "14:00" }] } } });
  };
  const removeShift = (dayKey, shiftIndex) => {
    const day = draft.weeklySchedule[dayKey];
    update({ weeklySchedule: { ...draft.weeklySchedule, [dayKey]: { ...day, shifts: day.shifts.filter((_, index) => index !== shiftIndex) } } });
  };
  const copyMondayToAll = () => {
    const monday = clone(draft.weeklySchedule.monday);
    update({ weeklySchedule: Object.fromEntries(weekDaysDemo.map(([dayKey]) => [dayKey, clone(monday)])) });
  };
  const addException = () => {
    update({
      scheduleExceptions: [
        ...draft.scheduleExceptions,
        { id: `exception-${Date.now()}`, professionalId: draft.id, startDate: "2026-07-20", endDate: "2026-07-20", allDay: true, startTime: "", endTime: "", type: "Bloqueo manual", reason: "" },
      ],
    });
  };
  const updateException = (exceptionId, updates) => {
    update({ scheduleExceptions: draft.scheduleExceptions.map((item) => (item.id === exceptionId ? { ...item, ...updates } : item)) });
  };
  const togglePermission = (permissionId) => {
    const permissions = draft.access.permissions.includes(permissionId)
      ? draft.access.permissions.filter((item) => item !== permissionId)
      : [...draft.access.permissions, permissionId];
    updateNested("access", { permissions, role: "Personalizado" });
  };
  const changeRole = (role) => updateNested("access", { role, permissions: professionalDemoRoles[role] || [] });
  const save = () => {
    if (!draft.firstName.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    const badCustomDuration = draft.professionalServiceSettings.some((setting) => setting.customDurationMinutes !== "" && Number(setting.customDurationMinutes) < 5);
    if (badCustomDuration) {
      setError("Las duraciones personalizadas deben ser de al menos 5 minutos.");
      return;
    }
    const scheduleError = validateSchedule(draft.weeklySchedule);
    if (scheduleError) {
      setError(scheduleError);
      return;
    }
    onSave?.(draft);
  };

  return (
    <section className="sale-history-modal" role="dialog" aria-modal="true" aria-label="Profesional demo">
      <article className="sale-history-dialog professional-modal-demo">
        <div className="section-title compact-section-title">
          <div>
            <h2>{mode === "create" ? "Añadir profesional" : `Editar ${draft.displayName}`}</h2>
            <span>Modo demo local — los cambios desaparecerán al recargar</span>
          </div>
          <button className="secondary-button" type="button" onClick={onClose}>Cerrar</button>
        </div>
        <div className="professional-modal-tabs">
          {tabs.map(([key, label]) => (
            <button className={activeTab === key ? "active" : ""} key={key} type="button" onClick={() => setActiveTab(key)}>{label}</button>
          ))}
        </div>
        <div className="professional-modal-body">
          {activeTab === "basic" && (
            <section className="professional-tab-grid">
              <label>Nombre<input value={draft.firstName} onChange={(event) => update({ firstName: event.target.value, displayName: draft.displayName || event.target.value })} /></label>
              <label>Apellidos<input value={draft.lastName} onChange={(event) => update({ lastName: event.target.value })} /></label>
              <label>Nombre visible<input value={draft.displayName} onChange={(event) => update({ displayName: event.target.value })} /></label>
              <label>Correo electrónico<input type="email" value={draft.email} onChange={(event) => update({ email: event.target.value })} /></label>
              <label>Teléfono<input value={draft.phone} onChange={(event) => update({ phone: event.target.value })} /></label>
              <label>Estado<select value={draft.active ? "active" : "inactive"} onChange={(event) => update({ active: event.target.value === "active" })}><option value="active">Activa</option><option value="inactive">Inactiva</option></select></label>
              <label className="inline-check"><input checked={draft.offersServices} type="checkbox" onChange={(event) => update({ offersServices: event.target.checked })} /> Ofrece tratamientos y servicios</label>
              <label>Tipo de vinculación<select value={draft.employmentType} onChange={(event) => update({ employmentType: event.target.value })}><option>Empleada</option><option>Autónoma</option><option>Colaboradora</option></select></label>
              <label>Color para agenda<input type="color" value={draft.calendarColor} onChange={(event) => update({ calendarColor: event.target.value })} /></label>
              <label className="wide-field">Observaciones internas<textarea value={draft.internalNotes} onChange={(event) => update({ internalNotes: event.target.value })} /></label>
            </section>
          )}
          {activeTab === "services" && (
            <section className="professional-services-tab">
              <div className="professional-services-toolbar">
                <input value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} placeholder="Buscar servicios" />
                <p className="empty-state">{selectedCount} servicios seleccionados</p>
              </div>
              <div className="professional-service-category-list">
                {Object.entries(groupedServices).map(([category, services]) => {
                  const filtered = services.filter((service) => `${service.name} ${service.category}`.toLowerCase().includes(serviceQuery.toLowerCase()));
                  if (filtered.length === 0) return null;
                  const selectedInCategory = filtered.filter((service) => draft.assignedServiceIds.includes(service.id)).length;
                  return (
                    <details className="professional-service-category" key={category} open={openCategories[category]} onToggle={(event) => setOpenCategories((current) => ({ ...current, [category]: event.currentTarget.open }))}>
                      <summary><span>{category}</span><strong>{selectedInCategory}/{filtered.length}</strong></summary>
                      <div className="reset-actions">
                        <button type="button" onClick={() => setCategoryServices(filtered, true)}>Seleccionar categoría</button>
                        <button className="secondary-button" type="button" onClick={() => setCategoryServices(filtered, false)}>Quitar categoría</button>
                      </div>
                      {filtered.map((service) => {
                        const selected = draft.assignedServiceIds.includes(service.id);
                        const setting = draft.professionalServiceSettings.find((item) => item.serviceId === service.id);
                        return (
                          <div className="professional-service-row" key={service.id}>
                            <label className="inline-check" title={service.name}>
                              <input checked={selected} type="checkbox" onChange={() => toggleService(service.id)} />
                              <span>{service.name}</span>
                            </label>
                            <span className="professional-standard-duration">Estándar: {formatServiceDuration(service)}</span>
                            {selected && <input min="5" placeholder="Duración personalizada" type="number" value={setting?.customDurationMinutes || ""} onChange={(event) => updateServiceDuration(service.id, event.target.value)} />}
                          </div>
                        );
                      })}
                    </details>
                  );
                })}
              </div>
            </section>
          )}
          {activeTab === "schedule" && (
            <section className="professional-schedule-tab">
              <button className="secondary-button" type="button" onClick={copyMondayToAll}>Copiar lunes a toda la semana</button>
              {weekDaysDemo.map(([dayKey, label]) => {
                const day = draft.weeklySchedule[dayKey];
                return (
                  <article className="professional-day-row" key={dayKey}>
                    <label className="inline-check"><input checked={day.enabled} type="checkbox" onChange={(event) => update({ weeklySchedule: { ...draft.weeklySchedule, [dayKey]: { ...day, enabled: event.target.checked } } })} /> {label}</label>
                    {day.shifts.map((shift, index) => (
                      <div className="field-row" key={`${dayKey}-${index}`}>
                        <input type="time" value={shift.start} onChange={(event) => updateShift(dayKey, index, { start: event.target.value })} />
                        <input type="time" value={shift.end} onChange={(event) => updateShift(dayKey, index, { end: event.target.value })} />
                        <button className="danger-button" type="button" onClick={() => removeShift(dayKey, index)}>Eliminar turno</button>
                      </div>
                    ))}
                    <button className="secondary-button" type="button" onClick={() => addShift(dayKey)}>Añadir turno</button>
                  </article>
                );
              })}
              <section className="professional-exceptions-box">
                <div className="section-title compact-section-title"><h3>Excepciones y bloqueos</h3><button type="button" onClick={addException}>Añadir bloqueo</button></div>
                {draft.scheduleExceptions.map((exception) => (
                  <div className="professional-exception-row" key={exception.id}>
                    <select value={exception.type} onChange={(event) => updateException(exception.id, { type: event.target.value })}>{exceptionTypesDemo.map((type) => <option key={type}>{type}</option>)}</select>
                    <input type="date" value={exception.startDate} onChange={(event) => updateException(exception.id, { startDate: event.target.value })} />
                    <input type="date" value={exception.endDate} onChange={(event) => updateException(exception.id, { endDate: event.target.value })} />
                    <label className="inline-check"><input checked={exception.allDay} type="checkbox" onChange={(event) => updateException(exception.id, { allDay: event.target.checked })} /> Todo el día</label>
                    {!exception.allDay && <><input type="time" value={exception.startTime} onChange={(event) => updateException(exception.id, { startTime: event.target.value })} /><input type="time" value={exception.endTime} onChange={(event) => updateException(exception.id, { endTime: event.target.value })} /></>}
                    <input value={exception.reason} onChange={(event) => updateException(exception.id, { reason: event.target.value })} placeholder="Motivo" />
                  </div>
                ))}
              </section>
            </section>
          )}
          {activeTab === "permissions" && (
            <section className="professional-permissions-tab">
              <label className="inline-check"><input checked={draft.access.enabled} type="checkbox" onChange={(event) => updateNested("access", { enabled: event.target.checked })} /> Tiene acceso al sistema</label>
              <label>Rol demo<select value={draft.access.role} onChange={(event) => changeRole(event.target.value)}>{Object.keys(professionalDemoRoles).map((role) => <option key={role}>{role}</option>)}</select></label>
              {Object.entries(professionalPermissionGroups).map(([group, permissions]) => (
                <article className="professional-permission-group" key={group}>
                  <h3>{group}</h3>
                  {permissions.map(([permissionId, label]) => (
                    <label className="inline-check" key={permissionId}><input checked={draft.access.permissions.includes(permissionId)} type="checkbox" onChange={() => togglePermission(permissionId)} /> {label}</label>
                  ))}
                </article>
              ))}
            </section>
          )}
          {activeTab === "economics" && (
            <section className="professional-tab-grid">
              <label>Comisión predeterminada de servicios<input min="0" step="0.01" type="number" value={draft.economics.defaultServiceCommissionPercent} onChange={(event) => updateNested("economics", { defaultServiceCommissionPercent: event.target.value })} /></label>
              <label>Comisión de productos<input min="0" step="0.01" type="number" value={draft.economics.productCommissionPercent} onChange={(event) => updateNested("economics", { productCommissionPercent: event.target.value })} /></label>
              <label className="inline-check"><input checked={draft.economics.hasFixedSalary} type="checkbox" onChange={(event) => updateNested("economics", { hasFixedSalary: event.target.checked })} /> Tiene salario fijo</label>
              <label>Tipo de vinculación<select value={draft.employmentType} onChange={(event) => update({ employmentType: event.target.value })}><option>Empleada</option><option>Autónoma</option><option>Colaboradora</option></select></label>
              <label className="wide-field">Observaciones económicas internas<textarea value={draft.economics.internalEconomicNotes} onChange={(event) => updateNested("economics", { internalEconomicNotes: event.target.value })} /></label>
            </section>
          )}
          {activeTab === "public" && (
            <section className="professional-tab-grid">
              <label>Nombre público<input value={draft.publicProfile.publicName} onChange={(event) => updateNested("publicProfile", { publicName: event.target.value })} /></label>
              <label>Título profesional<input value={draft.publicProfile.professionalTitle} onChange={(event) => updateNested("publicProfile", { professionalTitle: event.target.value })} /></label>
              <label>Foto o avatar demo<input value={draft.publicProfile.photoDemo} onChange={(event) => updateNested("publicProfile", { photoDemo: event.target.value })} /></label>
              <label>Orden de aparición<input type="number" value={draft.publicProfile.displayOrder} onChange={(event) => updateNested("publicProfile", { displayOrder: event.target.value })} /></label>
              <label className="inline-check"><input checked={draft.publicProfile.visibleOnline} type="checkbox" onChange={(event) => updateNested("publicProfile", { visibleOnline: event.target.checked })} /> Visible en reservas online</label>
              <label className="wide-field">Biografía corta<textarea value={draft.publicProfile.shortBio} onChange={(event) => updateNested("publicProfile", { shortBio: event.target.value })} /></label>
              <label className="wide-field">Especialidades visibles<input value={(draft.publicProfile.visibleSpecialties || []).join(", ")} onChange={(event) => updateNested("publicProfile", { visibleSpecialties: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label>
            </section>
          )}
        </div>
        {error && <p className="auth-error">{error}</p>}
        <div className="professional-modal-footer">
          <button type="button" onClick={save}>Guardar</button>
          <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
        </div>
      </article>
    </section>
  );
}

export default ProfessionalModalDemo;
