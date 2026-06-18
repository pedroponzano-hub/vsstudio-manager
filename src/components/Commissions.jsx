import { useMemo, useState } from "react";
import { getLocalStartOfWeek, getTodayLocalDateString } from "../utils/date.js";

const periodOptions = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "year", label: "Año" },
  { value: "custom", label: "Personalizado" },
];

const paymentMethods = ["Efectivo", "Tarjeta", "Transferencia", "Bizum", "Otro"];

function money(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function rangeForPeriod(period) {
  const today = getTodayLocalDateString();
  if (period === "today") return { from: today, to: today };
  if (period === "week") return { from: getLocalStartOfWeek(today), to: today };
  if (period === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
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

function originLabel(row) {
  return row.operationType === "servicio_interno" ? "Servicio interno / socio" : "Venta";
}

function Commissions({ data, onStatusChange }) {
  const { rows = [] } = data;
  const [period, setPeriod] = useState("month");
  const [range, setRange] = useState(() => rangeForPeriod("month"));
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [editingRow, setEditingRow] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState("");

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

  const changePeriod = (nextPeriod) => {
    setPeriod(nextPeriod);
    if (nextPeriod !== "custom") setRange(rangeForPeriod(nextPeriod));
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

    if (normalizedStatus === "pendiente") {
      const confirmed = window.confirm("¿Seguro que deseas volver esta comisión a pendiente?");
      if (!confirmed) return;
    }

    onStatusChange?.(row.saleId, normalizedStatus, {
      statusChangeOnly: true,
    });
  };

  return (
    <section className="module">
      <div className="section-title">
        <div>
          <h2>Comisiones</h2>
          <span>Seguimiento, correccion y auditoria de comisiones</span>
        </div>
      </div>

      <section className="panel filters-panel">
        <label>Rango de fecha<select value={period} onChange={(event) => changePeriod(event.target.value)}>
          {periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>
        <label>Desde<input type="date" value={range.from || ""} disabled={period !== "custom"} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} /></label>
        <label>Hasta<input type="date" value={range.to || ""} disabled={period !== "custom"} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} /></label>
        <label>Empleado<select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
          <option value="all">Todas</option>
          {employees.map((employee) => <option key={employee} value={employee}>{employee}</option>)}
        </select></label>
        <label>Estado<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
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
          <div className="finance-header commission-detail-row">
            <span>Fecha</span><span>Hora</span><span>Cliente</span><span>Servicio</span><span>Profesional</span><span>Importe venta</span><span>%</span><span>Comision</span><span>Estado</span><span>Origen</span><span>Accion</span>
          </div>
          {filteredRows.map((row) => (
            <div className="finance-row commission-detail-row" key={row.saleId}>
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
              <span>{originLabel(row)}</span>
              {onStatusChange ? (
                <button className="secondary-button" type="button" onClick={() => startEdit(row)}>Editar comisión</button>
              ) : (
                <span className="muted-text">Solo lectura</span>
              )}
            </div>
          ))}
          {filteredRows.length === 0 && <p className="empty-state">No hay comisiones para estos filtros.</p>}
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
            <label>Porcentaje comisión<input type="number" step="0.01" name="commissionPercent" value={editForm.commissionPercent} onChange={updateEditField} /></label>
            <label>Importe comisión<input type="number" step="0.01" name="commissionAmount" value={editForm.commissionAmount} onChange={updateEditField} /></label>
          </div>
          <div className="field-row">
            <label>Estado<select name="status" value={editForm.status} onChange={updateEditField}>
              <option value="pendiente">pendiente</option>
              <option value="pagada">pagada</option>
            </select></label>
            <label>Fecha de pago<input type="date" name="paymentDate" value={editForm.paymentDate} onChange={updateEditField} disabled={editForm.status !== "pagada"} /></label>
            <label>Método de pago<select name="paymentMethod" value={editForm.paymentMethod} onChange={updateEditField} disabled={editForm.status !== "pagada"}>
              <option value="">Seleccionar...</option>
              {paymentMethods.map((method) => <option key={method}>{method}</option>)}
            </select></label>
          </div>
          <label>Motivo de corrección<textarea name="correctionReason" value={editForm.correctionReason} onChange={updateEditField} placeholder="Porcentaje incorrecto, profesional incorrecta, ajuste manual..." /></label>
          {editError && <p className="auth-error">{editError}</p>}
          <div className="reset-actions">
            <button type="button" onClick={saveEdit}>Guardar corrección</button>
            <button className="secondary-button" type="button" onClick={() => { setEditingRow(null); setEditForm(null); setEditError(""); }}>Cancelar</button>
          </div>
        </section>
      )}

    </section>
  );
}

export default Commissions;
