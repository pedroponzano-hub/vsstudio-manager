function cleanText(value = "") {
  return String(value ?? "").trim();
}

export function normalizeClientPhone(value = "") {
  return cleanText(value).replace(/\D/g, "");
}

function normalizeEmail(value = "") {
  return cleanText(value).toLowerCase();
}

export function findQuickClientDuplicate(clients = [], clientInput = {}) {
  const phone = normalizeClientPhone(clientInput.phoneNormalized || clientInput.phone);
  const email = normalizeEmail(clientInput.email);

  return clients.find((client) => {
    const clientPhone = normalizeClientPhone(client.phoneNormalized || client.phone);
    const clientEmail = normalizeEmail(client.email);
    return (phone && clientPhone === phone) || (email && clientEmail === email);
  }) || null;
}

export function validateQuickClientInput(clientInput = {}) {
  const name = cleanText(clientInput.name);
  const phone = cleanText(clientInput.phone);
  const normalizedPhone = normalizeClientPhone(phone);
  if (!name) throw new Error("Indica el nombre del cliente.");
  if (!phone) throw new Error("Indica el teléfono del cliente.");
  if (normalizedPhone.length < 6) throw new Error("Indica un teléfono válido.");
  return {
    name,
    phone,
    phoneNormalized: normalizedPhone,
    email: normalizeEmail(clientInput.email),
  };
}

export async function createQuickClientOperation(clientInput = {}, {
  clients = [],
  createClientId,
  saveClient,
} = {}) {
  const normalizedInput = validateQuickClientInput(clientInput);
  const existingClient = findQuickClientDuplicate(clients, normalizedInput);
  if (existingClient) return { client: existingClient, created: false };
  if (typeof createClientId !== "function" || typeof saveClient !== "function") {
    throw new Error("No se ha configurado la persistencia de clientes.");
  }

  const client = {
    ...clientInput,
    ...normalizedInput,
    id: createClientId(),
  };
  const savedClient = await saveClient(client);
  return { client: savedClient || client, created: true };
}
