import { useEffect, useMemo, useState } from "react";

const accessRoles = {
  profesional: { label: "Profesional", permissions: ["agenda.own", "commissions.own"] },
  recepcion: { label: "Recepción", permissions: ["agenda.create", "agenda.edit", "sales.charge", "clients.view"] },
  operador_centro: { label: "Operador de centro", permissions: ["agenda.all", "sales.today", "clients.manage", "cashClosing"] },
  caja: { label: "Caja", permissions: ["sales.charge", "expenses", "cashClosing"] },
  direccion: { label: "Dirección", permissions: ["agenda.all", "sales.today", "clients.manage", "expenses", "cashClosing", "commissions"] },
};

const permissionLabels = {
  "agenda.own": "Ver su propia agenda",
  "commissions.own": "Ver sus propias comisiones",
  "agenda.create": "Crear citas",
  "agenda.edit": "Editar citas",
  "agenda.all": "Ver todas las agendas",
  "sales.charge": "Cobrar ventas",
  "sales.today": "Ver ventas del día",
  "clients.view": "Consultar clientes",
  "clients.manage": "Gestionar clientes",
  expenses: "Gestionar gastos",
  cashClosing: "Realizar cierre de caja",
  commissions: "Consultar comisiones",
};

const statusLabels = {
  none: "Sin acceso",
  pending: "Invitación pendiente",
  active: "Activo",
  disabled: "Deshabilitado",
  error: "Error",
};

function ProfessionalAccessPanel({ access, disabled, error = "", notice = "", onSave, onSetActive, professionalEmail = "" }) {
  const [email, setEmail] = useState(access?.email || professionalEmail || "");
  const [role, setRole] = useState(access?.role || "profesional");
  const [permissions, setPermissions] = useState(access?.permissions || accessRoles.profesional.permissions);
  const [allowAccess, setAllowAccess] = useState(access?.active !== false);

  useEffect(() => {
    setEmail(access?.email || professionalEmail || "");
    setRole(access?.role || "profesional");
    setPermissions(access?.permissions || accessRoles[access?.role || "profesional"]?.permissions || []);
    setAllowAccess(access?.active !== false);
  }, [access, professionalEmail]);

  const status = access?.status || "none";
  const linked = Boolean(access?.uid);
  const availablePermissions = useMemo(() => accessRoles[role]?.permissions || [], [role]);

  const changeRole = (nextRole) => {
    setRole(nextRole);
    setPermissions(accessRoles[nextRole]?.permissions || []);
  };

  const togglePermission = (permission) => {
    setPermissions((current) => current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission]);
  };

  return (
    <section className="professional-access-panel" aria-labelledby="professional-access-title">
      <div className="section-title compact-section-title">
        <div>
          <h3 id="professional-access-title">Acceso a Domia</h3>
          <span>Cuenta de usuario separada de los datos profesionales.</span>
        </div>
        <span className={`status-pill ${status === "active" ? "online" : status === "pending" ? "pending" : "offline"}`}>{statusLabels[status] || statusLabels.error}</span>
      </div>

      <label className="inline-check">
        <input
          checked={allowAccess}
          disabled={disabled}
          type="checkbox"
          onChange={(event) => setAllowAccess(event.target.checked)}
        />
        Permitir acceso a Domia
      </label>
      <div className="professional-access-fields">
        <label>
          Correo electrónico de acceso
          <input
            disabled={disabled || linked}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {linked && <small>Para cambiar este correo utiliza una operación específica de gestión de acceso.</small>}
        </label>
        <label>
          Rol
          <select disabled={disabled} value={role} onChange={(event) => changeRole(event.target.value)}>
            {Object.entries(accessRoles).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
          </select>
        </label>
      </div>

      <fieldset className="professional-access-permissions" disabled={disabled}>
        <legend>Permisos</legend>
        {availablePermissions.map((permission) => (
          <label className="inline-check" key={permission}>
            <input checked={permissions.includes(permission)} type="checkbox" onChange={() => togglePermission(permission)} />
            {permissionLabels[permission] || permission}
          </label>
        ))}
      </fieldset>

      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message">{notice}</p>}

      <div className="row-actions">
        <button
          disabled={disabled || !allowAccess}
          type="button"
          onClick={() => onSave({ email, role, permissions })}
        >
          {linked ? "Gestionar acceso" : "Crear o vincular acceso"}
        </button>
        {linked && access.active !== false && <button className="danger-button" disabled={disabled} type="button" onClick={() => onSetActive(false)}>Deshabilitar acceso</button>}
        {linked && access.active === false && <button className="secondary-button" disabled={disabled} type="button" onClick={() => onSetActive(true)}>Reactivar acceso</button>}
      </div>
    </section>
  );
}

export { accessRoles };
export default ProfessionalAccessPanel;
