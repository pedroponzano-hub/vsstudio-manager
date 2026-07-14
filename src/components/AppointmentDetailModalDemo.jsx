import { useMemo, useState } from "react";

import { DEMO_SERVICES } from "../utils/availabilityDemo.js";

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function AppointmentDetailModalDemo({ appointment, onClose }) {
  const [mode, setMode] = useState("detail");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Tarjeta");
  const [useSplitPayment, setUseSplitPayment] = useState(false);
  const [observations, setObservations] = useState("");

  const service = useMemo(() => (
    DEMO_SERVICES.find((item) => item.id === appointment?.serviceId || item.name === appointment?.serviceName)
  ), [appointment]);

  if (!appointment) return null;

  const basePrice = service?.price || 30;
  const effectiveDiscount = Math.max(0, Number(discount || 0));
  const total = Math.max(0, basePrice - effectiveDiscount);
  const commissionPercent = 40;
  const commissionAmount = total * commissionPercent / 100;
  const splitCardAmount = total > 0 ? Math.round((total * 0.6) * 100) / 100 : 0;
  const splitCashAmount = Math.max(0, Math.round((total - splitCardAmount) * 100) / 100);
  const demoSaleId = `demo-sale-${appointment.id}`;

  return (
    <section className="sale-history-modal" role="dialog" aria-modal="true" aria-label="Detalle de cita demo">
      <article className="sale-history-dialog appointment-demo-dialog">
        <div className="section-title compact-section-title">
          <div>
            <h2>{mode === "checkout" ? "Cobro demo" : mode === "complete" ? "Cobro completado" : "Detalle de cita"}</h2>
            <span>Modo demo local - no se guarda en Firebase</span>
          </div>
          <button className="secondary-button" type="button" onClick={onClose}>Cerrar</button>
        </div>

        {mode === "detail" && (
          <>
            <div className="summary-list appointment-modal-summary">
              <span><b>appointmentId:</b> {appointment.id}</span>
              <span><b>Hora:</b> {appointment.time || "No disponible"}</span>
              <span><b>Cliente:</b> {appointment.clientName}</span>
              <span><b>Telefono:</b> {appointment.phone}</span>
              <span><b>Servicio:</b> {appointment.serviceName}</span>
              <span><b>Profesional:</b> {appointment.employee}</span>
              <span><b>Duracion:</b> {appointment.duration}</span>
              <span><b>Estado:</b> {appointment.status}</span>
            </div>
            <div className="reset-actions">
              <button type="button" onClick={() => setMode("checkout")}>Cobrar demo</button>
              <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
            </div>
          </>
        )}

        {mode === "checkout" && (
          <>
            <div className="checkout-demo-grid">
              <section className="checkout-demo-block">
                <h3>Cita</h3>
                <div className="summary-list">
                  <span><b>Cliente:</b> {appointment.clientName}</span>
                  <span><b>Servicio:</b> {appointment.serviceName}</span>
                  <span><b>Profesional:</b> {appointment.employee}</span>
                  <span><b>Precio demo:</b> {formatMoney(basePrice)}</span>
                </div>
              </section>

              <section className="checkout-demo-block">
                <h3>Cobro</h3>
                <div className="field-row">
                  <label>
                    Descuento demo
                    <input min="0" type="number" value={discount} onChange={(event) => setDiscount(event.target.value)} />
                  </label>
                  <label>
                    Metodo de pago
                    <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                      <option>Efectivo</option>
                      <option>Tarjeta</option>
                      <option>Bizum</option>
                      <option>Bono / tarjeta regalo</option>
                      <option>Otro</option>
                    </select>
                  </label>
                </div>
                <label className="inline-check">
                  <input checked={useSplitPayment} type="checkbox" onChange={(event) => setUseSplitPayment(event.target.checked)} />
                  Pago mixto demo
                </label>
                {useSplitPayment && (
                  <div className="demo-payment-split">
                    <span>Tarjeta: <b>{formatMoney(splitCardAmount)}</b></span>
                    <span>Efectivo: <b>{formatMoney(splitCashAmount)}</b></span>
                  </div>
                )}
                <label>
                  Observaciones
                  <textarea value={observations} onChange={(event) => setObservations(event.target.value)} placeholder="Observaciones demo del cobro" />
                </label>
              </section>
            </div>

            <section className="checkout-demo-total">
              <span><b>Comision demo:</b> {commissionPercent}% - {formatMoney(commissionAmount)}</span>
              <span><b>Total:</b> {formatMoney(total)}</span>
              <small>Preparado para futura relacion appointmentId: {appointment.id}, saleId: {demoSaleId}, services, payments y estado pagada.</small>
            </section>

            <div className="reset-actions">
              <button type="button" onClick={() => setMode("complete")}>Cobrar y finalizar demo</button>
              <button className="secondary-button" type="button" onClick={() => setMode("detail")}>Volver al detalle</button>
            </div>
          </>
        )}

        {mode === "complete" && (
          <section className="checkout-demo-complete">
            <strong>Cobro demo completado — no se ha guardado ningún dato</strong>
            <p>En la version real se crearia la venta, se vincularia con la cita y se marcaria como pagada/finalizada.</p>
            <button type="button" onClick={onClose}>Cerrar</button>
          </section>
        )}
      </article>
    </section>
  );
}

export default AppointmentDetailModalDemo;
