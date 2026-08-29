import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, setDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../firebase.js";
import {
  assertAppointmentStatusTransition,
  assertNoAppointmentConflict,
  buildAppointmentRecord,
  createAppointmentOperation,
  normalizeAppointmentDate,
  normalizeAppointmentRecord,
} from "../utils/appointmentModel.js";
import { createQuickClientOperation, findQuickClientDuplicate } from "../utils/clientQuickCreate.js";
import {
  buildManualCommissionOverride,
  assertCommissionEditReason,
  commissionFieldsChanged,
  createCommissionAuditEntry,
  filterOwnPositiveCommissions,
  normalizeProfessionalCommissionPolicy,
  resolveSaleCommissionSnapshot,
} from "../utils/commissionSchedule.js";
import {
  getMadridDateString,
  getMadridDayOfMonth,
  getMadridDaysInCurrentMonth,
  getMadridTimeString,
  getMadridTimestamp,
  getTechnicalTimestamp,
  getTodayLocalDateString,
} from "../utils/date.js";
import {
  buildCommissionPaymentFields,
  commissionPaymentDate,
  normalizeCommissionPaymentMethod,
  selectPayableCommissions,
} from "../utils/commissionFinance.js";

const STORAGE_KEYS = {
  sales: "business-dashboard:sales",
  expenses: "business-dashboard:expenses",
  clients: "business-dashboard:clients",
  config: "business-dashboard:config",
  appointments: "business-dashboard:appointments",
  commissions: "business-dashboard:commissions",
  commissionPaymentBatches: "business-dashboard:commissionPaymentBatches",
  cashClosings: "business-dashboard:cashClosings",
  monthlyClosings: "business-dashboard:monthlyClosings",
};

function todayLocal() {
  return getMadridDateString();
}

function saleOperationalDate(sale = {}) {
  if (sale.saleDate || sale.fechaOperativa || sale.operationalDate) return sale.saleDate || sale.fechaOperativa || sale.operationalDate;
  const localCreatedDate = String(sale.horaCreacion || "").match(/^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(?::\d{2})?$/)?.[1];
  if (localCreatedDate && sale.date && localCreatedDate > sale.date) return localCreatedDate;
  return sale.fechaOperativa || sale.operationalDate || sale.date || sale.fecha || todayLocal();
}

function itemOperationalDate(item = {}) {
  return item.saleDate || item.fechaOperativa || item.operationalDate || item.date || item.fecha || "";
}

function localTimeFromTimestamp(value = "") {
  const match = String(value || "").match(/T(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

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
  durationMinutes: 0,
  price,
  active: true,
}));

initialServices.forEach((service) => {
  service.durationMinutes = durationToMinutes(service.duration);
});

