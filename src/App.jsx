import { Component, useEffect, useMemo, useRef, useState } from "react";
import Agenda from "./components/Agenda.jsx";
import CashClosing from "./components/CashClosing.jsx";
import Commissions from "./components/Commissions.jsx";
import Clients from "./components/Clients.jsx";
import Dashboard from "./components/Dashboard.jsx";
import ExpenseForm from "./components/ExpenseForm.jsx";
import ExpenseList from "./components/ExpenseList.jsx";
import Finance from "./components/Finance.jsx";
import Loyalty from "./components/Loyalty.jsx";
import SalesForm from "./components/SalesForm.jsx";
import SafeSalesHistory from "./components/SafeSalesHistory.jsx";
import Settings from "./components/Settings.jsx";
import Statistics from "./components/Statistics.jsx";
import Login, { LoginLoading } from "./components/Login.jsx";
import OperationalAgenda from "./components/OperationalAgendaReal.jsx";
import { ProfessionalAgenda, ProfessionalCommissions } from "./components/ProfessionalViews.jsx";
import ProfessionalsSettingsReal from "./components/ProfessionalsSettingsReal.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { allowedTabsForRole, canAccessDashboardSection, canAccessTab, canPerform, defaultPageForRole, effectiveRoleForUser, isOwnEmployeeOnly, onlyOwnEmployeeItems, professionalMatchesItem } from "./permissions.js";
import DataService from "./services/DataService.js";
import { formatMadridTime, getTodayLocalDateString } from "./utils/date.js";

const navigationSections = [
  {
    id: "professional-agenda",
    label: "Mi agenda",
    items: [
      { key: "professional-agenda", pageId: "professional.agenda", tabId: "professionalAgenda", label: "Mi agenda" },
    ],
  },
  {
    id: "professional-commissions",
    label: "Mis comisiones",
    items: [
      { key: "professional-commissions", pageId: "professional.commissions", tabId: "professionalCommissions", label: "Mis comisiones" },
    ],
  },
  {
    id: "dashboard",
    label: "Dashboard",
    items: [
      { key: "dashboard-daily", pageId: "dashboard.daily", tabId: "dashboard", label: "Resumen diario" },
      { key: "dashboard-monthly", pageId: "dashboard.monthly", tabId: "dashboard", label: "Resumen mensual" },
    ],
  },
  {
    id: "sales",
    label: "Ventas",
    items: [
      { key: "sales-new", pageId: "sales.new", tabId: "sales", label: "Nueva venta" },
      { key: "sales-pending", pageId: "sales.pending", tabId: "sales", label: "Tickets pendientes" },
      { key: "sales-today", pageId: "sales.today", tabId: "sales", label: "Ventas del dia" },
    ],
  },
  {
    id: "clients",
    label: "Clientes",
    items: [
      { key: "clients-list", pageId: "clients.list", tabId: "clients", label: "Clientes" },
      { key: "clients-loyalty", pageId: "clients.loyalty", tabId: "loyalty", label: "Fidelizacion" },
    ],
  },
  {
    id: "agenda",
    label: "Agenda",
    items: [
      { key: "agenda-appointments", pageId: "agenda.appointments", tabId: "agenda", label: "Citas" },
      { key: "agenda-operational-v2", pageId: "pos.agendaV2", tabId: "agenda", label: "Agenda operativa v2" },
    ],
  },
  {
    id: "expenses",
    label: "Gastos",
    items: [
      { key: "expenses-list", pageId: "finance.expenses", tabId: "expenses", label: "Gastos" },
    ],
  },
  {
    id: "cash-closing",
    label: "Cierre de Caja",
    items: [
      { key: "cash-closing-main", pageId: "finance.cashClosing", tabId: "cashClosing", label: "Cierre de caja" },
    ],
  },
  {
    id: "commissions",
    label: "Comisiones",
    items: [
      { key: "commissions-main", pageId: "finance.commissions", tabId: "commissions", label: "Comisiones" },
    ],
  },
  {
    id: "finance",
    label: "Finanzas",
    items: [
      { key: "finance-monthly-closing", pageId: "finance.monthlyClosing", tabId: "finance", label: "Cierre mensual" },
      { key: "finance-treasury", pageId: "finance.treasury", tabId: "finance", label: "Tesoreria" },
    ],
  },
  {
    id: "statistics",
    label: "Estadisticas",
    items: [
      { key: "stats-sales-history", pageId: "statistics.salesHistory", tabId: "salesHistory", label: "Historial de ventas" },
      { key: "stats-sales-audit", pageId: "statistics.salesAudit", tabId: "statistics", label: "Ventas editadas/anuladas" },
      { key: "stats-category", pageId: "statistics.category", tabId: "statistics", label: "Ventas por categoria" },
      { key: "stats-employee", pageId: "statistics.employee", tabId: "statistics", label: "Ventas por empleada" },
      { key: "stats-channels", pageId: "statistics.channels", tabId: "statistics", label: "Canales de origen" },
      { key: "stats-commissions", pageId: "statistics.commissions", tabId: "statistics", label: "Comisiones" },
    ],
  },
  {
    id: "settings",
    label: "Configuracion",
    items: [
      { key: "settings-general", pageId: "settings.general", tabId: "settings", label: "General" },
      { key: "settings-professionals", pageId: "settings.professionals", tabId: "settings", label: "Profesionales" },
      { key: "settings-services", pageId: "settings.services", tabId: "settings", label: "Servicios" },
      { key: "settings-products", pageId: "settings.products", tabId: "settings", label: "Productos" },
      { key: "settings-catalogs", pageId: "settings.catalogs", tabId: "settings", label: "Catalogos" },
      { key: "settings-imports", pageId: "settings.imports", tabId: "settings", label: "Importaciones" },
    ],
  },
];

const platformSectionIds = {
  pos: ["agenda", "sales", "clients", "expenses", "cash-closing", "professional-agenda", "professional-commissions"],
  manager: ["dashboard", "clients", "finance", "statistics", "commissions", "settings"],
};

const directionSectionIds = ["agenda", "dashboard", "sales", "clients", "expenses", "cash-closing", "commissions", "statistics"];

function getPlatformModeFromPath(pathname = "") {
  const normalizedPath = String(pathname || "").toLowerCase();
  return normalizedPath === "/pos" || normalizedPath.startsWith("/pos/") ? "pos" : "manager";
}

