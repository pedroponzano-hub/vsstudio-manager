import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase.js";

const STORAGE_KEYS = {
  sales: "business-dashboard:sales",
  expenses: "business-dashboard:expenses",
  clients: "business-dashboard:clients",
  config: "business-dashboard:config",
  appointments: "business-dashboard:appointments",
  commissions: "business-dashboard:commissions",
};

const today = new Date().toISOString().slice(0, 10);

const initialServices = [
  ["DEPILACION FACIAL CON CERA", "Mujer - Diseno de cejas con cera", "15 min", 10],
  ["DEPILACION FACIAL CON CERA", "Mujer - Depilacion de cejas y labio superior con cera", "20 min", 12],
  ["DEPILACION FACIAL CON CERA", "Mujer - Depilacion de cejas con pinzas", "15 min", 8],
  ["HOMBRE - DEPILACION CON CERA", "Hombre - Depilacion de cejas con cera", "15 min", 10],
  ["HOMBRE - DEPILACION CON CERA", "Hombre - Depilacion de cejas con pinzas", "15 min", 8],
  ["CEJAS, PESTANAS Y EXTENSIONES", "Mujer - Lifting y tinte de pestanas", "1 h", 35],
  ["CEJAS, PESTANAS Y EXTENSIONES", "Mujer - Diseno y tinte de cejas", "30 min", 18],
  ["CEJAS, PESTANAS Y EXTENSIONES", "Mujer - Diseno + Tinte de cejas con henna", "30 min", 18],
  ["CEJAS, PESTANAS Y EXTENSIONES", "Mujer - Laminado de cejas", "1 h", 35],
  ["CEJAS, PESTANAS Y EXTENSIONES", "Mujer - Extensiones de pestanas pelo a pelo", "1 h 15 min", 40],
  ["CEJAS, PESTANAS Y EXTENSIONES", "Mujer - Extensiones de pestanas 2D", "1 h 30 min", 60],
  ["CEJAS, PESTANAS Y EXTENSIONES", "Mujer - Extensiones de pestanas 3D", "1 h 30 min", 60],
  ["CEJAS, PESTANAS Y EXTENSIONES", "Mujer - Extensiones de pestanas 4D", "1 h 30 min", 60],
  ["CEJAS, PESTANAS Y EXTENSIONES", "Mujer - Extensiones de pestanas 5D", "1 h 30 min", 60],
  ["CEJAS, PESTANAS Y EXTENSIONES", "Mujer - Extensiones de pestanas 6D", "1 h 30 min", 60],
  ["CEJAS, PESTANAS Y EXTENSIONES", "Mujer - Extensiones de pestanas 'Efecto mascara'", "1 h 30 min", 50],
  ["CEJAS, PESTANAS Y EXTENSIONES", "Mujer - Retirada de extensiones de pestanas", "30 min", 10],
  ["CEJAS, PESTANAS Y EXTENSIONES", "Mujer - Extensiones de pestanas volumen ruso", "2 h", 70],
  ["CEJAS, PESTANAS Y EXTENSIONES", "Mujer - Extensiones de pestanas volumen ruso promocion", "2 h", 50],
  ["MANICURAS Y TRATAMIENTOS DE MANOS", "Mujer - Manicura completa - Solo limpieza", "30 min", 12],
  ["MANICURAS Y TRATAMIENTOS DE MANOS", "Mujer - Manicura completa - Tradicional con esmalte", "45 min", 15],
  ["MANICURAS Y TRATAMIENTOS DE MANOS", "Mujer - Manicura completa - Semipermanente", "45 min", 20],
  ["MANICURAS Y TRATAMIENTOS DE MANOS", "Mujer - Manicura completa - Refuerzo Base Rubber", "1 h 15 min", 25],
  ["MANICURAS Y TRATAMIENTOS DE MANOS", "Mujer - Manicura semipermanente expres", "45 min", 12],
  ["MANICURAS Y TRATAMIENTOS DE MANOS", "Mujer - Manicura expres", "25 min", 10],
  ["MANICURAS Y TRATAMIENTOS DE MANOS", "Mujer - Aplicacion de unas acrilicas desde", "2 h", 35],
  ["MANICURAS Y TRATAMIENTOS DE MANOS", "Mujer - Unas de soft gel - Retirada", "15 min", 10],
  ["MANICURAS Y TRATAMIENTOS DE MANOS", "Mujer - Unas de soft gel - Aplicacion", "1 h 30 min", 25],
  ["MANICURAS Y TRATAMIENTOS DE MANOS", "Mujer - Unas acrilicas - Retirada", "15 min", 10],
  ["MANICURAS Y TRATAMIENTOS DE MANOS", "Mujer - Unas acrilicas - Relleno", "1 h 30 min", 30],
  ["MANICURAS Y TRATAMIENTOS DE MANOS", "Mujer - Unas acrilicas - Aplicacion desde", "2 h", 35],
  ["MANICURAS Y TRATAMIENTOS DE MANOS", "Mujer - Unas de Poligel - Retirada", "15 min", 10],
  ["MANICURAS Y TRATAMIENTOS DE MANOS", "Mujer - Unas de Poligel - Relleno", "1 h 30 min", 30],
  ["MANICURAS Y TRATAMIENTOS DE MANOS", "Mujer - Unas de Poligel - Aplicacion", "2 h", 35],
  ["MANICURAS Y TRATAMIENTOS DE MANOS", "Mujer - Reparacion de una una", "15 min", 3.5],
  ["MANICURAS Y TRATAMIENTOS DE MANOS", "Mujer - Decoracion de unas desde", "15 min", 1.5],
  ["MANICURAS Y TRATAMIENTOS DE MANOS", "Mujer - Manicura semipermanente completa", "45 min", 20],
  ["MANICURAS Y TRATAMIENTOS DE MANOS", "Mujer - Manicura completa Refuerzo Base Rubber", "1 h 15 min", 25],
  ["FACIAL", "Limpieza facial profunda", "1 h", 60],
  ["FACIAL", "Tratamiento facial antiedad", "1 h 15 min", 100],
  ["CURSOS / ACADEMIA", "Formacion en Lifting de Pestanas 8H", "1 h", 180],
  ["CURSOS / ACADEMIA", "Extensiones de Pestanas Basico + Volumen Tecnologico GRATIS 16H", "1 h", 350],
  ["CURSOS / ACADEMIA", "Curso Extensiones de Pestanas Avanzado + Volumen Tecnologico GRATIS 16H", "1 h", 300],
  ["CURSOS / ACADEMIA", "Curso Lifting de pestanas", "1 h", 180],
  ["PEDICURA Y TRATAMIENTO DE PIES", "Mujer - Pedicura completa - Solo limar y cortar", "20 min", 8],
  ["PEDICURA Y TRATAMIENTO DE PIES", "Mujer - Pedicura completa - Limpieza", "45 min", 20],
  ["PEDICURA Y TRATAMIENTO DE PIES", "Mujer - Pedicura completa - Esmalte tradicional", "1 h", 25],
  ["PEDICURA Y TRATAMIENTO DE PIES", "Mujer - Pedicura semipermanente", "1 h", 28],
  ["PEDICURA Y TRATAMIENTO DE PIES", "Mujer - Pedicura expres", "30 min", 15],
  ["PEDICURA Y TRATAMIENTO DE PIES", "Mujer - Pedicura semipermanente expres", "1 h", 15],
  ["PEDICURA Y TRATAMIENTO DE PIES", "Mujer - Reparacion de una una pie", "15 min", 5],
  ["CORPORAL", "Masaje relajante", "1 h", 35],
  ["CORPORAL", "Masaje anticelulitico, reductor y reafirmante", "1 h", 40],
  ["CORPORAL", "Maderoterapia", "1 h", 35],
  ["CORPORAL", "Presoterapia", "30 min", 30],
  ["CORPORAL", "Reductivo y Linfatico", "2 h", 300],
  ["CORPORAL", "Reductivo y Presoterapia", "2 h 30 min", 400],
  ["CORPORAL", "Tratamiento exfoliante e hidratante corporal", "45 min", 50],
  ["CORPORAL", "Mujer - Depilacion de ingles normales con cera", "15 min", 15],
  ["CORPORAL", "Mujer - Depilacion de ingles brasilenas con cera", "20 min", 20],
  ["CORPORAL", "Mujer - Depilacion de ingles completas con cera", "30 min", 25],
  ["CORPORAL", "Mujer - Depilacion de zona perianal con cera", "15 min", 8],
  ["CORPORAL", "Mujer - Depilacion de axilas con cera", "20 min", 10],
  ["CORPORAL", "Mujer - Depilacion de piernas con cera - Medias piernas", "30 min", 20],
  ["CORPORAL", "Mujer - Depilacion de piernas con cera - Piernas completas", "45 min", 28],
  ["CORPORAL", "Mujer - Depilacion de brazos con cera - Brazos completos", "30 min", 18],
  ["CORPORAL", "Mujer - Depilacion de brazos con cera - Medios brazos", "45 min", 25],
].map(([category, name, duration, price], index) => ({
  id: `service-vs-${index + 1}`,
  category,
  name,
  duration,
  price,
  active: true,
}));

