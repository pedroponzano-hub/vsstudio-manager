import { useEffect, useMemo, useRef, useState } from "react";
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
import Settings from "./components/Settings.jsx";
import Statistics from "./components/Statistics.jsx";
import Login from "./components/Login.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { allowedTabsForRole, canAccessTab, canPerform, effectiveRoleForUser, isOwnEmployeeOnly, onlyOwnEmployeeItems } from "./permissions.js";
import DataService from "./services/DataService.js";
import { formatMadridTime, getTodayLocalDateString } from "./utils/date.js";

const tabs = [
  { id: "dashboard", label: "Dashboard" },
  { id: "sales", label: "Ventas" },
  { id: "expenses", label: "Gastos" },
  { id: "commissions", label: "Comisiones" },
  { id: "clients", label: "Clientes" },
  { id: "loyalty", label: "Fidelizacion" },
  { id: "agenda", label: "Agenda" },
  { id: "statistics", label: "Estadisticas" },
  { id: "finance", label: "Finanzas" },
  { id: "cashClosing", label: "Cierre de Caja" },
  { id: "settings", label: "Configuracion" },
];

function money(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function saleStatus(sale) {
  const status = String(sale.status || "cobrado").toLowerCase();
  if (status === "pendiente_pago" || status === "cancelado" || status === "anulada") return status;
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
  return item.fechaOperativa || item.date || "";
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
              <span>{formatMadridTime(sale.horaCreacion || sale.date)} - {sale.employee || "Sin profesional"} - {saleServicesText(sale)}</span>
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

function App() {
  const { user, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [data, setData] = useState(() => DataService.getData());
  const [showResetOptions, setShowResetOptions] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [currentMadridDate, setCurrentMadridDate] = useState(getTodayLocalDateString());
  const [selectedSaleDate, setSelectedSaleDate] = useState(getTodayLocalDateString());
  const [editingSale, setEditingSale] = useState(null);
  const [salesFormHighlight, setSalesFormHighlight] = useState(false);
  const [appVersionSignature, setAppVersionSignature] = useState("");
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState("");
  const salesFormRef = useRef(null);

  const effectiveRole = useMemo(() => effectiveRoleForUser(user), [user]);
  const allowedTabIds = useMemo(() => allowedTabsForRole(effectiveRole), [effectiveRole]);
  const visibleTabs = useMemo(() => tabs.filter((tab) => allowedTabIds.includes(tab.id)), [allowedTabIds]);
  const roleCanManageClients = canPerform(effectiveRole, "manageClients");
  const roleCanManageCommissions = canPerform(effectiveRole, "manageCommissions");
  const roleCanManageServices = canPerform(effectiveRole, "manageServices");
  const roleCanEditSaleDate = canPerform(effectiveRole, "viewFinance");
  const scopedData = useMemo(() => {
    if (!isOwnEmployeeOnly(effectiveRole)) return data;
    const ownEmployeeName = user?.employeeName || user?.nombre ? [user.employeeName || user.nombre] : [];
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
  const dashboardData = useMemo(() => DataService.getDashboardData(), [data, currentMadridDate]);
  const commissionsData = useMemo(() => {
    const commissions = DataService.getCommissions();
    if (!isOwnEmployeeOnly(effectiveRole)) return commissions;
    const rows = onlyOwnEmployeeItems(commissions.rows || [], user);
    const byEmployee = rows.reduce((totals, row) => {
      totals[row.employee] = (totals[row.employee] || 0) + Number(row.commissionAmount || 0);
      return totals;
    }, {});
    const generated = rows.reduce((total, row) => total + Number(row.commissionAmount || 0), 0);
    const pending = rows.filter((row) => row.status !== "pagada").reduce((total, row) => total + Number(row.commissionAmount || 0), 0);
    const paid = generated - pending;
    return { rows, totals: { generated, pending, paid, byEmployee } };
  }, [data, user, effectiveRole]);
  const clientMap = useMemo(() => Object.fromEntries(scopedData.clients.map((client) => [client.id, client.name])), [scopedData.clients]);

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
    if (allowedTabIds.includes(activeTab)) return;
    setAccessDeniedMessage("No tienes permisos para acceder a esta sección.");
    setActiveTab(allowedTabIds[0] || "agenda");
  }, [activeTab, allowedTabIds, user]);

  useEffect(() => {
    let isMounted = true;

    const readVersionSignature = async () => {
      try {
        const response = await fetch(`/index.html?version-check=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const text = await response.text();
        const signature = `${text.length}:${text.slice(0, 160)}:${text.slice(-160)}`;

        if (!isMounted) return;
        setAppVersionSignature((current) => {
          if (!current) return signature;
          if (current !== signature) setHasNewVersion(true);
          return current;
        });
      } catch {
        // Silently keep the app running if the version check cannot reach the server.
      }
    };

    readVersionSignature();
    const intervalId = window.setInterval(readVersionSignature, 60000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const refresh = () => setData(DataService.getData());

  const addSale = (sale) => {
    if (!canPerform(effectiveRole, "manageSales")) return;
    setData(DataService.addSale(sale));
    setEditingSale(null);
  };
  const updateSale = (saleId, updates) => {
    if (!canPerform(effectiveRole, "manageSales")) return;
    const nextData = DataService.updateSale(saleId, { ...updates, editedBy: user?.email || user?.nombre || "" });
    setData(nextData);
    setEditingSale(null);
    setSalesFormHighlight(false);
  };
  const addExpense = (expense) => {
    if (!canPerform(effectiveRole, "manageExpenses")) return;
    setData(DataService.addExpense(expense));
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
  };
  const updateCommissionStatus = (saleId, status, details) => {
    if (!canPerform(effectiveRole, "manageCommissions")) return;
    setData(DataService.updateCommissionStatus(saleId, status, details));
  };

  const resetData = (mode) => {
    if (!canPerform(effectiveRole, "restoreData")) return;
    const confirmed = window.confirm("Esto eliminará todos los datos. ¿Deseas continuar?");
    if (!confirmed) return;

    setData(DataService.reset(mode));
    setShowResetOptions(false);
  };

  if (loading) {
    return (
      <main className="login-page">
        <section className="login-card">
          <p className="eyebrow">VS Studio Manager</p>
          <h1>Cargando acceso</h1>
        </section>
      </main>
    );
  }

  if (!user) return <Login />;

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">VS Studio Manager</p>
          <h1>Gestion de ventas, clientes y agenda</h1>
        </div>
        <div className="topbar-actions">
          <span className={isOnline ? "status-pill online" : "status-pill offline"}>{isOnline ? "Conectado a Firebase" : "Modo local / sin conexión"}</span>
          <span className="user-pill">{user.nombre} - {effectiveRole}</span>
          <button className="ghost-button" type="button" onClick={logout}>Cerrar sesion</button>
          {canPerform(effectiveRole, "restoreData") && <button className="ghost-button" onClick={() => setShowResetOptions(true)}>Restaurar datos (limpiar todo)</button>}
        </div>
      </section>

      {hasNewVersion && (
        <section className="version-notice" aria-live="polite">
          <span>Nueva version disponible</span>
          <button type="button" onClick={() => window.location.reload()}>Actualizar</button>
        </section>
      )}

      {accessDeniedMessage && (
        <section className="version-notice" aria-live="polite">
          <span>{accessDeniedMessage}</span>
          <button type="button" onClick={() => setAccessDeniedMessage("")}>Cerrar</button>
        </section>
      )}

      {showResetOptions && canPerform(effectiveRole, "restoreData") && (
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

      <nav className="tabs" aria-label="Modulos">
        {visibleTabs.map((tab) => (
          <button className={activeTab === tab.id ? "tab active" : "tab"} key={tab.id} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "dashboard" && canAccessTab(effectiveRole, "dashboard") && <Dashboard data={dashboardData} viewMode={effectiveRole === "direccion" ? "encargado" : "administrador"} />}
      {activeTab === "sales" && canAccessTab(effectiveRole, "sales") && (
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
                canEditSaleDate={roleCanEditSaleDate}
                onCancelEdit={() => {
                  setEditingSale(null);
                  setSalesFormHighlight(false);
                }}
                onDateChange={setSelectedSaleDate}
              />
            </div>
            <PendingTickets sales={scopedData.sales} clients={clientMap} onCharge={chargePendingSale} onCancel={cancelPendingSale} />
            <TodayClosedSales sales={scopedData.sales} clients={clientMap} onView={viewSale} onEdit={editClosedSale} onVoid={voidClosedSale} />
            <DailySalesCards sales={scopedData.sales} selectedDate={selectedSaleDate} />
          </div>
        </section>
      )}
      {activeTab === "expenses" && canAccessTab(effectiveRole, "expenses") && (
        <section className="workspace">
          <ExpenseForm config={scopedData.config} onAddExpense={addExpense} />
          <ExpenseList expenses={scopedData.expenses} onDeleteExpense={deleteExpense} />
        </section>
      )}
      {activeTab === "commissions" && canAccessTab(effectiveRole, "commissions") && <Commissions data={commissionsData} onStatusChange={roleCanManageCommissions ? updateCommissionStatus : null} />}
      {activeTab === "clients" && canAccessTab(effectiveRole, "clients") && (
        <Clients
          clients={scopedData.clients}
          sales={scopedData.sales}
          config={scopedData.config}
          onCreateClient={addClient}
          onUpdateClient={updateClient}
          onDeleteClient={deleteClient}
          readOnly={!roleCanManageClients}
        />
      )}
      {activeTab === "loyalty" && canAccessTab(effectiveRole, "loyalty") && <Loyalty clients={scopedData.clients} config={scopedData.config} />}
      {activeTab === "agenda" && canAccessTab(effectiveRole, "agenda") && (
        <Agenda
          clients={scopedData.clients}
          config={scopedData.config}
          appointments={scopedData.appointments}
          onSave={addAppointment}
          onUpdate={updateAppointment}
          onDelete={deleteAppointment}
          onCreateClient={roleCanManageClients ? createClientFromSale : null}
        />
      )}
      {activeTab === "statistics" && canAccessTab(effectiveRole, "statistics") && (
        <Statistics
          dataVersion={scopedData}
          clients={clientMap}
          selectedSaleDate={selectedSaleDate}
          onDateSelect={setSelectedSaleDate}
          onEditSale={(sale) => {
            setEditingSale(sale);
            setSelectedSaleDate(operationalDate(sale));
            setSalesFormHighlight(true);
            setActiveTab("sales");
            window.setTimeout(() => {
              salesFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 80);
          }}
          onDeleteSale={deleteSale}
        />
      )}
      {activeTab === "finance" && canAccessTab(effectiveRole, "finance") && (
        <Finance
          data={scopedData}
          commissionsData={commissionsData}
          user={user}
          canManageMonthlyClosing={effectiveRole === "admin"}
          onSaveControls={updateFinanceControls}
          onSaveMonthlyClosing={saveMonthlyClosing}
        />
      )}
      {activeTab === "cashClosing" && canAccessTab(effectiveRole, "cashClosing") && <CashClosing data={scopedData} commissionsData={commissionsData} user={user} onSave={saveCashClosing} />}
      {activeTab === "settings" && canAccessTab(effectiveRole, "settings") && <Settings config={scopedData.config} onSave={updateConfig} onRestoreBaseConfig={restoreVSStudioConfig} onImportClients={importTreatwellClients} />}
    </main>
  );
}

export default App;
