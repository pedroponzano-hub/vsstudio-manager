import { useState } from "react";
import { getMadridTimestamp } from "../utils/date.js";

function money(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function getSaleServices(sale) {
  if (Array.isArray(sale.services) && sale.services.length > 0) return sale.services;
  return [{ serviceName: sale.service || sale.concept || "Sin servicio", price: sale.price || sale.amount || sale.total, quantity: 1 }];
}

function operationalDate(item = {}) {
  return item.fechaOperativa || item.date || "";
}

function servicesCount(sale) {
  return getSaleServices(sale).reduce((total, service) => total + Number(service.quantity || 1), 0);
}

function ClientProfile({ client, sales, referralSales = [], config, onUpdateClient, readOnly = false, canManageLoyalty = false, currentUser }) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    name: client.name || "",
    lastName: client.lastName || client.apellidos || "",
    phone: client.phone || "",
    email: client.email || "",
    observations: client.observations || client.notes || "",
    interests: client.interests || "",
  });
  const stamps = Number(client.loyaltyStamps || 0);
  const referralStamps = Number(client.referralStamps || 0);
  const required = Number(config.loyaltyVisits || 5);
  const missing = Math.max(required - stamps, 0);
  const hasPrize = stamps >= required;
  const loyaltyHistory = Array.isArray(client.loyaltyAdjustmentHistory) ? client.loyaltyAdjustmentHistory : [];

  const resetForm = () => {
    setForm({
      name: client.name || "",
      lastName: client.lastName || client.apellidos || "",
      phone: client.phone || "",
      email: client.email || "",
      observations: client.observations || client.notes || "",
      interests: client.interests || "",
    });
  };

  const updateField = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const startEdit = () => {
    resetForm();
    setIsEditing(true);
  };

  const cancelEdit = () => {
    resetForm();
    setIsEditing(false);
  };

  const save = (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    if (readOnly) return;
    onUpdateClient(client.id, form);
    setIsEditing(false);
  };

  const saveLoyaltyAdjustment = (nextStamps) => {
    if (!canManageLoyalty) return;
    const before = Number(client.loyaltyStamps || 0);
    const after = Math.max(0, Number(nextStamps || 0));
    if (after === before) return;

    const reason = window.prompt("Motivo obligatorio del ajuste de sellos");
    if (!reason || !reason.trim()) {
      window.alert("Debes indicar un motivo para modificar los sellos.");
      return;
    }

    const delta = after - before;
    const historyItem = {
      id: `loyalty-${Date.now()}`,
      date: getMadridTimestamp(),
      user: currentUser?.email || currentUser?.nombre || "Usuario no identificado",
      reason: reason.trim(),
      before,
      after,
    };

    onUpdateClient(client.id, {
      loyaltyStamps: after,
      loyaltyManualAdjustment: Number(client.loyaltyManualAdjustment || 0) + delta,
      loyaltyAdjustmentHistory: [historyItem, ...loyaltyHistory],
    });
  };

  const editLoyaltyBalance = () => {
    const value = window.prompt("Nuevo saldo de sellos", String(stamps));
    if (value === null) return;
    const nextStamps = Number(value);
    if (!Number.isFinite(nextStamps) || nextStamps < 0) {
      window.alert("Introduce un numero valido de sellos.");
      return;
    }
    saveLoyaltyAdjustment(nextStamps);
  };

  return (
    <article className="panel profile">
      <div className="section-title">
        <div>
          <h2>{client.name}</h2>
          <span>{client.phone || "Sin telefono"}{client.email ? ` - ${client.email}` : ""}</span>
        </div>
        {!readOnly && !isEditing && <button className="secondary-button" type="button" onClick={startEdit}>Editar</button>}
      </div>
      {isEditing ? (
        <form className="profile-edit-form" onSubmit={save}>
          <div className="field-row">
            <label>Nombre<input name="name" value={form.name} onChange={updateField} /></label>
            <label>Apellidos<input name="lastName" value={form.lastName} onChange={updateField} /></label>
          </div>
          <div className="field-row">
            <label>Telefono<input name="phone" value={form.phone} onChange={updateField} /></label>
            <label>Email<input name="email" value={form.email} onChange={updateField} /></label>
          </div>
          <label>Observaciones<textarea name="observations" value={form.observations} onChange={updateField} /></label>
          <label>Intereses<textarea name="interests" value={form.interests} onChange={updateField} /></label>
          <div className="row-actions">
            <button type="submit">Guardar cambios</button>
            <button className="secondary-button" type="button" onClick={cancelEdit}>Cancelar</button>
          </div>
        </form>
      ) : (
        <section className="client-detail-grid">
          <div><span>Nombre</span><strong>{client.name || "-"}</strong></div>
          <div><span>Apellidos</span><strong>{client.lastName || client.apellidos || "-"}</strong></div>
          <div><span>Telefono</span><strong>{client.phone || "-"}</strong></div>
          <div><span>Email</span><strong>{client.email || "-"}</strong></div>
          <div className="wide-detail"><span>Observaciones</span><p>{client.observations || client.notes || "-"}</p></div>
          <div className="wide-detail"><span>Intereses</span><p>{client.interests || "-"}</p></div>
        </section>
      )}
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
      <section className="panel loyalty-manual-panel">
        <h3>Fidelizacion</h3>
        <div className="stat-row">
          <span>Sellos actuales</span>
          <strong>{stamps}</strong>
        </div>
        {canManageLoyalty ? (
          <div className="row-actions">
            <button type="button" onClick={() => saveLoyaltyAdjustment(stamps + 1)}>Añadir sello</button>
            <button className="secondary-button" type="button" onClick={() => saveLoyaltyAdjustment(stamps - 1)}>Quitar sello</button>
            <button className="secondary-button" type="button" onClick={editLoyaltyBalance}>Editar saldo de sellos</button>
          </div>
        ) : (
          <p className="empty-state">Solo administracion puede modificar sellos.</p>
        )}
      </section>
      <h3>Historial de modificaciones de fidelizacion</h3>
      <div className="list">
        {loyaltyHistory.length === 0 && <p className="empty-state">Sin ajustes manuales registrados.</p>}
        {loyaltyHistory.map((item) => (
          <div className="list-item" key={item.id || `${item.date}-${item.before}-${item.after}`}>
            <div>
              <strong>{item.reason || "Ajuste manual"}</strong>
              <span>{item.date || "-"} - {item.user || "Usuario no identificado"}</span>
            </div>
            <b>{item.before} -&gt; {item.after}</b>
          </div>
        ))}
      </div>
      <h3>Referidos</h3>
      <div className="list">
        {referralSales.length === 0 && <p className="empty-state">Sin referidos registrados.</p>}
        {referralSales.map((sale) => (
          <div className="list-item" key={sale.id}>
            <div>
              <strong>{sale.clientName || "Cliente sin nombre"}</strong>
              <span>{operationalDate(sale)} - {getSaleServices(sale).map((service) => service.serviceName).join(", ")}</span>
            </div>
            <b>{servicesCount(sale)} sellos</b>
          </div>
        ))}
        {referralStamps > 0 && (
          <div className="stat-row">
            <span>Sellos ganados por referidos</span>
            <strong>{referralStamps}</strong>
          </div>
        )}
      </div>
      <h3>Historial</h3>
      <div className="list">
        {sales.map((sale) => (
          <div className="list-item" key={sale.id}>
            <div>
              <strong>{getSaleServices(sale).map((service) => service.serviceName).join(", ")}</strong>
              <span>{operationalDate(sale)} - {sale.employee || "Sin empleada"}</span>
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