const defaultData = {
  sales: [],
  expenses: [],
  clients: [],
  appointments: [],
  commissions: [],
  config: {
    employees: ["Marianne", "Ambar", "Grace", "Leidys"],
    services: initialServices,
    paymentMethods: ["Efectivo", "Tarjeta", "Bizum", "Tarjeta regalo", "Bonos"],
    entryChannels: ["Walk-in/Calle", "Instagram", "Google", "Treatwell", "Booksy", "WhatsApp", "Recomendacion", "TikTok", "Cliente recurrente", "Academia", "Otro"],
    expenseCategories: [
      "Suministros",
      "Nominas",
      "Alquiler",
      "Gestoria",
      "Materiales",
      "Impuestos",
      "Comisiones bancarias",
      "Marketing",
      "Mantenimiento",
      "Servicios externos",
      "Otros",
    ],
    monthlyGoal: 4500,
    loyaltyVisits: 5,
    agenda: [],
  },
};

const vsStudioBaseConfig = {
  employees: defaultData.config.employees,
  paymentMethods: defaultData.config.paymentMethods,
  entryChannels: defaultData.config.entryChannels,
  expenseCategories: defaultData.config.expenseCategories,
  monthlyGoal: defaultData.config.monthlyGoal,
  loyaltyVisits: defaultData.config.loyaltyVisits,
};

