import { useMemo, useState } from "react";

import ProfessionalHistoryDemo from "./ProfessionalHistoryDemo.jsx";
import ProfessionalModalDemo from "./ProfessionalModalDemo.jsx";
import ProfessionalsListDemo from "./ProfessionalsListDemo.jsx";
import {
  PROFESSIONAL_DEMO_USER,
  buildProfessional,
  cloneProfessionalsDemo,
  createProfessionalId,
} from "../utils/professionalsConfigDemo.js";

const emptyProfessional = () => buildProfessional({
  id: createProfessionalId(),
  firstName: "",
  lastName: "",
  displayName: "",
  active: true,
  offersServices: true,
  assignedServiceIds: [],
});

const trackedFields = [
  "firstName",
  "lastName",
  "displayName",
  "email",
  "phone",
  "active",
  "offersServices",
  "employmentType",
  "calendarColor",
  "internalNotes",
  "assignedServiceIds",
  "professionalServiceSettings",
  "weeklySchedule",
  "scheduleExceptions",
  "access",
  "economics",
  "publicProfile",
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function changedFields(previous = {}, next = {}) {
  return trackedFields.filter((field) => JSON.stringify(previous[field]) !== JSON.stringify(next[field]));
}

function ProfessionalsSettingsDemo() {
  const [professionals, setProfessionals] = useState(() => cloneProfessionalsDemo());
  const [history, setHistory] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [modalState, setModalState] = useState(null);
  const [notice, setNotice] = useState("");

  const totals = useMemo(() => {
    const active = professionals.filter((professional) => professional.active !== false).length;
    const withAccess = professionals.filter((professional) => professional.access?.enabled).length;
    const serviceProviders = professionals.filter((professional) => professional.offersServices).length;
    return { active, withAccess, serviceProviders, total: professionals.length };
  }, [professionals]);

  const addHistory = (action, previous, next) => {
    setHistory((current) => [
      {
        action,
        changedAt: new Date().toISOString(),
        changedBy: PROFESSIONAL_DEMO_USER,
        professionalId: next?.id || previous?.id,
        professionalName: next?.displayName || previous?.displayName || "Profesional demo",
        changedFields: changedFields(previous || {}, next || {}),
        previousValues: previous || null,
        newValues: next || null,
      },
      ...current,
    ]);
  };

  const handleAction = (action, professional) => {
    setNotice("");
    if (action === "edit") {
      setModalState({ mode: "edit", professional: clone(professional) });
      return;
    }
    if (action === "activate" || action === "deactivate") {
      const nextActive = action === "activate";
      setProfessionals((current) => current.map((item) => {
        if (item.id !== professional.id) return item;
        const next = { ...item, active: nextActive };
        addHistory(nextActive ? "professional_activated" : "professional_deactivated", item, next);
        return next;
      }));
      return;
    }
    if (action === "duplicate") {
      const next = {
        ...clone(professional),
        id: createProfessionalId(),
        firstName: `${professional.firstName} copia`,
        displayName: `${professional.displayName} copia`,
        email: "",
        active: true,
      };
      setProfessionals((current) => [next, ...current]);
      addHistory("professional_duplicated", professional, next);
      return;
    }
    if (action === "agenda") {
      setNotice(`Agenda de ${professional.displayName}: vista preparada para una fase posterior.`);
    }
  };

  const saveProfessional = (draft) => {
    const preparedDraft = {
      ...draft,
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      displayName: (draft.displayName || `${draft.firstName} ${draft.lastName}`).trim(),
    };

    if (modalState?.mode === "create") {
      setProfessionals((current) => [preparedDraft, ...current]);
      addHistory("professional_created", null, preparedDraft);
    } else {
      setProfessionals((current) => current.map((item) => {
        if (item.id !== preparedDraft.id) return item;
        addHistory("professional_edited", item, preparedDraft);
        return preparedDraft;
      }));
    }
    setModalState(null);
  };

  return (
    <section className="module professionals-settings-demo">
      <div className="section-title">
        <div>
          <h2>Profesionales</h2>
          <span>Gestiona el equipo, los servicios, horarios y accesos.</span>
        </div>
        <button type="button" onClick={() => setModalState({ mode: "create", professional: emptyProfessional() })}>
          Añadir profesional
        </button>
      </div>

      <section className="panel professional-demo-notice">
        <strong>Modo demo local — los cambios desaparecerán al recargar</strong>
        <span>No escribe en Firebase, no modifica permisos reales y no toca la configuración actual.</span>
      </section>

      <section className="summary-grid compact">
        <article className="metric"><span>Total profesionales</span><strong>{totals.total}</strong></article>
        <article className="metric"><span>Activas</span><strong>{totals.active}</strong></article>
        <article className="metric"><span>Ofrecen servicios</span><strong>{totals.serviceProviders}</strong></article>
        <article className="metric"><span>Con acceso demo</span><strong>{totals.withAccess}</strong></article>
      </section>

      <section className="panel professional-demo-controls">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar profesional..." />
        <div className="segmented-controls">
          <button className={filter === "all" ? "active" : ""} type="button" onClick={() => setFilter("all")}>Todas</button>
          <button className={filter === "active" ? "active" : ""} type="button" onClick={() => setFilter("active")}>Activas</button>
          <button className={filter === "inactive" ? "active" : ""} type="button" onClick={() => setFilter("inactive")}>Inactivas</button>
        </div>
      </section>

      {notice && <section className="panel"><p className="empty-state">{notice}</p></section>}

      <ProfessionalsListDemo
        filter={filter}
        onAction={handleAction}
        professionals={professionals}
        query={query}
      />

      <ProfessionalHistoryDemo history={history} />

      {modalState && (
        <ProfessionalModalDemo
          mode={modalState.mode}
          onClose={() => setModalState(null)}
          onSave={saveProfessional}
          professional={modalState.professional}
        />
      )}
    </section>
  );
}

export default ProfessionalsSettingsDemo;
