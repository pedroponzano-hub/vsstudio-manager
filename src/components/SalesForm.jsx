import { useEffect, useMemo, useState } from "react";
import { getMadridDateString } from "../utils/date.js";

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

const emptyServiceForm = { category: "", name: "", durationMinutes: "", price: "", active: true };
const defaultPaymentMethods = ["Efectivo", "Tarjeta", "Bizum", "Bono / tarjeta regalo", "Treatwell", "Otro"];
const tpvCategories = [
  { id: "Manicura", label: "Manicura" },
  { id: "Pedicura", label: "Pedicura" },
  { id: "Pestanas", label: "Pestañas" },
  { id: "Cejas", label: "Cejas" },
  { id: "Corporal", label: "Corporal" },
  { id: "Facial", label: "Facial" },
  { id: "Cursos", label: "Cursos" },
  { id: "Productos", label: "Productos" },
];

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function serviceTpvCategory(service) {
  const category = normalizeText(service.category || "");
  const name = normalizeText(service.name || "");
  const text = `${category} ${name}`;

  if (category === "cursos / academia" || includesAny(name, ["curso", "formacion", "academia", "masterclass"])) return "Cursos";

  if (category === "pedicura y tratamiento de pies") return "Pedicura";

  if (
    category === "manicuras y tratamientos de manos" ||
    includesAny(name, ["manicura", "unas", "soft gel", "acrilic", "rubber", "retirada unas", "poligel"])
  ) return "Manicura";

  if (
    includesAny(name, [
      "extensiones de pestanas",
      "extension de pestanas",
      "lifting",
      "tinte de pestanas",
      "volumen ruso",
      "retirada de extensiones de pestanas",
      "pestanas pelo a pelo",
      "pestanas 2d",
      "pestanas 3d",
      "pestanas 4d",
      "pestanas 5d",
      "pestanas 6d",
      "efecto mascara",
    ])
  ) return "Pestanas";

  if (
    includesAny(name, ["cejas", "ceja", "henna", "laminado", "microblading", "micropigmentacion", "micropigment", "powder brows"])
  ) return "Cejas";

  if (
    category === "corporal" ||
    includesAny(text, ["corporal", "masaje", "anticelulitico", "reductor", "maderoterapia", "presoterapia", "linfatico", "ingles", "axilas", "piernas", "brazos", "perianal"])
  ) return "Corporal";

  if (
    category === "facial" ||
    (category === "depilacion facial con cera" && !includesAny(name, ["ceja", "cejas"]))
  ) return "Facial";

  if (
    service.type === "product" ||
    service.isProduct === true ||
    category === "productos" ||
    includesAny(text, ["producto", "retail"])
  ) return "Productos";

  return "";
}

function serviceSearchText(service) {
  return `${service.name} ${service.category} ${service.duration}`.toLowerCase();
}