const FIRESTORE_COLLECTIONS = ["sales", "expenses", "clients", "appointments", "commissions"];
const CONFIG_DOC_ID = "main";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readCollection(key) {
  const stored = localStorage.getItem(STORAGE_KEYS[key]);

  if (!stored) {
    const initial = clone(defaultData[key]);
    localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(initial));
    return initial;
  }

  try {
    return JSON.parse(stored);
  } catch {
    const initial = clone(defaultData[key]);
    localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(initial));
    return initial;
  }
}

function writeCollection(key, items, syncRemote = false) {
  localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(items));
  localStorage.setItem(key, JSON.stringify(items));
  if (syncRemote) {
    syncKeyToFirestore(key, items);
  }
  return items;
}

async function syncCollectionToFirestore(collectionName, items) {
  const batch = writeBatch(db);
  const snapshot = await getDocs(collection(db, collectionName));

  snapshot.forEach((document) => batch.delete(document.ref));
  items.forEach((item) => {
    const itemId = item.id || createId(collectionName);
    batch.set(doc(db, collectionName, itemId), { ...item, id: itemId });
  });

  await batch.commit();
}

async function syncConfigToFirestore(config) {
  const { services, agenda, ...configData } = config;

  await setDoc(doc(db, "config", CONFIG_DOC_ID), configData);
  await syncCollectionToFirestore("services", services || []);
}

function saveDocumentToFirestore(collectionName, item, successMessage) {
  setDoc(doc(db, collectionName, item.id), item)
    .then(() => {
      if (successMessage) console.log(successMessage);
    })
    .catch((error) => {
      console.warn("Firestore document save failed", error);
      console.log("Usando localStorage fallback");
    });
}

function deleteDocumentFromFirestore(collectionName, id) {
  deleteDoc(doc(db, collectionName, id)).catch((error) => {
    console.warn("Firestore document delete failed", error);
    console.log("Usando localStorage fallback");
  });
}

function syncKeyToFirestore(key, value) {
  const task = async () => {
    if (FIRESTORE_COLLECTIONS.includes(key)) {
      await syncCollectionToFirestore(key, value || []);
      return;
    }
    if (key === "config") {
      await syncConfigToFirestore(value || defaultData.config);
    }
  };

  task().catch((error) => {
    console.warn("Firestore sync failed", error);
  });
}

async function readFirestoreCollection(collectionName) {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
}

async function readFirestoreConfig() {
  const snapshot = await getDoc(doc(db, "config", CONFIG_DOC_ID));
  return snapshot.exists() ? snapshot.data() : null;
}

function getDateParts(date) {
  const value = date || today;
  return { day: value, month: value.slice(0, 7) };
}

function normalizeSaleServices(sale) {
  if (Array.isArray(sale.services) && sale.services.length > 0) {
    return sale.services.map((service, index) => ({
      serviceId: service.serviceId || "",
      serviceName: service.serviceName || service.name || service.service || `Servicio ${index + 1}`,
      category: service.category || "",
      duration: service.duration || "",
      price: Number(service.price || 0),
      quantity: Number(service.quantity || 1),
    }));
  }

  const serviceName = sale.serviceName || sale.service || sale.concept || "";
  if (!serviceName) return [];

  return [{
    serviceId: sale.serviceId || "",
    serviceName,
    category: sale.category || "",
    duration: sale.duration || "",
    price: Number(sale.price ?? sale.amount ?? sale.total ?? 0),
    quantity: 1,
  }];
}

function servicesSubtotal(services) {
  return services.reduce((total, service) => total + Number(service.price || 0) * Number(service.quantity || 1), 0);
}

function saleAmount(sale) {
  const services = normalizeSaleServices(sale);
  const subtotalServices = sale.subtotalServices ?? servicesSubtotal(services);
  return Number(sale.total ?? (Number(subtotalServices || 0) + Number(sale.extra || 0)) ?? sale.amount ?? 0);
}

