import test from "node:test";
import assert from "node:assert/strict";

import { accessDeniedMessageForRoute, getDefaultRouteForUser, resolveRouteForUser } from "../src/permissions.js";
import { normalizeUserProfile } from "../src/utils/userProfile.js";

test("resuelve la ruta inicial del administrador", () => {
  assert.equal(getDefaultRouteForUser({ role: "admin", active: true }), "/manager");
});

test("resuelve la ruta propia de un profesional como Leo", () => {
  assert.equal(getDefaultRouteForUser({ role: "profesional", active: true, professionalId: "leo" }), "/pos/my-agenda");
  assert.equal(resolveRouteForUser({ role: "profesional", active: true, professionalId: "leo" }, "/pos/my-sales"), "/pos/my-sales");
});

test("el detalle financiero del Dashboard permanece reservado al administrador", () => {
  assert.equal(resolveRouteForUser({ role: "profesional", active: true, professionalId: "leo" }, "/manager/dashboard/detail"), "/pos/my-agenda");
  assert.equal(resolveRouteForUser({ role: "direccion", active: true }, "/manager/dashboard/detail"), "/pos/agenda-v2");
  assert.equal(resolveRouteForUser({ role: "admin", active: true }, "/manager/dashboard/detail"), "/manager/dashboard/detail");
});

test("bloquea /manager manual y devuelve a Leo a su área", () => {
  const leo = { role: "profesional", active: true, professionalId: "leo" };
  assert.equal(resolveRouteForUser(leo, "/manager"), "/pos/my-agenda");
  assert.equal(accessDeniedMessageForRoute(leo, "/manager"), "No tienes permisos para acceder a Manager.");
  assert.equal(resolveRouteForUser(leo, "/pos/my-agenda"), "/pos/my-agenda");
  assert.equal(accessDeniedMessageForRoute(leo, "/pos/my-agenda"), "");
});

test("un usuario POS no recibe avisos de Manager en rutas permitidas", () => {
  const localUser = { role: "direccion", active: true };
  assert.equal(accessDeniedMessageForRoute(localUser, "/pos"), "");
  assert.equal(accessDeniedMessageForRoute(localUser, "/pos/agenda-v2"), "");
});

test("el administrador entra a Manager sin aviso", () => {
  const admin = { role: "admin", active: true };
  assert.equal(resolveRouteForUser(admin, "/manager"), "/manager");
  assert.equal(accessDeniedMessageForRoute(admin, "/manager"), "");
});

test("un usuario con rol desconocido no hereda permisos profesionales", () => {
  assert.equal(getDefaultRouteForUser({ role: "sin_configurar", active: true }), "/no-permissions");
});

test("un usuario deshabilitado no recibe ruta operativa", () => {
  assert.equal(getDefaultRouteForUser({ role: "profesional", active: false }), "/no-permissions");
});

test("normaliza perfiles antiguos sin perder employeeId ni permisos heredados", () => {
  const profile = normalizeUserProfile({
    id: "leo-legacy",
    email: "LEO@DOMIA.TEST",
    employeeId: "leo-real-id",
    employeeName: "Leo",
    role: "profesional",
    access: { permissions: ["agenda.own"] },
  }, { uid: "leo-auth-uid", email: "leo@domia.test" });

  assert.equal(profile.uid, "leo-auth-uid");
  assert.equal(profile.professionalId, "leo-real-id");
  assert.equal(profile.email, "leo@domia.test");
  assert.deepEqual(profile.permissions, ["agenda.own"]);
});

test("las claims server-side prevalecen sobre un rol de perfil manipulable", () => {
  const profile = normalizeUserProfile(
    { role: "admin", professionalId: "otro" },
    { uid: "leo-auth-uid", email: "leo@domia.test" },
    { role: "profesional", professionalId: "leo-real-id" },
  );
  assert.equal(profile.role, "profesional");
  assert.equal(profile.professionalId, "leo-real-id");
});
