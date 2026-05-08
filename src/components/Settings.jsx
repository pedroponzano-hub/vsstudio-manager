import { useMemo, useState } from "react";

const emptyService = { category: "", name: "", duration: "", price: "", active: true };

function listToText(items) {
  return (items || []).join("\n");
}

function textToList(text) {
  return text.split("\n").map((item) => item.trim()).filter(Boolean);
}

function createServiceId() {
  return `service-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function Settings({ config, onSave, onRestoreBaseConfig, onImportClients }) {
  const [form, setForm] = useState({
    employees: listToText(config.employees),
    paymentMethods: listToText(config.paymentMethods),
    entryChannels: listToText(config.entryChannels),
    expenseCategories: listToText(config.expenseCategories),
    monthlyGoal: config.monthlyGoal,
    loyaltyVisits: config.loyaltyVisits,
  });
  const [services, setServices] = useState(config.services || []);
  const [serviceForm, setServiceForm] = useState(emptyService);
  const [editingServiceId, setEditingServiceId] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const filteredServices = useMemo(() => {
    const query = serviceQuery.trim().toLowerCase();
    if (!query) return services;
    return services.filter((service) => `${service.name} ${service.category} ${service.duration}`.toLowerCase().includes(query));
  }, [serviceQuery, services]);

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
  };

  const saveService = (event) => {
    event.preventDefault();
    if (!serviceForm.name.trim()) return;

    const service = {
      id: editingServiceId || createServiceId(),
      category: serviceForm.category.trim() || "Sin categoria",
      name: serviceForm.name.trim(),
      duration: serviceForm.duration.trim(),
      price: Number(serviceForm.price || 0),
      active: serviceForm.active !== false,
    };

    setServices((current) =>
      editingServiceId ? current.map((item) => (item.id === editingServiceId ? service : item)) : [service, ...current]
    );
    setServiceForm(emptyService);
    setEditingServiceId("");
  };

  const editService = (service) => {
    setEditingServiceId(service.id);
    setServiceForm({
      category: service.category || "",
      name: service.name || "",
      duration: service.duration || "",
      price: String(service.price || 0),
      active: service.active !== false,
    });
  };

  const toggleService = (serviceId) => {
    setServices((current) => current.map((service) => (
      service.id === serviceId ? { ...service, active: service.active === false } : service
    )));
  };

  const deleteService = (serviceId) => {
    const confirmed = window.confirm("Seguro que deseas eliminar este servicio? Esta accion no se puede deshacer.");
    if (!confirmed) return;
    setServices((current) => current.filter((service) => service.id !== serviceId));
    if (editingServiceId === serviceId) {
      setEditingServiceId("");
      setServiceForm(emptyService);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    onSave({
      employees: textToList(form.employees),
      services,
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
      employees: "Marianne\nAmbar\nGrace\nLeidys",
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
      <form className="panel settings-form" onSubmit={submit}>
        <h2>Configuracion</h2>
        <div className="field-row">
          <label>Empleadas<textarea name="employees" value={form.employees} onChange={updateField} /></label>
          <label>Metodos pago<textarea name="paymentMethods" value={form.paymentMethods} onChange={updateField} /></label>
        </div>
        <div className="field-row">
          <label>Canales de entrada<textarea name="entryChannels" value={form.entryChannels} onChange={updateField} /></label>
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
          <label>Categoria<input name="category" value={serviceForm.category} onChange={updateServiceField} placeholder="Manicuras y tratamientos" /></label>
          <label>Nombre<input name="name" value={serviceForm.name} onChange={updateServiceField} placeholder="Manicura semipermanente" /></label>
          <label>Duracion<input name="duration" value={serviceForm.duration} onChange={updateServiceField} placeholder="45 min" /></label>
          <label>Precio<input type="number" min="0" step="0.01" name="price" value={serviceForm.price} onChange={updateServiceField} placeholder="20" /></label>
          <label className="check-field"><input type="checkbox" name="active" checked={serviceForm.active} onChange={updateServiceField} /> Activo</label>
          <button type="submit">{editingServiceId ? "Guardar servicio" : "Crear servicio"}</button>
          {editingServiceId && <button className="secondary-button" type="button" onClick={() => { setEditingServiceId(""); setServiceForm(emptyService); }}>Cancelar</button>}
        </form>
        <label>Buscar servicio<input value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} placeholder="mani, cejas, lifting..." /></label>
        <div className="service-category-list">
          {Object.entries(groupedServices).map(([category, categoryServices]) => (
            <section className="service-category" key={category}>
              <h3>{category}</h3>
              <div className="list">
                {categoryServices.map((service) => (
                  <article className={service.active === false ? "list-item muted-item" : "list-item"} key={service.id}>
                    <div>
                      <strong>{service.name}</strong>
                      <span>{service.duration || "Sin duracion"} - {Number(service.price || 0).toFixed(2)} EUR - {service.active === false ? "Inactivo" : "Activo"}</span>
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