function saleVatFields(sale) {
  const total = saleAmount(sale);
  const ivaPercent = Number(sale.ivaPercent ?? 21);
  const ivaAmount = sale.ivaAmount ?? (total * ivaPercent) / (100 + ivaPercent);
  const netWithoutVat = sale.netWithoutVat ?? total - ivaAmount;
  const commissionPercent = Number(sale.commissionPercent || 0);
  const commissionAmount = sale.commissionAmount ?? total * (commissionPercent / 100);
  const netAfterCommission = sale.netAfterCommission ?? netWithoutVat - commissionAmount;

  return {
    total,
    ivaPercent,
    ivaAmount: Number(ivaAmount || 0),
    netWithoutVat: Number(netWithoutVat || 0),
    commissionPercent,
    commissionAmount: Number(commissionAmount || 0),
    netAfterCommission: Number(netAfterCommission || 0),
  };
}

function sum(items, field) {
  return items.reduce((total, item) => total + Number(item[field] ?? 0), 0);
}

function groupBySum(items, keyField, amountField) {
  return items.reduce((groups, item) => {
    if (keyField === "service") {
      normalizeSaleServices(item).forEach((service) => {
        const key = service.serviceName || "Sin servicio";
        const amount = Number(service.price || 0) * Number(service.quantity || 1);
        groups[key] = (groups[key] || 0) + amount;
      });
      return groups;
    }

    const key = item[keyField] || (keyField === "service" ? item.concept : "") || "Sin dato";
    const amount = amountField === "total" ? saleAmount(item) : Number(saleVatFields(item)[amountField] ?? item[amountField] ?? 0);
    groups[key] = (groups[key] || 0) + amount;
    return groups;
  }, {});
}

function saleSummary(sales) {
  return sales.reduce((summary, sale) => {
    const fields = saleVatFields(sale);
    summary.totalSales += fields.total;
    summary.ivaAmount += fields.ivaAmount;
    summary.netWithoutVat += fields.netWithoutVat;
    summary.commissionAmount += fields.commissionAmount;
    summary.netAfterCommission += fields.netAfterCommission;
    return summary;
  }, {
    totalSales: 0,
    ivaAmount: 0,
    netWithoutVat: 0,
    commissionAmount: 0,
    netAfterCommission: 0,
  });
}

function employeeCommissions(sales) {
  const grouped = sales.reduce((groups, sale) => {
    const employee = sale.employee || "Sin empleada";
    const current = groups[employee] || {
      employee,
      commissionAmount: 0,
      servicesCount: 0,
      salesCount: 0,
    };
    const commissionPercent = Number(sale.commissionPercent || 0);
    const commissionAmount = saleAmount(sale) * (commissionPercent / 100);
    const servicesCount = normalizeSaleServices(sale).reduce((total, service) => total + Number(service.quantity || 1), 0);

    current.commissionAmount += commissionAmount;
    current.servicesCount += servicesCount;
    current.salesCount += 1;
    groups[employee] = current;
    return groups;
  }, {});

  return Object.values(grouped).sort((a, b) => b.commissionAmount - a.commissionAmount);
}

function saleServicesText(sale) {
  return normalizeSaleServices(sale).map((service) => service.serviceName).filter(Boolean).join(", ") || sale.service || "Sin servicio";
}

function commissionRows(sales, commissionStatuses) {
  const statusBySale = Object.fromEntries(commissionStatuses.map((item) => [item.saleId || item.id, item.status || "pendiente"]));

  return sales
    .filter((sale) => Number(sale.commissionPercent || 0) > 0)
    .map((sale) => {
      const commissionPercent = Number(sale.commissionPercent || 0);
      const total = saleAmount(sale);

      return {
        id: sale.id,
        saleId: sale.id,
        date: sale.date,
        employee: sale.employee || "Sin empleada",
        client: sale.clientName || "Sin cliente",
        services: saleServicesText(sale),
        saleTotal: total,
        commissionPercent,
        commissionAmount: total * (commissionPercent / 100),
        status: statusBySale[sale.id] || "pendiente",
      };
    })
    .sort((first, second) => String(second.date || "").localeCompare(String(first.date || "")));
}

function commissionTotals(rows) {
  const byEmployee = rows.reduce((groups, row) => {
    groups[row.employee] = (groups[row.employee] || 0) + row.commissionAmount;
    return groups;
  }, {});

  return {
    generated: rows.reduce((total, row) => total + row.commissionAmount, 0),
    pending: rows.filter((row) => row.status !== "pagada").reduce((total, row) => total + row.commissionAmount, 0),
    paid: rows.filter((row) => row.status === "pagada").reduce((total, row) => total + row.commissionAmount, 0),
    byEmployee,
  };
}

function serviceRankings(sales) {
  const grouped = sales.reduce((groups, sale) => {
    normalizeSaleServices(sale).forEach((service) => {
      const key = service.serviceId || service.serviceName || "Sin servicio";
      const current = groups[key] || {
        serviceId: service.serviceId || "",
        serviceName: service.serviceName || "Sin servicio",
        count: 0,
        revenue: 0,
      };

      current.count += Number(service.quantity || 1);
      current.revenue += Number(service.price || 0) * Number(service.quantity || 1);
      groups[key] = current;
    });
    return groups;
  }, {});
  const rows = Object.values(grouped);

  return {
    byCount: [...rows].sort((a, b) => b.count - a.count),
    byRevenue: [...rows].sort((a, b) => b.revenue - a.revenue),
  };
}

