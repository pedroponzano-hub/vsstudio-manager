import { useMemo, useState } from "react";

function saleServicesText(sale) {
  if (Array.isArray(sale.services) && sale.services.length > 0) {
    return sale.services.map((service) => service.serviceName).join(", ");
  }

  return sale.service || sale.concept || "Sin servicio";
}

function money(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function SaleItem({ sale, clients, onEditSale, onDeleteSale }) {
  return (
    <article className="list-item sale-card">
      <div className="sale-card-main">
        <strong>{saleServicesText(sale)}</strong>
        <span>{clients[sale.clientId] || sale.clientName || "Cliente eliminado"} - {sale.date} - {sale.employee || "Sin empleada"}</span>
      </div>
      <div className="item-actions sale-card-actions">
        <b>{Number(sale.total || sale.amount || 0).toFixed(2)} EUR</b>
        <div className="sale-card-buttons">
          <button type="button" onClick={() => onEditSale(sale)} aria-label="Editar venta">
            Editar
          </button>
          <button type="button" onClick={() => onDeleteSale(sale.id)} aria-label="Eliminar venta">
            Eliminar
          </button>
        </div>
      </div>
    </article>
  );
}

function SaleList({ sales, clients, selectedDate, onEditSale, onDeleteSale }) {
  const [showDaySales, setShowDaySales] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");

  const daySales = useMemo(() => (
    sales.filter((sale) => sale.date === selectedDate)
  ), [sales, selectedDate]);

  const historySales = useMemo(() => (
    sales
      .filter((sale) => sale.date !== selectedDate)
      .filter((sale) => !historyFrom || sale.date >= historyFrom)
      .filter((sale) => !historyTo || sale.date <= historyTo)
      .sort((first, second) => String(second.date || "").localeCompare(String(first.date || "")))
  ), [sales, selectedDate, historyFrom, historyTo]);

  return (
    <section className="panel list-panel sales-history-panel">
      <h2>Historial de ventas</h2>
      <p className="muted-text">{selectedDate}</p>

      <div className="history-toggle">
        <button className="secondary-button" type="button" onClick={() => setShowDaySales((current) => !current)}>
          Ver ventas del dia
        </button>
        <button className="secondary-button" type="button" onClick={() => setShowHistory((current) => !current)}>
          Hist&oacute;rico de ventas
        </button>
      </div>

      {showDaySales && (
        <section className="sales-history">
          <h3>Ventas del d&iacute;a</h3>
          <div className="list">
            {daySales.length === 0 && <p className="empty-state">Sin ventas en la fecha seleccionada.</p>}
            {daySales.map((sale) => (
              <SaleItem key={sale.id} sale={sale} clients={clients} onEditSale={onEditSale} onDeleteSale={onDeleteSale} />
            ))}
          </div>
        </section>
      )}

      {showHistory && (
        <section className="sales-history">
          <h3>Hist&oacute;rico de ventas</h3>
          <div className="field-row">
            <label>Desde<input type="date" value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} /></label>
            <label>Hasta<input type="date" value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} /></label>
          </div>
          <div className="history-actions">
            <button className="secondary-button" type="button" onClick={() => { setHistoryFrom(""); setHistoryTo(""); }}>
              Limpiar filtro
            </button>
          </div>
          <div className="list">
            {historySales.length === 0 && <p className="empty-state">Sin ventas anteriores con ese filtro.</p>}
            {historySales.map((sale) => (
              <SaleItem key={sale.id} sale={sale} clients={clients} onEditSale={onEditSale} onDeleteSale={onDeleteSale} />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

export default SaleList;
