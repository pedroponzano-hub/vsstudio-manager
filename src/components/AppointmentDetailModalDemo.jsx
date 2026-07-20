import { useEffect, useMemo, useState } from "react";

import AppointmentEditFormDemo from "./AppointmentEditFormDemo.jsx";
import AppointmentEditHistoryDemo from "./AppointmentEditHistoryDemo.jsx";
import {
  DEMO_APPOINTMENT_TRANSITIONS,
  DEMO_SERVICES,
  DEMO_TREATWELL_BOOKING_TYPES,
  durationToMinutes,
  formatMinutes,
  minutesToTime,
  timeToMinutes,
} from "../utils/availabilityDemo.js";

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

function treatwellBookingLabel(typeId) {
  return DEMO_TREATWELL_BOOKING_TYPES.find((item) => item.id === typeId)?.label || "No indicado";
}

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function AppointmentDetailModalDemo({
  appointment,
  appointmentHistory = [],
  appointments = [],
  clients = [],
  onClose,
  onUpdateAppointment,
}) {
  const [mode, setMode] = useState("detail");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Tarjeta");
  const [singlePaymentAmount, setSinglePaymentAmount] = useState("");
  const [useSplitPayment, setUseSplitPayment] = useState(false);
  const [payments, setPayments] = useState([emptyPaymentLine()]);
  const [observations, setObservations] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [checkoutTreatwellCommissionPercent, setCheckoutTreatwellCommissionPercent] = useState(appointment?.treatwellCommissionPercent || 0);

  const service = useMemo(() => (
    DEMO_SERVICES.find((item) => item.id === appointment?.serviceId || item.name === appointment?.serviceName)
  ), [appointment]);

  if (!appointment) return null;

  const basePrice = Number(appointment.expectedPrice || service?.price || 30);
  const serviceDefaultDuration = durationToMinutes(appointment.serviceDefaultDuration || service?.duration);
  const appointmentDuration = durationToMinutes(appointment.appointmentDuration || appointment.duration || serviceDefaultDuration);
  const startTime = appointment.startTime || appointment.time || "No disponible";
  const calculatedEndTime = startTime === "No disponible"
    ? (appointment.endTime || "No disponible")
    : (appointment.endTime || minutesToTime(timeToMinutes(startTime) + appointmentDuration));
  const appointmentStatus = appointment.appointmentStatus || appointment.status || "Confirmada";
  const paymentStatus = appointment.paymentStatus || (appointment.isPrepaid ? "prepaid" : "pending");
  const isTreatwell = appointment.appointmentSource === "Treatwell" || Boolean(appointment.treatwellBookingType);
  const isTreatwellPrepaid = isTreatwell && paymentStatus === "prepaid";
  const normalizedAppointmentStatus = normalizeText(appointmentStatus);
  const isTerminal = ["Finalizada", "Cancelada"].includes(appointmentStatus) || normalizedAppointmentStatus.includes("no se present");
  const canEditAppointment = ["Confirmada", "Cancelada"].includes(appointmentStatus) || normalizedAppointmentStatus.includes("no se present");
  const canTransitionTo = (nextStatus) => (DEMO_APPOINTMENT_TRANSITIONS[appointmentStatus] || []).includes(nextStatus);
  const salonDue = Number(appointment.amountDueAtSalon ?? basePrice);
  const prepaidAmount = Number(appointment.prepaidAmount || 0);
  const treatwellCommissionPercent = Number(checkoutTreatwellCommissionPercent || 0);
  const treatwellCommissionAmount = basePrice * treatwellCommissionPercent / 100;
  const effectiveDiscount = Math.max(0, Number(discount || 0));
  const total = isTreatwellPrepaid ? 0 : Math.max(0, salonDue - effectiveDiscount);
  const commissionPercent = 40;
  const commissionAmount = total * commissionPercent / 100;
  const demoResultAfterCommissions = basePrice - commissionAmount - treatwellCommissionAmount;
  const demoSaleId = `demo-sale-${appointment.id}`;
  const singlePaidTotal = Number(singlePaymentAmount || 0);
  const splitPaidTotal = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const paidTotal = useSplitPayment ? splitPaidTotal : singlePaidTotal;
  const paymentDifference = total - paidTotal;

  const applyStatusChange = (nextStatus, extraUpdates = {}) => {
    if (!canTransitionTo(nextStatus)) return;
    onUpdateAppointment?.(appointment.id, {
      appointmentStatus: nextStatus,
      status: nextStatus,
      ...extraUpdates,
    });
  };

  const cancelAppointment = () => {
    if (!canTransitionTo("Cancelada")) return;
    if (!window.confirm("¿Seguro que deseas cancelar esta cita demo?")) return;
    applyStatusChange("Cancelada");
  };

  const markNoShow = () => {
    if (!canTransitionTo("No se presentó")) return;
    if (!window.confirm("¿Seguro que deseas marcar esta cita demo como no se presentó?")) return;
    applyStatusChange("No se presentó");
  };

  const finalizePrepaidService = () => {
    if (appointmentStatus !== "En servicio" || paymentStatus !== "prepaid") return;
    onUpdateAppointment?.(appointment.id, {
      appointmentStatus: "Finalizada",
      status: "Finalizada",
      paymentStatus: "prepaid",
      demoPaymentCompleted: true,
      demoPaymentSummary: {
        method: appointment.prepaidMethod || "Treatwell",
        paidAmount: prepaidAmount,
        completedAt: new Date().toISOString(),
      },
    });
    setMode("detail");
  };

  const saveAppointmentEdit = (updates, auditEntry) => {
    onUpdateAppointment?.(appointment.id, updates, auditEntry);
    setMode("detail");
  };

  useEffect(() => {
    if (!useSplitPayment) setSinglePaymentAmount(total.toFixed(2));
  }, [total, useSplitPayment]);

  useEffect(() => {
    if (isTreatwellPrepaid) {
      setPaymentMethod("Treatwell");
      setUseSplitPayment(false);
      setSinglePaymentAmount("0.00");
    }
  }, [isTreatwellPrepaid]);

  useEffect(() => {
    setCheckoutTreatwellCommissionPercent(appointment.treatwellCommissionPercent || 0);
  }, [appointment.id, appointment.treatwellCommissionPercent]);

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
    if (appointmentStatus !== "En servicio" || appointment.demoPaymentCompleted || paymentStatus === "paid") {
      setPaymentError("Esta cita demo no permite un nuevo cobro.");
      return;
    }

    if (isTreatwellPrepaid) {
      setPaymentError("");
      finalizePrepaidService();
      return;
    }

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
    onUpdateAppointment?.(appointment.id, {
      appointmentStatus: "Finalizada",
      status: "Finalizada",
      paymentStatus: "paid",
      demoPaymentCompleted: true,
      demoSaleId,
      demoPaymentSummary: {
        total,
        payments: validPayments,
        completedAt: new Date().toISOString(),
      },
    });
    setMode("detail");
  };

  const treatwellInfo = isTreatwell ? (
    <div className="treatwell-demo-info appointment-treatwell-info">
      <strong>Datos Treatwell</strong>
      <span><b>Origen:</b> Treatwell</span>
      <span><b>Tipo de reserva:</b> {treatwellBookingLabel(appointment.treatwellBookingType)}</span>
      <span><b>Comision Treatwell:</b> {treatwellCommissionPercent}% - {formatMoney(treatwellCommissionAmount)}</span>
      <span><b>Estado de pago:</b> {isTreatwellPrepaid ? "Prepaga en Treatwell" : "Pendiente de cobro en centro"}</span>
      <span><b>Pagado previamente:</b> {formatMoney(prepaidAmount)}</span>
      <span><b>Pendiente en centro:</b> {formatMoney(salonDue)}</span>
      {mode === "checkout" && !isTreatwellPrepaid && (
        <label className="treatwell-commission-adjust">
          Ajuste de cobro demo
          <input
            min="0"
            step="0.01"
            type="number"
            value={checkoutTreatwellCommissionPercent}
            onChange={(event) => setCheckoutTreatwellCommissionPercent(event.target.value)}
          />
        </label>
      )}
      {mode === "checkout" && isTreatwellPrepaid && <small>Reserva prepaga: la comision Treatwell queda fijada al 2 % en este flujo demo.</small>}
    </div>
  ) : null;

  return (
    <section className="sale-history-modal" role="dialog" aria-modal="true" aria-label="Detalle de cita demo">
      <article className="sale-history-dialog appointment-demo-dialog">
        <div className="section-title compact-section-title">
          <div>
            <h2>{mode === "checkout" ? "Cobro demo" : "Detalle de cita"}</h2>
            <span>Modo demo local - no se guarda en Firebase</span>
          </div>
          <button className="secondary-button" type="button" onClick={onClose}>Cerrar</button>
        </div>

        {mode === "edit" && (
          <AppointmentEditFormDemo
            appointment={appointment}
            appointments={appointments}
            clients={clients}
            onCancel={() => setMode("detail")}
            onSave={saveAppointmentEdit}
          />
        )}

        {mode === "detail" && (
          <>
            <div className="summary-list appointment-modal-summary">
              <span><b>appointmentId:</b> {appointment.id}</span>
              <span><b>Hora inicio:</b> {startTime}</span>
              <span><b>Hora final calculada:</b> {calculatedEndTime}</span>
              <span><b>Cliente:</b> {appointment.clientName}</span>
              <span><b>Telefono:</b> {appointment.phone}</span>
              <span><b>Servicio:</b> {appointment.serviceName}</span>
              <span><b>Profesional:</b> {appointment.employee}</span>
              <span><b>Duracion estandar servicio:</b> {formatMinutes(serviceDefaultDuration)}</span>
              <span><b>Duracion aplicada cita:</b> {formatMinutes(appointmentDuration)}</span>
              <span><b>Estado cita:</b> {appointmentStatus}</span>
              <span><b>Estado pago:</b> {paymentStatus}</span>
              <span><b>Origen:</b> {appointment.appointmentSource || "No indicado"}</span>
              <span><b>Referido por:</b> {appointment.referralText || "Sin indicar"}</span>
              <span><b>Observaciones cita:</b> {appointment.appointmentNotes || "Sin notas"}</span>
            </div>
            {treatwellInfo}
            {appointment.demoPaymentSummary && (
              <div className="checkout-demo-total appointment-payment-summary">
                <span><b>Cobro demo:</b> {appointment.paymentStatus}</span>
                <span><b>Importe:</b> {formatMoney(appointment.demoPaymentSummary.total || appointment.demoPaymentSummary.paidAmount || 0)}</span>
                <span><b>Completado:</b> {appointment.demoPaymentSummary.completedAt || "No disponible"}</span>
              </div>
            )}
            <AppointmentEditHistoryDemo history={appointmentHistory} />
            <div className="reset-actions">
              {canEditAppointment && (
                <button className="secondary-button" type="button" onClick={() => setMode("edit")}>Editar cita</button>
              )}
              {appointmentStatus === "Confirmada" && (
                <>
                  <button type="button" onClick={() => applyStatusChange("En servicio")}>Iniciar servicio</button>
                  <button className="secondary-button" type="button" onClick={cancelAppointment}>Cancelar cita</button>
                  <button className="danger-button" type="button" onClick={markNoShow}>Marcar no se presentó</button>
                </>
              )}
              {appointmentStatus === "En servicio" && paymentStatus !== "prepaid" && !appointment.demoPaymentCompleted && (
                <button type="button" onClick={() => setMode("checkout")}>Finalizar y cobrar</button>
              )}
              {appointmentStatus === "En servicio" && paymentStatus === "prepaid" && !appointment.demoPaymentCompleted && (
                <button type="button" onClick={finalizePrepaidService}>Finalizar servicio demo</button>
              )}
              {isTerminal && <p className="empty-state">Cita en solo lectura. No hay acciones disponibles.</p>}
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
                {treatwellInfo}
              </section>

              <section className="checkout-demo-block">
                <h3>Cobro</h3>
                {isTreatwellPrepaid ? (
                  <div className="prepaid-demo-box">
                    <strong>Reserva pagada en Treatwell</strong>
                    <span>Metodo conceptual: {appointment.prepaidMethod || "Treatwell"}</span>
                    <span>Importe ya pagado: {formatMoney(prepaidAmount)}</span>
                    <span>Diferencia pendiente: {formatMoney(0)}</span>
                    <small>No se permite un segundo cobro en este flujo demo.</small>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
                <div className="calculated-row">
                  <span>{isTreatwellPrepaid ? "Total venta bruto" : "Total venta"}: <b>{formatMoney(isTreatwellPrepaid ? basePrice : total)}</b></span>
                  <span>{isTreatwellPrepaid ? "Pagado en Treatwell" : "Pagado"}: <b>{formatMoney(isTreatwellPrepaid ? prepaidAmount : paidTotal)}</b></span>
                  <span>Diferencia pendiente: <b>{formatMoney(isTreatwellPrepaid ? 0 : paymentDifference)}</b></span>
                </div>
                {paymentError && <p className="auth-error">{paymentError}</p>}
                <label>
                  Observaciones
                  <textarea value={observations} onChange={(event) => setObservations(event.target.value)} placeholder="Observaciones demo del cobro" />
                </label>
              </section>
            </div>

            <section className="checkout-demo-total">
              <span><b>Venta bruta demo:</b> {formatMoney(basePrice)}</span>
              <span><b>Comision demo profesional:</b> {commissionPercent}% - {formatMoney(commissionAmount)}</span>
              {isTreatwell && <span><b>Comision Treatwell separada:</b> {treatwellCommissionPercent}% - {formatMoney(treatwellCommissionAmount)}</span>}
              {isTreatwell && <span><b>Resultado demo despues de ambas comisiones:</b> {formatMoney(demoResultAfterCommissions)}</span>}
              <span><b>Total a cobrar en centro:</b> {formatMoney(total)}</span>
              <small>Preparado para futura relacion appointmentId: {appointment.id}, saleId: {demoSaleId}, services, payments y estado pagada.</small>
            </section>

            <div className="reset-actions">
              <button type="button" onClick={finishDemoPayment}>{isTreatwellPrepaid ? "Finalizar servicio demo" : "Cobrar y finalizar demo"}</button>
              <button className="secondary-button" type="button" onClick={() => setMode("detail")}>Volver al detalle</button>
            </div>
          </>
        )}

      </article>
    </section>
  );
}

export default AppointmentDetailModalDemo;
