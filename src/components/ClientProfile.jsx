import { useState } from "react";

function money(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function getSaleServices(sale) {
  if (Array.isArray(sale.services) && sale.services.length > 0) return sale.services;
  return [{ serviceName: sale.service || sale.concept || "Sin servicio", price: sale.price || sale.amount || sale.total, quantity: 1 }];
}

function ClientProfile({ client, sales, config, onUpdateClient }) {
  const [observations, setObservations] = useState(client.observations || client.notes || "");
  const [interests, setInterests] = useState(client.interests || "");
  const stamps = Number(client.loyaltyStamps || 0);
  const required = Number(config.loyaltyVisits || 5);
  const missing = Math.max(required - stamps, 0);
  const hasPrize = stamps >= required;

  const save = () => onUpdateClient(client.id, { observations, interests });

  return (
    <article className="panel profile">
      <div className="section-title">
        <h2>{client.name}</h2>
        <span>{client.phone}</span>
      </div>
      <div className="summary-grid compact">
        <div className="metric"><span>Total visitas</span><strong>{client.visits || 0}</strong></div>
        <div className="metric"><span>Total gastado</span><strong>{money(client.totalSpent)}</strong></div>
        <div className="metric"><span>Ultima visita</span><strong>{client.lastVisit || "Sin visitas"}</strong></div>
        <div className={hasPrize ? "metric prize-metric" : "metric"}><span>Sellos de fidelizacion</span><strong>{stamps} / {required}</strong></div>
      </div>
      <section className={hasPrize ? "loyalty-summary prize-card" : "loyalty-summary"}>
        <div className="stamp-row">{Array.from({ length: required }).map((_, index) => <span className={index < Math.min(stamps, required) ? "stamp active" : "stamp"} key={index} />)}</div>
        <div>
          <strong>Sellos: {stamps} / {required}</strong>
          <p>{hasPrize ? "🎁 Premio disponible" : `Faltan ${missing} para premio`}</p>
        </div>
      </section>
      <label>Observaciones<textarea value={observations} onChange={(event) => setObservations(event.target.value)} /></label>
      <label>Intereses<textarea value={interests} onChange={(event) => setInterests(event.target.value)} /></label>
      <button type="button" onClick={save}>Guardar perfil</button>
      <h3>Historial</h3>
      <div className="list">
        {sales.map((sale) => (
          <div className="list-item" key={sale.id}>
            <div>
              <strong>{getSaleServices(sale).map((service) => service.serviceName).join(", ")}</strong>
              <span>{sale.date} - {sale.employee || "Sin empleada"}</span>
              <span>{getSaleServices(sale).map((service) => `${service.serviceName} x${service.quantity || 1}`).join(" | ")}</span>
            </div>
            <b>{money(sale.total || sale.amount)}</b>
          </div>
        ))}
      </div>
    </article>
  );
}

export default ClientProfile;
