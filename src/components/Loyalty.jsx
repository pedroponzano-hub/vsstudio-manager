import { useState } from "react";

function Loyalty({ clients, config }) {
  const [query, setQuery] = useState("");
  const required = Number(config.loyaltyVisits || 5);
  const filteredClients = clients.filter((client) =>
    `${client.name} ${client.phone}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <section className="module">
      <div className="section-title">
        <h2>Fidelizacion</h2>
        <span>1 visita = 1 sello</span>
      </div>
      <label className="panel search-panel">
        Buscar cliente
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre o telefono" />
      </label>
      <div className="loyalty-grid">
        {filteredClients.map((client) => {
          const stamps = Number(client.loyaltyStamps || 0);
          const missing = Math.max(required - stamps, 0);
          const hasPrize = stamps >= required;

          return (
            <article className={hasPrize ? "panel loyalty-card prize-card" : "panel loyalty-card"} key={client.id}>
              <div>
                <h3>{client.name}</h3>
                <p>{client.phone || "Sin telefono"}</p>
              </div>
              <div className="stamp-row">{Array.from({ length: required }).map((_, index) => <span className={index < Math.min(stamps, required) ? "stamp active" : "stamp"} key={index} />)}</div>
              <div className="loyalty-status">
                <strong>Sellos: {stamps} / {required}</strong>
                <span>{hasPrize ? "Premio disponible" : `Faltan ${missing} para premio`}</span>
              </div>
              {hasPrize && <span className="prize-badge">🎁 Premio disponible</span>}
            </article>
          );
        })}
        {filteredClients.length === 0 && <p className="empty-state panel">No hay clientes con esa busqueda.</p>}
      </div>
    </section>
  );
}

export default Loyalty;
