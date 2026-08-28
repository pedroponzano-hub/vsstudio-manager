import test from "node:test";
import assert from "node:assert/strict";

import {
  ProfessionalAccessError,
  createOrLinkProfessionalUserCore,
  isAuthorizedAdminProfile,
  setProfessionalUserAccessStateCore,
} from "../src/professionalAccessCore.js";

function createAdapters({ authUsers = [], profiles = [], professionals = [{ id: "leo", name: "Leo" }] } = {}) {
  const authByEmail = new Map(authUsers.map((user) => [user.email, { ...user }]));
  const profilesByUid = new Map(profiles.map((profile) => [profile.uid, { ...profile }]));
  const calls = { created: 0, disabled: [], claims: [], saved: [] };
  return {
    calls,
    profilesByUid,
    adapters: {
      getProfessional: async (id) => professionals.find((item) => item.id === id) || null,
      findAuthUserByEmail: async (email) => authByEmail.get(email) || null,
      createAuthUser: async ({ email, displayName }) => {
        calls.created += 1;
        const user = { uid: `uid-${calls.created}`, email, displayName };
        authByEmail.set(email, user);
        return user;
      },
      findProfileByUid: async (uid) => profilesByUid.get(uid) || null,
      findProfileByEmail: async (email) => [...profilesByUid.values()].find((profile) => profile.email === email) || null,
      findProfileByProfessionalId: async (professionalId) => [...profilesByUid.values()].find((profile) => profile.professionalId === professionalId) || null,
      setAuthDisabled: async (uid, disabled) => calls.disabled.push({ uid, disabled }),
      setAuthClaims: async (uid, claims) => calls.claims.push({ uid, claims }),
      saveUserProfile: async (uid, profile) => {
        profilesByUid.set(uid, { ...profile });
        calls.saved.push({ uid, profile: { ...profile } });
      },
    },
  };
}

const actor = { uid: "admin-uid", email: "admin@domia.test" };
const validInput = { professionalId: "leo", email: "leo@domia.test", role: "profesional", permissions: ["agenda.own", "commissions.own"] };

test("crea Auth y persiste users/{uid} con professionalId sin recrear profesional", async () => {
  const context = createAdapters();
  const result = await createOrLinkProfessionalUserCore({ input: validInput, actor, adapters: context.adapters, now: "2026-08-28T10:00:00.000Z" });
  assert.equal(result.created, true);
  assert.equal(context.calls.created, 1);
  assert.equal(context.calls.saved[0].profile.professionalId, "leo");
  assert.equal(context.profilesByUid.get(result.access.uid).email, "leo@domia.test");
});

test("vincular de nuevo el mismo usuario actualiza sin duplicar Auth", async () => {
  const existing = { uid: "leo-uid", email: "leo@domia.test", professionalId: "leo", role: "profesional", active: true };
  const context = createAdapters({ authUsers: [existing], profiles: [existing] });
  const result = await createOrLinkProfessionalUserCore({ input: validInput, actor, adapters: context.adapters });
  assert.equal(result.created, false);
  assert.equal(context.calls.created, 0);
  assert.equal(context.calls.saved.length, 1);
});

test("bloquea un correo vinculado a otro profesional", async () => {
  const existing = { uid: "other-uid", email: "leo@domia.test", professionalId: "marianne", role: "profesional", active: true };
  const context = createAdapters({ authUsers: [existing], profiles: [existing] });
  await assert.rejects(
    createOrLinkProfessionalUserCore({ input: validInput, actor, adapters: context.adapters }),
    (error) => error instanceof ProfessionalAccessError && error.code === "already-exists",
  );
  assert.equal(context.calls.saved.length, 0);
});

test("desactivar y reactivar conserva usuario y professionalId", async () => {
  const existing = { uid: "leo-uid", email: "leo@domia.test", professionalId: "leo", role: "profesional", permissions: ["agenda.own"], active: true };
  const context = createAdapters({ authUsers: [existing], profiles: [existing] });
  const disabled = await setProfessionalUserAccessStateCore({ input: { professionalId: "leo", active: false }, actor, adapters: context.adapters });
  assert.equal(disabled.access.status, "disabled");
  assert.equal(context.profilesByUid.get("leo-uid").professionalId, "leo");
  const enabled = await setProfessionalUserAccessStateCore({ input: { professionalId: "leo", active: true }, actor, adapters: context.adapters });
  assert.equal(enabled.access.status, "active");
  assert.deepEqual(context.calls.disabled, [{ uid: "leo-uid", disabled: true }, { uid: "leo-uid", disabled: false }]);
});

test("un usuario normal no supera la autorización administrativa server-side", () => {
  assert.equal(isAuthorizedAdminProfile({ role: "profesional", active: true }, { role: "admin" }), false);
  assert.equal(isAuthorizedAdminProfile({ role: "admin", active: true }, {}), false);
  assert.equal(isAuthorizedAdminProfile({ role: "admin", active: true }, { admin: true }), true);
  assert.equal(isAuthorizedAdminProfile({ role: "admin", active: false }, { role: "admin" }), false);
});

test("no permite asignar el rol admin mediante la operación profesional", async () => {
  const context = createAdapters();
  await assert.rejects(
    createOrLinkProfessionalUserCore({ input: { ...validInput, role: "admin", permissions: [] }, actor, adapters: context.adapters }),
    (error) => error instanceof ProfessionalAccessError && error.code === "invalid-argument",
  );
  assert.equal(context.calls.created, 0);
});