function getInitialPageFromPath(pathname = "") {
  const normalizedPath = String(pathname || "").toLowerCase();
  if (normalizedPath === "/pos/agenda-v2" || normalizedPath.startsWith("/pos/agenda-v2/")) return "pos.agendaV2";
  if (normalizedPath === "/manager/dashboard/monthly" || normalizedPath.startsWith("/manager/dashboard/monthly/")) return "dashboard.monthly";
  if (normalizedPath === "/manager/dashboard/daily" || normalizedPath.startsWith("/manager/dashboard/daily/")) return "dashboard.daily";
  return normalizedPath === "/pos" || normalizedPath.startsWith("/pos/") ? "agenda.appointments" : "dashboard.daily";
}

function money(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function formatDisplayDate(date = "") {
  const text = String(date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text || "-";
  return `${text.slice(8, 10)}/${text.slice(5, 7)}/${text.slice(0, 4)}`;
}

function expenseBusinessDate(expense = {}) {
  const expenseDate = String(expense.expenseDate || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) return expenseDate;
  const date = String(expense.date || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return String(expense.createdAt || "").match(/\d{4}-\d{2}-\d{2}/)?.[0] || "";
}

function saleStatus(sale) {
  const status = String(sale.status || "cobrado").toLowerCase();
  if (status === "pendiente_pago" || status === "cancelado" || status === "anulada" || status === "servicio_interno") return status;
  if (status === "editada") return "cobrado";
  return "cobrado";
}

function saleIsEdited(sale) {
  return Boolean(sale.editada || sale.editedAt || String(sale.status || "").toLowerCase() === "editada");
}

function isCollectedSale(sale) {
  return saleStatus(sale) === "cobrado";
}

function operationalDate(item = {}) {
  return item.saleDate || item.fechaOperativa || item.date || "";
}

function saleServicesText(sale) {
  if (Array.isArray(sale.services) && sale.services.length > 0) {
    return sale.services.map((service) => service.serviceName).filter(Boolean).join(", ");
  }
  return sale.service || "Sin servicio";
}

function paymentAmountForDay(sales, selectedDate, matcher) {
  return sales
    .filter((sale) => operationalDate(sale) === selectedDate && isCollectedSale(sale))
    .reduce((total, sale) => {
      if (Array.isArray(sale.payments) && sale.payments.length > 0) {
        return total + sale.payments
          .filter((payment) => matcher(String(payment.method || "").toLowerCase()))
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      }
      return matcher(String(sale.paymentMethod || "").toLowerCase()) ? total + Number(sale.total || sale.amount || 0) : total;
    }, 0);
}

function DailySalesCards({ sales, selectedDate }) {
  const daySales = useMemo(() => sales.filter((sale) => operationalDate(sale) === selectedDate && isCollectedSale(sale)), [sales, selectedDate]);
  const total = daySales.reduce((sum, sale) => sum + Number(sale.total || sale.amount || 0), 0);
  const cardTips = daySales.reduce((sum, sale) => sum + Number(sale.cardTipAmount || 0), 0);
  const commissions = daySales.reduce((sum, sale) => {
    const saleTotal = Number(sale.total || sale.amount || 0);
    return sum + saleTotal * (Number(sale.commissionPercent || 0) / 100);
  }, 0);
  const knownMatchers = [
    (method) => method === "efectivo",
    (method) => method === "tarjeta",
    (method) => method === "bizum",
    (method) => method === "bono" || method === "bonos" || method === "bono / tarjeta regalo",
    (method) => method === "tarjeta regalo",
    (method) => method === "treatwell",
  ];
  const other = daySales
    .reduce((sum, sale) => {
      if (Array.isArray(sale.payments) && sale.payments.length > 0) {
        return sum + sale.payments
          .filter((payment) => !knownMatchers.some((matcher) => matcher(String(payment.method || "").toLowerCase())))
          .reduce((total, payment) => total + Number(payment.amount || 0), 0);
      }
      return !knownMatchers.some((matcher) => matcher(String(sale.paymentMethod || "").toLowerCase()))
        ? sum + Number(sale.total || sale.amount || 0)
        : sum;
    }, 0);
  const cards = [
    ["Total ventas del dia", total],
    ["Efectivo", paymentAmountForDay(sales, selectedDate, (method) => method === "efectivo")],
    ["Tarjeta", paymentAmountForDay(sales, selectedDate, (method) => method === "tarjeta")],
    ["Bizum", paymentAmountForDay(sales, selectedDate, (method) => method === "bizum")],
    ["Bono / tarjeta regalo", paymentAmountForDay(sales, selectedDate, (method) => method === "bono" || method === "bonos" || method === "tarjeta regalo" || method === "bono / tarjeta regalo")],
    ["Treatwell", paymentAmountForDay(sales, selectedDate, (method) => method === "treatwell")],
    ["Comisiones", commissions],
    ["Propinas tarjeta", cardTips],
    ["Otros", other],
  ];

  return (
    <section className="sales-day-cards">
      {cards.map(([label, value]) => (
        <article className="sales-day-card" key={label}>
          <span>{label}</span>
          <strong>{money(value)}</strong>
        </article>
      ))}
    </section>
  );
}

function PendingTickets({ sales, clients, onCharge, onCancel }) {
  const pendingSales = useMemo(() => (
    (sales || [])
      .filter((sale) => saleStatus(sale) === "pendiente_pago")
      .sort((first, second) => String(first.horaCreacion || "").localeCompare(String(second.horaCreacion || "")))
  ), [sales]);

  if (pendingSales.length === 0) return null;

  return (
    <section className="panel pending-tickets-panel">
      <div className="section-title">
        <div>
          <h2>Pendientes de cobro</h2>
          <span>{pendingSales.length} tickets abiertos</span>
        </div>
      </div>
      <div className="list">
        {pendingSales.map((sale) => (
          <article className="pending-ticket-card" key={sale.id}>
            <div>
              <strong>{clients[sale.clientId] || sale.clientName || "Cliente mostrador"}</strong>
              <span>Fecha de la venta: {formatDisplayDate(operationalDate(sale))}</span>
              <span>{formatMadridTime(sale.horaCreacion || sale.date)} - {sale.employee || "Sin profesional"} - {saleServicesText(sale)}</span>
              {sale.isBackdated && <span className="sale-tag backdated">Registrada posteriormente</span>}
            </div>
            <b>{money(sale.total || sale.amount || 0)}</b>
            <span className="status-pill pending">Pendiente de pago</span>
            <div className="sale-card-buttons">
              <button type="button" onClick={() => onCharge(sale)}>Cobrar</button>
              <button className="danger-button" type="button" onClick={() => onCancel(sale)}>Cancelar</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TodayClosedSales({ sales, clients, onView, onEdit, onVoid }) {
  const today = getTodayLocalDateString();
  const todaySales = useMemo(() => (
    (sales || [])
      .filter((sale) => operationalDate(sale) === today && saleStatus(sale) === "cobrado")
      .sort((first, second) => String(second.horaCierre || "").localeCompare(String(first.horaCierre || "")))
  ), [sales, today]);

  return (
    <section className="panel today-sales-panel">
      <div className="section-title">
        <div>
          <h2>Ventas de hoy</h2>
          <span>{todaySales.length} ventas cerradas</span>
        </div>
      </div>
      <div className="finance-table">
        <div className="finance-header today-sales-row"><span>Hora cierre</span><span>Cliente</span><span>Profesional</span><span>Servicios</span><span>Método pago</span><span>Total</span><span>Estado</span><span>Acciones</span></div>
        {todaySales.map((sale) => (
          <div className="finance-row today-sales-row" key={sale.id}>
            <span>{sale.horaCierre ? formatMadridTime(sale.horaCierre) : "-"}</span>
            <span>{clients[sale.clientId] || sale.clientName || "Cliente mostrador"}</span>
            <span>{sale.employee || "Sin profesional"}</span>
            <span>{saleServicesText(sale)}</span>
            <span>{sale.paymentMethod || "Sin pago"}</span>
            <strong>{money(sale.total || sale.amount || 0)}</strong>
            <span className={saleIsEdited(sale) ? "status-pill edited" : "status-pill online"}>{saleIsEdited(sale) ? "Cobrada · Editada" : "Cobrada"}</span>
            <div className="compact-actions">
              <button className="secondary-button" type="button" onClick={() => onView(sale)}>Ver</button>
              <button className="secondary-button" type="button" onClick={() => onEdit(sale)}>Editar</button>
              <button className="danger-button" type="button" onClick={() => onVoid(sale)}>Anular</button>
            </div>
          </div>
        ))}
        {todaySales.length === 0 && <p className="empty-state">Aún no hay ventas cerradas hoy.</p>}
      </div>
    </section>
  );
}

function buildVisibleNavigation(allowedTabIds, role, platformMode) {
  const normalizedRole = String(role || "").trim().toLowerCase();
  const sectionIds = normalizedRole === "direccion"
    ? directionSectionIds
    : platformSectionIds[platformMode] || platformSectionIds.manager;
  const sectionsForPlatform = sectionIds
    .map((sectionId) => navigationSections.find((section) => section.id === sectionId))
    .filter(Boolean);
  const sectionsForRole = normalizedRole === "profesional"
    ? sectionsForPlatform.filter((section) => section.id.startsWith("professional-"))
    : sectionsForPlatform.filter((section) => !section.id.startsWith("professional-"));

  return sectionsForRole
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => (
        allowedTabIds.includes(item.tabId)
        && !(item.pageId === "dashboard.monthly" && !canAccessDashboardSection(normalizedRole, "month"))
        && !((platformMode === "pos" || normalizedRole === "direccion") && item.pageId === "agenda.appointments")
      )),
    }))
    .filter((section) => section.items.length > 0);
}

function firstNavigationKeyForTab(sections, tabId) {
  for (const section of sections) {
    const item = section.items.find((entry) => entry.tabId === tabId);
    if (item) return item.key;
  }
  return "";
}

function firstNavigationItem(sections) {
  return sections[0]?.items?.[0] || null;
}

function navigationItemForPage(sections, pageId) {
  for (const section of sections) {
    const item = section.items.find((entry) => entry.pageId === pageId);
    if (item) return item;
  }
  return null;
}

class ViewErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Error al cargar la vista", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="module">
          <section className="panel">
            <h2>Historial de ventas</h2>
            <p className="empty-state">No se pudo cargar el historial de ventas.</p>
          </section>
        </section>
      );
    }

    return this.props.children;
  }
}

