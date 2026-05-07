import { useEffect, useMemo, useState } from "react";

const CUSTOM_SERVICE = "custom-service";
const CREATE_CLIENT_VALUE = "__create_client__";

function serviceSearchText(service) {
  return `${service.name} ${service.category} ${service.duration}`.toLowerCase();
}

function createLineId() {
  return `line-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function SalesForm({ clients, config, editingSale, onSave, onUpdate, onCreateClient, onCancelEdit, onDateChange }) {
  const catalogServices = (config.services || []).filter((service) => service.active !== false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    clientId: clients[0]?.id || "",
    employee: config.employees[0] || "",
    extra: "0",
    paymentMethod: config.paymentMethods[0] || "",
    commissionPercent: "10",
    notes: "",
  });
  const [saleServices, setSaleServices] = useState([]);
  const [serviceQuery, setServiceQuery] = useState("");
  const [showServiceResults, setShowServiceResults] = useState(false);
  const [customServiceName, setCustomServiceName] = useState("");
  const [customServicePrice, setCustomServicePrice] = useState("");
  const [showQuickClientForm, setShowQuickClientForm] = useState(false);
  const [quickClient, setQuickClient] = useState({ name: "", phone: "", email: "", observations: "" });

  useEffect(() => {
    if (!editingSale) return;

    const nextDate = editingSale.date || new Date().toISOString().slice(0, 10);
    setForm({
      date: nextDate,
      clientId: editingSale.clientId || "",
      employee: editingSale.employee || config.employees[0] || "",
      extra: String(editingSale.extra ?? 0),
      paymentMethod: editingSale.paymentMethod || config.paymentMethods[0] || "",
      commissionPercent: String(editingSale.commissionPercent ?? 0),
      notes: editingSale.notes || "",
    });
    setSaleServices((editingSale.services || []).map((service) => ({
      lineId: createLineId(),
      serviceId: service.serviceId || "",
      serviceName: service.serviceName || service.name || service.service || "",
      category: service.category || "",
      duration: service.duration || "",
      price: Number(service.price || 0),
      quantity: Number(service.quantity || 1),
    })));
    setServiceQuery("");
    setShowServiceResults(false);
    setCustomServiceName("");
    setCustomServicePrice("");
    onDateChange?.(nextDate);
  }, [editingSale, config.employees, config.paymentMethods, onDateChange]);

  const filteredServices = useMemo(() => {
    const query = serviceQuery.trim().toLowerCase();
    if (!query) return [];
    return catalogServices.filter((service) => serviceSearchText(service).includes(query)).slice(0, 20);
  }, [serviceQuery, catalogServices]);

  const totals = useMemo(() => {
    const subtotalServices = saleServices.reduce((total, service) => total + Number(service.price || 0) * Number(service.quantity || 1), 0);
    const extra = Number(form.extra || 0);
    const total = subtotalServices + extra;
    const ivaPercent = 21;
    const ivaAmount = (total * ivaPercent) / 121;
    const netWithoutVat = total - ivaAmount;
    const commissionAmount = total * (Number(form.commissionPercent || 0) / 100);
    const netAfterCommission = netWithoutVat - commissionAmount;

    return { subtotalServices, total, ivaPercent, ivaAmount, netWithoutVat, commissionAmount, netAfterCommission };
  }, [saleServices, form.extra, form.commissionPercent]);

  const updateField = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
    if (event.target.name === "date") {
      onDateChange?.(event.target.value);
    }
  };

  const updateClientField = (event) => {
    const value = event.target.value;
    if (value === CREATE_CLIENT_VALUE) {
      setShowQuickClientForm(true);
      setForm({ ...form, clientId: "" });
      return;
    }

    setShowQuickClientForm(false);
    setForm({ ...form, clientId: value });
  };

  const updateQuickClientField = (event) => {
    setQuickClient({ ...quickClient, [event.target.name]: event.target.value });
  };

  const saveQuickClient = () => {
    if (!quickClient.name.trim()) return;
    const client = onCreateClient?.({
      name: quickClient.name.trim(),
      phone: quickClient.phone.trim(),
      email: quickClient.email.trim(),
      observations: quickClient.observations.trim(),
    });
    if (!client) return;

    setForm((current) => ({ ...current, clientId: client.id }));
    setQuickClient({ name: "", phone: "", email: "", observations: "" });
    setShowQuickClientForm(false);
  };

  const addServiceLine = (service) => {
    setSaleServices((current) => [
      ...current,
      {
        lineId: createLineId(),
        serviceId: service.serviceId || service.id || "",
        serviceName: service.serviceName || service.name,
        category: service.category || "",
        duration: service.duration || "",
        price: Number(service.price || 0),
        quantity: Number(service.quantity || 1),
      },
    ]);
    setServiceQuery("");
    setShowServiceResults(false);
  };

  const addCustomService = () => {
    if (!customServiceName.trim()) return;
    addServiceLine({
      serviceId: "",
      serviceName: customServiceName.trim(),
      category: "Personalizado",
      duration: "",
      price: Number(customServicePrice || 0),
      quantity: 1,
    });
    setCustomServiceName("");
    setCustomServicePrice("");
  };

  const updateServiceLine = (lineId, updates) => {
    setSaleServices((current) => current.map((service) => (
      service.lineId === lineId ? { ...service, ...updates } : service
    )));
  };

  const removeServiceLine = (lineId) => {
    setSaleServices((current) => current.filter((service) => service.lineId !== lineId));
  };

  const resetSaleForm = () => {
    const nextDate = new Date().toISOString().slice(0, 10);
    setSaleServices([]);
    setServiceQuery("");
    setShowServiceResults(false);
    setCustomServiceName("");
    setCustomServicePrice("");
    setShowQuickClientForm(false);
    setQuickClient({ name: "", phone: "", email: "", observations: "" });
    setForm({
      date: nextDate,
      clientId: clients[0]?.id || "",
      employee: config.employees[0] || "",
      extra: "0",
      paymentMethod: config.paymentMethods[0] || "",
      commissionPercent: "10",
      notes: "",
    });
    onDateChange?.(nextDate);
  };

  const cancelEdit = () => {
    resetSaleForm();
    onCancelEdit?.();
  };

  const submit = (event) => {
    event.preventDefault();
    if (saleServices.length === 0) return;

    const client = clients.find((item) => item.id === form.clientId);
    const payload = {
      ...form,
      clientName: client?.name || "",
      services: saleServices.map(({ lineId, ...service }) => ({
        ...service,
        price: Number(service.price || 0),
        quantity: Number(service.quantity || 1),
      })),
      extra: Number(form.extra || 0),
      commissionPercent: Number(form.commissionPercent || 0),
      ...totals,
    };

    if (editingSale) {
      onUpdate(editingSale.id, payload);
    } else {
      onSave(payload);
    }
    resetSaleForm();
  };

  if (catalogServices.length === 0) {
    return (
      <section className="panel">
        <h2>Nueva venta</h2>
        <p className="empty-state">Primero crea servicios en configuracion</p>
      </section>
    );
  }

  return (
    <form className="panel form-grid" onSubmit={submit}>
      <h2>{editingSale ? "Editar venta" : "Nueva venta"}</h2>
      <div className="field-row">
        <label>Fecha<input type="date" name="date" value={form.date} onChange={updateField} /></label>
        <label>Cliente<select name="clientId" value={form.clientId} onChange={updateClientField}><option value="">Sin cliente</option><option value={CREATE_CLIENT_VALUE}>+ Crear cliente nuevo</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      </div>
      {showQuickClientForm && (
        <section className="quick-client-box">
          <h3>Crear cliente nuevo</h3>
          <div className="field-row">
            <input name="name" value={quickClient.name} onChange={updateQuickClientField} placeholder="Nombre" />
            <input name="phone" value={quickClient.phone} onChange={updateQuickClientField} placeholder="Telefono" />
          </div>
          <div className="field-row">
            <input name="email" type="email" value={quickClient.email} onChange={updateQuickClientField} placeholder="Email opcional" />
            <input name="observations" value={quickClient.observations} onChange={updateQuickClientField} placeholder="Observaciones opcional" />
          </div>
          <div className="row-actions">
            <button type="button" onClick={saveQuickClient}>Guardar cliente</button>
            <button className="secondary-button" type="button" onClick={() => setShowQuickClientForm(false)}>Cancelar</button>
          </div>
        </section>
      )}
      <div className="field-row">
        <label>Empleada<select name="employee" value={form.employee} onChange={updateField}>{config.employees.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Metodo pago<select name="paymentMethod" value={form.paymentMethod} onChange={updateField}>{config.paymentMethods.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>

      <label className="service-search-field">
        Servicio
        <input
          value={serviceQuery}
          onChange={(event) => { setServiceQuery(event.target.value); setShowServiceResults(Boolean(event.target.value.trim())); }}
          placeholder="Busca y anade servicios"
        />
        {showServiceResults && serviceQuery.trim() && (
          <div className="service-results">
            {filteredServices.map((service) => (
              <button className="service-result" type="button" key={service.id} onMouseDown={() => addServiceLine(service)}>
                <strong>{service.name}</strong>
                <span>{service.category} - {service.duration || "Sin duracion"} - {Number(service.price || 0).toFixed(2)} EUR</span>
              </button>
            ))}
            {filteredServices.length === 0 && <p className="empty-state">Sin resultados.</p>}
          </div>
        )}
      </label>

      <section className="custom-service-box">
        <h3>Servicio personalizado</h3>
        <div className="field-row">
          <input value={customServiceName} onChange={(event) => setCustomServiceName(event.target.value)} placeholder="Nombre del servicio" />
          <input type="number" min="0" step="0.01" value={customServicePrice} onChange={(event) => setCustomServicePrice(event.target.value)} placeholder="Precio" />
        </div>
        <button className="secondary-button" type="button" onClick={addCustomService}>Anadir personalizado</button>
      </section>

      <section className="sale-services-list">
        <h3>Servicios añadidos</h3>
        {saleServices.length === 0 && <p className="empty-state">Aun no hay servicios en esta venta.</p>}
        {saleServices.map((service) => (
          <article className="sale-service-card" key={service.lineId}>
            <div>
              <strong>{service.serviceName}</strong>
              <span>{service.category || "Sin categoria"} - {service.duration || "Sin duracion"}</span>
            </div>
            <label>Precio<input type="number" min="0" step="0.01" value={service.price} onChange={(event) => updateServiceLine(service.lineId, { price: Number(event.target.value || 0) })} /></label>
            <label>Cantidad<input type="number" min="1" step="1" value={service.quantity} onChange={(event) => updateServiceLine(service.lineId, { quantity: Number(event.target.value || 1) })} /></label>
            <b>{(Number(service.price || 0) * Number(service.quantity || 1)).toFixed(2)} EUR</b>
            <button className="danger-button" type="button" onClick={() => removeServiceLine(service.lineId)}>Eliminar</button>
          </article>
        ))}
      </section>

      <div className="field-row">
        <label>Extra<input type="number" min="0" step="0.01" name="extra" value={form.extra} onChange={updateField} /></label>
        <label>Comision %<input type="number" min="0" step="0.01" name="commissionPercent" value={form.commissionPercent} onChange={updateField} /></label>
      </div>
      <label>Observaciones<textarea name="notes" value={form.notes} onChange={updateField} placeholder="Observaciones internas de la venta" /></label>

      <div className="calculated-row tax-row">
        <span>Subtotal servicios: <b>{totals.subtotalServices.toFixed(2)} EUR</b></span>
        <span>Extra: <b>{Number(form.extra || 0).toFixed(2)} EUR</b></span>
        <span>Total venta: <b>{totals.total.toFixed(2)} EUR</b></span>
        <span>IVA incluido 21%: <b>{totals.ivaAmount.toFixed(2)} EUR</b></span>
        <span>Neto sin IVA: <b>{totals.netWithoutVat.toFixed(2)} EUR</b></span>
        <span>Comision: <b>{totals.commissionAmount.toFixed(2)} EUR</b></span>
        <span>Neto despues de IVA y comision: <b>{totals.netAfterCommission.toFixed(2)} EUR</b></span>
      </div>
      <div className="form-actions">
        <button type="submit">{editingSale ? "Guardar cambios" : "Guardar venta"}</button>
        {editingSale && <button className="secondary-button" type="button" onClick={cancelEdit}>Cancelar edicion</button>}
      </div>
    </form>
  );
}

export default SalesForm;