function createLineId() {
  return `line-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeCategory(value = "") {
  return String(value).trim().toLowerCase();
}

function normalizePaymentOption(method = "") {
  const value = String(method).trim();
  const normalized = value.toLowerCase();
  if (normalized === "bono" || normalized === "bonos" || normalized === "tarjeta regalo") return "Bono / tarjeta regalo";
  return value;
}

function saleStatus(sale) {
  const status = String(sale?.status || "cobrado").toLowerCase();
  if (status === "pendiente_pago" || status === "cancelado" || status === "anulada") return status;
  return "cobrado";
}

function emptySaleForm() {
  return {
    date: getMadridDateString(),
    clientId: "",
    employee: "",
    extra: "0",
    paymentMethod: "",
    entryChannel: "",
    referralClientId: "",
    cardTipAmount: "0",
    treatwellCommissionPercent: "0",
    treatwellCommissionAmount: "0",
    commissionPercent: "0",
    notes: "",
  };
}

function SalesForm({
  clients,
  config,
  editingSale,
  onSave,
  onUpdate,
  onCreateClient,
  onCreateService,
  canCreateService = false,
  canEditSaleDate = false,
  onCancelEdit,
  onDateChange,
}) {
  const catalogServices = (config.services || []).filter((service) => service.active !== false);
  const serviceCategories = useMemo(() => {
    const categories = [...(config.serviceCategories || []), ...(config.services || []).map((service) => service.category)];
    return Array.from(new Set(categories.filter(Boolean))).sort((first, second) => first.localeCompare(second));
  }, [config.serviceCategories, config.services]);
  const [form, setForm] = useState(() => emptySaleForm());
  const [saleServices, setSaleServices] = useState([]);
  const [payments, setPayments] = useState([{ method: "", amount: "" }]);
  const [clientQuery, setClientQuery] = useState("");
  const [showClientResults, setShowClientResults] = useState(false);
  const [referralQuery, setReferralQuery] = useState("");
  const [showReferralResults, setShowReferralResults] = useState(false);
  const [serviceQuery, setServiceQuery] = useState("");
  const [showServiceResults, setShowServiceResults] = useState(false);
  const [showServiceCreator, setShowServiceCreator] = useState(false);
  const [serviceForm, setServiceForm] = useState(emptyServiceForm);
  const [showCategoryResults, setShowCategoryResults] = useState(false);
  const [showQuickClientForm, setShowQuickClientForm] = useState(false);
  const [quickClient, setQuickClient] = useState({ name: "", phone: "", email: "", observations: "" });
  const [saleError, setSaleError] = useState("");
  const [activeCategory, setActiveCategory] = useState(tpvCategories[0].id);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!editingSale) return;

    const nextDate = editingSale.fechaOperativa || editingSale.date || getMadridDateString();
    setForm({
      date: nextDate,
      clientId: editingSale.clientId || "",
      employee: editingSale.employee || "",
      extra: String(editingSale.extra ?? 0),
      paymentMethod: editingSale.paymentMethod || "",
      entryChannel: editingSale.entryChannel || "",
      referralClientId: editingSale.referralClientId || "",
      cardTipAmount: String(editingSale.cardTipAmount ?? 0),
      treatwellCommissionPercent: String(editingSale.treatwellCommissionPercent ?? 0),
      treatwellCommissionAmount: String(editingSale.treatwellCommissionAmount ?? 0),
      commissionPercent: String(editingSale.commissionPercent ?? 0),
      notes: editingSale.notes || "",
    });
    setPayments(Array.isArray(editingSale.payments) && editingSale.payments.length > 0
      ? editingSale.payments.map((payment) => ({ method: payment.method || "", amount: String(payment.amount ?? "") }))
      : [{ method: editingSale.paymentMethod || "", amount: String(editingSale.total ?? "") }]);
    setClientQuery(editingSale.clientName || clients.find((client) => client.id === editingSale.clientId)?.name || "");
    setReferralQuery(editingSale.referralClientName || clients.find((client) => client.id === editingSale.referralClientId)?.name || "");
    setShowClientResults(false);
    setShowReferralResults(false);
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
    setShowServiceCreator(false);
    setServiceForm(emptyServiceForm);
    setShowCategoryResults(false);
    setSaleError("");
    onDateChange?.(nextDate);
  }, [editingSale, clients, onDateChange]);

  useEffect(() => {
    if (editingSale || canEditSaleDate) return undefined;

    const refreshDate = () => {
      const today = getMadridDateString();
      setForm((current) => (current.date === today ? current : { ...current, date: today }));
      onDateChange?.(today);
    };

    refreshDate();
    const interval = window.setInterval(refreshDate, 60000);
    return () => window.clearInterval(interval);
  }, [editingSale, canEditSaleDate, onDateChange]);

  const filteredServices = useMemo(() => {
    const query = serviceQuery.trim().toLowerCase();
    if (!query) return [];
    return catalogServices.filter((service) => serviceSearchText(service).includes(query)).slice(0, 20);
  }, [serviceQuery, catalogServices]);

  const filteredCategories = useMemo(() => {
    const query = serviceForm.category.trim().toLowerCase();
    if (!query) return serviceCategories;
    return serviceCategories.filter((category) => category.toLowerCase().includes(query));
  }, [serviceForm.category, serviceCategories]);

  const filteredClients = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    if (!query) return [];
    return clients.filter((client) => `${client.name} ${client.phone || ""} ${client.email || ""}`.toLowerCase().includes(query)).slice(0, 12);
  }, [clientQuery, clients]);

  const filteredReferralClients = useMemo(() => {
    const query = referralQuery.trim().toLowerCase();
    if (!query) return [];
    return clients
      .filter((client) => `${client.name} ${client.phone || ""} ${client.email || ""}`.toLowerCase().includes(query))
      .slice(0, 12);
  }, [referralQuery, clients]);

  const categoryServices = useMemo(() => (
    catalogServices
      .filter((service) => serviceTpvCategory(service) === activeCategory)
      .sort((first, second) => String(first.name || "").localeCompare(String(second.name || "")))
  ), [catalogServices, activeCategory]);

  const totals = useMemo(() => {
    const subtotalServices = saleServices.reduce((total, service) => total + Number(service.price || 0) * Number(service.quantity || 1), 0);
    const extra = Number(form.extra || 0);
    const total = subtotalServices + extra;
    const ivaPercent = 21;
    const ivaAmount = (total * ivaPercent) / 121;
    const netWithoutVat = total - ivaAmount;
    const commissionAmount = total * (Number(form.commissionPercent || 0) / 100);
    const treatwellCommissionAmount = Number(form.treatwellCommissionAmount || 0);
    const netAfterCommission = netWithoutVat - commissionAmount;
    const netAfterTreatwellAndCommission = total - treatwellCommissionAmount - commissionAmount;

    return { subtotalServices, total, ivaPercent, ivaAmount, netWithoutVat, commissionAmount, treatwellCommissionAmount, netAfterCommission, netAfterTreatwellAndCommission };
  }, [saleServices, form.extra, form.commissionPercent, form.treatwellCommissionAmount]);

  const paymentMethods = useMemo(() => {
    const configured = (config.paymentMethods || []).map(normalizePaymentOption);
    return Array.from(new Set([...defaultPaymentMethods, ...configured]));
  }, [config.paymentMethods]);

  const paymentsTotal = useMemo(() => payments.reduce((total, payment) => total + Number(payment.amount || 0), 0), [payments]);
  const paymentsDifference = totals.total - paymentsTotal;

  const updateField = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
    setSaleError("");
    if (event.target.name === "date") onDateChange?.(event.target.value);
  };

  const updateTreatwellPercent = (event) => {
    const percent = event.target.value;
    const amount = totals.total * (Number(percent || 0) / 100);
    setForm({ ...form, treatwellCommissionPercent: percent, treatwellCommissionAmount: amount ? amount.toFixed(2) : "0" });
    setSaleError("");
  };

  const updateTreatwellAmount = (event) => {
    const amount = event.target.value;
    const percent = totals.total ? (Number(amount || 0) / totals.total) * 100 : 0;
    setForm({ ...form, treatwellCommissionAmount: amount, treatwellCommissionPercent: percent ? percent.toFixed(2) : "0" });
    setSaleError("");
  };

  const updatePaymentLine = (index, updates) => {
    setPayments((current) => current.map((payment, paymentIndex) => (
      paymentIndex === index ? { ...payment, ...updates } : payment
    )));
    setSaleError("");
  };

  const addPaymentLine = () => {
    setPayments((current) => [...current, { method: "", amount: "" }]);
  };

  const removePaymentLine = (index) => {
    setPayments((current) => (current.length > 1 ? current.filter((_, paymentIndex) => paymentIndex !== index) : current));
    setSaleError("");
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

  const updateServiceFormField = (event) => {
    const { name, value, type, checked } = event.target;
    setServiceForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    setSaleError("");
  };

  const selectCategory = (category) => {
    setServiceForm((current) => ({ ...current, category }));
    setShowCategoryResults(false);
  };

  const createRealService = () => {
    if (!canCreateService || !onCreateService) return;
    const category = serviceForm.category.trim();
    const name = serviceForm.name.trim();
    const durationMinutes = Number(serviceForm.durationMinutes || 0);
    const price = Number(serviceForm.price);

    if (!category || !name || !durationMinutes || Number.isNaN(price) || price <= 0) {
      setSaleError("Completa categoria, nombre, duracion y precio para crear el servicio.");
      return;
    }

    const service = onCreateService({
      category,
      name,
      durationMinutes,
      price,
      active: serviceForm.active !== false,
    });
    if (!service) {
      setSaleError("No tienes permisos para crear servicios.");
      return;
    }

    addServiceLine(service);
    setServiceForm(emptyServiceForm);
    setShowServiceCreator(false);
    setShowCategoryResults(false);
  };

  const selectClient = (client) => {
    setForm((current) => ({ ...current, clientId: client.id }));
    setClientQuery(client.name || "");
    setShowClientResults(false);
    setShowQuickClientForm(false);
    setSaleError("");
  };

  const clearClient = () => {
    setForm((current) => ({ ...current, clientId: "", referralClientId: "" }));
    setClientQuery("");
    setReferralQuery("");
    setShowClientResults(false);
    setShowReferralResults(false);
    setShowQuickClientForm(false);
  };

  const openQuickClientForm = () => {
    setForm((current) => ({ ...current, clientId: "" }));
    setClientQuery("");
    setShowClientResults(false);
    setShowQuickClientForm(true);
  };

  const updateClientQuery = (event) => {
    const value = event.target.value;
    setClientQuery(value);
    setShowClientResults(Boolean(value.trim()));
    setSaleError("");
    if (!value.trim()) {
      setForm((current) => ({ ...current, clientId: "", referralClientId: "" }));
      setReferralQuery("");
    }
  };

  const selectReferralClient = (client) => {
    setForm((current) => ({ ...current, referralClientId: client.id }));
    setReferralQuery(client.name || "");
    setShowReferralResults(false);
    setSaleError("");
  };

  const updateReferralQuery = (event) => {
    const value = event.target.value;
    setReferralQuery(value);
    setShowReferralResults(Boolean(value.trim()));
    setSaleError("");
    if (!value.trim()) {
      setForm((current) => ({ ...current, referralClientId: "" }));
    }
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

    selectClient(client);
    setQuickClient({ name: "", phone: "", email: "", observations: "" });
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
    const nextDate = getMadridDateString();
    setSaleServices([]);
    setPayments([{ method: "", amount: "" }]);
    setClientQuery("");
    setShowClientResults(false);
    setReferralQuery("");
    setShowReferralResults(false);
    setServiceQuery("");
    setShowServiceResults(false);
    setShowServiceCreator(false);
    setServiceForm(emptyServiceForm);
    setShowCategoryResults(false);
    setShowQuickClientForm(false);
    setQuickClient({ name: "", phone: "", email: "", observations: "" });
    setSaleError("");
    setForm({ ...emptySaleForm(), date: nextDate });
    onDateChange?.(nextDate);
  };

  const cancelEdit = () => {
    resetSaleForm();
    onCancelEdit?.();
  };

  const buildPayload = (validPayments, effectiveDate, status) => {
    const client = clients.find((item) => item.id === form.clientId);
    const referralClient = clients.find((item) => item.id === form.referralClientId);

    return {
      ...form,
      date: effectiveDate,
      fechaOperativa: effectiveDate,
      status,
      clientName: client?.name || clientQuery.trim() || "Cliente mostrador",
      referralClientId: status === "cobrado" ? (referralClient?.id || "") : "",
      referralClientName: status === "cobrado" ? (referralClient?.name || "") : "",
      cardTipAmount: Number(form.cardTipAmount || 0),
      treatwellCommissionPercent: Number(form.treatwellCommissionPercent || 0),
      treatwellCommissionAmount: Number(form.treatwellCommissionAmount || 0),
      netAfterTreatwellAndCommission: totals.netAfterTreatwellAndCommission,
      payments: validPayments,
      paymentMethod: validPayments.map((payment) => payment.method).join(" + "),
      services: saleServices.map(({ lineId, ...service }) => ({
        ...service,
        price: Number(service.price || 0),
        quantity: Number(service.quantity || 1),
      })),
      extra: Number(form.extra || 0),
      commissionPercent: Number(form.commissionPercent || 0),
      ...totals,
    };
  };

  const effectiveOperationalDate = (status) => {
    const today = getMadridDateString();
    const editingPending = editingSale && String(editingSale.status || "").toLowerCase() === "pendiente_pago";
    if (!editingSale) return canEditSaleDate ? (form.date || today) : today;
    if (editingPending && status === "cobrado") return canEditSaleDate ? (form.date || today) : today;
    return form.date || editingSale.fechaOperativa || editingSale.date || today;
  };

  const savePayload = (payload) => {
    if (editingSale) {
      const editsCollectedSale = saleStatus(editingSale) === "cobrado" && payload.status === "cobrado";
      if (editsCollectedSale) {
        const editReason = window.prompt("Motivo de la edicion\n\nEjemplos: Error en metodo de pago, servicio incorrecto, cliente cambio servicio, error de importe, error de empleada, otro.");
        if (!editReason || !editReason.trim()) {
          setSaleError("Debes indicar el motivo de la edicion para guardar cambios.");
          return;
        }
        onUpdate(editingSale.id, { ...payload, editReason: editReason.trim() });
      } else {
        onUpdate(editingSale.id, payload);
      }
    } else {
      onSave(payload);
    }
    resetSaleForm();
  };

  const savePending = () => {
    if (saleServices.length === 0) return;
    const effectiveDate = effectiveOperationalDate("pendiente_pago");

    if (saleServices.length === 0 || !form.employee || totals.total <= 0) {
      setSaleError("Completa servicio, profesional y total antes de guardar pendiente.");
      return;
    }

    savePayload(buildPayload([], effectiveDate, "pendiente_pago"));
  };

  const submit = (event) => {
    event.preventDefault();
    if (saleServices.length === 0) return;
    const validPayments = payments
      .map((payment) => ({ method: payment.method, amount: Number(payment.amount || 0) }))
      .filter((payment) => payment.method && payment.amount > 0);
    const paymentCents = Math.round(validPayments.reduce((total, payment) => total + payment.amount, 0) * 100);
    const totalCents = Math.round(totals.total * 100);

    const effectiveDate = effectiveOperationalDate("cobrado");

    if (saleServices.length === 0 || !form.employee || totals.total <= 0 || !form.entryChannel) {
      setSaleError("Completa servicio, profesional, canal de origen y total de venta.");
      return;
    }
    if (validPayments.length === 0) {
      setSaleError("Anade al menos un metodo de pago.");
      return;
    }
    if (paymentCents !== totalCents) {
      setSaleError(`La suma de pagos debe coincidir con el total. Faltan/sobran ${(totals.total - validPayments.reduce((total, payment) => total + payment.amount, 0)).toFixed(2)} EUR.`);
      return;
    }
    if (form.referralClientId && !form.clientId) {
      setSaleError("Selecciona primero el cliente principal para usar referido.");
      return;
    }
    if (form.referralClientId && form.referralClientId === form.clientId) {
      setSaleError("El cliente referido no puede ser el mismo cliente principal.");
      return;
    }

    savePayload(buildPayload(validPayments, effectiveDate, "cobrado"));
  };

  return (
    <form className="panel form-grid" onSubmit={submit}>
      <div className="sale-form-heading">
        <h2>{editingSale ? "Editar venta" : "Nueva venta"}</h2>
        <strong className="tpv-heading-total">{totals.total.toFixed(2)} EUR</strong>
      </div>

      <section className="sale-services-workflow">
        <section className="tpv-categories">
          {tpvCategories.map((category) => (
            <button
              className={activeCategory === category.id ? "tpv-category active" : "tpv-category"}
              type="button"
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </section>

        <section className="tpv-service-grid">
          {categoryServices.map((service) => (
            <button className="tpv-service-button" type="button" key={service.id} onClick={() => addServiceLine(service)}>
              <span>{service.name}</span>
              <strong>{Number(service.price || 0).toFixed(2)} EUR</strong>
            </button>
          ))}
          {categoryServices.length === 0 && (
            <p className="empty-state">
              {activeCategory === "Productos" ? "No hay productos disponibles" : "No hay servicios activos en esta categoria."}
            </p>
          )}
        </section>

        <section className="sale-services-list tpv-ticket">
          <div className="section-title">
            <div>
              <h3>Ticket</h3>
              <span>{saleServices.length} lineas</span>
            </div>
            <strong>{totals.total.toFixed(2)} EUR</strong>
          </div>
          {saleServices.length === 0 && <p className="empty-state">Toca un servicio para anadirlo al ticket.</p>}
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
      </section>

      <section className="sale-admin-section">
        <h3>Datos de la venta</h3>
        <label className="service-search-field">
          Cliente
          <input value={clientQuery} onChange={updateClientQuery} onFocus={() => setShowClientResults(Boolean(clientQuery.trim()))} placeholder="Buscar cliente por nombre o telefono" />
          <div className="client-quick-actions">
            <button className="secondary-button" type="button" onClick={clearClient}>Sin cliente</button>
            <button className="secondary-button" type="button" onClick={openQuickClientForm}>+ Crear cliente nuevo</button>
          </div>
          {showClientResults && (
            <div className="service-results">
              {filteredClients.map((client) => (
                <button className="service-result" type="button" key={client.id} onMouseDown={() => selectClient(client)}>
                  <strong>{client.name}</strong>
                  <span>{client.phone || "Sin telefono"}{client.email ? ` - ${client.email}` : ""}</span>
                </button>
              ))}
              {filteredClients.length === 0 && <p className="empty-state">Sin clientes con esa busqueda.</p>}
            </div>
          )}
        </label>
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
          <label>Empleada<select name="employee" value={form.employee} onChange={updateField}><option value="">Seleccionar...</option>{(config.employees || []).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Canal de origen<select name="entryChannel" value={form.entryChannel} onChange={updateField}><option value="">Seleccionar...</option>{(config.entryChannels || []).map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <section className="quick-client-box">
          <h3>Pagos</h3>
          {payments.map((payment, index) => (
            <div className="field-row" key={`${index}-${payment.method}`}>
              <label>Metodo<select value={payment.method} onChange={(event) => updatePaymentLine(index, { method: event.target.value })}><option value="">Seleccionar...</option>{paymentMethods.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Importe<input type="number" min="0" step="0.01" value={payment.amount} onChange={(event) => updatePaymentLine(index, { amount: event.target.value })} /></label>
              <button className="danger-button" type="button" onClick={() => removePaymentLine(index)}>Eliminar pago</button>
            </div>
          ))}
          <div className="row-actions">
            <button className="secondary-button" type="button" onClick={addPaymentLine}>+ Anadir pago</button>
          </div>
          <div className="calculated-row">
            <span>Total venta: <b>{totals.total.toFixed(2)} EUR</b></span>
            <span>Pagado: <b>{paymentsTotal.toFixed(2)} EUR</b></span>
            <span>Diferencia: <b>{paymentsDifference.toFixed(2)} EUR</b></span>
          </div>
        </section>
        <section className="advanced-sale-section">
          <button className="secondary-button" type="button" onClick={() => setShowAdvanced((current) => !current)}>
            {showAdvanced ? "Ocultar opciones avanzadas" : "Opciones avanzadas"}
          </button>
          {showAdvanced && (
            <div className="advanced-sale-fields">
              <div className="field-row">
                <label>Fecha<input type="date" name="date" value={form.date} onChange={updateField} disabled={!canEditSaleDate} /></label>
                <label>Comision %<input type="number" min="0" step="0.01" name="commissionPercent" value={form.commissionPercent} onChange={updateField} /></label>
              </div>
              <div className="field-row">
                <label>Comision Treatwell %<input type="number" min="0" step="0.01" name="treatwellCommissionPercent" value={form.treatwellCommissionPercent} onChange={updateTreatwellPercent} /></label>
                <label>Propina en tarjeta<input type="number" min="0" step="0.01" name="cardTipAmount" value={form.cardTipAmount} onChange={updateField} /></label>
              </div>
              <label>Referido por
                <input value={referralQuery} onChange={updateReferralQuery} onFocus={() => setShowReferralResults(Boolean(referralQuery.trim()) && Boolean(form.clientId))} placeholder={form.clientId ? "Buscar cliente existente" : "Selecciona primero un cliente"} disabled={!form.clientId} />
                {showReferralResults && referralQuery.trim() && form.clientId && (
                  <div className="service-results">
                    {filteredReferralClients.map((client) => (
                      <button className="service-result" type="button" key={client.id} onMouseDown={() => selectReferralClient(client)}>
                        <strong>{client.name}</strong>
                        <span>{client.phone || "Sin telefono"}{client.email ? ` - ${client.email}` : ""}</span>
                      </button>
                    ))}
                    {filteredReferralClients.length === 0 && <p className="empty-state">Sin clientes con esa busqueda.</p>}
                  </div>
                )}
              </label>
              <label>Observaciones<textarea name="notes" value={form.notes} onChange={updateField} placeholder="Observaciones internas de la venta" /></label>
            </div>
          )}
        </section>
        {saleError && <p className="auth-error">{saleError}</p>}
      </section>

      <div className="calculated-row operational-total-row">
        <span>Subtotal servicios: <b>{totals.subtotalServices.toFixed(2)} EUR</b></span>
        <span>Pagado: <b>{paymentsTotal.toFixed(2)} EUR</b></span>
        <span>Total venta: <b>{totals.total.toFixed(2)} EUR</b></span>
      </div>
      <div className="form-actions">
        <button type="submit">{editingSale ? "Cobrar y cerrar" : "Cobrar y cerrar"}</button>
        <button className="secondary-button" type="button" onClick={savePending}>Guardar pendiente</button>
        {editingSale && <button className="secondary-button" type="button" onClick={cancelEdit}>Cancelar edicion</button>}
      </div>
    </form>
  );
}

export default SalesForm;