const defaultData = {
  sales: [],
  expenses: [],
  clients: [],
  appointments: [],
  commissions: [],
  commissionPaymentBatches: [],
  cashClosings: [],
  monthlyClosings: [],
  config: {
    employees: ["Marianne", "Ambar", "Grace", "Leidys"],
    employeeSettings: [
      { name: "Marianne", active: true, commissionPercent: 0, commissionHistory: [] },
      { name: "Ambar", active: true, commissionPercent: 0, commissionHistory: [] },
      { name: "Grace", active: true, commissionPercent: 0, commissionHistory: [] },
      { name: "Leidys", active: true, commissionPercent: 0, commissionHistory: [] },
    ],
    services: initialServices,
    paymentMethods: ["Efectivo", "Tarjeta", "Bizum", "Bono", "Tarjeta regalo"],
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

const FIRESTORE_COLLECTIONS = ["sales", "expenses", "clients", "appointments", "commissions", "commissionPaymentBatches", "cashClosings", "monthlyClosings"];
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
  setDoc(doc(db, collectionName, item.id), cleanFirestoreData(item))
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

async function readFirestoreAppointmentsByDate(date) {
  const normalizedDate = normalizeAppointmentDate(date);
  if (!normalizedDate) throw new Error("La fecha de Agenda no es válida.");
  const snapshot = await getDocs(query(collection(db, "appointments"), where("date", "==", normalizedDate)));
  return snapshot.docs.map((document) => normalizeAppointmentRecord({ id: document.id, ...document.data() }));
}

async function readFirestoreAppointmentsByClientId(clientId) {
  const safeClientId = cleanText(clientId);
  if (!safeClientId) return [];
  const snapshot = await getDocs(query(collection(db, "appointments"), where("clientId", "==", safeClientId)));
  return snapshot.docs
    .map((document) => normalizeAppointmentRecord({ id: document.id, ...document.data() }))
    .sort((first, second) => `${second.date} ${second.startTime}`.localeCompare(`${first.date} ${first.startTime}`));
}

async function readFirestoreAppointment(appointmentId) {
  const snapshot = await getDoc(doc(db, "appointments", appointmentId));
  return snapshot.exists() ? normalizeAppointmentRecord({ id: snapshot.id, ...snapshot.data() }) : null;
}

function mergeAppointmentDateIntoLocal(date, appointments) {
  const normalizedDate = normalizeAppointmentDate(date);
  const incomingIds = new Set((appointments || []).map((appointment) => appointment.id));
  const otherDates = readCollection("appointments").filter((appointment) => (
    normalizeAppointmentRecord(appointment).date !== normalizedDate && !incomingIds.has(appointment.id)
  ));
  writeCollection("appointments", [...appointments, ...otherDates]);
}

async function readFirestoreConfig() {
  const snapshot = await getDoc(doc(db, "config", CONFIG_DOC_ID));
  return snapshot.exists() ? snapshot.data() : null;
}

function getDateParts(date) {
  const value = date || todayLocal();
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

function saleServicesCount(sale) {
  return normalizeSaleServices(sale).reduce((total, service) => total + Number(service.quantity || 1), 0);
}

function saleAmount(sale) {
  const services = normalizeSaleServices(sale);
  const subtotalServices = sale.subtotalServices ?? servicesSubtotal(services);
  return Number(sale.total ?? (Number(subtotalServices || 0) + Number(sale.extra || 0)) ?? sale.amount ?? 0);
}

function normalizeSalePayments(sale) {
  if (String(sale.operationType || sale.tipoOperacion || "").toLowerCase() === "servicio_interno") return [];

  if (Array.isArray(sale.payments) && sale.payments.length > 0) {
    return sale.payments
      .map((payment) => ({
        method: payment.method || payment.paymentMethod || "",
        amount: Number(payment.amount || 0),
      }))
      .filter((payment) => payment.method && payment.amount > 0);
  }

  const method = sale.paymentMethod || sale.metodoPago || "";
  const amount = saleAmount(sale);
  return method ? [{ method, amount }] : [];
}

function saleVatFields(sale) {
  const total = saleAmount(sale);
  const isInternalService = String(sale.operationType || sale.tipoOperacion || "").toLowerCase() === "servicio_interno";
  const ivaPercent = Number(sale.ivaPercent ?? 21);
  const commissionPercent = Number(sale.commissionPercent || 0);
  const commissionAmount = sale.commissionAmount ?? total * (commissionPercent / 100);
  const treatwellCommissionPercent = Number(sale.treatwellCommissionPercent || 0);
  const treatwellCommissionAmount = Number(sale.treatwellCommissionAmount ?? (total * (treatwellCommissionPercent / 100)));
  const ivaAmount = isInternalService ? 0 : sale.ivaAmount ?? (total * ivaPercent) / (100 + ivaPercent);
  const netWithoutVat = isInternalService ? 0 : sale.netWithoutVat ?? total - ivaAmount;
  const netAfterCommission = sale.netAfterCommission ?? netWithoutVat - commissionAmount;
  const netAfterTreatwellAndCommission = sale.netAfterTreatwellAndCommission ?? total - treatwellCommissionAmount - commissionAmount;

  return {
    total,
    ivaPercent,
    ivaAmount: Number(ivaAmount || 0),
    netWithoutVat: Number(netWithoutVat || 0),
    commissionPercent,
    commissionAmount: Number(commissionAmount || 0),
    treatwellCommissionPercent,
    treatwellCommissionAmount: Number(treatwellCommissionAmount || 0),
    netAfterCommission: Number(netAfterCommission || 0),
    netAfterTreatwellAndCommission: Number(netAfterTreatwellAndCommission || 0),
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
    if (keyField === "paymentMethod") {
      normalizeSalePayments(item).forEach((payment) => {
        groups[payment.method] = (groups[payment.method] || 0) + Number(payment.amount || 0);
      });
      return groups;
    }

    const key = item[keyField] || (keyField === "service" ? item.concept : "") || "Sin dato";
    const amount = amountField === "total" ? saleAmount(item) : Number(saleVatFields(item)[amountField] ?? item[amountField] ?? 0);
    groups[key] = (groups[key] || 0) + amount;
    return groups;
  }, {});
}

function normalizePaymentMethodName(method = "") {
  const normalized = String(method || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized.includes("efectivo")) return "Efectivo";
  if (normalized.includes("tarjeta")) return "Tarjeta";
  if (normalized.includes("bizum")) return "Bizum";
  if (normalized.includes("treatwell")) return "Treatwell";
  if (normalized.includes("transferencia")) return "Transferencia";
  return "Otros";
}

function normalizeStatsPaymentMethodName(method = "") {
  const normalized = String(method || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized.includes("efectivo")) return "Efectivo";
  if (normalized.includes("bizum")) return "Bizum";
  if (normalized.includes("treatwell")) return "Treatwell";
  if (normalized.includes("bono") || normalized.includes("regalo")) return "Bono / tarjeta regalo";
  if (normalized.includes("tarjeta")) return "Tarjeta";
  return "Otro";
}

function adjustedSalePaymentsForStats(sale) {
  const payments = normalizeSalePayments(sale).map((payment) => ({ ...payment }));
  const saleTotal = saleAmount(sale);
  const paymentsTotal = payments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  let cardTipToRemove = Math.min(Number(sale.cardTipAmount || 0), Math.max(paymentsTotal - saleTotal, 0));

  return payments
    .map((payment) => {
      const method = normalizeStatsPaymentMethodName(payment.method);
      let amount = Number(payment.amount || 0);
      if (method === "Tarjeta" && cardTipToRemove > 0) {
        const removed = Math.min(amount, cardTipToRemove);
        amount -= removed;
        cardTipToRemove -= removed;
      }
      return { method, amount };
    })
    .filter((payment) => payment.amount > 0);
}

function paymentMethodStats(sales) {
  const methodOrder = ["Efectivo", "Tarjeta", "Bizum", "Treatwell", "Bono / tarjeta regalo", "Otro"];
  const grouped = Object.fromEntries(methodOrder.map((method) => [method, { method, amount: 0, count: 0, percent: 0 }]));

  sales.forEach((sale) => {
    const countedMethods = new Set();
    adjustedSalePaymentsForStats(sale).forEach((payment) => {
      grouped[payment.method] = grouped[payment.method] || { method: payment.method, amount: 0, count: 0, percent: 0 };
      grouped[payment.method].amount += Number(payment.amount || 0);
      countedMethods.add(payment.method);
    });
    countedMethods.forEach((method) => {
      grouped[method].count += 1;
    });
  });

  const total = Object.values(grouped).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return methodOrder.map((method) => ({
    ...grouped[method],
    percent: total ? (grouped[method].amount / total) * 100 : 0,
  }));
}

function groupDashboardIncomeByMethod(sales) {
  return sales.reduce((groups, sale) => {
    const payments = normalizeSalePayments(sale);
    const saleTotal = saleAmount(sale);
    const paymentsTotal = payments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
    let cardTipToRemove = Math.min(Number(sale.cardTipAmount || 0), Math.max(paymentsTotal - saleTotal, 0));

    payments.forEach((payment) => {
      const method = normalizePaymentMethodName(payment.method);
      let amount = Number(payment.amount || 0);
      if (method === "Tarjeta" && cardTipToRemove > 0) {
        const removed = Math.min(amount, cardTipToRemove);
        amount -= removed;
        cardTipToRemove -= removed;
      }
      groups[method] = (groups[method] || 0) + amount;
    });

    return groups;
  }, { Efectivo: 0, Tarjeta: 0, Bizum: 0, Transferencia: 0, Treatwell: 0, Otros: 0 });
}

function groupDashboardPaidExpensesByMethod(expenses) {
  return expenses
    .filter((expense) => expense.status !== "pendiente")
    .reduce((groups, expense) => {
      const method = normalizePaymentMethodName(expense.paymentMethod);
      const targetMethod = ["Efectivo", "Tarjeta", "Transferencia", "Bizum"].includes(method) ? method : "Otros";
      groups[targetMethod] = (groups[targetMethod] || 0) + Number(expense.amount || 0);
      return groups;
    }, { Efectivo: 0, Tarjeta: 0, Transferencia: 0, Bizum: 0, Otros: 0 });
}

function groupDashboardPaidCommissionsByMethod(commissions) {
  return commissions
    .filter((commission) => commission.status === "pagada")
    .reduce((groups, commission) => {
      const method = normalizeCommissionPaymentMethod(commission.metodoPagoComision || commission.paymentMethod) || "Otros";
      const targetMethod = ["Efectivo", "Tarjeta", "Transferencia", "Bizum"].includes(method) ? method : "Otros";
      groups[targetMethod] = (groups[targetMethod] || 0) + Number(commission.commissionAmount || 0);
      return groups;
    }, { Efectivo: 0, Tarjeta: 0, Transferencia: 0, Bizum: 0, Otros: 0 });
}

function dashboardCashSummary(sales, expenses, commissions = []) {
  const incomeByMethod = groupDashboardIncomeByMethod(sales);
  const expensesByMethod = groupDashboardPaidExpensesByMethod(expenses);
  const commissionsByMethod = groupDashboardPaidCommissionsByMethod(commissions);
  const totalIncome = Object.values(incomeByMethod).reduce((total, amount) => total + Number(amount || 0), 0);
  const totalExpenses = Object.values(expensesByMethod).reduce((total, amount) => total + Number(amount || 0), 0);
  const totalCommissions = Object.values(commissionsByMethod).reduce((total, amount) => total + Number(amount || 0), 0);

  return {
    incomeByMethod,
    expensesByMethod,
    commissionsByMethod,
    totalIncome,
    totalExpenses,
    totalCommissions,
    netResult: totalIncome - totalExpenses - totalCommissions,
  };
}

function saleSummary(sales) {
  return sales.reduce((summary, sale) => {
    const fields = saleVatFields(sale);
    summary.totalSales += fields.total;
    summary.ivaAmount += fields.ivaAmount;
    summary.netWithoutVat += fields.netWithoutVat;
    summary.commissionAmount += fields.commissionAmount;
    summary.treatwellCommissionAmount += fields.treatwellCommissionAmount;
    summary.netAfterCommission += fields.netAfterCommission;
    summary.netAfterTreatwellAndCommission += fields.netAfterTreatwellAndCommission;
    return summary;
  }, {
    totalSales: 0,
    ivaAmount: 0,
    netWithoutVat: 0,
    commissionAmount: 0,
    treatwellCommissionAmount: 0,
    netAfterCommission: 0,
    netAfterTreatwellAndCommission: 0,
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

function saleStatus(sale) {
  const status = String(sale.status || sale.estado || "cobrado").toLowerCase();
  if (status === "pendiente_pago" || status === "cancelado" || status === "anulada" || status === "servicio_interno") return status;
  if (status === "editada") return "cobrado";
  return "cobrado";
}

function saleIsEdited(sale) {
  return Boolean(sale.editada || sale.editedAt || String(sale.status || "").toLowerCase() === "editada");
}

function saleEditHistory(sale) {
  const history = Array.isArray(sale.editHistory) ? sale.editHistory : [];
  if (history.length > 0) return history;
  const legacy = (sale.previousVersions || []).map((version, index) => ({
    id: version.id || `legacy-edit-${index}`,
    editedAt: version.savedAt || "",
    editedBy: sale.editedBy || "",
    reason: version.reason || sale.editReason || "Edicion anterior sin motivo registrado",
    previousValues: version.data || {},
    newValues: {},
    changes: [],
  }));

  return [...legacy, ...history];
}

function isCollectedSale(sale) {
  return saleStatus(sale) === "cobrado";
}

function isInternalServiceSale(sale) {
  return saleStatus(sale) === "servicio_interno" || String(sale.operationType || "").toLowerCase() === "servicio_interno";
}

function comparableSaleSnapshot(sale) {
  return {
    fechaOperativa: saleOperationalDate(sale),
    clientId: sale.clientId || "",
    clientName: sale.clientName || "",
    employee: sale.employee || "",
    services: normalizeSaleServices(sale),
    extra: Number(sale.extra || 0),
    total: Number(sale.total || 0),
    payments: normalizeSalePayments(sale),
    paymentMethod: sale.paymentMethod || "",
    entryChannel: sale.entryChannel || "",
    commissionPercent: Number(sale.commissionPercent || 0),
    commissionAmount: Number(sale.commissionAmount || 0),
    commissionRateApplied: Number(sale.commissionRateApplied ?? sale.commissionPercent ?? 0),
    commissionRule: sale.commissionRule || "",
    commissionSource: sale.commissionSource || "",
    appointmentId: sale.appointmentId || "",
    serviceDate: sale.serviceDate || "",
    serviceTime: sale.serviceTime || "",
    treatwellCommissionPercent: Number(sale.treatwellCommissionPercent || 0),
    treatwellCommissionAmount: Number(sale.treatwellCommissionAmount || 0),
    cardTipAmount: Number(sale.cardTipAmount || 0),
    notes: sale.notes || "",
  };
}

function saleChanges(previousSale, nextSale) {
  const previousValues = comparableSaleSnapshot(previousSale);
  const newValues = comparableSaleSnapshot(nextSale);

  return Object.keys(newValues).reduce((changes, field) => {
    if (JSON.stringify(previousValues[field]) !== JSON.stringify(newValues[field])) {
      changes.push({ field, before: previousValues[field], after: newValues[field] });
    }
    return changes;
  }, []);
}

function normalizeExpense(expense) {
  const status = String(expense.status || "pagado").toLowerCase() === "pendiente" ? "pendiente" : "pagado";
  const documentType = expense.documentType || "Otro";
  const isInvoice = documentType === "Factura";
  const vatRate = isInvoice ? Number(expense.vatRate ?? expense.ivaRate ?? 21) : 0;
  const amount = Number(expense.amount || 0);
  const taxableBase = isInvoice && vatRate > 0 ? amount / (1 + vatRate / 100) : amount;
  const supportedVat = isInvoice && vatRate > 0 ? amount - taxableBase : 0;

  return {
    ...expense,
    date: expense.date || todayLocal(),
    category: expense.category || "General",
    concept: expense.concept || "",
    amount,
    paymentMethod: expense.paymentMethod || "",
    status,
    documentType,
    vatRate,
    taxableBase: Number(taxableBase || 0),
    supportedVat: Number(supportedVat || 0),
  };
}

function normalizeCashClosing(closing) {
  const date = closing.date || todayLocal();

  return cleanFirestoreData({
    id: closing.id || `cash-closing-${date}`,
    date,
    responsible: closing.responsible || "",
    realAmounts: closing.realAmounts || {},
    cardTips: Number(closing.cardTips || closing.summary?.cardTips || 0),
    expectedTerminalTotal: Number(closing.expectedTerminalTotal || closing.summary?.expectedTerminalTotal || 0),
    cardRealConfirmed: Number(closing.cardRealConfirmed || closing.summary?.card?.realConfirmed || 0),
    cardDifference: Number(closing.cardDifference || closing.summary?.card?.difference || 0),
    summary: closing.summary || {},
    observations: closing.observations || "",
    savedAt: closing.savedAt || "",
    reportGeneratedAt: closing.reportGeneratedAt || "",
  });
}

function normalizeMonthlyClosing(closing) {
  const date = todayLocal();
  const month = Number(closing.month || date.slice(5, 7));
  const year = Number(closing.year || date.slice(0, 4));

  return cleanFirestoreData({
    id: closing.id || `monthly-closing-${year}-${String(month).padStart(2, "0")}`,
    month,
    year,
    periodKey: closing.periodKey || `${year}-${String(month).padStart(2, "0")}`,
    createdAt: closing.createdAt || "",
    updatedAt: closing.updatedAt || "",
    responsible: closing.responsible || "",
    salesTotal: Number(closing.salesTotal || 0),
    collectionsByMethod: closing.collectionsByMethod || {},
    expensesTotal: Number(closing.expensesTotal || 0),
    paidExpensesTotal: Number(closing.paidExpensesTotal || 0),
    pendingExpensesTotal: Number(closing.pendingExpensesTotal || 0),
    expensesByMethod: closing.expensesByMethod || {},
    generatedCommissionsTotal: Number(closing.generatedCommissionsTotal || 0),
    paidCommissionsTotal: Number(closing.paidCommissionsTotal || 0),
    pendingCommissionsTotal: Number(closing.pendingCommissionsTotal || 0),
    treatwellCommissionTotal: Number(closing.treatwellCommissionTotal || 0),
    outputVat: Number(closing.outputVat || 0),
    inputVat: Number(closing.inputVat || 0),
    estimatedVat: Number(closing.estimatedVat || 0),
    operatingProfit: Number(closing.operatingProfit || 0),
    theoreticalTreasury: Number(closing.theoreticalTreasury || 0),
    bankTheoretical: Number(closing.bankTheoretical || 0),
    bankReal: Number(closing.bankReal || 0),
    bankDifference: Number(closing.bankDifference || 0),
    cashTheoretical: Number(closing.cashTheoretical || 0),
    cashReal: Number(closing.cashReal || 0),
    cashDifference: Number(closing.cashDifference || 0),
    observations: closing.observations || "",
  });
}

function commissionRows(sales, commissionStatuses) {
  const statusBySale = Object.fromEntries(commissionStatuses.map((item) => [item.saleId || item.id, item.commissionStatus || item.status || "pendiente"]));
  const detailsBySale = Object.fromEntries(commissionStatuses.map((item) => [item.saleId || item.id, item]));

  return sales
    .filter((sale) => isCollectedSale(sale) || isInternalServiceSale(sale))
    .map((sale) => {
      const details = detailsBySale[sale.id] || {};
      const commissionPercent = Number(details.commissionPercent ?? sale.commissionPercent ?? 0);
      const total = saleAmount(sale);
      const commissionAmount = Number(details.commissionAmount ?? (total * (commissionPercent / 100)));

      return {
        id: sale.id,
        saleId: sale.id,
        date: saleOperationalDate(sale),
        hour: sale.serviceTime || sale.horaCierreLocal || sale.horaCreacionLocal || localTimeFromTimestamp(sale.horaCierre || sale.horaCreacion || sale.createdAt),
        professionalId: details.professionalId || sale.professionalId || sale.employeeId || "",
        professionalName: details.professionalName || sale.professionalName || sale.employee || "Sin empleada",
        employee: details.employee || sale.employee || "Sin empleada",
        originalEmployee: sale.employee || "Sin empleada",
        client: sale.clientName || "Sin cliente",
        services: saleServicesText(sale),
        saleTotal: total,
        operationType: isInternalServiceSale(sale) ? "servicio_interno" : "venta",
        commissionPercent,
        commissionAmount,
        commissionRule: sale.commissionRule || "",
        commissionSource: sale.commissionSource || "",
        status: statusBySale[sale.id] || "pendiente",
        commissionStatus: statusBySale[sale.id] || "pendiente",
        paidAt: details.paidAt || "",
        paidBy: details.paidBy || details.usuarioQuePago || "",
        paidObservation: details.paidObservation || details.observacionesPago || "",
        statusChangeReason: details.statusChangeReason || "",
        updatedBy: details.updatedBy || details.editedBy || "",
        paymentDate: details.paymentDate || details.fechaPago || "",
        paymentMethod: details.paymentMethod || details.metodoPagoComision || "",
        fechaPago: details.fechaPago || details.paymentDate || "",
        metodoPagoComision: details.metodoPagoComision || details.paymentMethod || "",
        usuarioQuePago: details.usuarioQuePago || details.paidBy || "",
        observacionesPago: details.observacionesPago || details.paidObservation || "",
        commissionPaymentBatchId: details.commissionPaymentBatchId || "",
        correctionReason: details.correctionReason || "",
        correctionHistory: Array.isArray(details.correctionHistory) ? details.correctionHistory : [],
      };
    })
    .filter((row) => Number(row.commissionAmount || 0) > 0)
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

const businessAreas = ["Manicura / Pedicura", "Cejas / Pestañas", "Corporal", "Facial", "Cursos", "Productos"];

function normalizeBusinessText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function serviceBusinessArea(service) {
  const category = normalizeBusinessText(service.category || "");
  const name = normalizeBusinessText(service.serviceName || service.name || "");
  const text = `${category} ${name}`;

  if (includesAny(text, ["curso", "formacion", "academia", "masterclass"])) return "Cursos";
  if (service.type === "product" || service.isProduct === true || includesAny(text, ["producto", "retail"])) return "Productos";
  if (includesAny(text, ["manicura", "pedicura", "unas", "soft gel", "acrilic", "rubber", "retirada unas"])) return "Manicura / Pedicura";
  if (includesAny(text, ["ceja", "cejas", "pestana", "pestanas", "lifting", "extension", "extensiones", "laminado", "henna", "microblading", "micropigmentacion", "micropigment", "powder brows", "volumen ruso"])) return "Cejas / Pestañas";
  if (includesAny(text, ["corporal", "masaje", "maderoterapia", "drenaje", "presoterapia", "cavitacion", "radiofrecuencia corporal"])) return "Corporal";
  if (includesAny(text, ["facial", "limpieza facial", "tratamiento facial", "depilacion facial", "dermapen", "peeling"])) return "Facial";
  return "";
}

function salesByBusinessArea(sales) {
  const grouped = Object.fromEntries(businessAreas.map((area) => [area, { area, amount: 0, servicesCount: 0, percent: 0 }]));

  sales.forEach((sale) => {
    normalizeSaleServices(sale).forEach((service) => {
      const area = serviceBusinessArea(service);
      if (!area || !grouped[area]) return;
      const amount = Number(service.price || 0) * Number(service.quantity || 1);
      grouped[area].amount += amount;
      grouped[area].servicesCount += Number(service.quantity || 1);
    });
  });

  const total = sales.reduce((sum, sale) => sum + saleAmount(sale), 0);
  return businessAreas.map((area) => ({
    ...grouped[area],
    percent: total ? (grouped[area].amount / total) * 100 : 0,
  }));
}

function channelStats(sales, configuredChannels = []) {
  const grouped = Object.fromEntries((configuredChannels || []).map((channel) => [
    channel,
    { channel, amount: 0, count: 0, averageTicket: 0 },
  ]));

  sales.forEach((sale) => {
    const channel = sale.entryChannel || "Sin especificar";
    const current = grouped[channel] || { channel, amount: 0, count: 0, averageTicket: 0 };
    current.amount += saleAmount(sale);
    current.count += 1;
    current.averageTicket = current.count ? current.amount / current.count : 0;
    grouped[channel] = current;
  });

  return Object.values(grouped).sort((first, second) => second.amount - first.amount);
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

function formatDuration(minutes) {
  const value = Number(minutes || 0);
  if (!value) return "";
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (!hours) return `${rest} min`;
  if (!rest) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

function normalizeServices(services) {
  return (services || []).map((service, index) => {
    if (typeof service === "string") {
      return {
        id: `service-legacy-${index}-${service.toLowerCase().replace(/\s+/g, "-")}`,
        category: "Sin categoria",
        name: service,
        duration: "",
        durationMinutes: 0,
        price: 0,
        active: true,
      };
    }
    const durationMinutes = Number(service.durationMinutes || service.durationInMinutes || durationToMinutes(service.duration || service.duracion));

    return {
      id: service.id || createId("service"),
      category: service.category || service.categoria || "Sin categoria",
      name: service.name || service.nombre || "",
      duration: formatDuration(durationMinutes) || service.duration || service.duracion || "",
      durationMinutes,
      price: Number(service.price ?? service.basePrice ?? service.precioBase ?? 0),
      active: service.active !== false,
      ...(service.type ? { type: service.type } : {}),
      ...(service.isProduct === true ? { isProduct: true } : {}),
    };
  }).filter((service) => service.name);
}

function normalizeEmployeeSettings(config) {
  const rawSettings = Array.isArray(config.employeeSettings) ? config.employeeSettings : [];
  const names = [
    ...(Array.isArray(config.employees) ? config.employees : []),
    ...rawSettings.map((employee) => employee.name),
  ].filter(Boolean);
  const uniqueNames = Array.from(new Set(names.map((name) => String(name).trim()).filter(Boolean)));

  return uniqueNames.map((name) => {
    const existing = rawSettings.find((employee) => String(employee.name || "").trim().toLowerCase() === name.toLowerCase());
    const normalizedEmployee = {
      ...(existing || {}),
      id: existing?.id || `employee-${name.toLowerCase().replace(/\s+/g, "-")}`,
      name,
      active: existing?.active !== false,
      commissionPercent: Number(existing?.commissionPercent || 0),
      commissionHistory: Array.isArray(existing?.commissionHistory) ? existing.commissionHistory : [],
    };
    const policy = normalizeProfessionalCommissionPolicy(normalizedEmployee);
    return {
      ...normalizedEmployee,
      commissionMode: policy.commissionMode,
      commissionSchedule: policy.commissionSchedule,
      economics: {
        ...(normalizedEmployee.economics || {}),
        defaultServiceCommissionPercent: policy.defaultCommissionPercent,
        commissionMode: policy.commissionMode,
        commissionSchedule: policy.commissionSchedule,
        outsideSchedule: policy.outsideSchedule,
      },
    };
  });
}

function normalizeConfig(config) {
  const rawServices = config.services;
  const hasLegacyServices = (rawServices || []).some((service) => (
    typeof service === "string" || (!service.category && !service.duration && service.price === undefined && service.basePrice !== undefined)
  ));

  const normalizedServices = hasLegacyServices ? clone(initialServices) : normalizeServices(rawServices);
  const serviceCategories = Array.from(new Set([
    ...(config.serviceCategories || []),
    ...normalizedServices.map((service) => service.category).filter(Boolean),
  ]));

  return {
    ...config,
    employeeSettings: normalizeEmployeeSettings(config),
    employees: normalizeEmployeeSettings(config).filter((employee) => employee.active !== false).map((employee) => employee.name),
    paymentMethods: config.paymentMethods || defaultData.config.paymentMethods,
    entryChannels: config.entryChannels || defaultData.config.entryChannels,
    serviceCategories,
    services: normalizedServices,
  };
}

function normalizeSale(sale) {
  const services = normalizeSaleServices(sale);
  const fechaOperativa = saleOperationalDate(sale);
  const operationType = String(sale.operationType || sale.tipoOperacion || "").toLowerCase() === "servicio_interno" ? "servicio_interno" : "venta";
  const subtotalServices = Number(sale.subtotalServices ?? servicesSubtotal(services));
  const extra = Number(sale.extra || 0);
  const total = subtotalServices + extra;
  const fields = saleVatFields({ ...sale, operationType, total, commissionPercent: sale.commissionPercent });
  const primaryService = services[0] || {};
  const payments = operationType === "servicio_interno" ? [] : normalizeSalePayments({ ...sale, total });
  const status = operationType === "servicio_interno" ? "servicio_interno" : saleStatus(sale);
  const editada = saleIsEdited(sale);

  return {
    id: sale.id,
    date: fechaOperativa,
    saleDate: sale.saleDate || fechaOperativa,
    fechaOperativa,
    operationType,
    internalService: operationType === "servicio_interno",
    status,
    estadoVenta: status,
    editada,
    clientId: sale.clientId,
    clientName: sale.clientName || "",
    professionalId: sale.professionalId || sale.employeeId || sale.empleadaId || "",
    professionalName: sale.professionalName || sale.employeeName || sale.employee || sale.empleada || "",
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
    paymentMethod: operationType === "servicio_interno" ? "" : sale.paymentMethod || sale.metodoPago || payments.map((payment) => payment.method).join(" + "),
    payments,
    entryChannel: sale.entryChannel || sale.channel || "",
    referralClientId: sale.referralClientId || "",
    referralClientName: sale.referralClientName || "",
    cardTipAmount: Number(sale.cardTipAmount || 0),
    commissionPercent: fields.commissionPercent,
    commissionAmount: fields.commissionAmount,
    commissionRateApplied: Number(sale.commissionRateApplied ?? fields.commissionPercent),
    commissionRule: sale.commissionRule || "",
    commissionSource: sale.commissionSource || "",
    commissionAppliedAt: sale.commissionAppliedAt || "",
    commissionScheduleSnapshot: sale.commissionScheduleSnapshot || null,
    commissionSnapshotLocked: Boolean(sale.commissionSnapshotLocked),
    appointmentId: sale.appointmentId || "",
    serviceDate: sale.serviceDate || "",
    serviceTime: sale.serviceTime || "",
    treatwellCommissionPercent: fields.treatwellCommissionPercent,
    treatwellCommissionAmount: fields.treatwellCommissionAmount,
    netAfterCommission: fields.netAfterCommission,
    netAfterTreatwellAndCommission: fields.netAfterTreatwellAndCommission,
    notes: sale.notes || "",
    horaCreacionLocal: sale.horaCreacionLocal || localTimeFromTimestamp(sale.horaCreacion || sale.createdAt),
    horaCierreLocal: sale.horaCierreLocal || localTimeFromTimestamp(sale.horaCierre || sale.closedAt),
    horaCreacion: sale.horaCreacion || sale.createdAt || "",
    horaCierre: sale.horaCierre || sale.closedAt || "",
    createdAt: sale.createdAt || "",
    createdBy: sale.createdBy || sale.registeredBy || "",
    updatedAt: sale.updatedAt || "",
    isBackdated: Boolean(sale.isBackdated),
    backdatedReasonCode: sale.backdatedReasonCode || "",
    backdatedReasonText: sale.backdatedReasonText || "",
    registeredAfterClosure: Boolean(sale.registeredAfterClosure),
    relatedClosureId: sale.relatedClosureId || "",
    closureStatusAtCreation: sale.closureStatusAtCreation || "",
    auditEvents: Array.isArray(sale.auditEvents) ? sale.auditEvents : [],
    commissionCreatedAfterSettlement: Boolean(sale.commissionCreatedAfterSettlement),
    fechaCierre: sale.fechaCierre || "",
    fechaCancelacion: sale.fechaCancelacion || "",
    horaCancelacion: sale.horaCancelacion || "",
    cancelReason: sale.cancelReason || "",
    editedAt: sale.editedAt || (editada && sale.updatedAt ? sale.updatedAt : ""),
    editedBy: sale.editedBy || "",
    editReason: sale.editReason || "",
    editHistory: saleEditHistory(sale),
    previousVersions: sale.previousVersions || [],
    voidedAt: sale.voidedAt || "",
    voidedBy: sale.voidedBy || "",
    voidReason: sale.voidReason || "",
  };
}

function normalizeClient(client) {
  const { allergies, ...rest } = client || {};
  const observations = rest.observations ?? rest.notes ?? "";
  const email = cleanText(rest.email);

  return cleanFirestoreData({
    ...rest,
    name: rest.name || "",
    email,
    phone: rest.phone || "",
    observations,
    notes: observations,
    interests: rest.interests || "",
    visits: Number(rest.visits || 0),
    totalSpent: Number(rest.totalSpent || 0),
    lastVisit: rest.lastVisit || "",
    loyaltyManualAdjustment: Number(rest.loyaltyManualAdjustment || 0),
    loyaltyStamps: Number(rest.loyaltyStamps || 0),
    referralStamps: Number(rest.referralStamps || 0),
    loyaltyAdjustmentHistory: Array.isArray(rest.loyaltyAdjustmentHistory) ? rest.loyaltyAdjustmentHistory : [],
  });
}

function cleanFirestoreData(item) {
  return Object.fromEntries(Object.entries(item || {}).filter(([, value]) => value !== undefined));
}

function backdatedAuditEvent(type, sale = {}) {
  if (!sale.isBackdated && !sale.backdatedReasonCode && !sale.registeredAfterClosure) return null;
  return cleanFirestoreData({
    id: createId("audit"),
    type,
    saleId: sale.id || "",
    saleDate: sale.saleDate || saleOperationalDate(sale),
    createdAt: sale.createdAt || getTechnicalTimestamp(),
    createdBy: sale.createdBy || sale.registeredBy || "",
    backdatedReasonCode: sale.backdatedReasonCode || "",
    backdatedReasonText: sale.backdatedReasonText || "",
    registeredAfterClosure: Boolean(sale.registeredAfterClosure),
    relatedClosureId: sale.relatedClosureId || "",
    total: Number(sale.total || 0),
    paymentMethods: normalizeSalePayments(sale).map((payment) => payment.method).filter(Boolean),
  });
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function findExistingClient(clients, clientInput = {}) {
  return findQuickClientDuplicate(clients, clientInput) || undefined;
}

function firstValue(row, keys) {
  const normalizedRow = Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [
    String(key).trim().toLowerCase(),
    value,
  ]));

  return keys.reduce((found, key) => {
    if (found !== undefined && found !== null && found !== "") return found;
    return normalizedRow[String(key).trim().toLowerCase()];
  }, "");
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function treatwellRowToClient(row) {
  const firstName = firstValue(row, ["Nombre"]);
  const lastName = firstValue(row, ["Apellidos"]);
  const fullName = firstValue(row, ["Nombre completo"]) || `${firstName || ""} ${lastName || ""}`.trim();
  const phone = firstValue(row, ["Telefono", "Teléfono"]);
  const normalizedPhone = normalizePhone(firstValue(row, ["Telefono normalizado", "Teléfono normalizado"]) || phone);
  const email = cleanText(row?.Email ?? firstValue(row, ["Email", "email", "correo", "Correo", "correo electrónico", "Correo electrónico", "e-mail", "E-mail"]));

  return normalizeClient({
    treatwellClientId: firstValue(row, ["ID cliente"]),
    name: fullName || firstName || phone || "Cliente sin nombre",
    lastName,
    phone,
    phoneNormalized: normalizedPhone,
    email,
    observations: firstValue(row, ["Notas"]),
    marketingOptIn: firstValue(row, ["Opt-in marketing"]),
    language: firstValue(row, ["Idioma"]),
    birthDate: firstValue(row, ["Fecha nacimiento"]),
    bookingCount: Number(firstValue(row, ["Nº reservas", "N reservas", "No reservas"]) || 0),
    createdAtTreatwell: firstValue(row, ["Fecha creación", "Fecha creacion"]),
  });
}

function mergeMissingClientData(existingClient, importedClient) {
  const merged = { ...existingClient };
  let changed = false;

  Object.entries(importedClient).forEach(([key, value]) => {
    if (key === "id" || value === undefined || value === null || value === "") return;
    if (merged[key] === undefined || merged[key] === null || merged[key] === "") {
      merged[key] = value;
      changed = true;
    }
  });

  return { client: normalizeClient(merged), changed };
}

function resetClientMetrics(client) {
  const manualAdjustment = Number(client.loyaltyManualAdjustment || 0);
  return {
    ...client,
    visits: 0,
    totalSpent: 0,
    lastVisit: "",
    loyaltyStamps: manualAdjustment,
    referralStamps: 0,
  };
}

function applySaleToClient(client, sale) {
  const visits = Number(client.visits || 0) + 1;
  const totalSpent = Number(client.totalSpent || 0) + saleAmount(sale);
  const visitDate = saleOperationalDate(sale);
  const lastVisit = !client.lastVisit || visitDate > client.lastVisit ? visitDate : client.lastVisit;
  const loyaltyStamps = Number(client.loyaltyStamps || 0) + saleServicesCount(sale);

  return {
    ...client,
    visits,
    totalSpent,
    lastVisit,
    loyaltyStamps,
  };
}

function applyReferralToClient(client, sale) {
  const stamps = saleServicesCount(sale);
  const referralStamps = Number(client.referralStamps || 0) + stamps;
  const loyaltyStamps = Number(client.loyaltyStamps || 0) + stamps;

  return {
    ...client,
    referralStamps,
    loyaltyStamps,
  };
}

const DataService = {
  getSales() {
    const sales = readCollection("sales").map((sale) => normalizeSale({ ...sale, ...saleVatFields(sale) }));
    writeCollection("sales", sales);
    return sales;
  },

  getExpenses() {
    const expenses = readCollection("expenses").map(normalizeExpense);
    writeCollection("expenses", expenses);
    return expenses;
  },

  getClients() {
    const clients = readCollection("clients").map(normalizeClient);
    writeCollection("clients", clients);
    return clients;
  },

  getAppointments() {
    return readCollection("appointments").map(normalizeAppointmentRecord);
  },

  async getAppointmentsByDate(date) {
    const normalizedDate = normalizeAppointmentDate(date);
    if (!normalizedDate) throw new Error("Selecciona una fecha válida.");
    const appointments = await readFirestoreAppointmentsByDate(normalizedDate);
    mergeAppointmentDateIntoLocal(normalizedDate, appointments);
    return appointments;
  },

  async getAppointmentsByClientId(clientId) {
    return readFirestoreAppointmentsByClientId(clientId);
  },

  getCommissionStatuses() {
    return readCollection("commissions");
  },

  getCommissionPaymentBatches() {
    return readCollection("commissionPaymentBatches");
  },

  getCashClosings() {
    const closings = readCollection("cashClosings").map(normalizeCashClosing);
    writeCollection("cashClosings", closings);
    return closings;
  },

  getMonthlyClosings() {
    const closings = readCollection("monthlyClosings").map(normalizeMonthlyClosing);
    writeCollection("monthlyClosings", closings);
    return closings;
  },

  getCommissions() {
    const rows = commissionRows(this.getSales(), this.getCommissionStatuses());
    return {
      rows,
      paymentBatches: this.getCommissionPaymentBatches(),
      totals: commissionTotals(rows),
    };
  },

  getCommissionsForProfessional(professionalId) {
    const commissions = this.getCommissions();
    const rows = filterOwnPositiveCommissions(commissions.rows, professionalId);
    const byEmployee = rows.reduce((totals, row) => {
      totals[row.employee] = (totals[row.employee] || 0) + Number(row.commissionAmount || 0);
      return totals;
    }, {});
    const generated = rows.reduce((total, row) => total + Number(row.commissionAmount || 0), 0);
    const pending = rows.filter((row) => row.status !== "pagada").reduce((total, row) => total + Number(row.commissionAmount || 0), 0);
    return { rows, totals: { generated, pending, paid: generated - pending, byEmployee } };
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
      cashClosings: this.getCashClosings(),
      monthlyClosings: this.getMonthlyClosings(),
      services: config.services,
      config,
    };
  },

  async initializeRemoteData() {
    try {
      const [sales, expenses, clients, appointments, commissions, commissionPaymentBatches, cashClosings, monthlyClosings, services, remoteConfig] = await Promise.all([
        readFirestoreCollection("sales"),
        readFirestoreCollection("expenses"),
        readFirestoreCollection("clients"),
        readFirestoreAppointmentsByDate(todayLocal()),
        readFirestoreCollection("commissions"),
        readFirestoreCollection("commissionPaymentBatches"),
        readFirestoreCollection("cashClosings"),
        readFirestoreCollection("monthlyClosings"),
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
      writeCollection("commissionPaymentBatches", commissionPaymentBatches);
      writeCollection("cashClosings", cashClosings.map(normalizeCashClosing));
      writeCollection("monthlyClosings", monthlyClosings.map(normalizeMonthlyClosing));
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
      onSnapshot(query(collection(db, "appointments"), where("date", "==", todayLocal())), (snapshot) => {
        const appointments = snapshot.docs.map((document) => normalizeAppointmentRecord({ id: document.id, ...document.data() }));
        mergeAppointmentDateIntoLocal(todayLocal(), appointments);
        refreshFromLocal();
      }, handleError),
      onSnapshot(collection(db, "commissions"), (snapshot) => {
        const commissions = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
        writeCollection("commissions", commissions);
        refreshFromLocal();
      }, handleError),
      onSnapshot(collection(db, "commissionPaymentBatches"), (snapshot) => {
        const commissionPaymentBatches = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
        writeCollection("commissionPaymentBatches", commissionPaymentBatches);
        refreshFromLocal();
      }, handleError),
      onSnapshot(collection(db, "cashClosings"), (snapshot) => {
        const cashClosings = snapshot.docs.map((document) => normalizeCashClosing({ id: document.id, ...document.data() }));
        writeCollection("cashClosings", cashClosings);
        refreshFromLocal();
      }, handleError),
      onSnapshot(collection(db, "monthlyClosings"), (snapshot) => {
        const monthlyClosings = snapshot.docs.map((document) => normalizeMonthlyClosing({ id: document.id, ...document.data() }));
        writeCollection("monthlyClosings", monthlyClosings);
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
    const technicalTimestamp = getTechnicalTimestamp();
    const localTimestamp = getMadridTimestamp();
    const localTime = getMadridTimeString();
    const date = saleInput.saleDate || saleInput.fechaOperativa || saleInput.date || todayLocal();
    const status = saleStatus(saleInput);
    const saleId = createId("sale");
    const preliminarySale = normalizeSale({
      ...saleInput,
      date,
      saleDate: date,
      fechaOperativa: date,
      createdAt: technicalTimestamp,
      horaCreacion: localTimestamp,
      horaCreacionLocal: localTime,
    });
    const commissionSnapshot = resolveSaleCommissionSnapshot(preliminarySale, {
      appointments: this.getAppointments(),
      professionals: this.getConfig().employeeSettings || [],
      appliedAt: technicalTimestamp,
    });
    const sale = {
      ...normalizeSale({
        ...saleInput,
        ...commissionSnapshot,
        netAfterCommission: undefined,
        netAfterTreatwellAndCommission: undefined,
        date,
        saleDate: date,
        fechaOperativa: date,
        status,
        createdAt: technicalTimestamp,
        createdBy: saleInput.createdBy || "",
        updatedAt: technicalTimestamp,
      }),
      id: saleId,
      horaCreacion: localTimestamp,
      horaCreacionLocal: localTime,
      horaCierre: status === "cobrado" ? localTimestamp : "",
      horaCierreLocal: status === "cobrado" ? localTime : "",
      fechaCierre: status === "cobrado" ? date : "",
    };
    const auditEvent = backdatedAuditEvent("sale_backdated_created", sale);
    if (auditEvent) sale.auditEvents = [...(sale.auditEvents || []), auditEvent];
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

    const nextStatus = saleStatus({ ...existingSale, ...updates });
    const technicalTimestamp = getTechnicalTimestamp();
    const now = getMadridTimestamp();
    const localTime = getMadridTimeString();
    const date = updates.saleDate || updates.fechaOperativa || updates.date || existingSale.saleDate || existingSale.fechaOperativa || existingSale.date || todayLocal();
    const wasCollected = saleStatus(existingSale) === "cobrado";
    const isCollected = nextStatus === "cobrado";
    const isVoid = nextStatus === "anulada";
    const isAuditedEdit = Boolean(updates.editReason) && !updates.skipEditAudit;
    const previousVersions = isAuditedEdit
      ? [...(existingSale.previousVersions || []), { savedAt: now, data: existingSale }]
      : existingSale.previousVersions || [];
    const updateInput = {
      ...existingSale,
      ...updates,
      date,
      saleDate: date,
      fechaOperativa: date,
      id: saleId,
      status: nextStatus,
      estadoVenta: nextStatus,
      editada: isAuditedEdit ? true : saleIsEdited(existingSale),
      horaCreacion: existingSale.horaCreacion || existingSale.createdAt || now,
      horaCreacionLocal: existingSale.horaCreacionLocal || localTimeFromTimestamp(existingSale.horaCreacion || existingSale.createdAt) || localTime,
      horaCierre: nextStatus === "cobrado" ? (updates.horaCierre || (wasCollected ? existingSale.horaCierre : "") || now) : "",
      horaCierreLocal: nextStatus === "cobrado" ? (updates.horaCierreLocal || (wasCollected ? existingSale.horaCierreLocal : "") || localTime) : "",
      fechaCierre: nextStatus === "cobrado" ? (updates.fechaCierre || date) : "",
      fechaCancelacion: nextStatus === "cancelado" ? (updates.fechaCancelacion || todayLocal()) : existingSale.fechaCancelacion,
      horaCancelacion: nextStatus === "cancelado" ? (updates.horaCancelacion || now) : existingSale.horaCancelacion,
      createdAt: existingSale.createdAt || technicalTimestamp,
      createdBy: existingSale.createdBy || updates.createdBy || "",
      updatedAt: technicalTimestamp,
      editedAt: isAuditedEdit ? now : existingSale.editedAt,
      editedBy: isAuditedEdit ? (updates.editedBy || existingSale.editedBy || "") : existingSale.editedBy,
      previousVersions,
      voidedAt: isVoid ? (updates.voidedAt || now) : existingSale.voidedAt,
      voidedBy: isVoid ? (updates.voidedBy || existingSale.voidedBy || "") : existingSale.voidedBy,
      voidReason: isVoid ? (updates.voidReason || existingSale.voidReason || "") : existingSale.voidReason,
    };
    const hasCommissionChange = commissionFieldsChanged(existingSale, updateInput);
    assertCommissionEditReason(existingSale, updateInput, updates.editReason);
    let commissionAwareInput = updateInput;
    if (hasCommissionChange) {
      const momentChanged = ["serviceDate", "serviceTime", "appointmentId"]
        .some((field) => String(existingSale[field] || "") !== String(updateInput[field] || ""));
      const rateChanged = Number(existingSale.commissionPercent || 0) !== Number(updateInput.commissionPercent || 0);
      const amountChanged = Number(existingSale.commissionAmount || 0) !== Number(updateInput.commissionAmount || 0);
      const manualUpdates = { ...updates };
      if (momentChanged && !rateChanged && !amountChanged) {
        delete manualUpdates.commissionPercent;
        delete manualUpdates.commissionRateApplied;
        delete manualUpdates.commissionAmount;
      }
      const normalizedForOverride = normalizeSale({
        ...updateInput,
        netAfterCommission: undefined,
        netAfterTreatwellAndCommission: undefined,
      });
      const manualSnapshot = buildManualCommissionOverride(normalizedForOverride, manualUpdates, {
        appointments: this.getAppointments(),
        professionals: this.getConfig().employeeSettings || [],
        appliedAt: technicalTimestamp,
      });
      commissionAwareInput = {
        ...updateInput,
        ...manualSnapshot,
        netAfterCommission: undefined,
        netAfterTreatwellAndCommission: undefined,
      };
    }
    const draftSale = normalizeSale(commissionAwareInput);
    const editHistory = isAuditedEdit
      ? [
        ...saleEditHistory(existingSale),
        createCommissionAuditEntry({
          id: createId("sale-edit"),
          editedAt: now,
          editedBy: updates.editedBy || existingSale.editedBy || "",
          reason: updates.editReason || "Sin motivo registrado",
          previousValues: comparableSaleSnapshot(existingSale),
          newValues: comparableSaleSnapshot(draftSale),
          changes: saleChanges(existingSale, draftSale),
        }),
      ]
      : saleEditHistory(existingSale);
    const updatedSale = normalizeSale({
      ...draftSale,
      editReason: isAuditedEdit ? (updates.editReason || "") : draftSale.editReason,
      editHistory,
    });
    const backdatedEditEvent = isAuditedEdit ? backdatedAuditEvent("sale_backdated_edited", updatedSale) : null;
    if (backdatedEditEvent) {
      updatedSale.auditEvents = [...(updatedSale.auditEvents || []), backdatedEditEvent];
    }
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
    const expense = normalizeExpense({
      date: expenseInput.date || todayLocal(),
      category: expenseInput.category || "General",
      concept: expenseInput.concept || "",
      amount: Number(expenseInput.amount || 0),
      paymentMethod: expenseInput.paymentMethod || "",
      status: String(expenseInput.status || "pagado").toLowerCase() === "pendiente" ? "pendiente" : "pagado",
      documentType: expenseInput.documentType || "Otro",
      vatRate: expenseInput.vatRate,
      id: createId("expense"),
      createdAt: expenseInput.createdAt || getMadridTimestamp(),
    });
    const expenses = writeCollection("expenses", [expense, ...currentExpenses]);
    saveDocumentToFirestore("expenses", expense);
    return Array.isArray(arg1) ? expenses : this.getData();
  },

  updateExpense(expenseId, updates) {
    const currentExpenses = this.getExpenses();
    const existingExpense = currentExpenses.find((expense) => expense.id === expenseId);
    if (!existingExpense) return this.getData();

    const updatedExpense = normalizeExpense({
      ...existingExpense,
      ...updates,
      id: expenseId,
    });
    const expenses = writeCollection(
      "expenses",
      currentExpenses.map((expense) => (expense.id === expenseId ? updatedExpense : expense)),
    );
    saveDocumentToFirestore("expenses", updatedExpense);
    return { ...this.getData(), expenses };
  },

  addClient(arg1, arg2) {
    const currentClients = Array.isArray(arg1) ? arg1 : this.getClients();
    const clientInput = arg2 || arg1;
    const existingClient = findExistingClient(currentClients, clientInput);
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
    const existingClient = findExistingClient(currentClients, clientInput);
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

  async createAgendaClient(clientInput) {
    const currentClients = this.getClients();
    const result = await createQuickClientOperation(clientInput, {
      clients: currentClients,
      createClientId: () => createId("client"),
      saveClient: async (candidate) => {
        const client = normalizeClient({
          ...candidate,
          observations: candidate.observations ?? candidate.notes ?? "",
        });
        await setDoc(doc(db, "clients", client.id), cleanFirestoreData(client));
        return client;
      },
    });
    const clients = result.created
      ? writeCollection("clients", [result.client, ...currentClients])
      : currentClients;
    return { ...result, data: { ...this.getData(), clients } };
  },

  importTreatwellClients(rows = []) {
    const currentClients = this.getClients();
    const phoneIndex = new Map(currentClients.map((client) => [
      normalizePhone(client.phoneNormalized || client.phone),
      client,
    ]).filter(([phone]) => phone));
    const importedPhones = new Set();
    const errors = [];
    let imported = 0;
    let updated = 0;
    let duplicates = 0;

    const nextClients = [...currentClients];

    rows.forEach((row, index) => {
      try {
        const importedClient = treatwellRowToClient(row);
        const phoneKey = normalizePhone(importedClient.phoneNormalized || importedClient.phone);

        if (!phoneKey) {
          errors.push(`Fila ${index + 2}: telefono normalizado vacio`);
          return;
        }

        if (importedPhones.has(phoneKey)) {
          duplicates += 1;
          return;
        }
        importedPhones.add(phoneKey);

        const existingClient = phoneIndex.get(phoneKey);
        if (existingClient) {
          const { client, changed } = mergeMissingClientData(existingClient, importedClient);
          const clientIndex = nextClients.findIndex((item) => item.id === existingClient.id);
          if (clientIndex >= 0 && changed) {
            nextClients[clientIndex] = client;
            saveDocumentToFirestore("clients", client);
            updated += 1;
          }
          duplicates += 1;
          return;
        }

        const client = normalizeClient({
          ...importedClient,
          id: createId("client"),
        });
        nextClients.unshift(client);
        phoneIndex.set(phoneKey, client);
        saveDocumentToFirestore("clients", client);
        imported += 1;
      } catch (error) {
        errors.push(`Fila ${index + 2}: ${error.message || "no se pudo importar"}`);
      }
    });

    const clients = writeCollection("clients", nextClients);

    return {
      data: { ...this.getData(), clients },
      result: {
        imported,
        updated,
        duplicates,
        errors,
      },
    };
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

  async updateProfessionalSettings(updates) {
    const config = normalizeConfig({ ...this.getConfig(), ...updates });
    await syncConfigToFirestore(config);
    writeCollection("config", config);
    return { ...this.getData(), config };
  },

  createService(serviceInput) {
    const currentConfig = this.getConfig();
    const categoryName = cleanText(serviceInput.category);
    const existingCategory = (currentConfig.serviceCategories || []).find((category) => normalizeEmail(category) === normalizeEmail(categoryName));
    const category = existingCategory || categoryName;
    const durationMinutes = Number(serviceInput.durationMinutes || durationToMinutes(serviceInput.duration));
    const service = normalizeServices([{
      id: createId("service"),
      category,
      name: cleanText(serviceInput.name),
      durationMinutes,
      price: Number(serviceInput.price || 0),
      active: serviceInput.active !== false,
    }])[0];

    if (!service?.name || !service.category || !service.durationMinutes || service.price <= 0) {
      return { data: this.getData(), service: null };
    }

    const serviceCategories = existingCategory || !category
      ? currentConfig.serviceCategories
      : [...(currentConfig.serviceCategories || []), category].sort((first, second) => first.localeCompare(second));
    const config = writeCollection("config", normalizeConfig({
      ...currentConfig,
      serviceCategories,
      services: [service, ...(currentConfig.services || [])],
    }));
    syncConfigToFirestore(config).catch((error) => {
      console.warn("Firestore service save failed", error);
      console.log("Usando localStorage fallback");
    });

    return { data: { ...this.getData(), config }, service };
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

  async createAppointment(appointment, actor = {}) {
    const item = await createAppointmentOperation(appointment, {
      actor,
      id: createId("appointment"),
      loadAppointmentsByDate: readFirestoreAppointmentsByDate,
      now: getTechnicalTimestamp(),
      saveAppointment: (record) => setDoc(doc(db, "appointments", record.id), cleanFirestoreData(record)),
    });
    const appointmentsForDate = await readFirestoreAppointmentsByDate(item.date);
    mergeAppointmentDateIntoLocal(item.date, [item, ...appointmentsForDate]);
    return { appointment: item, data: this.getData() };
  },

  async updateAppointment(appointmentId, updates, actor = {}) {
    const currentAppointments = this.getAppointments();
    const existingAppointment = currentAppointments.find((appointment) => appointment.id === appointmentId)
      || await readFirestoreAppointment(appointmentId);
    if (!existingAppointment) throw new Error("La cita ya no existe.");

    const updatedAppointment = buildAppointmentRecord(updates, {
      actor,
      existing: existingAppointment,
      now: getTechnicalTimestamp(),
    });
    assertAppointmentStatusTransition(existingAppointment.status, updatedAppointment.status);
    const appointmentsForDate = await readFirestoreAppointmentsByDate(updatedAppointment.date);
    assertNoAppointmentConflict(updatedAppointment, appointmentsForDate, appointmentId);
    await setDoc(doc(db, "appointments", appointmentId), cleanFirestoreData(updatedAppointment));

    const withoutUpdated = appointmentsForDate.filter((appointment) => appointment.id !== appointmentId);
    mergeAppointmentDateIntoLocal(updatedAppointment.date, [updatedAppointment, ...withoutUpdated]);
    if (existingAppointment.date !== updatedAppointment.date) {
      writeCollection("appointments", this.getAppointments().filter((appointment) => (
        appointment.id !== appointmentId || appointment.date === updatedAppointment.date
      )));
    }
    return { appointment: updatedAppointment, data: this.getData() };
  },

  async addAppointment(appointment, actor = {}) {
    const result = await this.createAppointment(appointment, actor);
    return result.data;
  },

  async deleteAppointment(appointmentId, actor = {}) {
    const result = await this.updateAppointment(appointmentId, { status: "Cancelada" }, actor);
    return result.data;
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

  updateCommissionStatus(saleId, status, details = {}) {
    const safeStatus = status === "pagada" ? "pagada" : "pendiente";
    const currentStatuses = this.getCommissionStatuses();
    const existingStatus = currentStatuses.find((item) => (item.saleId || item.id) === saleId);
    const currentRow = commissionRows(this.getSales(), currentStatuses).find((row) => row.saleId === saleId);
    const hasCorrection = Boolean(details.correctionReason);
    const isQuickStatusChange = Boolean(details.statusChangeOnly);
    if (hasCorrection) {
      const sale = this.getSales().find((item) => item.id === saleId);
      if (sale) {
        this.updateSale(saleId, {
          employee: details.employee ?? sale.employee,
          commissionPercent: details.commissionPercent !== undefined ? Number(details.commissionPercent || 0) : sale.commissionPercent,
          commissionAmount: details.commissionAmount !== undefined ? Number(details.commissionAmount || 0) : sale.commissionAmount,
          commissionRule: "manual_override",
          commissionRateApplied: details.commissionPercent !== undefined ? Number(details.commissionPercent || 0) : sale.commissionRateApplied,
          editReason: details.correctionReason,
          editedBy: details.editedBy || details.updatedBy || "",
          netAfterCommission: undefined,
          netAfterTreatwellAndCommission: undefined,
        });
      }
    }
    if (safeStatus === "pagada" && currentRow?.status === "pagada" && !hasCorrection) {
      return { ...this.getData(), commissions: currentStatuses };
    }
    const previousValues = currentRow ? {
      employee: currentRow.employee,
      commissionPercent: Number(currentRow.commissionPercent || 0),
      commissionAmount: Number(currentRow.commissionAmount || 0),
      status: currentRow.status || "pendiente",
      commissionStatus: currentRow.commissionStatus || currentRow.status || "pendiente",
      paidAt: currentRow.paidAt || "",
      paidBy: currentRow.paidBy || "",
      paidObservation: currentRow.paidObservation || "",
      paymentDate: currentRow.paymentDate || "",
      paymentMethod: currentRow.paymentMethod || "",
      fechaPago: currentRow.fechaPago || currentRow.paymentDate || "",
      metodoPagoComision: currentRow.metodoPagoComision || currentRow.paymentMethod || "",
      usuarioQuePago: currentRow.usuarioQuePago || currentRow.paidBy || "",
      observacionesPago: currentRow.observacionesPago || currentRow.paidObservation || "",
    } : {};
    const paymentDate = details.paymentDate || details.fechaPago || existingStatus?.paymentDate || existingStatus?.fechaPago || todayLocal();
    const paymentMethod = normalizeCommissionPaymentMethod(
      details.paymentMethod || details.metodoPagoComision || existingStatus?.paymentMethod || existingStatus?.metodoPagoComision || "",
    );
    const paymentObservation = details.paidObservation || details.observacionesPago || existingStatus?.paidObservation || existingStatus?.observacionesPago || "";
    const paymentUser = details.updatedBy || details.editedBy || existingStatus?.updatedBy || existingStatus?.usuarioQuePago || "";
    const paymentFields = safeStatus === "pagada" ? buildCommissionPaymentFields({
      paymentDate,
      paymentMethod,
      actor: paymentUser,
      notes: paymentObservation,
      paidAt: details.paidAt || getMadridTimestamp(),
    }) : null;
    if (safeStatus === "pagada" && !paymentFields) {
      return { ...this.getData(), commissions: currentStatuses };
    }
    const newValues = {
      employee: details.employee ?? existingStatus?.employee ?? previousValues.employee,
      commissionPercent: details.commissionPercent !== undefined ? Number(details.commissionPercent || 0) : (existingStatus?.commissionPercent ?? previousValues.commissionPercent),
      commissionAmount: details.commissionAmount !== undefined ? Number(details.commissionAmount || 0) : (existingStatus?.commissionAmount ?? previousValues.commissionAmount),
      status: safeStatus,
      commissionStatus: safeStatus,
      paidAt: paymentFields?.paidAt || null,
      paidBy: paymentFields?.paidBy || "",
      paidObservation: paymentFields?.paidObservation || "",
      paymentDate: paymentFields?.paymentDate || "",
      paymentMethod: paymentFields?.paymentMethod || "",
      fechaPago: paymentFields?.fechaPago || "",
      metodoPagoComision: paymentFields?.metodoPagoComision || "",
      usuarioQuePago: paymentFields?.usuarioQuePago || "",
      observacionesPago: paymentFields?.observacionesPago || "",
    };
    const correctionHistory = hasCorrection
      ? [
        ...(Array.isArray(existingStatus?.correctionHistory) ? existingStatus.correctionHistory : []),
        {
          id: createId("commission-edit"),
          editedAt: getMadridTimestamp(),
          editedBy: details.editedBy || "",
          reason: details.correctionReason,
          previousValues,
          newValues,
        },
      ]
      : (existingStatus?.correctionHistory || []);
    const statusHistory = isQuickStatusChange
      ? [
        ...(Array.isArray(existingStatus?.statusHistory) ? existingStatus.statusHistory : []),
        {
          id: createId("commission-status"),
          changedAt: getMadridTimestamp(),
          changedBy: details.updatedBy || details.editedBy || "",
          previousStatus: previousValues.commissionStatus || previousValues.status || "pendiente",
          newStatus: safeStatus,
          paidAt: newValues.paidAt,
          paymentDate: newValues.paymentDate,
          paymentMethod: newValues.paymentMethod,
          commissionAmount: newValues.commissionAmount,
        },
      ]
      : (existingStatus?.statusHistory || []);
    const nextStatus = cleanFirestoreData({
      ...(existingStatus || {}),
      id: saleId,
      saleId,
      employee: newValues.employee,
      commissionPercent: newValues.commissionPercent,
      commissionAmount: newValues.commissionAmount,
      status: safeStatus,
      commissionStatus: safeStatus,
      paidAt: newValues.paidAt,
      paidBy: newValues.paidBy,
      paidObservation: newValues.paidObservation,
      statusChangeReason: "",
      paymentDate: newValues.paymentDate,
      paymentMethod: newValues.paymentMethod,
      fechaPago: newValues.fechaPago,
      metodoPagoComision: newValues.metodoPagoComision,
      usuarioQuePago: newValues.usuarioQuePago,
      observacionesPago: newValues.observacionesPago,
      correctionReason: details.correctionReason || existingStatus?.correctionReason || "",
      correctionHistory,
      statusHistory,
      editedBy: details.editedBy || existingStatus?.editedBy || "",
      updatedBy: details.updatedBy || details.editedBy || existingStatus?.updatedBy || "",
      updatedAt: getMadridTimestamp(),
    });
    const commissions = writeCollection(
      "commissions",
      existingStatus
        ? currentStatuses.map((item) => ((item.saleId || item.id) === saleId ? nextStatus : item))
        : [nextStatus, ...currentStatuses],
    );
    saveDocumentToFirestore("commissions", nextStatus);
    return { ...this.getData(), commissions };
  },

  bulkPayCommissions(commissionIds = [], details = {}) {
    const uniqueIds = [...new Set((commissionIds || []).filter(Boolean))];
    const currentStatuses = this.getCommissionStatuses();
    const rows = commissionRows(this.getSales(), currentStatuses);
    const currentById = new Map(currentStatuses.map((item) => [item.saleId || item.id, item]));
    const paymentDate = details.paymentDate || todayLocal();
    const paymentMethod = normalizeCommissionPaymentMethod(details.paymentMethod || "Transferencia");
    const actor = details.updatedBy || details.createdBy || "";
    const notes = details.notes || "";
    const periodStart = details.periodStart || "";
    const periodEnd = details.periodEnd || "";
    const now = getMadridTimestamp();
    const paymentFields = buildCommissionPaymentFields({ paymentDate, paymentMethod, actor, notes, paidAt: now });
    if (!paymentFields) {
      return { data: this.getData(), result: { paidCount: 0, batchCount: 0, totalAmount: 0, skippedCount: uniqueIds.length, batches: [] } };
    }
    const selectedRows = selectPayableCommissions(rows, uniqueIds);

    if (selectedRows.length === 0) {
      return { data: this.getData(), result: { paidCount: 0, batchCount: 0, totalAmount: 0, skippedCount: uniqueIds.length, batches: [] } };
    }

    const skippedCount = uniqueIds.length - selectedRows.length;
    const operationId = createId("commission-bulk-payment");
    const groupedRows = selectedRows.reduce((groups, row) => {
      const key = row.professionalId || row.employee || "Sin empleada";
      const current = groups[key] || {
        professionalId: row.professionalId || "",
        professionalName: row.professionalName || row.employee || "Sin empleada",
        employee: row.employee || "Sin empleada",
        rows: [],
      };
      current.rows.push(row);
      groups[key] = current;
      return groups;
    }, {});
    const existingBatches = this.getCommissionPaymentBatches();
    const batches = Object.values(groupedRows).map((group) => {
      const totalAmount = group.rows.reduce((total, row) => total + Number(row.commissionAmount || 0), 0);
      return cleanFirestoreData({
        id: createId("commission-payment-batch"),
        operationId,
        professionalId: group.professionalId,
        professionalName: group.professionalName,
        employee: group.employee,
        commissionIds: group.rows.map((row) => row.saleId),
        periodStart,
        periodEnd,
        paymentDate,
        paymentMethod,
        commissionCount: group.rows.length,
        totalAmount,
        status: "pagado",
        notes,
        createdAt: now,
        createdBy: actor,
        auditEvent: "commission_batch_paid",
      });
    });
    const batchIdByCommission = new Map();
    batches.forEach((batchItem) => {
      (batchItem.commissionIds || []).forEach((commissionId) => batchIdByCommission.set(commissionId, batchItem.id));
    });

    const nextStatusesById = new Map(currentStatuses.map((item) => [item.saleId || item.id, item]));
    selectedRows.forEach((row) => {
      const existingStatus = currentById.get(row.saleId) || {};
      const previousStatus = existingStatus.commissionStatus || existingStatus.status || row.status || "pendiente";
      const newStatus = cleanFirestoreData({
        ...existingStatus,
        id: row.saleId,
        saleId: row.saleId,
        employee: existingStatus.employee || row.employee,
        professionalId: existingStatus.professionalId || row.professionalId || "",
        professionalName: existingStatus.professionalName || row.professionalName || row.employee || "",
        commissionPercent: existingStatus.commissionPercent ?? row.commissionPercent,
        commissionAmount: existingStatus.commissionAmount ?? row.commissionAmount,
        status: "pagada",
        commissionStatus: "pagada",
        ...paymentFields,
        commissionPaymentBatchId: batchIdByCommission.get(row.saleId),
        updatedBy: actor,
        updatedAt: now,
        statusHistory: [
          ...(Array.isArray(existingStatus.statusHistory) ? existingStatus.statusHistory : []),
          {
            id: createId("commission-status"),
            changedAt: now,
            changedBy: actor,
            previousStatus,
            newStatus: "pagada",
            paymentDate,
            paymentMethod,
            commissionAmount: Number(row.commissionAmount || 0),
            commissionPaymentBatchId: batchIdByCommission.get(row.saleId),
            auditEvent: "commission_batch_paid",
          },
        ],
      });
      nextStatusesById.set(row.saleId, newStatus);
    });

    const nextStatuses = [...nextStatusesById.values()];
    const nextBatches = [...batches, ...existingBatches];
    writeCollection("commissions", nextStatuses);
    writeCollection("commissionPaymentBatches", nextBatches);

    const firestoreBatch = writeBatch(db);
    selectedRows.forEach((row) => {
      firestoreBatch.set(doc(db, "commissions", row.saleId), cleanFirestoreData(nextStatusesById.get(row.saleId)));
    });
    batches.forEach((batchItem) => {
      firestoreBatch.set(doc(db, "commissionPaymentBatches", batchItem.id), cleanFirestoreData(batchItem));
    });
    firestoreBatch.commit().catch((error) => {
      console.warn("Firestore commission bulk payment failed", error);
      console.log("Usando localStorage fallback");
    });

    const totalAmount = selectedRows.reduce((total, row) => total + Number(row.commissionAmount || 0), 0);
    return {
      data: { ...this.getData(), commissions: nextStatuses, commissionPaymentBatches: nextBatches },
      result: {
        paidCount: selectedRows.length,
        batchCount: batches.length,
        totalAmount,
        skippedCount,
        batches,
      },
    };
  },

  saveCashClosing(closingInput) {
    const date = closingInput.date || todayLocal();
    const currentClosings = this.getCashClosings();
    const existingClosing = currentClosings.find((closing) => closing.date === date);
    const closing = normalizeCashClosing({
      ...(existingClosing || {}),
      ...closingInput,
      id: existingClosing?.id || `cash-closing-${date}`,
      date,
      savedAt: getMadridTimestamp(),
    });
    const cashClosings = writeCollection(
      "cashClosings",
      existingClosing
        ? currentClosings.map((item) => (item.id === existingClosing.id ? closing : item))
        : [closing, ...currentClosings],
    );
    saveDocumentToFirestore("cashClosings", closing);
    return { ...this.getData(), cashClosings };
  },

  saveMonthlyClosing(closingInput) {
    const month = Number(closingInput.month || todayLocal().slice(5, 7));
    const year = Number(closingInput.year || todayLocal().slice(0, 4));
    const periodKey = `${year}-${String(month).padStart(2, "0")}`;
    const currentClosings = this.getMonthlyClosings();
    const existingClosing = currentClosings.find((closing) => closing.periodKey === periodKey);
    const now = getMadridTimestamp();
    const closing = normalizeMonthlyClosing({
      ...(existingClosing || {}),
      ...closingInput,
      id: existingClosing?.id || `monthly-closing-${periodKey}`,
      month,
      year,
      periodKey,
      createdAt: existingClosing?.createdAt || now,
      updatedAt: now,
    });
    const monthlyClosings = writeCollection(
      "monthlyClosings",
      existingClosing
        ? currentClosings.map((item) => (item.id === existingClosing.id ? closing : item))
        : [closing, ...currentClosings],
    );
    saveDocumentToFirestore("monthlyClosings", closing);
    return { ...this.getData(), monthlyClosings };
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
    const allSales = this.getSales();
    const sales = allSales.filter(isCollectedSale);
    const current = getDateParts(todayLocal());
    const pendingSales = allSales.filter((sale) => saleStatus(sale) === "pendiente_pago" && itemOperationalDate(sale) === current.day);
    const expenses = this.getExpenses();
    const clients = this.getClients();
    const appointments = this.getAppointments();
    const config = this.getConfig();
    const commissionRowsForDashboard = commissionRows(allSales, this.getCommissionStatuses());
    const todaySales = sales.filter((sale) => itemOperationalDate(sale) === current.day);
    const todayAppointments = appointments.filter((appointment) => itemOperationalDate(appointment) === current.day);
    const todayExpenses = expenses.filter((expense) => itemOperationalDate(expense) === current.day);
    const todayPaidCommissions = commissionRowsForDashboard.filter((commission) => (
      commission.status === "pagada" && commissionPaymentDate(commission) === current.day
    ));
    const monthSales = sales.filter((sale) => itemOperationalDate(sale)?.startsWith(current.month));
    const monthExpenses = expenses.filter((expense) => itemOperationalDate(expense)?.startsWith(current.month));
    const monthPaidCommissions = commissionRowsForDashboard.filter((commission) => (
      commission.status === "pagada" && commissionPaymentDate(commission).startsWith(current.month)
    ));
    const todaySalesTotal = todaySales.reduce((total, sale) => total + saleAmount(sale), 0);
    const todayExpensesTotal = sum(todayExpenses, "amount");
    const monthSalesTotal = monthSales.reduce((total, sale) => total + saleAmount(sale), 0);
    const monthExpensesTotal = sum(monthExpenses, "amount");
    const todaySummary = saleSummary(todaySales);
    const monthSummary = saleSummary(monthSales);
    const todayCashSummary = dashboardCashSummary(todaySales, todayExpenses, todayPaidCommissions);
    const monthCashSummary = dashboardCashSummary(monthSales, monthExpenses, monthPaidCommissions);
    const monthProfit = monthSummary.totalSales - monthSummary.ivaAmount - monthSummary.commissionAmount - monthExpensesTotal;
    const dayOfMonth = getMadridDayOfMonth();
    const daysInMonth = getMadridDaysInCurrentMonth();
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
        salesCount: todaySales.length,
        servicesCount: todaySales.reduce((total, sale) => total + saleServicesCount(sale), 0),
        appointmentsCount: todayAppointments.length,
        clients: new Set(todaySales.map((sale) => sale.clientId).filter(Boolean)).size,
        averageTicket: todaySales.length ? todaySalesTotal / todaySales.length : 0,
        cashSummary: todayCashSummary,
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
        cashSummary: monthCashSummary,
      },
      pending: {
        count: pendingSales.length,
        total: pendingSales.reduce((total, sale) => total + saleAmount(sale), 0),
      },
      clients,
    };
  },

  getStats(filters = {}) {
    this.recalculateClientData();
    const from = filters.from || "";
    const to = filters.to || "";
    const statusFilter = filters.status || "cobrado";
    const inRange = (item) => {
      const date = itemOperationalDate(item);
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    };
    const sales = this.getSales()
      .filter(inRange)
      .filter((sale) => !statusFilter || saleStatus(sale) === statusFilter);
    const expenses = this.getExpenses().filter(inRange);
    const config = this.getConfig();
    const summary = saleSummary(sales);
    const totalSales = summary.totalSales;
    const totalExpenses = sum(expenses, "amount");

    return {
      salesByDay: groupBySum(sales, "date", "total"),
      expensesByCategory: groupBySum(expenses, "category", "amount"),
      salesByEmployee: groupBySum(sales, "employee", "total"),
      salesByService: groupBySum(sales, "service", "total"),
      paymentMethods: groupBySum(sales, "paymentMethod", "total"),
      paymentMethodBreakdown: paymentMethodStats(sales),
      salesByChannel: channelStats(sales, config.entryChannels),
      salesByBusinessArea: salesByBusinessArea(sales),
      serviceRankings: serviceRankings(sales),
      employeeCommissions: employeeCommissions(sales),
      totalSales,
      totalExpenses,
      totalIva: summary.ivaAmount,
      totalNetWithoutVat: summary.netWithoutVat,
      totalCommissions: summary.commissionAmount,
      totalTreatwellCommissions: summary.treatwellCommissionAmount,
      netAfterVatAndCommissions: summary.netAfterCommission,
      netAfterTreatwellAndCommissions: summary.netAfterTreatwellAndCommission,
      profit: summary.netAfterCommission - totalExpenses,
      averageTicket: sales.length ? totalSales / sales.length : 0,
    };
  },

  recalculateClientData(syncRemote = false) {
    const sales = this.getSales().filter(isCollectedSale);
    const resetClients = this.getClients().map(resetClientMetrics);
    const clients = sales.reduce((currentClients, sale) => {
      let nextClients = currentClients;

      if (sale.clientId) {
        nextClients = nextClients.map((client) =>
          client.id === sale.clientId ? applySaleToClient(client, sale) : client
        );
      }

      if (sale.clientId && sale.referralClientId && sale.referralClientId !== sale.clientId) {
        nextClients = nextClients.map((client) =>
          client.id === sale.referralClientId ? applyReferralToClient(client, sale) : client
        );
      }

      return nextClients;
    }, resetClients);

    return writeCollection("clients", clients, syncRemote);
  },

  reset(mode = "full") {
    writeCollection("sales", [], true);
    writeCollection("expenses", [], true);
    writeCollection("appointments", [], true);
    writeCollection("commissions", [], true);
    writeCollection("commissionPaymentBatches", [], true);
    writeCollection("cashClosings", [], true);
    writeCollection("monthlyClosings", [], true);

    if (mode === "all") {
      writeCollection("clients", [], true);
    }

    this.recalculateClientData();
    return this.getData();
  },
};

export default DataService;
