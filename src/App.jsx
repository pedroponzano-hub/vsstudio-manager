import { useEffect, useMemo, useState } from "react";
import Agenda from "./components/Agenda.jsx";
import Commissions from "./components/Commissions.jsx";
import Clients from "./components/Clients.jsx";
import Dashboard from "./components/Dashboard.jsx";
import ExpenseForm from "./components/ExpenseForm.jsx";
import ExpenseList from "./components/ExpenseList.jsx";
import Loyalty from "./components/Loyalty.jsx";
import SalesForm from "./components/SalesForm.jsx";
import SaleList from "./components/SaleList.jsx";
import Settings from "./components/Settings.jsx";
import Statistics from "./components/Statistics.jsx";
import DataService from "./services/DataService.js";

const tabs = [
  { id: "dashboard", label: "Dashboard" },
  { id: "sales", label: "Ventas" },
  { id: "expenses", label: "Gastos" },
  { id: "commissions", label: "Comisiones" },
  { id: "clients", label: "Clientes" },
  { id: "loyalty", label: "Fidelizacion" },
  { id: "agenda", label: "Agenda" },
  { id: "statistics", label: "Estadisticas" },
  { id: "settings", label: "Configuracion" },
];

function money(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function paymentAmountForDay(sales, selectedDate, matcher) {
  return sales
    .filter((sale) => sale.date === selectedDate)
    .filter((sale) => matcher(String(sale.paymentMethod || "").toLowerCase()))
    .reduce((total, sale) => total + Number(sale.total || sale.amount || 0), 0);
}

function DailySalesCards({ sales, selectedDate }) {
  const daySales = useMemo(() => sales.filter((sale) => sale.date === selectedDate), [sales, selectedDate]);
  const total = daySales.reduce((sum, sale) => sum + Number(sale.total || sale.amount || 0), 0);
  const commissions = daySales.reduce((sum, sale) => {
    const saleTotal = Number(sale.total || sale.amount || 0);
    return sum + saleTotal * (Number(sale.commissionPercent || 0) / 100);
  }, 0);
  const knownMatchers = [
    (method) => method === "efectivo",
    (method) => method === "tarjeta",
    (method) => method === "bizum",
    (method) => method === "bono" || method === "bonos",
    (method) => method === "tarjeta regalo",
  ];
  const other = daySales
    .filter((sale) => !knownMatchers.some((matcher) => matcher(String(sale.paymentMethod || "").toLowerCase())))
    .reduce((sum, sale) => sum + Number(sale.total || sale.amount || 0), 0);
  const cards = [
    ["Total ventas del dia", total],
    ["Efectivo", paymentAmountForDay(sales, selectedDate, (method) => method === "efectivo")],
    ["Tarjeta", paymentAmountForDay(sales, selectedDate, (method) => method === "tarjeta")],
    ["Bizum", paymentAmountForDay(sales, selectedDate, (method) => method === "bizum")],
    ["Bono", paymentAmountForDay(sales, selectedDate, (method) => method === "bono" || method === "bonos")],
    ["Tarjeta regalo", paymentAmountForDay(sales, selectedDate, (method) => method === "tarjeta regalo")],
    ["Comisiones", commissions],
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

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [data, setData] = useState(() => DataService.getData());
  const [showResetOptions, setShowResetOptions] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [selectedSaleDate, setSelectedSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [editingSale, setEditingSale] = useState(null);
  const [appVersionSignature, setAppVersionSignature] = useState("");
  const [hasNewVersion, setHasNewVersion] = useState(false);

  const dashboardData = useMemo(() => DataService.getDashboardData(), [data]);
  const commissionsData = useMemo(() => DataService.getCommissions(), [data]);
  const clientMap = useMemo(() => Object.fromEntries(data.clients.map((client) => [client.id, client.name])), [data.clients]);

  useEffect(() => {
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
  }, []);

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
    setData(DataService.addSale(sale));
    setEditingSale(null);
  };
  const updateSale = (saleId, updates) => {
    const nextData = DataService.updateSale(saleId, updates);
    setData(nextData);
    setEditingSale(null);
  };
  const addExpense = (expense) => setData(DataService.addExpense(expense));
  const addClient = (client) => setData(DataService.addClient(client));
  const createClientFromSale = (client) => {
    const result = DataService.createClientFromSale(client);
    setData(result.data);
    return result.client;
  };
  const updateClient = (clientId, updates) => {
    DataService.updateClient(clientId, updates);
    refresh();
  };
  const deleteClient = (clientId) => setData(DataService.deleteClient(clientId));
  const addAppointment = (appointment) => setData(DataService.addAppointment(appointment));
  const updateConfig = (updates) => setData(DataService.updateConfig(updates));
  const restoreVSStudioConfig = () => setData(DataService.restoreVSStudioConfig());
  const importTreatwellClients = (rows) => {
    const result = DataService.importTreatwellClients(rows);
    setData(result.data);
    return result.result;
  };

  const deleteSale = (id) => {
    setData(DataService.deleteSale(id));
    if (editingSale?.id === id) setEditingSale(null);
  };

  const deleteExpense = (id) => {
    setData((current) => ({ ...current, expenses: DataService.deleteExpense(current.expenses, id) }));
  };
  const updateCommissionStatus = (saleId, status) => setData(DataService.updateCommissionStatus(saleId, status));

  const resetData = (mode) => {
    const confirmed = window.confirm("Esto eliminará todos los datos. ¿Deseas continuar?");
    if (!confirmed) return;

    setData(DataService.reset(mode));
    setShowResetOptions(false);
  };

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">VS Studio Manager</p>
          <h1>Gestion de ventas, clientes y agenda</h1>
        </div>
        <div className="topbar-actions">
          <span className={isOnline ? "status-pill online" : "status-pill offline"}>{isOnline ? "Conectado a Firebase" : "Modo local / sin conexión"}</span>
          <button className="ghost-button" onClick={() => setShowResetOptions(true)}>Restaurar datos (limpiar todo)</button>
        </div>
      </section>

      {hasNewVersion && (
        <section className="version-notice" aria-live="polite">
          <span>Nueva version disponible</span>
          <button type="button" onClick={() => window.location.reload()}>Actualizar</button>
        </section>
      )}

      {showResetOptions && (
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
        {tabs.map((tab) => (
          <button className={activeTab === tab.id ? "tab active" : "tab"} key={tab.id} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "dashboard" && <Dashboard data={dashboardData} />}
      {activeTab === "sales" && (
        <section className="workspace sales-workspace">
          <div className="sales-main-column">
            <SalesForm
              clients={data.clients}
              config={data.config}
              editingSale={editingSale}
              onSave={addSale}
              onUpdate={updateSale}
              onCreateClient={createClientFromSale}
              onCancelEdit={() => setEditingSale(null)}
              onDateChange={setSelectedSaleDate}
            />
            <DailySalesCards sales={data.sales} selectedDate={selectedSaleDate} />
            <SaleList
              sales={data.sales}
              clients={clientMap}
              selectedDate={selectedSaleDate}
              onEditSale={(sale) => {
                setEditingSale(sale);
                setSelectedSaleDate(sale.date);
              }}
              onDeleteSale={deleteSale}
            />
          </div>
        </section>
      )}
      {activeTab === "expenses" && (
        <section className="workspace">
          <ExpenseForm config={data.config} onAddExpense={addExpense} />
          <ExpenseList expenses={data.expenses} onDeleteExpense={deleteExpense} />
        </section>
      )}
      {activeTab === "commissions" && <Commissions data={commissionsData} onStatusChange={updateCommissionStatus} />}
      {activeTab === "clients" && (
        <Clients
          clients={data.clients}
          sales={data.sales}
          config={data.config}
          onCreateClient={addClient}
          onUpdateClient={updateClient}
          onDeleteClient={deleteClient}
        />
      )}
      {activeTab === "loyalty" && <Loyalty clients={data.clients} config={data.config} />}
      {activeTab === "agenda" && <Agenda clients={data.clients} config={data.config} onSave={addAppointment} />}
      {activeTab === "statistics" && <Statistics dataVersion={data} />}
      {activeTab === "settings" && <Settings config={data.config} onSave={updateConfig} onRestoreBaseConfig={restoreVSStudioConfig} onImportClients={importTreatwellClients} />}
    </main>
  );
}

export default App;
