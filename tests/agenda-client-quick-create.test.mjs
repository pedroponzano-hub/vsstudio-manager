import test from "node:test";
import assert from "node:assert/strict";

import {
  createQuickClientOperation,
  findQuickClientDuplicate,
  normalizeClientPhone,
} from "../src/utils/clientQuickCreate.js";

test("crea un cliente persistente y devuelve su clientId real para la cita", async () => {
  const stored = new Map();
  const result = await createQuickClientOperation({
    name: "Nombre de prueba",
    phone: "+34 600 123 456",
    email: "CLIENTE@EXAMPLE.COM",
  }, {
    clients: [],
    createClientId: () => "client-real-created",
    saveClient: async (client) => {
      stored.set(client.id, structuredClone(client));
      return client;
    },
  });

  assert.equal(result.created, true);
  assert.equal(result.client.id, "client-real-created");
  assert.equal(result.client.phoneNormalized, "34600123456");
  assert.equal(result.client.email, "cliente@example.com");
  assert.equal(stored.get(result.client.id).id, "client-real-created");

  const appointmentDraft = { clientId: result.client.id, clientName: result.client.name };
  assert.equal(appointmentDraft.clientId, "client-real-created");
});

test("reutiliza el cliente existente si coincide el teléfono normalizado", async () => {
  const existing = { id: "client-existing", name: "Cliente existente", phone: "600123456" };
  let saves = 0;
  const result = await createQuickClientOperation({ name: "Nombre repetido", phone: "600 123 456" }, {
    clients: [existing],
    createClientId: () => "should-not-be-used",
    saveClient: async () => { saves += 1; },
  });

  assert.equal(result.created, false);
  assert.equal(result.client.id, "client-existing");
  assert.equal(saves, 0);
  assert.equal(findQuickClientDuplicate([existing], { phone: "+34 600123456" }), null);
  assert.equal(normalizeClientPhone("600 123 456"), "600123456");
});

test("exige nombre y teléfono válido antes de guardar", async () => {
  await assert.rejects(() => createQuickClientOperation({ name: "", phone: "600123456" }), /nombre/);
  await assert.rejects(() => createQuickClientOperation({ name: "Cliente", phone: "123" }), /teléfono válido/);
});
