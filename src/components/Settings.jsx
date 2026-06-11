import { useEffect, useMemo, useRef, useState } from "react";

const emptyService = { category: "", name: "", duration: "", price: "", active: true };
const durationOptions = [
  { label: "15 min", value: 15 },
  { label: "20 min", value: 20 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 h", value: 60 },
  { label: "1 h 15 min", value: 75 },
  { label: "1 h 30 min", value: 90 },
  { label: "2 h", value: 120 },
];

function listToText(items) {
  return (items || []).join("\n");
}

function textToList(text) {
  return text.split("\n").map((item) => item.trim()).filter(Boolean);
}

function createServiceId() {
  return `service-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmployeeId(name = "") {
  return `employee-${String(name || Date.now()).toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(16).slice(2, 7)}`;
}

function normalizeCategory(value = "") {
  return String(value).trim().toLowerCase();
}

function formatDuration(minutes) {
  const value = Number(minutes || 0);
  if (!value) return "";
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (!hours) return `${rest} min`;
  if (!rest) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

function durationToMinutes(duration = "") {
  if (typeof duration === "number") return duration;
  const text = String(duration || "").toLowerCase();
  const hours = text.match(/(\d+(?:[.,]\d+)?)\s*h/);
  const minutes = text.match(/(\d+)\s*min/);
  const hourMinutes = hours ? Number(hours[1].replace(",", ".")) * 60 : 0;
  const extraMinutes = minutes ? Number(minutes[1]) : 0;
  const directMinutes = !hours && !minutes ? Number(text) : 0;
  return Math.round(hourMinutes + extraMinutes + (Number.isFinite(directMinutes) ? directMinutes : 0));
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && quoted && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && nextChar === "\n") index += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current);
  rows.push(row);

  const headers = (rows.shift() || []).map((header) => header.trim());
  return rows
    .filter((item) => item.some((value) => String(value || "").trim()))
    .map((item) => Object.fromEntries(headers.map((header, index) => [header, item[index] || ""])));
}

async function readClientImportFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();

  if (extension === "csv") {
    return parseCsv(await file.text());
  }

  if (extension === "xlsx") {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
  }

  throw new Error("Formato no soportado. Usa .xlsx o .csv");
}

function normalizeEmployeeSettings(config) {
  const settings = Array.isArray(config.employeeSettings) ? config.employeeSettings : [];
  const names = [...(config.employees || []), ...settings.map((employee) => employee.name)].filter(Boolean);
  const uniqueNames = Array.from(new Set(names.map((name) => String(name).trim()).filter(Boolean)));
  return uniqueNames.map((name) => {
    const existing = settings.find((employee) => String(employee.name || "").trim().toLowerCase() === name.toLowerCase());
    return {
      id: existing?.id || createEmployeeId(name),
      name,
      active: existing?.active !== false,
      commissionPercent: Number(existing?.commissionPercent || 0),
      commissionHistory: Array.isArray(existing?.commissionHistory) ? existing.commissionHistory : [],
    };
  });
}

function Settings({ config, onSave, onRestoreBaseConfig, onImportClients, currentUser, canManageEmployeeCommissions = false }) {
  const [form, setForm] = useState({
    paymentMethods: listToText(config.paymentMethods),
    entryChannels: listToText(config.entryChannels),
    expenseCategories: listToText(config.expenseCategories),
    monthlyGoal: config.monthlyGoal,
    loyaltyVisits: config.loyaltyVisits,
  });
  const [employeeSettings, setEmployeeSettings] = useState(() => normalizeEmployeeSettings(config));
  const [employeeDraft, setEmployeeDraft] = useState({ name: "", active: true, commissionPercent: "0" });
  const [services, setServices] = useState(config.services || []);
  const [serviceCategories, setServiceCategories] = useState(() => {
    const categories = [...(config.serviceCategories || []), ...(config.services || []).map((service) => service.category)];
    return Array.from(new Set(categories.filter(Boolean)));
  });
  const [serviceForm, setServiceForm] = useState(emptyService);
  const [editingServiceId, setEditingServiceId] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [showCategoryResults, setShowCategoryResults] = useState(false);
  const [serviceError, setServiceError] = useState("");
  const [editingCategory, setEditingCategory] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const categoryDropdownRef = useRef(null);

  useEffect(() => {
    const closeCategoryDropdown = (event) => {
      if (event.key === "Escape") {
        setShowCategoryResults(false);
        return;
      }
      if (event.type === "mousedown" && categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setShowCategoryResults(false);
      }
    };

    document.addEventListener("mousedown", closeCategoryDropdown);
    document.addEventListener("keydown", closeCategoryDropdown);

    return () => {
      document.removeEventListener("mousedown", closeCategoryDropdown);
      document.removeEventListener("keydown", closeCategoryDropdown);
    };
  }, []);

  const filteredServices = useMemo(() => {
    const query = serviceQuery.trim().toLowerCase();
    if (!query) return services;
    return services.filter((service) => (
      `${service.name} ${service.category} ${service.duration} ${formatDuration(service.durationMinutes)} ${service.price}`
        .toLowerCase()
        .includes(query)
    ));
  }, [serviceQuery, services]);

  const filteredCategories = useMemo(() => {
    const query = serviceForm.category.trim().toLowerCase();
    if (!query) return serviceCategories;
    return serviceCategories.filter((category) => category.toLowerCase().includes(query));
  }, [serviceForm.category, serviceCategories]);

  const groupedServices = useMemo(() => {
    return filteredServices.reduce((groups, service) => {
      const category = service.category || "Sin categoria";
      groups[category] = groups[category] || [];
      groups[category].push(service);
      return groups;
    }, {});
  }, [filteredServices]);

  const updateField = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const updateServiceField = (event) => {
    const { name, value, type, checked } = event.target;
    setServiceForm({ ...serviceForm, [name]: type === "checkbox" ? checked : value });
    setServiceError("");
  };

  const buildConfigPayload = (nextServices = services, nextCategories = serviceCategories, nextEmployees = employeeSettings) => ({
    employees: nextEmployees.filter((employee) => employee.active !== false).map((employee) => employee.name),
    employeeSettings: nextEmployees,
    services: nextServices,
    serviceCategories: nextCategories,
    paymentMethods: textToList(form.paymentMethods),
    entryChannels: textToList(form.entryChannels),
    expenseCategories: textToList(form.expenseCategories),
    monthlyGoal: Number(form.monthlyGoal || 0),
    loyaltyVisits: Number(form.loyaltyVisits || 5),
  });

  const persistServices = (nextServices, nextCategories = serviceCategories) => {
    setServices(nextServices);
    setServiceCategories(nextCategories);
    onSave(buildConfigPayload(nextServices, nextCategories));
  };

  const persistEmployees = (nextEmployees) => {
    setEmployeeSettings(nextEmployees);
    onSave(buildConfigPayload(services, serviceCategories, nextEmployees));
  };

  const withCommissionAudit = (employeesToSave, targetEmployeeId = "") => {
    const originalEmployees = normalizeEmployeeSettings(config);
    return employeesToSave.map((employee) => {
      if (targetEmployeeId && employee.id !== targetEmployeeId) return employee;
      const original = originalEmployees.find((item) => item.id === employee.id || item.name.toLowerCase() === employee.name.toLowerCase());
      const previousPercent = Number(original?.commissionPercent || 0);
      const nextPercent = Number(employee.commissionPercent || 0);
      if (nextPercent === previousPercent) return { ...employee, commissionPercent: nextPercent };

      return {
        ...employee,
        commissionPercent: nextPercent,
        commissionHistory: [
          {
            id: `employee-commission-${Date.now()}`,
            date: new Date().toISOString(),
            user: currentUser?.email || currentUser?.nombre || "Usuario no identificado",
            previousValue: previousPercent,
            newValue: nextPercent,
          },
          ...(employee.commissionHistory || []),
        ],
      };
    });
  };

  const updateEmployeeDraft = (employeeId, updates) => {
    if (!canManageEmployeeCommissions) return;
    setEmployeeSettings((current) => current.map((employee) => (
      employee.id === employeeId ? { ...employee, ...updates } : employee
    )));
  };

  const saveEmployee = (employeeId) => {
    if (!canManageEmployeeCommissions) return;
    persistEmployees(withCommissionAudit(employeeSettings, employeeId));
  };

  const createEmployee = () => {
    if (!canManageEmployeeCommissions || !employeeDraft.name.trim()) return;
    const exists = employeeSettings.some((employee) => employee.name.trim().toLowerCase() === employeeDraft.name.trim().toLowerCase());
    if (exists) return;
    persistEmployees([
      ...employeeSettings,
      {
        id: createEmployeeId(employeeDraft.name),
        name: employeeDraft.name.trim(),
        active: employeeDraft.active !== false,
        commissionPercent: Number(employeeDraft.commissionPercent || 0),
        commissionHistory: [],
      },
    ]);
    setEmployeeDraft({ name: "", active: true, commissionPercent: "0" });
  };

  const selectCategory = (category) => {
    setServiceForm((current) => ({ ...current, category }));
    setShowCategoryResults(false);
    setServiceError("");
  };

  const createCategory = () => {
    const category = serviceForm.category.trim();
    if (!category) return;

    const exists = serviceCategories.some((item) => normalizeCategory(item) === normalizeCategory(category));
    const nextCategories = exists ? serviceCategories : [...serviceCategories, category].sort((a, b) => a.localeCompare(b));
    setServiceCategories(nextCategories);
    setServiceForm((current) => ({ ...current, category }));
    setShowCategoryResults(false);
    onSave(buildConfigPayload(services, nextCategories));
  };

  const startEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryDraft(category);
    setServiceError("");
    setShowCategoryResults(false);
  };

  const cancelEditCategory = () => {
    setEditingCategory("");
    setCategoryDraft("");
  };

  const saveCategoryEdit = () => {
    const nextName = categoryDraft.trim();
    if (!editingCategory || !nextName) return;
    const duplicate = serviceCategories.some((category) => (
      normalizeCategory(category) === normalizeCategory(nextName) &&
      normalizeCategory(category) !== normalizeCategory(editingCategory)
    ));

    if (duplicate) {
      setServiceError("Ya existe una categoria con ese nombre.");
      return;
    }

    const nextCategories = serviceCategories
      .map((category) => (category === editingCategory ? nextName : category))
      .sort((a, b) => a.localeCompare(b));
    const nextServices = services.map((service) => (
      service.category === editingCategory ? { ...service, category: nextName } : service
    ));

    persistServices(nextServices, nextCategories);
    setServiceForm((current) => ({
      ...current,
      category: current.category === editingCategory ? nextName : current.category,
    }));
    cancelEditCategory();
  };

  const deleteCategory = (category) => {
    const hasServices = services.some((service) => service.category === category);
    if (hasServices) {
      setServiceError("No se puede eliminar esta categoria porque tiene servicios asociados");
      return;
    }

    const confirmed = window.confirm("Seguro que deseas eliminar esta categoria?");
    if (!confirmed) return;

    const nextCategories = serviceCategories.filter((item) => item !== category);
    persistServices(services, nextCategories);
    if (serviceForm.category === category) {
      setServiceForm((current) => ({ ...current, category: "" }));
    }
  };

  const saveService = (event) => {
    event.preventDefault();
    const category = serviceForm.category.trim();
    const name = serviceForm.name.trim();
    const durationMinutes = Number(serviceForm.duration || 0);
    const price = Number(serviceForm.price);

    if (!category || !name || !durationMinutes || Number.isNaN(price) || price <= 0) {
      setServiceError("Completa categoria, nombre, duracion y precio para guardar el servicio.");
      return;
    }

    const service = {
      id: editingServiceId || createServiceId(),
      category,
      name,
      duration: formatDuration(durationMinutes),
      durationMinutes,
      price,
      active: serviceForm.active !== false,
    };

    const nextCategories = serviceCategories.some((item) => normalizeCategory(item) === normalizeCategory(category))
      ? serviceCategories
      : [...serviceCategories, category].sort((a, b) => a.localeCompare(b));
    const nextServices = editingServiceId
      ? services.map((item) => (item.id === editingServiceId ? service : item))
      : [service, ...services];

    persistServices(nextServices, nextCategories);
    setServiceForm(emptyService);
    setEditingServiceId("");
    setServiceError("");
  };

  const editService = (service) => {
    setEditingServiceId(service.id);
    setServiceForm({
      category: service.category || "",
      name: service.name || "",
      duration: String(service.durationMinutes || durationToMinutes(service.duration)),
      price: String(service.price || ""),
      active: service.active !== false,
    });
    setServiceError("");
  };

  const cancelServiceEdit = () => {
    setEditingServiceId("");
    setServiceForm(emptyService);
    setServiceError("");
  };

  const toggleService = (serviceId) => {
    const nextServices = services.map((service) => (
      service.id === serviceId ? { ...service, active: service.active === false } : service
    ));
    persistServices(nextServices);
  };

  const deleteService = (serviceId) => {
    const confirmed = window.confirm("Seguro que deseas eliminar este servicio? Esta accion no se puede deshacer.");
    if (!confirmed) return;
    const nextServices = services.filter((service) => service.id !== serviceId);
    persistServices(nextServices);
    if (editingServiceId === serviceId) {
      cancelServiceEdit();
    }
  };

  const submit = (event) => {
    event.preventDefault();
    const auditedEmployees = withCommissionAudit(employeeSettings);
    onSave({
      employees: auditedEmployees.filter((employee) => employee.active !== false).map((employee) => employee.name),
      employeeSettings: auditedEmployees,
      services,
      serviceCategories,
      paymentMethods: textToList(form.paymentMethods),
      entryChannels: textToList(form.entryChannels),
      expenseCategories: textToList(form.expenseCategories),
      monthlyGoal: Number(form.monthlyGoal || 0),
      loyaltyVisits: Number(form.loyaltyVisits || 5),
    });
  };

  const restoreBaseConfig = () => {
    const confirmed = window.confirm("Restaurar configuracion VS Studio? No se borraran ventas, clientes ni servicios.");
    if (!confirmed) return;

    onRestoreBaseConfig();
    setForm({
      paymentMethods: "Efectivo\nTarjeta\nBizum\nBono\nTarjeta regalo",
      entryChannels: "Walk-in/Calle\nInstagram\nGoogle\nTreatwell\nBooksy\nWhatsApp\nRecomendacion\nTikTok\nCliente recurrente\nAcademia\nOtro",
      expenseCategories: "Suministros\nNominas\nAlquiler\nGestoria\nMateriales\nImpuestos\nComisiones bancarias\nMarketing\nMantenimiento\nServicios externos\nOtros",
      monthlyGoal: 4500,
      loyaltyVisits: 5,
    });
    setEmployeeSettings(normalizeEmployeeSettings({
      employees: ["Marianne", "Ambar", "Grace", "Leidys"],
      employeeSettings: ["Marianne", "Ambar", "Grace", "Leidys"].map((name) => ({ name, active: true, commissionPercent: 0, commissionHistory: [] })),
    }));
  };

  const importClients = async () => {
    if (!importFile || isImporting) return;

    setIsImporting(true);
    setImportProgress(12);
    setImportResult(null);

    try {
      const rows = await readClientImportFile(importFile);
      setImportProgress(55);
      const result = onImportClients(rows);
      setImportProgress(100);
      setImportResult(result);
    } catch (error) {
      setImportResult({
        imported: 0,
        updated: 0,
        duplicates: 0,
        errors: [error.message || "No se pudo importar el archivo"],
      });
      setImportProgress(100);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <section className="settings-layout">
      <form className="panel settings-form" onSubmit={submit}>
        <h2>Configuracion</h2>
        <section className="panel employee-settings-panel">
          <h3>Empleadas</h3>
          <div className="list">
            {employeeSettings.map((employee) => (
              <article className="list-item" key={employee.id}>
                <div>
                  <strong>{employee.name}</strong>
                  <span>{employee.active === false ? "Inactiva" : "Activa"} - Comision por defecto {Number(employee.commissionPercent || 0).toFixed(2)}%</span>
                  {(employee.commissionHistory || []).slice(0, 3).map((item) => (
                    <small key={item.id || item.date}>{item.date} - {item.user}: {item.previousValue}% -&gt; {item.newValue}%</small>
                  ))}
                </div>
                <div className="row-actions">
                  <input value={employee.name} disabled={!canManageEmployeeCommissions} onChange={(event) => updateEmployeeDraft(employee.id, { name: event.target.value })} placeholder="Nombre" />
                  <label className="check-field"><input type="checkbox" checked={employee.active !== false} disabled={!canManageEmployeeCommissions} onChange={(event) => updateEmployeeDraft(employee.id, { active: event.target.checked })} /> Activa</label>
                  <input type="number" min="0" step="0.01" value={employee.commissionPercent} disabled={!canManageEmployeeCommissions} onChange={(event) => updateEmployeeDraft(employee.id, { commissionPercent: event.target.value })} aria-label="Comision por defecto" />
                  {canManageEmployeeCommissions && <button type="button" onClick={() => saveEmployee(employee.id)}>Guardar</button>}
                </div>
              </article>
            ))}
          </div>
          {canManageEmployeeCommissions && (
            <div className="field-row">
              <input value={employeeDraft.name} onChange={(event) => setEmployeeDraft({ ...employeeDraft, name: event.target.value })} placeholder="Nueva empleada" />
              <label className="check-field"><input type="checkbox" checked={employeeDraft.active} onChange={(event) => setEmployeeDraft({ ...employeeDraft, active: event.target.checked })} /> Activa</label>
              <input type="number" min="0" step="0.01" value={employeeDraft.commissionPercent} onChange={(event) => setEmployeeDraft({ ...employeeDraft, commissionPercent: event.target.value })} placeholder="Comision %" />
              <button type="button" onClick={createEmployee}>Crear empleada</button>
            </div>
          )}
        </section>
        <div className="field-row">
          <label>Metodos pago<textarea name="paymentMethods" value={form.paymentMethods} onChange={updateField} /></label>
          <label>Canales de entrada<textarea name="entryChannels" value={form.entryChannels} onChange={updateField} /></label>
        </div>
        <div className="field-row">
          <label>Categorias gasto<textarea name="expenseCategories" value={form.expenseCategories} onChange={updateField} /></label>
        </div>
        <div className="field-row">
          <div className="inline-form">
            <label>Objetivo mensual<input type="number" name="monthlyGoal" value={form.monthlyGoal} onChange={updateField} /></label>
            <label>Visitas fidelizacion<input type="number" min="1" name="loyaltyVisits" value={form.loyaltyVisits} onChange={updateField} /></label>
          </div>
        </div>
        <div className="row-actions">
          <button type="submit">Guardar configuracion</button>
          <button className="secondary-button" type="button" onClick={restoreBaseConfig}>Restaurar configuracion VS Studio</button>
        </div>
      </form>

      <section className="panel import-panel">
        <div className="section-title">
          <h2>Importar clientes</h2>
          <span>Treatwell Excel / CSV</span>
        </div>
        <div className="import-controls">
          <label>
            Archivo .xlsx o .csv
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={(event) => {
                setImportFile(event.target.files?.[0] || null);
                setImportProgress(0);
                setImportResult(null);
              }}
            />
          </label>
          <button type="button" onClick={importClients} disabled={!importFile || isImporting}>
            {isImporting ? "Importando..." : "Importar clientes"}
          </button>
        </div>
        <div className="progress-track" aria-label="Progreso de importacion">
          <span style={{ width: `${importProgress}%` }} />
        </div>
        {importResult && (
          <div className="import-result">
            <article><span>Clientes importados</span><strong>{importResult.imported}</strong></article>
            <article><span>Duplicados omitidos</span><strong>{importResult.duplicates}</strong></article>
            <article><span>Clientes actualizados</span><strong>{importResult.updated}</strong></article>
            <article><span>Errores</span><strong>{importResult.errors.length}</strong></article>
            {importResult.errors.length > 0 && (
              <div className="import-errors">
                {importResult.errors.slice(0, 8).map((error) => <p key={error}>{error}</p>)}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="panel services-panel">
        <div className="section-title">
          <h2>Servicios</h2>
          <span>{services.length} servicios</span>
        </div>
        <form className="service-form advanced" onSubmit={saveService}>
          <label className="service-search-field" ref={categoryDropdownRef}>
            Categoria
            <input
              name="category"
              value={serviceForm.category}
              onChange={(event) => {
                updateServiceField(event);
                setShowCategoryResults(Boolean(event.target.value.trim()));
              }}
              onFocus={() => setShowCategoryResults(true)}
              onBlur={() => window.setTimeout(() => setShowCategoryResults(false), 120)}
              placeholder="Buscar o crear categoria"
            />
            {showCategoryResults && (
              <div className="service-results">
                {filteredCategories.map((category) => (
                  <button className="service-result" type="button" key={category} onMouseDown={() => selectCategory(category)}>
                    <strong>{category}</strong>
                    <span>Categoria existente</span>
                  </button>
                ))}
                {serviceForm.category.trim() && !serviceCategories.some((category) => normalizeCategory(category) === normalizeCategory(serviceForm.category)) && (
                  <button className="service-result custom-result" type="button" onMouseDown={createCategory}>
                    <strong>+ Crear categoria</strong>
                    <span>{serviceForm.category.trim()}</span>
                  </button>
                )}
                {filteredCategories.length === 0 && !serviceForm.category.trim() && <p className="empty-state">Escribe para buscar categorias.</p>}
              </div>
            )}
          </label>
          <label>Nombre<input name="name" value={serviceForm.name} onChange={updateServiceField} placeholder="Nombre exacto del servicio" /></label>
          <label>
            Duracion
            <select name="duration" value={serviceForm.duration} onChange={updateServiceField}>
              <option value="">Seleccionar...</option>
              {durationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>Precio<input type="number" min="0" step="0.01" name="price" value={serviceForm.price} onChange={updateServiceField} placeholder="0.00" /></label>
          <label className="check-field"><input type="checkbox" name="active" checked={serviceForm.active} onChange={updateServiceField} /> Activo</label>
          <button type="submit">{editingServiceId ? "Guardar cambios" : "Crear servicio"}</button>
          {editingServiceId && <button className="secondary-button" type="button" onClick={cancelServiceEdit}>Cancelar edicion</button>}
        </form>
        {serviceError && <p className="auth-error">{serviceError}</p>}
        <section className="service-category">
          <h3>Categorias de servicios</h3>
          <div className="list">
            {serviceCategories.length === 0 && <p className="empty-state">Aun no hay categorias creadas.</p>}
            {serviceCategories.map((category) => (
              <article className="list-item" key={category}>
                {editingCategory === category ? (
                  <>
                    <input value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} />
                    <div className="row-actions">
                      <button type="button" onClick={saveCategoryEdit}>Guardar</button>
                      <button className="secondary-button" type="button" onClick={cancelEditCategory}>Cancelar</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <strong>{category}</strong>
                      <span>{services.filter((service) => service.category === category).length} servicios asociados</span>
                    </div>
                    <div className="row-actions">
                      <button type="button" onClick={() => startEditCategory(category)}>Editar</button>
                      <button className="danger-button" type="button" onClick={() => deleteCategory(category)}>Eliminar</button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        </section>
        <label>Buscar servicio<input value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} placeholder="categoria, nombre, precio o duracion..." /></label>
        <div className="service-category-list">
          {Object.entries(groupedServices).map(([category, categoryServices]) => (
            <section className="service-category" key={category}>
              <h3>{category}</h3>
              <div className="list">
                {categoryServices.map((service) => (
                  <article className={service.active === false ? "list-item muted-item" : "list-item"} key={service.id}>
                    <div>
                      <strong>{service.name}</strong>
                      <span>{service.duration || formatDuration(service.durationMinutes) || "Sin duracion"} - {Number(service.price || 0).toFixed(2)} EUR - {service.active === false ? "Inactivo" : "Activo"}</span>
                    </div>
                    <div className="row-actions">
                      <button type="button" onClick={() => editService(service)}>Editar</button>
                      <button className="secondary-button" type="button" onClick={() => toggleService(service.id)}>{service.active === false ? "Activar" : "Desactivar"}</button>
                      <button className="danger-button" type="button" onClick={() => deleteService(service.id)}>Eliminar</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
          {filteredServices.length === 0 && <p className="empty-state">No hay servicios con esa busqueda.</p>}
        </div>
      </section>
    </section>
  );
}

export default Settings;
