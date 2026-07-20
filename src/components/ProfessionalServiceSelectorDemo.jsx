import { useEffect, useMemo } from "react";

import SearchableCombobox from "./SearchableCombobox.jsx";
import { DEMO_PROFESSIONALS } from "../utils/availabilityDemo.js";

const ANY_PROFESSIONAL = { id: "any", name: "Cualquiera", serviceIds: [] };

function ProfessionalServiceSelectorDemo({
  disabled = false,
  label = "Profesional",
  onChange,
  onCompatibilityMessage,
  professionals = DEMO_PROFESSIONALS,
  selectedProfessionalId = "any",
  serviceId = "",
}) {
  const compatibleProfessionals = useMemo(() => (
    serviceId
      ? professionals.filter((professional) => professional.serviceIds?.includes(serviceId))
      : professionals
  ), [professionals, serviceId]);
  const selectableProfessionals = [ANY_PROFESSIONAL, ...compatibleProfessionals];
  const selectedProfessional = selectableProfessionals.find((professional) => professional.id === selectedProfessionalId) || ANY_PROFESSIONAL;

  useEffect(() => {
    if (!serviceId) {
      onCompatibilityMessage?.("");
      return;
    }

    if (compatibleProfessionals.length === 0) {
      onCompatibilityMessage?.("No hay profesionales asignadas a este servicio");
      if (selectedProfessionalId !== "any") onChange?.("any");
      return;
    }

    if (compatibleProfessionals.length === 1 && selectedProfessionalId === "any") {
      onCompatibilityMessage?.("");
      onChange?.(compatibleProfessionals[0].id);
      return;
    }

    if (
      selectedProfessionalId !== "any"
      && !compatibleProfessionals.some((professional) => professional.id === selectedProfessionalId)
    ) {
      onCompatibilityMessage?.("La profesional seleccionada no realiza este servicio");
      onChange?.("any");
      return;
    }

    onCompatibilityMessage?.("");
  }, [compatibleProfessionals, onChange, onCompatibilityMessage, selectedProfessionalId, serviceId]);

  return (
    <label>
      {label}
      <SearchableCombobox
        emptyMessage="No hay profesionales compatibles"
        getLabel={(professional) => professional?.name || ""}
        getSearchText={(professional) => professional?.name || ""}
        items={selectableProfessionals}
        onChange={(professional) => onChange?.(professional?.id || "any")}
        placeholder="Buscar profesional..."
        renderItem={(professional) => (
          <span className="service-combobox-result">
            <strong>{professional.name}</strong>
            {professional.id !== "any" && <small>{serviceId ? "Compatible con el servicio" : "Disponible"}</small>}
          </span>
        )}
        value={selectedProfessional}
      />
      {disabled && <small>Selecciona un servicio para validar compatibilidad.</small>}
    </label>
  );
}

export default ProfessionalServiceSelectorDemo;
