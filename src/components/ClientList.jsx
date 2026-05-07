function ClientList({ clients, onDeleteClient }) {
  return (
    <section className="panel list-panel">
      <h2>Clientes</h2>
      <div className="list">
        {clients.map((client) => (
          <article className="list-item" key={client.id}>
            <div>
              <strong>{client.name}</strong>
              <span>{client.email || "Sin email"} · {client.phone || "Sin telefono"}</span>
            </div>
            <button type="button" onClick={() => onDeleteClient(client.id)} aria-label={`Eliminar ${client.name}`}>
              Eliminar
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ClientList;
