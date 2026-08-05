import { useEffect, useMemo, useRef, useState } from "react";
import { addLocalDays, getLocalStartOfWeek, getTodayLocalDateString } from "../utils/date.js";

const periodOptions = [
  { value: "today", label: "Hoy" },
  { value: "last10", label: "Ultimos 10 dias" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "previous_month", label: "Mes anterior" },
  { value: "year", label: "Ano" },
  { value: "custom", label: "Personalizado" },
];

const paymentMethods = ["Efectivo", "Transferencia", "Bizum", "Otro"];
const commissionPaymentOptions = [
  { value: "Efectivo", label: "Efectivo" },
  { value: "Transferencia", label: "Transferencia bancaria" },
  { value: "Bizum", label: "Bizum" },
  { value: "Otro", label: "Otro" },
];

function money(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function formatDate(date = "") {
  const value = String(date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "-";
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

function previousMonthRange(today = getTodayLocalDateString()) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const monthText = String(previousMonth).padStart(2, "0");
  const lastDay = new Date(previousYear, previousMonth, 0).getDate();
  return { from: `${previousYear}-${monthText}-01`, to: `${previousYear}-${monthText}-${String(lastDay).padStart(2, "0")}` };
}

function rangeForPeriod(period) {
  const today = getTodayLocalDateString();
  if (period === "today") return { from: today, to: today };
  if (period === "last10") return { from: addLocalDays(today, -9), to: today };
  if (period === "week") return { from: getLocalStartOfWeek(today), to: today };
  if (period === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (period === "previous_month") return previousMonthRange(today);
  if (period === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from: "", to: "" };
}

function inDateRange(date, range) {
  if (!date) return false;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

function groupByEmployee(rows) {
  return Object.values(rows.reduce((groups, row) => {
    const employee = row.employee || "Sin empleada";
    const current = groups[employee] || { employee, generated: 0, pending: 0, paid: 0 };
    const amount = Number(row.commissionAmount || 0);
    current.generated += amount;
    if (row.status === "pagada") current.paid += amount;
    else current.pending += amount;
    groups[employee] = current;
    return groups;
  }, {})).sort((first, second) => second.generated - first.generated);
}

function groupSelectionByEmployee(rows) {
  return Object.values(rows.reduce((groups, row) => {
    const employee = row.employee || "Sin empleada";
    const current = groups[employee] || { employee, professionalId: row.professionalId || "", count: 0, total: 0, rows: [] };
    current.count += 1;
    current.total += Number(row.commissionAmount || 0);
    current.rows.push(row);
    groups[employee] = current;
    return groups;
  }, {})).sort((first, second) => first.employee.localeCompare(second.employee, "es"));
}

function originLabel(row) {
  return row.operationType === "servicio_interno" ? "Servicio interno / socio" : "Venta";
}

function Commissions({ data, user, canBulkPay = false, onBulkPay, onStatusChange }) {
  const { rows = [], paymentBatches = [] } = data;
  const selectAllRef = useRef(null);
  const [period, setPeriod] = useState("month");
  const [range, setRange] = useState(() => rangeForPeriod("month"));
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkModal, setBulkModal] = useState(null);
  const [bulkForm, setBulkForm] = useState({ paymentDate: getTodayLocalDateString(), paymentMethod: "Transferencia", notes: "" });
  const [bulkError, setBulkError] = useState("");
  const [bulkResult, setBulkResult] = useState("");
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [batchDetail, setBatchDetail] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState("");
  const [statusModal, setStatusModal] = useState(null);
  const [statusForm, setStatusForm] = useState({ paymentDate: "", paymentMethod: "", paymentObservation: "" });
  const [statusError, setStatusError] = useState("");

  const employees = useMemo(() => (
    [...new Set(rows.map((row) => row.employee || "Sin empleada"))].sort((first, second) => first.localeCompare(second))
  ), [rows]);

  const filteredRows = useMemo(() => (
    rows.filter((row) => {
      if (!inDateRange(row.date, range)) return false;
      if (statusFilter === "pending" && row.status === "pagada") return false;
      if (statusFilter === "paid" && row.status !== "pagada") return false;
      if (employeeFilter !== "all" && (row.employee || "Sin empleada") !== employeeFilter) return false;
      return true;
    })
  ), [rows, range, statusFilter, employeeFilter]);

  const filteredTotals = useMemo(() => ({
    generated: filteredRows.reduce((total, row) => total + Number(row.commissionAmount || 0), 0),
    pending: filteredRows.filter((row) => row.status !== "pagada").reduce((total, row) => total + Number(row.commissionAmount || 0), 0),
    paid: filteredRows.filter((row) => row.status === "pagada").reduce((total, row) => total + Number(row.commissionAmount || 0), 0),
    count: filteredRows.length,
  }), [filteredRows]);

  const employeeSummary = useMemo(() => groupByEmployee(filteredRows), [filteredRows]);
  const pendingFilteredRows = useMemo(() => filteredRows.filter((row) => row.status !== "pagada"), [filteredRows]);
  const selectedRows = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return filteredRows.filter((row) => selectedSet.has(row.saleId) && row.status !== "pagada");
  }, [filteredRows, selectedIds]);
  const selectedTotal = useMemo(() => selectedRows.reduce((total, row) => total + Number(row.commissionAmount || 0), 0), [selectedRows]);
  const selectedByEmployee = useMemo(() => groupSelectionByEmployee(selectedRows), [selectedRows]);
  const visiblePendingIds = useMemo(() => pendingFilteredRows.map((row) => row.saleId), [pendingFilteredRows]);
  const allVisibleSelected = visiblePendingIds.length > 0 && visiblePendingIds.every((id) => selectedIds.includes(id));
  const partiallySelected = selectedRows.length > 0 && !allVisibleSelected;
  const sortedBatches = useMemo(() => (
    [...paymentBatches].sort((first, second) => String(second.createdAt || second.paymentDate || "").localeCompare(String(first.createdAt || first.paymentDate || "")))
  ), [paymentBatches]);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = partiallySelected;
  }, [partiallySelected]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => pendingFilteredRows.some((row) => row.saleId === id)));
  }, [pendingFilteredRows]);

  const changePeriod = (nextPeriod) => {
    setPeriod(nextPeriod);
    if (nextPeriod !== "custom") setRange(rangeForPeriod(nextPeriod));
    setSelectedIds([]);
  };

  const setRangeField = (field, value) => {
    setRange((current) => ({ ...current, [field]: value }));
    setPeriod("custom");
    setSelectedIds([]);
  };

  const toggleRowSelection = (row) => {
    if (!canBulkPay || row.status === "pagada") return;
    setBulkResult("");
    setSelectedIds((current) => (
      current.includes(row.saleId)
        ? current.filter((id) => id !== row.saleId)
        : [...current, row.saleId]
    ));
  };

  const toggleVisibleSelection = () => {
    if (!canBulkPay) return;
    setBulkResult("");
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !visiblePendingIds.includes(id)));
      return;
    }
    setSelectedIds((current) => [...new Set([...current, ...visiblePendingIds])]);
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setBulkError("");
  };

  const openBulkPayment = (sourceRows = selectedRows) => {
    const payableRows = sourceRows.filter((row) => row.status !== "pagada");
    if (!canBulkPay || payableRows.length === 0) return;
    setBulkModal({ rows: payableRows });
    setBulkForm({ paymentDate: getTodayLocalDateString(), paymentMethod: "Transferencia", notes: "" });
    setBulkError("");
  };

  const updateBulkField = (event) => {
    const { name, value } = event.target;
    setBulkForm((current) => ({ ...current, [name]: value }));
    setBulkError("");
  };

  const confirmBulkPayment = () => {
    if (!bulkModal || !onBulkPay || isBulkProcessing) return;
    if (!bulkForm.paymentDate || !/^\d{4}-\d{2}-\d{2}$/.test(bulkForm.paymentDate)) {
      setBulkError("Indica una fecha de pago valida.");
      return;
    }
    if (!bulkForm.paymentMethod) {
      setBulkError("Selecciona el metodo de pago.");
      return;
    }
    const payableRows = bulkModal.rows.filter((row) => rows.some((currentRow) => (
      currentRow.saleId === row.saleId
      && currentRow.status !== "pagada"
      && Number(currentRow.commissionAmount || 0) === Number(row.commissionAmount || 0)
    )));
    if (payableRows.length === 0) {
      setBulkError("Las comisiones seleccionadas ya no estan pendientes.");
      return;
    }
    setIsBulkProcessing(true);
    const result = onBulkPay(payableRows.map((row) => row.saleId), {
      paymentDate: bulkForm.paymentDate,
      paymentMethod: bulkForm.paymentMethod,
      notes: bulkForm.notes.trim(),
      periodStart: range.from,
      periodEnd: range.to,
    });
    setIsBulkProcessing(false);
    if (!result || result.paidCount === 0) {
      setBulkError("No se pudo completar el pago. Revisa si las comisiones siguen pendientes.");
      return;
    }
    setBulkResult(`Se pagaron ${result.paidCount} comisiones en ${result.batchCount} lotes por un total de ${money(result.totalAmount)}.${result.skippedCount ? ` ${result.skippedCount} comisiones fueron excluidas porque ya no estaban pendientes.` : ""}`);
    setBulkModal(null);
    setSelectedIds([]);
  };

  const startEdit = (row) => {
    setEditingRow(row);
    setEditForm({
      employee: row.employee || "",
      commissionPercent: String(row.commissionPercent ?? 0),
      commissionAmount: String(row.commissionAmount ?? 0),
      status: row.status || "pendiente",
      paymentDate: row.paymentDate || "",
      paymentMethod: row.paymentMethod || "",
      correctionReason: "",
    });
    setEditError("");
  };

  const updateEditField = (event) => {
    const { name, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: value }));
    setEditError("");
  };

  const saveEdit = () => {
    if (!editingRow || !editForm) return;
    if (!editForm.correctionReason.trim()) {
      setEditError("Indica el motivo de correccion.");
      return;
    }
    if (!editForm.employee.trim()) {
      setEditError("Selecciona una profesional.");
      return;
    }
    if (editForm.status === "pagada" && (!editForm.paymentDate || !editForm.paymentMethod)) {
      setEditError("Para marcar como pagada, completa fecha y metodo de pago.");
      return;
    }

    onStatusChange?.(editingRow.saleId, editForm.status, {
      employee: editForm.employee.trim(),
      commissionPercent: Number(editForm.commissionPercent || 0),
      commissionAmount: Number(editForm.commissionAmount || 0),
      paymentDate: editForm.status === "pagada" ? editForm.paymentDate : "",
      paymentMethod: editForm.status === "pagada" ? editForm.paymentMethod : "",
      fechaPago: editForm.status === "pagada" ? editForm.paymentDate : "",
      metodoPagoComision: editForm.status === "pagada" ? editForm.paymentMethod : "",
      correctionReason: editForm.correctionReason.trim(),
    });
    setEditingRow(null);
    setEditForm(null);
    setEditError("");
  };

  const startStatusChange = (row, nextStatus) => {
    if (!onStatusChange) return;
    const normalizedStatus = nextStatus === "pagada" ? "pagada" : "pendiente";
    if ((row.status || "pendiente") === normalizedStatus) return;

    if (normalizedStatus === "pagada") {
      setStatusModal(row);
      setStatusForm({
        paymentDate: row.paymentDate || getTodayLocalDateString(),
        paymentMethod: row.paymentMethod || "",
        paymentObservation: row.paidObservation || "",
      });
      setStatusError("");
      return;
    }

    if (normalizedStatus === "pendiente") {
      const confirmed = window.confirm("Seguro que deseas volver esta comision a pendiente?");
      if (!confirmed) return;
    }

    onStatusChange?.(row.saleId, normalizedStatus, {
      statusChangeOnly: true,
    });
  };

  const updateStatusField = (event) => {
    const { name, value } = event.target;
    setStatusForm((current) => ({ ...current, [name]: value }));
    setStatusError("");
  };

  const saveStatusPayment = () => {
    if (!statusModal) return;
    if (!statusForm.paymentDate || !statusForm.paymentMethod) {
      setStatusError("Completa la fecha y el metodo de pago.");
      return;
    }

    onStatusChange?.(statusModal.saleId, "pagada", {
      statusChangeOnly: true,
      paymentDate: statusForm.paymentDate,
      paymentMethod: statusForm.paymentMethod,
      fechaPago: statusForm.paymentDate,
      metodoPagoComision: statusForm.paymentMethod,
      observacionesPago: statusForm.paymentObservation.trim(),
      paidObservation: statusForm.paymentObservation.trim(),
    });
    setStatusModal(null);
    setStatusForm({ paymentDate: "", paymentMethod: "", paymentObservation: "" });
    setStatusError("");
  };

  return (
    <section className="module">
      <div className="section-title">
        <div>
          <h2>Comisiones</h2>
          <span>Seguimiento, correccion y auditoria de comisiones</span>
        </div>
      </div>

      {statusModal && (
        <section className="sale-history-modal" role="dialog" aria-modal="true" aria-label="Marcar comision como pagada">
          <article className="sale-history-dialog commission-payment-dialog">
            <div className="section-title">
              <div>
                <h2>Marcar comision como pagada</h2>
                <span>{statusModal.employee || "Sin profesional"}</span>
              </div>
            </div>
            <div className="list">
              <div className="stat-row"><span>Servicio</span><strong>{statusModal.services || "Sin servicio"}</strong></div>
              <div className="stat-row"><span>Importe comision</span><strong>{money(statusModal.commissionAmount)}</strong></div>
            </div>
            <div className="field-row">
              <label>Fecha de pago<input type="date" name="paymentDate" value={statusForm.paymentDate} onChange={updateStatusField} /></label>
              <label>Metodo de pago<select name="paymentMethod" value={statusForm.paymentMethod} onChange={updateStatusField}>
                <option value="">Seleccionar...</option>
                {commissionPaymentOptions.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
              </select></label>
            </div>
            <label>Observaciones opcionales<textarea name="paymentObservation" value={statusForm.paymentObservation} onChange={updateStatusField} placeholder="Referencia, detalle del pago..." /></label>
            {statusError && <p className="auth-error">{statusError}</p>}
            <div className="reset-actions">
              <button type="button" onClick={saveStatusPayment}>Guardar como pagada</button>
              <button className="secondary-button" type="button" onClick={() => { setStatusModal(null); setStatusError(""); }}>Cancelar</button>
            </div>
          </article>
        </section>
      )}

      {bulkModal && (
        <section className="sale-history-modal" role="dialog" aria-modal="true" aria-label="Pago de comisiones">
          <article className="sale-history-dialog commission-payment-dialog">
            <div className="section-title">
              <div>
                <h2>Pago de comisiones</h2>
                <span>{formatDate(range.from)} - {formatDate(range.to)}</span>
              </div>
            </div>
            <div className="summary-grid compact">
              <article className="metric"><span>Comisiones</span><strong>{bulkModal.rows.length}</strong></article>
              <article className="metric"><span>Profesionales</span><strong>{groupSelectionByEmployee(bulkModal.rows).length}</strong></article>
              <article className="metric"><span>Total</span><strong>{money(bulkModal.rows.reduce((total, row) => total + Number(row.commissionAmount || 0), 0))}</strong></article>
            </div>
            <div className="field-row">
              <label>Fecha de pago<input type="date" name="paymentDate" value={bulkForm.paymentDate} onChange={updateBulkField} /></label>
              <label>Metodo de pago<select name="paymentMethod" value={bulkForm.paymentMethod} onChange={updateBulkField}>
                {commissionPaymentOptions.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
              </select></label>
            </div>
            <label>Observacion opcional<textarea name="notes" value={bulkForm.notes} onChange={updateBulkField} placeholder="Pago de comisiones del periodo..." /></label>
            <div className="finance-table">
              <div className="finance-header commission-batch-summary-row"><span>Profesional</span><span>Comisiones</span><span>Total</span></div>
              {groupSelectionByEmployee(bulkModal.rows).map((row) => (
                <div className="finance-row commission-batch-summary-row" key={row.employee}>
                  <span>{row.employee}</span>
                  <strong>{row.count}</strong>
                  <strong>{money(row.total)}</strong>
                </div>
              ))}
            </div>
            {bulkError && <p className="auth-error">{bulkError}</p>}
            <div className="reset-actions">
              <button type="button" onClick={confirmBulkPayment} disabled={isBulkProcessing}>{isBulkProcessing ? "Procesando..." : "Confirmar pago"}</button>
              <button className="secondary-button" type="button" onClick={() => { setBulkModal(null); setBulkError(""); }} disabled={isBulkProcessing}>Cancelar</button>
            </div>
          </article>
        </section>
      )}

      {batchDetail && (
        <section className="sale-history-modal" role="dialog" aria-modal="true" aria-label="Detalle de lote">
          <article className="sale-history-dialog commission-payment-dialog">
            <div className="section-title">
              <div>
                <h2>Detalle del lote</h2>
                <span>{batchDetail.id}</span>
              </div>
              <button className="secondary-button" type="button" onClick={() => setBatchDetail(null)}>Cerrar</button>
            </div>
            <div className="summary-grid compact">
              <article className="metric"><span>Profesional</span><strong>{batchDetail.employee || batchDetail.professionalName}</strong></article>
              <article className="metric"><span>Fecha pago</span><strong>{formatDate(batchDetail.paymentDate)}</strong></article>
              <article className="metric"><span>Total</span><strong>{money(batchDetail.totalAmount)}</strong></article>
            </div>
            <div className="finance-table">
              <div className="finance-header commission-batch-detail-row"><span>Venta</span><span>Fecha</span><span>Servicio</span><span>Comision</span></div>
              {(batchDetail.commissionIds || []).map((commissionId) => {
                const row = rows.find((item) => item.saleId === commissionId);
                return (
                  <div className="finance-row commission-batch-detail-row" key={commissionId}>
                    <span>{commissionId}</span>
                    <span>{formatDate(row?.date || "")}</span>
                    <span>{row?.services || "Pago individual anterior"}</span>
                    <strong>{money(row?.commissionAmount || 0)}</strong>
                  </div>
                );
              })}
            </div>
            {batchDetail.notes && <p className="empty-state">Observacion: {batchDetail.notes}</p>}
          </article>
        </section>
      )}

      <section className="panel filters-panel">
        <label>Rango de fecha<select value={period} onChange={(event) => changePeriod(event.target.value)}>
          {periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>
        <label>Desde<input type="date" value={range.from || ""} disabled={period !== "custom"} onChange={(event) => setRangeField("from", event.target.value)} /></label>
        <label>Hasta<input type="date" value={range.to || ""} disabled={period !== "custom"} onChange={(event) => setRangeField("to", event.target.value)} /></label>
        <label>Empleado<select value={employeeFilter} onChange={(event) => { setEmployeeFilter(event.target.value); setSelectedIds([]); }}>
          <option value="all">Todas</option>
          {employees.map((employee) => <option key={employee} value={employee}>{employee}</option>)}
        </select></label>
        <label>Estado<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setSelectedIds([]); }}>
          <option value="all">Todas</option>
          <option value="pending">Pendientes</option>
          <option value="paid">Pagadas</option>
        </select></label>
      </section>

      <div className="summary-grid compact">
        <article className="metric"><span>Total generado</span><strong>{money(filteredTotals.generated)}</strong></article>
        <article className="metric"><span>Pendiente total</span><strong>{money(filteredTotals.pending)}</strong></article>
        <article className="metric"><span>Pagado total</span><strong>{money(filteredTotals.paid)}</strong></article>
        <article className="metric"><span>Registros</span><strong>{filteredTotals.count}</strong></article>
      </div>

      {bulkResult && <p className="success-message">{bulkResult}</p>}

      {canBulkPay && (
        <section className="panel commission-bulk-panel">
          <div className="section-title">
            <div>
              <h3>Pago en lote</h3>
              <span>{pendingFilteredRows.length} comisiones pendientes en los filtros actuales</span>
            </div>
            <button type="button" onClick={() => openBulkPayment(pendingFilteredRows)} disabled={pendingFilteredRows.length === 0}>Pagar todas las pendientes del periodo</button>
          </div>
          {selectedRows.length > 0 && (
            <div className="commission-selection-bar">
              <strong>{selectedRows.length} comisiones seleccionadas</strong>
              <span>Total: {money(selectedTotal)}</span>
              <button type="button" onClick={() => openBulkPayment(selectedRows)}>Marcar como pagadas</button>
              <button className="secondary-button" type="button" onClick={clearSelection}>Limpiar seleccion</button>
            </div>
          )}
          {selectedRows.length > 0 && selectedRows.length < pendingFilteredRows.length && (
            <button className="link-button" type="button" onClick={() => setSelectedIds(pendingFilteredRows.map((row) => row.saleId))}>
              Seleccionar las {pendingFilteredRows.length} comisiones pendientes del periodo
            </button>
          )}
        </section>
      )}

      <section className="panel">
        <h3>Comisiones por empleado</h3>
        <div className="finance-table">
          <div className="finance-header commission-employee-row"><span>Profesional</span><span>Total generado</span><span>Pendiente</span><span>Pagado</span></div>
          {employeeSummary.map((row) => (
            <div className="finance-row commission-employee-row" key={row.employee}>
              <span>{row.employee}</span>
              <strong>{money(row.generated)}</strong>
              <strong>{money(row.pending)}</strong>
              <strong>{money(row.paid)}</strong>
            </div>
          ))}
          {employeeSummary.length === 0 && <p className="empty-state">Sin comisiones para estos filtros.</p>}
        </div>
      </section>

      <section className="panel commission-list-panel">
        <h3>Detalle de comisiones</h3>
        <div className="finance-table">
          <div className={canBulkPay ? "finance-header commission-detail-row bulk" : "finance-header commission-detail-row"}>
            {canBulkPay && <span><input ref={selectAllRef} type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleSelection} aria-label="Seleccionar comisiones pendientes visibles" /></span>}
            <span>Fecha</span><span>Hora</span><span>Cliente</span><span>Servicio</span><span>Profesional</span><span>Importe venta</span><span>%</span><span>Comision</span><span>Estado</span><span>Origen</span><span>Accion</span>
          </div>
          {filteredRows.map((row) => (
            <div className={`${canBulkPay ? "finance-row commission-detail-row bulk" : "finance-row commission-detail-row"}${selectedIds.includes(row.saleId) ? " selected" : ""}`} key={row.saleId}>
              {canBulkPay && (
                <span>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.saleId)}
                    disabled={row.status === "pagada"}
                    onChange={() => toggleRowSelection(row)}
                    aria-label={`Seleccionar comision de ${row.employee || "profesional"}`}
                  />
                </span>
              )}
              <span>{row.date || "-"}</span>
              <span>{row.hour || "-"}</span>
              <span>{row.client || "Sin cliente"}</span>
              <span>{row.services || "Sin servicio"}</span>
              <span>{row.employee || "Sin empleada"}</span>
              <strong>{money(row.saleTotal)}</strong>
              <strong>{Number(row.commissionPercent || 0).toFixed(2)}%</strong>
              <strong>{money(row.commissionAmount)}</strong>
              {onStatusChange ? (
                <select
                  className={row.status === "pagada" ? "status-select paid" : "status-select pending"}
                  value={row.status === "pagada" ? "pagada" : "pendiente"}
                  onChange={(event) => startStatusChange(row, event.target.value)}
                >
                  <option value="pendiente">PENDIENTE</option>
                  <option value="pagada">PAGADA</option>
                </select>
              ) : (
                <span className={row.status === "pagada" ? "status-badge paid" : "status-badge pending"}>{row.status === "pagada" ? "PAGADA" : "PENDIENTE"}</span>
              )}
              <span>{originLabel(row)}{row.status === "pagada" && !row.commissionPaymentBatchId ? " - Pago individual anterior" : ""}</span>
              {onStatusChange ? (
                <button className="secondary-button" type="button" onClick={() => startEdit(row)}>Editar comision</button>
              ) : (
                <span className="muted-text">Solo lectura</span>
              )}
            </div>
          ))}
          {filteredRows.length === 0 && <p className="empty-state">No hay comisiones para estos filtros.</p>}
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <h3>Pagos realizados</h3>
            <span>Historial de lotes de pago de comisiones</span>
          </div>
        </div>
        <div className="finance-table">
          <div className="finance-header commission-payment-batch-row"><span>Fecha pago</span><span>Profesional</span><span>Periodo</span><span>Comisiones</span><span>Total</span><span>Usuario</span><span>Estado</span><span>Accion</span></div>
          {sortedBatches.map((batch) => (
            <div className="finance-row commission-payment-batch-row" key={batch.id}>
              <span>{formatDate(batch.paymentDate)}</span>
              <span>{batch.employee || batch.professionalName || "Sin profesional"}</span>
              <span>{formatDate(batch.periodStart)} - {formatDate(batch.periodEnd)}</span>
              <strong>{batch.commissionCount || (batch.commissionIds || []).length}</strong>
              <strong>{money(batch.totalAmount)}</strong>
              <span>{batch.createdBy || "-"}</span>
              <span className={batch.status === "anulado" ? "status-badge voided" : "status-badge paid"}>{batch.status === "anulado" ? "Anulado" : "Pagado"}</span>
              <button className="secondary-button" type="button" onClick={() => setBatchDetail(batch)}>Ver detalle</button>
            </div>
          ))}
          {sortedBatches.length === 0 && <p className="empty-state">Aun no hay lotes de pago. Las comisiones pagadas antiguas seguiran apareciendo como pago individual anterior.</p>}
        </div>
      </section>

      {editingRow && editForm && (
        <section className="reset-panel commission-edit-panel" role="dialog" aria-label="Editar comision">
          <div>
            <h2>Editar comision</h2>
            <p>{editingRow.services} - {editingRow.client}</p>
          </div>
          <div className="field-row">
            <label>Profesional<input name="employee" value={editForm.employee} onChange={updateEditField} list="commission-employees" /></label>
            <datalist id="commission-employees">{employees.map((employee) => <option key={employee} value={employee} />)}</datalist>
            <label>Porcentaje comision<input type="number" step="0.01" name="commissionPercent" value={editForm.commissionPercent} onChange={updateEditField} /></label>
            <label>Importe comision<input type="number" step="0.01" name="commissionAmount" value={editForm.commissionAmount} onChange={updateEditField} /></label>
          </div>
          <div className="field-row">
            <label>Estado<select name="status" value={editForm.status} onChange={updateEditField}>
              <option value="pendiente">pendiente</option>
              <option value="pagada">pagada</option>
            </select></label>
            <label>Fecha de pago<input type="date" name="paymentDate" value={editForm.paymentDate} onChange={updateEditField} disabled={editForm.status !== "pagada"} /></label>
            <label>Metodo de pago<select name="paymentMethod" value={editForm.paymentMethod} onChange={updateEditField} disabled={editForm.status !== "pagada"}>
              <option value="">Seleccionar...</option>
              {paymentMethods.map((method) => <option key={method}>{method}</option>)}
            </select></label>
          </div>
          <label>Motivo de correccion<textarea name="correctionReason" value={editForm.correctionReason} onChange={updateEditField} placeholder="Porcentaje incorrecto, profesional incorrecta, ajuste manual..." /></label>
          {editError && <p className="auth-error">{editError}</p>}
          <div className="reset-actions">
            <button type="button" onClick={saveEdit}>Guardar correccion</button>
            <button className="secondary-button" type="button" onClick={() => { setEditingRow(null); setEditForm(null); setEditError(""); }}>Cancelar</button>
          </div>
        </section>
      )}
    </section>
  );
}

export default Commissions;