function App() {
  const { user, loading, logout } = useAuth();
  const [platformMode, setPlatformMode] = useState(() => getPlatformModeFromPath(typeof window !== "undefined" ? window.location.pathname : "/manager"));
  const [activeTab, setActiveTab] = useState("dashboard");
  const [activePage, setActivePage] = useState(() => getInitialPageFromPath(typeof window !== "undefined" ? window.location.pathname : "/manager"));
  const [data, setData] = useState(() => DataService.getData());
  const [showResetOptions, setShowResetOptions] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [currentMadridDate, setCurrentMadridDate] = useState(getTodayLocalDateString());
  const [selectedSaleDate, setSelectedSaleDate] = useState(getTodayLocalDateString());
  const [editingSale, setEditingSale] = useState(null);
  const [modalEditingSale, setModalEditingSale] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseNotice, setExpenseNotice] = useState("");
  const [salesFormHighlight, setSalesFormHighlight] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNavKey, setActiveNavKey] = useState("");
  const [openMenuSections, setOpenMenuSections] = useState({});
  const [loadedAppVersion, setLoadedAppVersion] = useState("");
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState("");
  const salesFormRef = useRef(null);
  const landingUserRef = useRef("");

  const effectiveRole = useMemo(() => effectiveRoleForUser(user), [user]);
  const allowedTabIds = useMemo(() => allowedTabsForRole(effectiveRole), [effectiveRole]);
  const visibleNavigation = useMemo(() => buildVisibleNavigation(allowedTabIds, effectiveRole, platformMode), [allowedTabIds, effectiveRole, platformMode]);
  const selectedNavKey = useMemo(() => {
    const itemIsCurrent = visibleNavigation.some((section) => (
      section.items.some((item) => item.key === activeNavKey && item.pageId === activePage)
    ));
    const pageItem = navigationItemForPage(visibleNavigation, activePage);
    return itemIsCurrent ? activeNavKey : pageItem?.key || firstNavigationKeyForTab(visibleNavigation, activeTab);
  }, [activeNavKey, activePage, activeTab, visibleNavigation]);
  const roleCanManageClients = canPerform(effectiveRole, "manageClients");
  const roleCanManageCommissions = canPerform(effectiveRole, "manageCommissions");
  const roleCanBulkPayCommissions = canPerform(effectiveRole, "commissions.pay_bulk");
  const roleCanManageServices = canPerform(effectiveRole, "manageServices");
  const roleCanCreateBackdatedSale = canPerform(effectiveRole, "sales.create_backdated") || effectiveRole === "admin";
  const roleCanEditSalesFully = effectiveRole === "admin" || effectiveRole === "direccion";
  const canShowRestoreData = platformMode !== "pos" && canPerform(effectiveRole, "restoreData");
  const scopedData = useMemo(() => {
    if (!isOwnEmployeeOnly(effectiveRole)) return data;
    const ownEmployeeName = user?.professionalName || user?.employeeName || user?.nombre ? [user.professionalName || user.employeeName || user.nombre] : [];
    return {
      ...data,
      appointments: onlyOwnEmployeeItems(data.appointments || [], user),
      sales: onlyOwnEmployeeItems(data.sales || [], user),
      config: {
        ...data.config,
        employees: ownEmployeeName,
      },
    };
  }, [data, user, effectiveRole]);
  const ownCommissionsData = useMemo(() => {
    const commissions = DataService.getCommissions();
    if (!isOwnEmployeeOnly(effectiveRole)) return commissions;
    const rows = (commissions.rows || []).filter((row) => professionalMatchesItem(row, user));
    const byEmployee = rows.reduce((totals, row) => {
      totals[row.employee] = (totals[row.employee] || 0) + Number(row.commissionAmount || 0);
      return totals;
    }, {});
    const generated = rows.reduce((total, row) => total + Number(row.commissionAmount || 0), 0);
    const pending = rows.filter((row) => row.status !== "pagada").reduce((total, row) => total + Number(row.commissionAmount || 0), 0);
    const paid = generated - pending;
    return { rows, totals: { generated, pending, paid, byEmployee } };
  }, [data, user, effectiveRole]);
  const dashboardData = useMemo(() => DataService.getDashboardData(), [data, currentMadridDate]);
  const commissionsData = useMemo(() => {
    const commissions = DataService.getCommissions();
    if (!isOwnEmployeeOnly(effectiveRole)) return commissions;
    return ownCommissionsData;
  }, [data, effectiveRole, ownCommissionsData]);
  const clientMap = useMemo(() => Object.fromEntries(scopedData.clients.map((client) => [client.id, client.name])), [scopedData.clients]);

  useEffect(() => {
    const syncPlatformMode = () => {
      if (window.location.pathname === "/") {
        window.history.replaceState(null, "", `/manager${window.location.search}${window.location.hash}`);
      }
      setPlatformMode(getPlatformModeFromPath(window.location.pathname));
      setActivePage((currentPage) => {
        const pageFromPath = getInitialPageFromPath(window.location.pathname);
        return pageFromPath === currentPage ? currentPage : pageFromPath;
      });
    };

    syncPlatformMode();
    window.addEventListener("popstate", syncPlatformMode);
    return () => window.removeEventListener("popstate", syncPlatformMode);
  }, []);

  useEffect(() => {
    if (!user) {
      landingUserRef.current = "";
      return;
    }

    const userKey = String(user.uid || user.email || user.nombre || effectiveRole);
    if (landingUserRef.current === userKey) return;
    landingUserRef.current = userKey;

    if (defaultPageForRole(effectiveRole) !== "pos.agendaV2") return;

    window.history.replaceState(null, "", "/pos/agenda-v2");
    setPlatformMode("pos");
    setActivePage("pos.agendaV2");
    setActiveTab("agenda");
    setActiveNavKey("agenda-operational-v2");
    setAccessDeniedMessage("");
  }, [effectiveRole, user]);

  useEffect(() => {
    if (!user) return undefined;

    let isMounted = true;
    let unsubscribe = null;

    DataService.initializeRemoteData().then((result) => {
      if (!isMounted) return;
      setData(result.data);
      setIsOnline(result.online);
      unsubscribe = DataService.subscribeToData(setData, setIsOnline);
    });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [user]);

  useEffect(() => {
    const refreshMadridDate = () => {
      const nextDate = getTodayLocalDateString();
      setCurrentMadridDate((previousDate) => {
        if (previousDate !== nextDate) {
          setSelectedSaleDate((selectedDate) => (selectedDate === previousDate ? nextDate : selectedDate));
        }
        return nextDate;
      });
    };

    refreshMadridDate();
    const interval = window.setInterval(refreshMadridDate, 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;
    const pageItem = navigationItemForPage(visibleNavigation, activePage);
    if (pageItem && allowedTabIds.includes(pageItem.tabId)) {
      if (activeTab !== pageItem.tabId) setActiveTab(pageItem.tabId);
      if (accessDeniedMessage) setAccessDeniedMessage("");
      return;
    }

    const roleDefaultPage = defaultPageForRole(effectiveRole);
    const firstItem = navigationItemForPage(visibleNavigation, roleDefaultPage) || firstNavigationItem(visibleNavigation);
    if (roleDefaultPage === "pos.agendaV2") {
      window.history.replaceState(null, "", "/pos/agenda-v2");
      setPlatformMode("pos");
    }
    setAccessDeniedMessage("No tienes permisos para acceder a esta sección.");
    setActivePage(firstItem?.pageId || "agenda.appointments");
    setActiveTab(firstItem?.tabId || allowedTabIds[0] || "agenda");
    setActiveNavKey(firstItem?.key || "");
  }, [accessDeniedMessage, activePage, activeTab, allowedTabIds, effectiveRole, visibleNavigation, user]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activePage]);

  useEffect(() => {
    let isMounted = true;

    const readAppVersion = async () => {
      try {
        const response = await fetch(`/version.json?version-check=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        const remoteVersion = String(payload.version || "").trim();
        if (!remoteVersion) return;

        if (!isMounted) return;
        setLoadedAppVersion((current) => {
          if (!current) return remoteVersion;
          if (current !== remoteVersion) setHasNewVersion(true);
          return current;
        });
      } catch {
        // Silently keep the app running if the version check cannot reach the server.
      }
    };

    readAppVersion();
    const intervalId = window.setInterval(readAppVersion, 60000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const reloadLatestVersion = async () => {
    try {
      if ("caches" in window) {
        const cacheNames = await window.caches.keys();
        await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
      }

      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
    } catch {
      // Cache cleanup is best-effort; the cache-busted navigation below still fetches the newest app.
    } finally {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("appVersion", String(Date.now()));
      window.location.replace(nextUrl.toString());
    }
  };

  const refresh = () => setData(DataService.getData());

  const saleBusinessDate = (sale = {}) => sale.saleDate || sale.fechaOperativa || sale.date || getTodayLocalDateString();
  const closureForSaleDate = (saleDate) => (data.cashClosings || []).find((closing) => closing.date === saleDate);
  const withBackdatedContext = (sale = {}) => {
    const saleDate = saleBusinessDate(sale);
    const today = getTodayLocalDateString();
    const isBackdated = saleDate < today;
    const closure = isBackdated ? closureForSaleDate(saleDate) : null;
    return {
      ...sale,
      saleDate,
      fechaOperativa: saleDate,
      date: saleDate,
      createdBy: sale.createdBy || user?.email || user?.nombre || "",
      isBackdated,
      registeredAfterClosure: Boolean(sale.registeredAfterClosure || closure),
      relatedClosureId: sale.relatedClosureId || closure?.id || "",
      closureStatusAtCreation: sale.closureStatusAtCreation || closure?.status || closure?.estado || (closure ? "confirmado" : ""),
    };
  };

  const addSale = (sale) => {
    if (!canPerform(effectiveRole, "manageSales")) return;
    const preparedSale = withBackdatedContext(sale);
    if (preparedSale.isBackdated && !roleCanCreateBackdatedSale) return;
    if (preparedSale.saleDate > getTodayLocalDateString()) return;
    setData(DataService.addSale(preparedSale));
    setEditingSale(null);
  };
  const updateSale = (saleId, updates) => {
    if (!canPerform(effectiveRole, "manageSales")) return;
    const existingSale = data.sales.find((sale) => sale.id === saleId) || {};
    const preparedUpdates = withBackdatedContext({ ...existingSale, ...updates });
    const existingSaleDate = saleBusinessDate(existingSale);
    const requestedSaleDate = updates.saleDate || updates.fechaOperativa || updates.date || existingSaleDate;
    const isChangingSaleDate = requestedSaleDate !== existingSaleDate;
    if (isChangingSaleDate && requestedSaleDate < getTodayLocalDateString() && !roleCanCreateBackdatedSale) return;
    if (preparedUpdates.saleDate > getTodayLocalDateString()) return;
    const nextData = DataService.updateSale(saleId, { ...preparedUpdates, editedBy: user?.email || user?.nombre || "" });
    setData(nextData);
    setEditingSale(null);
    setSalesFormHighlight(false);
  };
  const addExpense = (expense) => {
    if (!canPerform(effectiveRole, "manageExpenses")) return;
    setData(DataService.addExpense(expense));
    setEditingExpense(null);
    setExpenseNotice("Gasto guardado correctamente");
  };
  const updateExpense = (expenseId, updates) => {
    if (!canPerform(effectiveRole, "manageExpenses")) return;
    setData(DataService.updateExpense(expenseId, updates));
    setEditingExpense(null);
    setExpenseNotice("");
  };
  const addClient = (client) => {
    if (!canPerform(effectiveRole, "manageClients")) return;
    setData(DataService.addClient(client));
  };
  const createClientFromSale = (client) => {
    if (!canPerform(effectiveRole, "manageClients")) return null;
    const result = DataService.createClientFromSale(client);
    setData(result.data);
    return result.client;
  };
  const updateClient = (clientId, updates) => {
    if (!canPerform(effectiveRole, "manageClients")) return;
    DataService.updateClient(clientId, updates);
    refresh();
  };
  const deleteClient = (clientId) => {
    if (!canPerform(effectiveRole, "manageClients")) return;
    setData(DataService.deleteClient(clientId));
  };
  const canWriteAppointments = (appointment) => {
    if (canPerform(effectiveRole, "manageAppointments")) return true;
    if (!canPerform(effectiveRole, "manageOwnAppointments")) return false;
    if (!appointment?.employee) return true;
    return onlyOwnEmployeeItems([appointment], user).length === 1;
  };
  const addAppointment = (appointment) => {
    if (!canWriteAppointments(appointment)) return;
    setData(DataService.addAppointment(appointment));
  };
  const updateAppointment = (appointmentId, updates) => {
    const existingAppointment = data.appointments.find((appointment) => appointment.id === appointmentId);
    if (!canWriteAppointments({ ...existingAppointment, ...updates })) return;
    setData(DataService.updateAppointment(appointmentId, updates));
  };
  const deleteAppointment = (appointmentId) => {
    const existingAppointment = data.appointments.find((appointment) => appointment.id === appointmentId);
    if (!canWriteAppointments(existingAppointment)) return;
    setData(DataService.deleteAppointment(appointmentId));
  };
  const updateConfig = (updates) => {
    if (!canPerform(effectiveRole, "manageSettings")) return;
    setData(DataService.updateConfig(updates));
  };
  const updateFinanceControls = (financeControls) => {
    if (!canPerform(effectiveRole, "viewFinance")) return;
    setData(DataService.updateConfig({ financeControls }));
  };
  const saveCashClosing = (closing) => {
    if (!canPerform(effectiveRole, "manageCashClosing")) return;
    setData(DataService.saveCashClosing(closing));
  };
  const saveMonthlyClosing = (closing) => {
    if (effectiveRole !== "admin") return;
    setData(DataService.saveMonthlyClosing(closing));
  };
  const createServiceFromSale = (service) => {
    if (!canPerform(effectiveRole, "manageServices")) return null;
    const result = DataService.createService(service);
    setData(result.data);
    return result.service;
  };
  const restoreVSStudioConfig = () => {
    if (!canPerform(effectiveRole, "manageSettings")) return;
    setData(DataService.restoreVSStudioConfig());
  };
  const importTreatwellClients = (rows) => {
    if (!canPerform(effectiveRole, "importClients")) return { imported: 0, updated: 0, duplicates: 0, errors: ["Sin permisos para importar clientes"] };
    const result = DataService.importTreatwellClients(rows);
    setData(result.data);
    return result.result;
  };

  const deleteSale = (id) => {
    if (!canPerform(effectiveRole, "manageSales")) return;
    setData(DataService.deleteSale(id));
    if (editingSale?.id === id) setEditingSale(null);
  };

  const chargePendingSale = (sale) => {
    if (!canPerform(effectiveRole, "manageSales")) return;
    setEditingSale(sale);
    setSelectedSaleDate(operationalDate(sale));
    setSalesFormHighlight(true);
    window.setTimeout(() => {
      salesFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const cancelPendingSale = (sale) => {
    if (!canPerform(effectiveRole, "manageSales")) return;
    const confirmed = window.confirm("¿Seguro que deseas cancelar este ticket pendiente?");
    if (!confirmed) return;
    const reason = window.prompt("Motivo de cancelación (opcional)") || "";
    setData(DataService.updateSale(sale.id, { status: "cancelado", cancelReason: reason }));
    if (editingSale?.id === sale.id) setEditingSale(null);
  };

  const viewSale = (sale) => {
    window.alert([
      `Cliente: ${clientMap[sale.clientId] || sale.clientName || "Cliente mostrador"}`,
      `Profesional: ${sale.employee || "Sin profesional"}`,
      `Servicios: ${saleServicesText(sale)}`,
      `Pago: ${sale.paymentMethod || "Sin pago"}`,
      `Total: ${money(sale.total || sale.amount || 0)}`,
      `Estado: ${saleIsEdited(sale) ? "Cobrada · Editada" : "Cobrada"}`,
      sale.notes ? `Observaciones: ${sale.notes}` : "",
    ].filter(Boolean).join("\n"));
  };

  const editClosedSale = (sale) => {
    if (!canPerform(effectiveRole, "manageSales")) return;
    setEditingSale(sale);
    setSelectedSaleDate(operationalDate(sale));
    setSalesFormHighlight(true);
    window.setTimeout(() => {
      salesFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const voidClosedSale = (sale) => {
    if (!canPerform(effectiveRole, "manageSales")) return;
    const confirmed = window.confirm("¿Seguro que deseas anular esta venta? No se borrará el registro.");
    if (!confirmed) return;
    const reason = window.prompt("Motivo de anulación (obligatorio)");
    if (!reason || !reason.trim()) {
      window.alert("Debes indicar un motivo para anular la venta.");
      return;
    }
    setData(DataService.updateSale(sale.id, {
      status: "anulada",
      voidReason: reason.trim(),
      voidedBy: user?.email || user?.nombre || "",
    }));
    if (editingSale?.id === sale.id) setEditingSale(null);
  };

  const deleteExpense = (id) => {
    if (!canPerform(effectiveRole, "manageExpenses")) return;
    setData((current) => ({ ...current, expenses: DataService.deleteExpense(current.expenses, id) }));
    setExpenseNotice("");
  };
  const canDeleteExpense = (expense) => effectiveRole === "admin" || expenseBusinessDate(expense) === getTodayLocalDateString();
  const updateCommissionStatus = (saleId, status, details) => {
    if (effectiveRole !== "admin" || !canPerform(effectiveRole, "manageCommissions")) return;
    const actor = user?.email || user?.nombre || "";
    setData(DataService.updateCommissionStatus(saleId, status, { ...details, editedBy: actor, updatedBy: actor }));
  };
  const bulkPayCommissions = (commissionIds, details) => {
    if (!roleCanBulkPayCommissions) return null;
    const actor = user?.email || user?.nombre || "";
    const result = DataService.bulkPayCommissions(commissionIds, { ...details, createdBy: actor, updatedBy: actor });
    setData(result.data);
    return result.result;
  };

  const resetData = (mode) => {
    if (!canPerform(effectiveRole, "restoreData")) return;
    const confirmed = window.confirm("Esto eliminará todos los datos. ¿Deseas continuar?");
    if (!confirmed) return;

    setData(DataService.reset(mode));
    setShowResetOptions(false);
  };

  const toggleMenuSection = (sectionId) => {
    setOpenMenuSections((current) => ({ [sectionId]: !current[sectionId] }));
  };

  const openNavigationItem = (item) => {
    setActiveTab(item.tabId);
    setActivePage(item.pageId);
    setActiveNavKey(item.key);
    setModalEditingSale(null);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const switchPlatform = (targetPlatform) => {
    if (effectiveRole !== "admin") return;
    const nextPage = targetPlatform === "pos" ? "pos.agendaV2" : "dashboard.daily";
    const nextTab = targetPlatform === "pos" ? "agenda" : "dashboard";
    const nextPath = targetPlatform === "pos" ? "/pos/agenda-v2" : "/manager";
    window.history.pushState(null, "", nextPath);
    setPlatformMode(targetPlatform);
    setActivePage(nextPage);
    setActiveTab(nextTab);
    setActiveNavKey("");
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderSalesFormPage = () => (
    <section className="workspace sales-workspace">
      <div className="sales-main-column">
        <div className={salesFormHighlight ? "sales-form-anchor editing-focus" : "sales-form-anchor"} ref={salesFormRef}>
          <SalesForm
            clients={scopedData.clients}
            config={scopedData.config}
            editingSale={editingSale}
            onSave={addSale}
            onUpdate={updateSale}
            onCreateClient={createClientFromSale}
            onCreateService={createServiceFromSale}
            canCreateService={roleCanManageServices}
            canEditSaleDate={roleCanCreateBackdatedSale}
            canEditCommission={editingSale ? roleCanEditSalesFully : effectiveRole === "admin"}
            cashClosings={scopedData.cashClosings || []}
            currentUser={user}
            onCancelEdit={() => {
              setEditingSale(null);
              setSalesFormHighlight(false);
            }}
            onDateChange={setSelectedSaleDate}
          />
        </div>
      </div>
    </section>
  );

  const renderSalesHistoryPage = (mode = "history") => {
    const canOpenHistory = mode === "history"
      ? canAccessTab(effectiveRole, "salesHistory") || canAccessTab(effectiveRole, "statistics")
      : canAccessTab(effectiveRole, "statistics");

    if (!canOpenHistory) {
      return (
        <section className="module">
          <section className="panel">
            <p className="empty-state">No tienes permisos para acceder a esta sección.</p>
          </section>
        </section>
      );
    }

    return (
      <SafeSalesHistory
        key={mode}
        sales={scopedData.sales || []}
        clients={clientMap}
        mode={mode}
        onEditSale={roleCanEditSalesFully ? (sale) => {
          setEditingSale(sale);
          setActivePage("sales.new");
          setActiveTab("sales");
          setActiveNavKey("sales-new");
          setSalesFormHighlight(true);
        } : null}
        onDeleteSale={effectiveRole === "admin" ? deleteSale : null}
        onVoidSale={effectiveRole === "admin" ? voidClosedSale : null}
      />
    );
  };

  const renderTodaySalesPage = () => {
    if (!canAccessTab(effectiveRole, "sales")) {
      return (
        <section className="module">
          <section className="panel">
            <p className="empty-state">No tienes permisos para acceder a esta sección.</p>
          </section>
        </section>
      );
    }

    return (
      <section className="module">
        <SafeSalesHistory
          sales={scopedData.sales || []}
          clients={clientMap}
          mode="today"
          fixedDate={getTodayLocalDateString()}
          title="Ventas del dia"
          subtitle="Ventas registradas hoy"
          showFilters={false}
          emptyMessage="No hay ventas registradas hoy."
          onEditSale={setModalEditingSale}
          onDeleteSale={deleteSale}
          onVoidSale={voidClosedSale}
        />
        {modalEditingSale && (
          <section className="sale-history-modal" role="dialog" aria-modal="true" aria-label="Editar venta del dia">
            <article className="statistics-edit-dialog">
              <div className="section-title">
                <div>
                  <h2>Editar venta</h2>
                  <span>Los cambios se guardan sin salir de Ventas del dia</span>
                </div>
                <button className="secondary-button" type="button" onClick={() => setModalEditingSale(null)}>Cerrar</button>
              </div>
              <SalesForm
                key={modalEditingSale.id}
                clients={scopedData.clients}
                config={scopedData.config}
                editingSale={modalEditingSale}
                onSave={addSale}
                onUpdate={(saleId, updates) => {
                  updateSale(saleId, updates);
                  setModalEditingSale(null);
                }}
                onCreateClient={createClientFromSale}
                onCreateService={createServiceFromSale}
                canCreateService={roleCanManageServices}
                canEditSaleDate={roleCanCreateBackdatedSale}
                canEditCommission={roleCanEditSalesFully}
                cashClosings={scopedData.cashClosings || []}
                currentUser={user}
                onCancelEdit={() => setModalEditingSale(null)}
                onDateChange={() => {}}
              />
            </article>
          </section>
        )}
      </section>
    );
  };

  const renderActivePage = () => {
    const accessDeniedPage = (
      <section className="module">
        <section className="panel">
          <p className="empty-state">No tienes permisos para acceder a esta sección.</p>
        </section>
      </section>
    );

    const unavailablePage = (
      <section className="module">
        <section className="panel">
          <p className="empty-state">No hay contenido disponible para esta opción.</p>
        </section>
      </section>
    );

    switch (activePage) {
      case "professional.agenda":
        return canAccessTab(effectiveRole, "professionalAgenda") ? <ProfessionalAgenda appointments={scopedData.appointments} /> : accessDeniedPage;
      case "professional.sales":
        return accessDeniedPage;
      case "professional.commissions":
        return canAccessTab(effectiveRole, "professionalCommissions") ? <ProfessionalCommissions sales={scopedData.sales} commissions={ownCommissionsData.rows} /> : accessDeniedPage;
      case "dashboard.monthly":
        return canAccessDashboardSection(effectiveRole, "month") ? <Dashboard data={dashboardData} viewMode="administrador" section="month" /> : accessDeniedPage;
      case "sales.new":
        return canAccessTab(effectiveRole, "sales") ? renderSalesFormPage() : accessDeniedPage;
      case "sales.pending":
        return canAccessTab(effectiveRole, "sales") ? (
          <section className="module">
            <div className="section-title"><h2>Tickets pendientes</h2><span>Pendientes de cobro</span></div>
            <PendingTickets sales={scopedData.sales} clients={clientMap} onCharge={chargePendingSale} onCancel={cancelPendingSale} />
            {!scopedData.sales.some((sale) => saleStatus(sale) === "pendiente_pago") && <section className="panel"><p className="empty-state">No hay tickets pendientes.</p></section>}
          </section>
        ) : accessDeniedPage;
      case "sales.today":
        return renderTodaySalesPage();
      case "sales-history":
      case "sales.history":
      case "sales-audit":
      case "sales.audit":
        return (
          <section className="module">
            <section className="panel">
              <p className="empty-state">Esta consulta se ha movido a Estadisticas.</p>
            </section>
          </section>
        );
      case "clients.list":
        return canAccessTab(effectiveRole, "clients") ? (
          <Clients
            clients={scopedData.clients}
            sales={scopedData.sales}
            config={scopedData.config}
            onCreateClient={addClient}
            onUpdateClient={updateClient}
            onDeleteClient={deleteClient}
            readOnly={!roleCanManageClients}
            canManageLoyalty={effectiveRole === "admin"}
            currentUser={user}
            compactMode={platformMode === "pos"}
          />
        ) : accessDeniedPage;
      case "clients.loyalty":
        return canAccessTab(effectiveRole, "loyalty") ? <Loyalty clients={scopedData.clients} config={scopedData.config} /> : accessDeniedPage;
      case "agenda.appointments":
        return canAccessTab(effectiveRole, "agenda") ? (
          <Agenda
            clients={scopedData.clients}
            config={scopedData.config}
            appointments={scopedData.appointments}
            onSave={addAppointment}
            onUpdate={updateAppointment}
            onDelete={deleteAppointment}
            onCreateClient={roleCanManageClients ? createClientFromSale : null}
          />
        ) : accessDeniedPage;
      case "pos.agendaV2":
        return canAccessTab(effectiveRole, "agenda") ? (
          <OperationalAgenda
            appointments={scopedData.appointments}
            clients={scopedData.clients}
            config={scopedData.config}
          />
        ) : accessDeniedPage;
      case "finance.expenses":
        return canAccessTab(effectiveRole, "expenses") ? (
          <section className="workspace">
            <ExpenseForm
              config={scopedData.config}
              editingExpense={editingExpense}
              onAddExpense={addExpense}
              onUpdateExpense={updateExpense}
              onCancelEdit={() => setEditingExpense(null)}
            />
            <ExpenseList
              expenses={scopedData.expenses}
              config={scopedData.config}
              notice={expenseNotice}
              onEditExpense={setEditingExpense}
              onDeleteExpense={deleteExpense}
              canDeleteExpense={canDeleteExpense}
            />
          </section>
        ) : accessDeniedPage;
      case "finance.commissions":
        return canAccessTab(effectiveRole, "commissions") ? (
          <Commissions
            data={commissionsData}
            user={user}
            canBulkPay={roleCanBulkPayCommissions}
            onBulkPay={roleCanBulkPayCommissions ? bulkPayCommissions : null}
            onStatusChange={effectiveRole === "admin" && roleCanManageCommissions ? updateCommissionStatus : null}
          />
        ) : accessDeniedPage;
      case "finance.cashClosing":
        return canAccessTab(effectiveRole, "cashClosing") ? <CashClosing data={scopedData} commissionsData={commissionsData} user={user} onSave={saveCashClosing} /> : accessDeniedPage;
      case "finance.monthlyClosing":
        return canAccessTab(effectiveRole, "finance") ? (
          <Finance
            data={scopedData}
            commissionsData={commissionsData}
            user={user}
            canManageMonthlyClosing={effectiveRole === "admin"}
            onSaveControls={updateFinanceControls}
            onSaveMonthlyClosing={saveMonthlyClosing}
            view="monthlyClosing"
          />
        ) : accessDeniedPage;
      case "finance.treasury":
        return canAccessTab(effectiveRole, "finance") ? (
          <Finance
            data={scopedData}
            commissionsData={commissionsData}
            user={user}
            canManageMonthlyClosing={effectiveRole === "admin"}
            onSaveControls={updateFinanceControls}
            onSaveMonthlyClosing={saveMonthlyClosing}
            view="treasury"
          />
        ) : accessDeniedPage;
      case "statistics.employee":
      case "statistics.channels":
      case "statistics.commissions":
      case "statistics.category":
        return canAccessTab(effectiveRole, "statistics") ? (
          <Statistics
            dataVersion={scopedData}
            clients={clientMap}
            view={activePage.split(".")[1]}
            selectedSaleDate={selectedSaleDate}
            onDateSelect={setSelectedSaleDate}
            onUpdateSale={updateSale}
            onDeleteSale={deleteSale}
            onCreateClient={createClientFromSale}
            onCreateService={createServiceFromSale}
            canCreateService={roleCanManageServices}
            canEditSaleDate={roleCanCreateBackdatedSale}
            canEditCommission={roleCanEditSalesFully}
            cashClosings={scopedData.cashClosings || []}
            currentUser={user}
          />
        ) : accessDeniedPage;
      case "statistics.salesHistory":
        return renderSalesHistoryPage("history");
      case "statistics.salesAudit":
        return renderSalesHistoryPage("audit");
      case "settings.general":
        return canAccessTab(effectiveRole, "settings") ? (
          <Settings
            config={scopedData.config}
            onSave={updateConfig}
            onRestoreBaseConfig={restoreVSStudioConfig}
            sales={scopedData.sales}
            view="general"
          />
        ) : accessDeniedPage;
      case "settings.professionals":
        return canAccessTab(effectiveRole, "settings") ? <ProfessionalsSettingsReal config={scopedData.config} currentUser={user} onSave={updateConfig} /> : accessDeniedPage;
      case "settings.services":
      case "settings.products":
      case "settings.catalogs":
      case "settings.imports":
        return canAccessTab(effectiveRole, "settings") ? (
          <Settings
            config={scopedData.config}
            onSave={updateConfig}
            onRestoreBaseConfig={restoreVSStudioConfig}
            onImportClients={importTreatwellClients}
            sales={scopedData.sales}
            view={activePage.split(".")[1]}
          />
        ) : accessDeniedPage;
      case "dashboard.daily":
      default:
        return canAccessDashboardSection(effectiveRole, "today")
          ? <Dashboard data={dashboardData} viewMode={effectiveRole === "direccion" ? "encargado" : "administrador"} section="today" />
          : accessDeniedPage;
    }
  };

  if (loading) {
    return <LoginLoading />;
  }

  if (!user) return <Login />;

  return (
    <main className={platformMode === "pos" ? "app-shell pos-shell" : "app-shell"}>
      <section className={platformMode === "pos" ? "topbar pos-topbar" : "topbar"}>
        {platformMode === "pos" ? (
          <div className="pos-page-context">
            <p className="eyebrow">Operaciones</p>
            <h1>{activePage === "pos.agendaV2" ? "Agenda" : navigationItemForPage(visibleNavigation, activePage)?.label || "Operaciones"}</h1>
          </div>
        ) : (
          <div>
            <p className="eyebrow">ERP / POS</p>
            <h1>VS Studio Manager</h1>
          </div>
        )}
        <div className="topbar-actions">
          <button className="nav-toggle-button" type="button" onClick={() => setMobileMenuOpen((current) => !current)}>
            {mobileMenuOpen ? "Cerrar menu" : "Menu"}
          </button>
          {platformMode === "pos" && (
            <div className="pos-business-context">
              <strong>VS Studio Beauty &amp; Academy</strong>
              <span>{user.nombre} · {effectiveRole === "admin" ? "Admin" : effectiveRole}</span>
            </div>
          )}
          <span className={isOnline ? "status-pill online" : "status-pill offline"}>{isOnline ? "Conectado a Firebase" : "Modo local / sin conexión"}</span>
          {platformMode !== "pos" && <span className="user-pill">{user.nombre} - {effectiveRole}</span>}
          {effectiveRole === "admin" && (
            <button className="ghost-button" type="button" onClick={() => switchPlatform(platformMode === "pos" ? "manager" : "pos")}>
              {platformMode === "pos" ? "Ir a Manager" : "Ir al POS"}
            </button>
          )}
          <button className="ghost-button" type="button" onClick={logout}>Cerrar sesion</button>
          {canShowRestoreData && <button className="ghost-button" onClick={() => setShowResetOptions(true)}>Restaurar datos (limpiar todo)</button>}
        </div>
      </section>

      {hasNewVersion && (
        <section className="version-notice" aria-live="polite">
          <span>Nueva actualizacion disponible. Recarga la aplicacion para aplicar los cambios.</span>
          <button type="button" onClick={reloadLatestVersion}>Actualizar ahora</button>
        </section>
      )}

      {accessDeniedMessage && (
        <section className="version-notice" aria-live="polite">
          <span>{accessDeniedMessage}</span>
          <button type="button" onClick={() => setAccessDeniedMessage("")}>Cerrar</button>
        </section>
      )}

      {showResetOptions && canShowRestoreData && (
        <section className="reset-panel" role="dialog" aria-label="Opciones de restauracion">
          <div>
            <h2>Restaurar datos</h2>
            <p>Esto eliminará todos los datos. ¿Deseas continuar?</p>
          </div>
          <div className="reset-actions">
            <button type="button" onClick={() => resetData("activity")}>Limpiar datos</button>
            <button type="button" onClick={() => resetData("all")}>Reiniciar todo</button>
            <button className="secondary-button" type="button" onClick={() => setShowResetOptions(false)}>Cancelar</button>
          </div>
        </section>
      )}

      <nav className={`${mobileMenuOpen ? "tabs nav-menu open" : "tabs nav-menu"}${platformMode === "pos" ? " pos-nav" : ""}`} aria-label="Menu principal">
        <div className="nav-brand">
          {platformMode === "pos" ? (
            <>
              <strong>DOMIA</strong>
              <span>Gestión &amp; Operaciones</span>
            </>
          ) : (
            <>
              <span>VS Studio</span>
              <strong>Manager</strong>
            </>
          )}
        </div>
        {visibleNavigation.map((section) => {
          const sectionActive = section.items.some((item) => item.key === selectedNavKey);
          const isOpen = openMenuSections[section.id] ?? sectionActive;

          return (
            <div className={sectionActive ? "nav-section active" : "nav-section"} key={section.id}>
              <button className="nav-section-toggle" type="button" onClick={() => toggleMenuSection(section.id)} aria-expanded={isOpen}>
                <span>{section.label}</span>
                <b>{isOpen ? "-" : "+"}</b>
              </button>
              {isOpen && (
                <div className="nav-section-items">
                  {section.items.map((item) => (
                    <button
                      className={selectedNavKey === item.key ? "tab active" : "tab"}
                      key={item.key}
                      type="button"
                      onClick={() => openNavigationItem(item)}
                    >
                      {platformMode === "pos" && item.pageId === "pos.agendaV2" ? "Agenda del día" : item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <ViewErrorBoundary key={activePage}>
        {platformMode === "pos" ? <div className="pos-main-content">{renderActivePage()}</div> : renderActivePage()}
      </ViewErrorBoundary>
    </main>
  );
}

export default App;