function normalizeServices(services) {
  return (services || []).map((service, index) => {
    if (typeof service === "string") {
      return {
        id: `service-legacy-${index}-${service.toLowerCase().replace(/\s+/g, "-")}`,
        category: "Sin categoria",
        name: service,
        duration: "",
        price: 0,
        active: true,
      };
    }

    return {
      id: service.id || createId("service"),
      category: service.category || service.categoria || "Sin categoria",
      name: service.name || service.nombre || "",
      duration: service.duration || service.duracion || "",
      price: Number(service.price ?? service.basePrice ?? service.precioBase ?? 0),
      active: service.active !== false,
    };
  }).filter((service) => service.name);
}

function normalizeConfig(config) {
  const rawServices = config.services;
  const hasLegacyServices = (rawServices || []).some((service) => (
    typeof service === "string" || (!service.category && !service.duration && service.price === undefined && service.basePrice !== undefined)
  ));

  return {
    ...config,
    paymentMethods: config.paymentMethods || defaultData.config.paymentMethods,
    entryChannels: config.entryChannels || defaultData.config.entryChannels,
    services: hasLegacyServices ? clone(initialServices) : normalizeServices(rawServices),
  };
}

function normalizeSale(sale) {
  const services = normalizeSaleServices(sale);
  const subtotalServices = Number(sale.subtotalServices ?? servicesSubtotal(services));
  const extra = Number(sale.extra || 0);
  const total = subtotalServices + extra;
  const fields = saleVatFields({ ...sale, total, commissionPercent: sale.commissionPercent });
  const primaryService = services[0] || {};

  return {
    id: sale.id,
    date: sale.date || today,
    clientId: sale.clientId,
    clientName: sale.clientName || "",
    employee: sale.employee || sale.empleada || "",
    services,
    serviceId: primaryService.serviceId || sale.serviceId || "",
    service: services.map((service) => service.serviceName).filter(Boolean).join(", ") || sale.serviceName || sale.service || sale.concept || "",
    duration: services.map((service) => service.duration).filter(Boolean).join(" + ") || sale.duration || "",
    price: Number(primaryService.price ?? sale.price ?? sale.amount ?? 0),
    subtotalServices,
    extra,
    total,
    ivaPercent: fields.ivaPercent,
    ivaAmount: fields.ivaAmount,
    netWithoutVat: fields.netWithoutVat,
    paymentMethod: sale.paymentMethod || sale.metodoPago || "",
    entryChannel: sale.entryChannel || sale.channel || "",
    commissionPercent: fields.commissionPercent,
    commissionAmount: fields.commissionAmount,
    netAfterCommission: fields.netAfterCommission,
    notes: sale.notes || "",
  };
}

function normalizeClient(client) {
  const { allergies, ...rest } = client || {};
  const observations = rest.observations ?? rest.notes ?? "";

  return {
    ...rest,
    name: rest.name || "",
    email: rest.email || "",
    phone: rest.phone || "",
    observations,
    notes: observations,
    interests: rest.interests || "",
    visits: Number(rest.visits || 0),
    totalSpent: Number(rest.totalSpent || 0),
    lastVisit: rest.lastVisit || "",
    loyaltyStamps: Number(rest.loyaltyStamps || 0),
  };
}

function resetClientMetrics(client) {
  return {
    ...client,
    visits: 0,
    totalSpent: 0,
    lastVisit: "",
    loyaltyStamps: 0,
  };
}

function applySaleToClient(client, sale) {
  const visits = Number(client.visits || 0) + 1;
  const totalSpent = Number(client.totalSpent || 0) + saleAmount(sale);
  const lastVisit = !client.lastVisit || sale.date > client.lastVisit ? sale.date : client.lastVisit;

  return {
    ...client,
    visits,
    totalSpent,
    lastVisit,
    loyaltyStamps: visits,
  };
}

