import { useEffect, useMemo, useState } from "react";

import { DEMO_SERVICES } from "../utils/availabilityDemo.js";

const demoPaymentMethods = ["Efectivo", "Tarjeta", "Bizum", "Bono / tarjeta regalo", "Treatwell", "Otro"];

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

function emptyPaymentLine() {
  return { method: "", amount: "" };
}

function AppointmentDetailModalDemo({ appointment, onClose }) {
  const [mode, setMode] = useState("detail");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Tarjeta");
  const [singlePaymentAmount, setSinglePaymentAmount] = useState("");
  const [useSplitPayment, setUseSplitPayment] = useState(false);
  const [payments, setPayments] = useState([emptyPaymentLine()]);
  const [observations, setObservations] = useState("");
  const [paymentError, setPaymentError] = useState("");

  const service = useMemo(() => (
    DEMO_SERVICES.find((item) => item.id === appointment?.serviceId || item.name === appointment?.serviceName)
  ), [appointment]);

  if (!appointment) return null;

  const basePrice = service?.price || 30;
  const effectiveDiscount = Math.max(0, Number(discount || 0));
  const total = Math.max(0, basePrice - effectiveDiscount);
  const commissionPercent = 40;
  const commissionAmount = total * commissionPercent / 100;
  const demoSaleId = `demo-sale-${appointment.id}`;
  const singlePaidTotal = Number(singlePaymentAmount || 0);
  const splitPaidTotal = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const paidTotal = useSplitPayment ? splitPaidTotal : singlePaidTotal;
  const paymentDifference = total - paidTotal;

  useEffect(() => {
    if (!useSplitPayment) setSinglePaymentAmount(total.toFixed(2));
  }, [total, useSplitPayment]);

  const updatePaymentLine = (index, updates) => {
    setPayments((current) => current.map((payment, paymentIndex) => (
      paymentIndex === index ? { ...payment, ...updates } : payment
    )));
    setPaymentError("");
  };

  const addPaymentLine = () => {
    setPayments((current) => [...current, emptyPaymentLine()]);
    setPaymentError("");
  };

  const removePaymentLine = (index) => {
    setPayments((current) => (current.length > 1 ? current.filter((_, paymentIndex) => paymentIndex !== index) : current));
    setPaymentError("");
  };

  const finishDemoPayment = () => {
    const validPayments = useSplitPayment
      ? payments.map((payment) => ({ method: payment.method, amount: Number(payment.amount || 0) })).filter((payment) => payment.method && payment.amount > 0)
      : paymentMethod && Number(singlePaymentAmount || 0) > 0
        ? [{ method: paymentMethod, amount: Number(singlePaymentAmount || 0) }]
        : [];

    if (validPayments.length === 0) {
      setPaymentError("Anade al menos un metodo de pago demo.");
      return;
    }

    if (cents(validPayments.reduce((sum, payment) => sum + payment.amount, 0)) !== cents(total)) {
      setPaymentError(`La suma de pagos debe coincidir con el total. Diferencia: ${formatMoney(total - validPayments.reduce((sum, payment) => sum + payment.amount, 0))}.`);
      return;
    }

    setPaymentError("");
    setMode("complete");
  };

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
                      {demoPaymentMethods.map((method) => <option key={method}>{method}</option>)}
                    </select>
                  </label>
                </div>
                <label className="inline-check">
                  <input checked={useSplitPayment} type="checkbox" onChange={(event) => setUseSplitPayment(event.target.checked)} />
                  Pago mixto demo
                </label>
                {!useSplitPayment ? (
                  <label>
                    Importe
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      value={singlePaymentAmount}
                      onChange={(event) => { setSinglePaymentAmount(event.target.value); setPaymentError(""); }}
                    />
                  </label>
                ) : (
                  <section className="quick-client-box demo-payments-box">
                    <h3>Pagos</h3>
                    {payments.map((payment, index) => (
                      <div className="field-row" key={`${index}-${payment.method}`}>
                        <label>
                          Metodo
                          <select value={payment.method} onChange={(event) => updatePaymentLine(index, { method: event.target.value })}>
                            <option value="">Seleccionar...</option>
                            {demoPaymentMethods.map((method) => <option key={method}>{method}</option>)}
                          </select>
                        </label>
                        <label>
                          Importe
                          <input
                            min="0"
                            step="0.01"
                            type="number"
                            value={payment.amount}
                            onChange={(event) => updatePaymentLine(index, { amount: event.target.value })}
                          />
                        </label>
                        <button className="danger-button" type="button" onClick={() => removePaymentLine(index)}>Eliminar pago</button>
                      </div>
                    ))}
                    <div className="row-actions">
                      <button className="secondary-button" type="button" onClick={addPaymentLine}>+ Anadir pago</button>
                    </div>
                  </section>
                )}
                <div className="calculated-row">
                  <span>Total venta: <b>{formatMoney(total)}</b></span>
                  <span>Pagado: <b>{formatMoney(paidTotal)}</b></span>
                  <span>Diferencia: <b>{formatMoney(paymentDifference)}</b></span>
                </div>
                {paymentError && <p className="auth-error">{paymentError}</p>}
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
              <button type="button" onClick={finishDemoPayment}>Cobrar y finalizar demo</button>
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
