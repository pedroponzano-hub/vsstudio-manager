import { useEffect, useMemo, useRef, useState } from "react";
import { historicalReferenceExists, isProductCatalogItem } from "../utils/managerConfiguration.js";

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

function Settings({ config, onSave, onRestoreBaseConfig, onImportClients, sales = [], view = "general" }) {
  const [form, setForm] = useState({
    paymentMethods: listToText(config.paymentMethods),
    entryChannels: listToText(config.entryChannels),
    expenseCategories: listToText(config.expenseCategories),
    monthlyGoal: config.monthlyGoal,
    loyaltyVisits: config.loyaltyVisits,
  });
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
    const sectionServices = services.filter((service) => view === "products" ? isProductCatalogItem(service) : !isProductCatalogItem(service));
    if (!query) return sectionServices;
    return sectionServices.filter((service) => (
      `${service.name} ${service.category} ${service.duration} ${formatDuration(service.durationMinutes)} ${service.price}`
        .toLowerCase()
        .includes(query)
    ));
  }, [serviceQuery, services, view]);

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

  const buildConfigPayload = (nextServices = services, nextCategories = serviceCategories) => ({
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

    if (!category || !name || (view !== "products" && !durationMinutes) || Number.isNaN(price) || price <= 0) {
      setServiceError(view === "products" ? "Completa categoría, nombre y precio para guardar el producto." : "Completa categoria, nombre, duracion y precio para guardar el servicio.");
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
      ...(view === "products" ? { type: "product", isProduct: true } : {}),
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
    const service = services.find((item) => item.id === serviceId);
    const hasHistoricalReferences = historicalReferenceExists(sales, service);
    if (hasHistoricalReferences) {
      setServiceError("Este elemento tiene referencias históricas y no puede eliminarse. Se ha desactivado para conservarlas.");
      persistServices(services.map((item) => item.id === serviceId ? { ...item, active: false } : item));
      return;
    }
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
    if (view === "catalogs") {
      onSave({ paymentMethods: textToList(form.paymentMethods), entryChannels: textToList(form.entryChannels), expenseCategories: textToList(form.expenseCategories) });
      return;
    }
    onSave({ monthlyGoal: Number(form.monthlyGoal || 0), loyaltyVisits: Number(form.loyaltyVisits || 5) });
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
      {(view === "general" || view === "catalogs") && (
      <form className={`panel settings-form settings-form-${view}`} onSubmit={submit}>
        <h2>{view === "general" ? "Configuración general" : "Catálogos"}</h2>
        {view === "catalogs" && <>
        <div className="manager-catalog-grid">
          <label>Metodos pago<textarea name="paymentMethods" value={form.paymentMethods} onChange={updateField} /></label>
          <label>Canales de entrada<textarea name="entryChannels" value={form.entryChannels} onChange={updateField} /></label>
          <label>Categorias gasto<textarea name="expenseCategories" value={form.expenseCategories} onChange={updateField} /></label>
        </div>
        </>}
        {view === "general" && <>
        <div className="field-row">
          <div className="inline-form">
            <label>Objetivo mensual<input type="number" name="monthlyGoal" value={form.monthlyGoal} onChange={updateField} /></label>
            <label>Visitas fidelizacion<input type="number" min="1" name="loyaltyVisits" value={form.loyaltyVisits} onChange={updateField} /></label>
          </div>
        </div>
        </>}
        <div className="row-actions">
          <button type="submit">{view === "general" ? "Guardar configuración" : "Guardar catálogos"}</button>
          {view === "general" && <button className="secondary-button" type="button" onClick={restoreBaseConfig}>Restaurar configuracion VS Studio</button>}
        </div>
      </form>
      )}

      {view === "imports" && <section className="panel import-panel">
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
      </section>}

      {(view === "services" || view === "products") && <section className="panel services-panel">
        <div className="section-title">
          <h2>{view === "products" ? "Productos" : "Servicios"}</h2>
          <span>{filteredServices.length} {view === "products" ? "productos" : "servicios"}</span>
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
          {view === "services" && <label>
            Duracion
            <select name="duration" value={serviceForm.duration} onChange={updateServiceField}>
              <option value="">Seleccionar...</option>
              {durationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>}
          <label>Precio<input type="number" min="0" step="0.01" name="price" value={serviceForm.price} onChange={updateServiceField} placeholder="0.00" /></label>
          <label className="check-field"><input type="checkbox" name="active" checked={serviceForm.active} onChange={updateServiceField} /> Activo</label>
          <button type="submit">{editingServiceId ? "Guardar cambios" : view === "products" ? "Crear producto" : "Crear servicio"}</button>
          {editingServiceId && <button className="secondary-button" type="button" onClick={cancelServiceEdit}>Cancelar edicion</button>}
        </form>
        {serviceError && <p className="auth-error">{serviceError}</p>}
        {view === "services" && <section className="service-category">
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
        </section>}
        <label>Buscar {view === "products" ? "producto" : "servicio"}<input value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} placeholder="categoria, nombre, precio o duracion..." /></label>
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
      </section>}
    </section>
  );
}

export default Settings;