const DataService = {
  getSales() {
    const sales = readCollection("sales").map((sale) => normalizeSale({ ...sale, ...saleVatFields(sale) }));
    writeCollection("sales", sales);
    return sales;
  },

  getExpenses() {
    return readCollection("expenses");
  },

  getClients() {
    const clients = readCollection("clients").map(normalizeClient);
    writeCollection("clients", clients);
    return clients;
  },

  getAppointments() {
    return readCollection("appointments");
  },

  getCommissionStatuses() {
    return readCollection("commissions");
  },

  getCommissions() {
    const rows = commissionRows(this.getSales(), this.getCommissionStatuses());
    return {
      rows,
      totals: commissionTotals(rows),
    };
  },

  getConfig() {
    const config = normalizeConfig({ ...clone(defaultData.config), ...readCollection("config"), agenda: this.getAppointments() });
    writeCollection("config", config);
    return config;
  },

  getData() {
    this.recalculateClientData();
    const config = this.getConfig();

    return {
      sales: this.getSales(),
      expenses: this.getExpenses(),
      clients: this.getClients(),
      appointments: this.getAppointments(),
      commissions: this.getCommissionStatuses(),
      services: config.services,
      config,
    };
  },

  async initializeRemoteData() {
    try {
      const [sales, expenses, clients, appointments, commissions, services, remoteConfig] = await Promise.all([
        readFirestoreCollection("sales"),
        readFirestoreCollection("expenses"),
        readFirestoreCollection("clients"),
        readFirestoreCollection("appointments"),
        readFirestoreCollection("commissions"),
        readFirestoreCollection("services"),
        readFirestoreConfig(),
      ]);
      const resolvedServices = services.length ? services : remoteConfig?.services || defaultData.config.services;
      const config = normalizeConfig({
        ...clone(defaultData.config),
        ...(remoteConfig || {}),
        services: resolvedServices,
        agenda: appointments,
      });

      writeCollection("sales", sales.map((sale) => normalizeSale({ ...sale, ...saleVatFields(sale) })));
      writeCollection("expenses", expenses);
      writeCollection("clients", clients.map(normalizeClient));
      writeCollection("appointments", appointments);
      writeCollection("commissions", commissions);
      writeCollection("config", config);
      if (!remoteConfig || services.length === 0) {
        await syncConfigToFirestore(config);
      }

      console.log(`Firestore sales recibidas: ${sales.length}`);
      return { data: this.getData(), online: true };
    } catch (error) {
      console.warn("Firestore load failed, using localStorage", error);
      console.log("Usando localStorage fallback");
      return { data: this.getData(), online: false };
    }
  },

  subscribeToData(onData, onStatus) {
    const refreshFromLocal = (markOnline = true) => {
      onStatus?.(true);
      onData(this.getData());
    };
    const handleError = (error) => {
      console.warn("Firestore listener failed", error);
      onStatus?.(false);
      console.log("Usando localStorage fallback");
    };
    const unsubscribers = [
      onSnapshot(collection(db, "sales"), (snapshot) => {
        const sales = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
        console.log(`Firestore sales recibidas: ${sales.length}`);
        writeCollection("sales", sales.map((sale) => normalizeSale({ ...sale, ...saleVatFields(sale) })));
        refreshFromLocal();
      }, handleError),
      onSnapshot(collection(db, "expenses"), (snapshot) => {
        const expenses = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
        writeCollection("expenses", expenses);
        refreshFromLocal();
      }, handleError),
      onSnapshot(collection(db, "clients"), (snapshot) => {
        const clients = snapshot.docs.map((document) => normalizeClient({ id: document.id, ...document.data() }));
        writeCollection("clients", clients);
        refreshFromLocal();
      }, handleError),
      onSnapshot(collection(db, "appointments"), (snapshot) => {
        const appointments = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
        writeCollection("appointments", appointments);
        refreshFromLocal();
      }, handleError),
      onSnapshot(collection(db, "commissions"), (snapshot) => {
        const commissions = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
        writeCollection("commissions", commissions);
        refreshFromLocal();
      }, handleError),
      onSnapshot(collection(db, "services"), (snapshot) => {
        const services = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
        writeCollection("config", normalizeConfig({ ...this.getConfig(), services }));
        refreshFromLocal();
      }, handleError),
      onSnapshot(doc(db, "config", CONFIG_DOC_ID), (snapshot) => {
        if (!snapshot.exists()) return;
        writeCollection("config", normalizeConfig({ ...this.getConfig(), ...snapshot.data() }));
        refreshFromLocal();
      }, handleError),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  },

  addSale(arg1, arg2) {
    const currentSales = Array.isArray(arg1) ? arg1 : this.getSales();
    const saleInput = arg2 || arg1;
    const sale = { ...normalizeSale(saleInput), id: createId("sale") };
    writeCollection("sales", [sale, ...currentSales]);
    saveDocumentToFirestore("sales", sale, "Venta guardada en Firestore");
    const clients = this.recalculateClientData();
    clients.forEach((client) => saveDocumentToFirestore("clients", client));
    return Array.isArray(arg1) ? this.getSales() : { ...this.getData(), clients };
  },

  updateSale(saleId, updates) {
    const currentSales = this.getSales();
    const existingSale = currentSales.find((sale) => sale.id === saleId);
    if (!existingSale) return this.getData();

    const updatedSale = normalizeSale({ ...existingSale, ...updates, id: saleId });
    const sales = writeCollection(
      "sales",
      currentSales.map((sale) => (sale.id === saleId ? updatedSale : sale)),
    );
    saveDocumentToFirestore("sales", updatedSale);
    const clients = this.recalculateClientData();
    clients.forEach((client) => saveDocumentToFirestore("clients", client));
    return { ...this.getData(), sales, clients };
  },

  addExpense(arg1, arg2) {
    const currentExpenses = Array.isArray(arg1) ? arg1 : this.getExpenses();
    const expenseInput = arg2 || arg1;
    const expense = {
      date: expenseInput.date || today,
      category: expenseInput.category || "General",
      concept: expenseInput.concept || "",
      amount: Number(expenseInput.amount || 0),
      paymentMethod: expenseInput.paymentMethod || "",
      id: createId("expense"),
    };
    const expenses = writeCollection("expenses", [expense, ...currentExpenses]);
    saveDocumentToFirestore("expenses", expense);
    return Array.isArray(arg1) ? expenses : this.getData();
  },

  addClient(arg1, arg2) {
    const currentClients = Array.isArray(arg1) ? arg1 : this.getClients();
    const clientInput = arg2 || arg1;
    const phone = String(clientInput.phone || "").trim();
    const existingClient = phone ? currentClients.find((client) => String(client.phone || "").trim() === phone) : null;
    if (existingClient) return Array.isArray(arg1) ? currentClients : this.getData();

    const client = normalizeClient({
      ...clientInput,
      observations: clientInput.observations ?? clientInput.notes ?? "",
      id: createId("client"),
    });
    const clients = writeCollection("clients", [client, ...currentClients]);
    saveDocumentToFirestore("clients", client);
    return Array.isArray(arg1) ? clients : this.getData();
  },

  createClientFromSale(clientInput) {
    const currentClients = this.getClients();
    const phone = String(clientInput.phone || "").trim();
    const existingClient = phone ? currentClients.find((client) => String(client.phone || "").trim() === phone) : null;
    if (existingClient) {
      return { data: this.getData(), client: existingClient };
    }

    const client = normalizeClient({
      ...clientInput,
      observations: clientInput.observations ?? clientInput.notes ?? "",
      id: createId("client"),
    });
    const clients = writeCollection("clients", [client, ...currentClients]);
    saveDocumentToFirestore("clients", client);
    return { data: { ...this.getData(), clients }, client };
  },

  updateClient(clientId, updates) {
    const clients = writeCollection(
      "clients",
      this.getClients().map((client) => (client.id === clientId ? normalizeClient({ ...client, ...updates }) : client)),
    );
    const updatedClient = clients.find((client) => client.id === clientId);
    if (updatedClient) saveDocumentToFirestore("clients", updatedClient);
    return updatedClient;
  },

  updateConfig(updates) {
    const config = writeCollection("config", normalizeConfig({ ...this.getConfig(), ...updates }));
    syncConfigToFirestore(config).catch((error) => {
      console.warn("Firestore config save failed", error);
      console.log("Usando localStorage fallback");
    });
    return { ...this.getData(), config };
  },

  restoreVSStudioConfig() {
    const config = writeCollection("config", normalizeConfig({
      ...this.getConfig(),
      ...vsStudioBaseConfig,
    }));
    syncConfigToFirestore(config).catch((error) => {
      console.warn("Firestore config save failed", error);
      console.log("Usando localStorage fallback");
    });

    return { ...this.getData(), config };
  },

  addAppointment(appointment) {
    const item = { ...appointment, id: createId("appointment") };
    writeCollection("appointments", [item, ...this.getAppointments()]);
    saveDocumentToFirestore("appointments", item);
    return this.getData();
  },

  deleteSale(arg1, arg2) {
    const id = arg2 || arg1;
    writeCollection("sales", this.getSales().filter((sale) => sale.id !== id));
    deleteDocumentFromFirestore("sales", id);
    const clients = this.recalculateClientData();
    clients.forEach((client) => saveDocumentToFirestore("clients", client));
    return Array.isArray(arg1) ? this.getSales() : this.getData();
  },

  deleteExpense(expenses, id) {
    deleteDocumentFromFirestore("expenses", id);
    return writeCollection("expenses", expenses.filter((expense) => expense.id !== id));
  },

  updateCommissionStatus(saleId, status) {
    const safeStatus = status === "pagada" ? "pagada" : "pendiente";
    const currentStatuses = this.getCommissionStatuses();
    const existingStatus = currentStatuses.find((item) => (item.saleId || item.id) === saleId);
    const nextStatus = {
      ...(existingStatus || {}),
      id: saleId,
      saleId,
      status: safeStatus,
      updatedAt: new Date().toISOString(),
    };
    const commissions = writeCollection(
      "commissions",
      existingStatus
        ? currentStatuses.map((item) => ((item.saleId || item.id) === saleId ? nextStatus : item))
        : [nextStatus, ...currentStatuses],
    );
    saveDocumentToFirestore("commissions", nextStatus);
    return { ...this.getData(), commissions };
  },

  deleteClient(arg1, arg2) {
    const currentClients = Array.isArray(arg1) ? arg1 : this.getClients();
    const id = arg2 || arg1;
    const clients = writeCollection("clients", currentClients.filter((client) => client.id !== id));
    deleteDocumentFromFirestore("clients", id);
    return Array.isArray(arg1) ? clients : this.getData();
  },

  getDashboardData() {
    this.recalculateClientData();
    const sales = this.getSales();
    const expenses = this.getExpenses();
    const clients = this.getClients();
    const config = this.getConfig();
    const current = getDateParts(today);
    const todaySales = sales.filter((sale) => sale.date === current.day);
    const todayExpenses = expenses.filter((expense) => expense.date === current.day);
    const monthSales = sales.filter((sale) => sale.date?.startsWith(current.month));
    const monthExpenses = expenses.filter((expense) => expense.date?.startsWith(current.month));
    const todaySalesTotal = todaySales.reduce((total, sale) => total + saleAmount(sale), 0);
    const todayExpensesTotal = sum(todayExpenses, "amount");
    const monthSalesTotal = monthSales.reduce((total, sale) => total + saleAmount(sale), 0);
    const monthExpensesTotal = sum(monthExpenses, "amount");
    const todaySummary = saleSummary(todaySales);
    const monthSummary = saleSummary(monthSales);
    const monthProfit = monthSummary.totalSales - monthSummary.ivaAmount - monthSummary.commissionAmount - monthExpensesTotal;
    const dayOfMonth = new Date().getDate();
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const predictedClose = dayOfMonth ? (monthSalesTotal / dayOfMonth) * daysInMonth : monthSalesTotal;

    return {
      today: {
        sales: todaySalesTotal,
        grossSales: todaySummary.totalSales,
        ivaAmount: todaySummary.ivaAmount,
        netWithoutVat: todaySummary.netWithoutVat,
        commissionAmount: todaySummary.commissionAmount,
        netAfterCommission: todaySummary.netAfterCommission,
        expenses: todayExpensesTotal,
        profit: todaySummary.netAfterCommission - todayExpensesTotal,
        clients: new Set(todaySales.map((sale) => sale.clientId).filter(Boolean)).size,
        averageTicket: todaySales.length ? todaySalesTotal / todaySales.length : 0,
      },
      month: {
        sales: monthSalesTotal,
        grossSales: monthSummary.totalSales,
        ivaAmount: monthSummary.ivaAmount,
        netWithoutVat: monthSummary.netWithoutVat,
        commissionAmount: monthSummary.commissionAmount,
        netAfterCommission: monthSummary.netAfterCommission,
        expenses: monthExpensesTotal,
        profit: monthProfit,
        margin: monthSummary.totalSales ? (monthProfit / monthSummary.totalSales) * 100 : 0,
        goal: Number(config.monthlyGoal || 0),
        completion: config.monthlyGoal ? (monthSalesTotal / Number(config.monthlyGoal)) * 100 : 0,
        predictedClose,
      },
      clients,
    };
  },

  getStats(filters = {}) {
    this.recalculateClientData();
    const from = filters.from || "";
    const to = filters.to || "";
    const inRange = (item) => {
      if (from && item.date < from) return false;
      if (to && item.date > to) return false;
      return true;
    };
    const sales = this.getSales().filter(inRange);
    const expenses = this.getExpenses().filter(inRange);
    const summary = saleSummary(sales);
    const totalSales = summary.totalSales;
    const totalExpenses = sum(expenses, "amount");

    return {
      salesByDay: groupBySum(sales, "date", "total"),
      expensesByCategory: groupBySum(expenses, "category", "amount"),
      salesByEmployee: groupBySum(sales, "employee", "total"),
      salesByService: groupBySum(sales, "service", "total"),
      paymentMethods: groupBySum(sales, "paymentMethod", "total"),
      serviceRankings: serviceRankings(sales),
      employeeCommissions: employeeCommissions(sales),
      totalSales,
      totalExpenses,
      totalIva: summary.ivaAmount,
      totalNetWithoutVat: summary.netWithoutVat,
      totalCommissions: summary.commissionAmount,
      netAfterVatAndCommissions: summary.netAfterCommission,
      profit: summary.netAfterCommission - totalExpenses,
      averageTicket: sales.length ? totalSales / sales.length : 0,
    };
  },

  recalculateClientData(syncRemote = false) {
    const sales = this.getSales();
    const resetClients = this.getClients().map(resetClientMetrics);
    const clients = sales.reduce((currentClients, sale) => {
      if (!sale.clientId) return currentClients;

      return currentClients.map((client) =>
        client.id === sale.clientId ? applySaleToClient(client, sale) : client
      );
    }, resetClients);

    return writeCollection("clients", clients, syncRemote);
  },

  reset(mode = "full") {
    writeCollection("sales", [], true);
    writeCollection("expenses", [], true);
    writeCollection("appointments", [], true);
    writeCollection("commissions", [], true);

    if (mode === "all") {
      writeCollection("clients", [], true);
    }

    this.recalculateClientData();
    return this.getData();
  },
};

export default DataService;
