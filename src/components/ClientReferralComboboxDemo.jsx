import SearchableCombobox from "./SearchableCombobox.jsx";
import { DEMO_CLIENTS } from "../utils/availabilityDemo.js";

const NO_REFERRAL = { id: "no-referral", name: "Sin referido", phone: "" };
const OTHER_REFERRAL = { id: "other-referral", name: "Otro / texto libre", phone: "" };

function normalizeClient(client = {}) {
  const name = client.name || `${client.firstName || ""} ${client.lastName || client.apellidos || ""}`.trim();
  return {
    id: client.id || client.clientId || client.phone || name,
    name: name || "Cliente sin nombre",
    phone: client.phone || client.telefono || client.telefonoNormalizado || "",
    email: client.email || "",
  };
}

function ClientReferralComboboxDemo({ clients = [], value = {}, onChange }) {
  const normalizedClients = (clients.length ? clients : DEMO_CLIENTS).map(normalizeClient);
  const selectedValue = value.referralMode === "other"
    ? OTHER_REFERRAL
    : value.referralClientId
      ? normalizedClients.find((client) => client.id === value.referralClientId) || null
      : NO_REFERRAL;
  const items = [NO_REFERRAL, OTHER_REFERRAL, ...normalizedClients];

  const selectReferral = (item) => {
    if (!item || item.id === NO_REFERRAL.id) {
      onChange?.({
        referralMode: "none",
        referralClientId: "",
        referralClientName: "",
        referralText: "",
      });
      return;
    }

    if (item.id === OTHER_REFERRAL.id) {
      onChange?.({
        referralMode: "other",
        referralClientId: "",
        referralClientName: "",
        referralText: value.referralText || "",
      });
      return;
    }

    onChange?.({
      referralMode: "client",
      referralClientId: item.id,
      referralClientName: item.name,
      referralText: item.name,
    });
  };

  return (
    <div className="referral-combobox-demo">
      <SearchableCombobox
        emptyMessage="No se encontraron clientes"
        getLabel={(item) => item?.name || ""}
        getSearchText={(item) => [item?.name, item?.phone, item?.email].filter(Boolean).join(" ")}
        items={items}
        onChange={selectReferral}
        placeholder="Buscar referido..."
        renderItem={(item) => (
          <span className="service-combobox-result">
            <strong>{item.name}</strong>
            {item.phone && <small>{item.phone}</small>}
          </span>
        )}
        value={selectedValue}
      />
      {value.referralMode === "other" && (
        <input
          value={value.referralText || ""}
          onChange={(event) => onChange?.({
            referralMode: "other",
            referralClientId: "",
            referralClientName: "",
            referralText: event.target.value,
          })}
          placeholder="Instagram, Google, vecina, recomendacion externa..."
        />
      )}
    </div>
  );
}

export default ClientReferralComboboxDemo;
