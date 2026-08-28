import { sendPasswordResetEmail } from "firebase/auth";
import { httpsCallable } from "firebase/functions";

import { auth, functions } from "../firebase.js";

const createOrLinkCallable = httpsCallable(functions, "createOrLinkProfessionalUser");
const listAccessesCallable = httpsCallable(functions, "listProfessionalUserAccesses");
const setAccessStateCallable = httpsCallable(functions, "setProfessionalUserAccessState");

function accessErrorMessage(error) {
  const code = String(error?.code || "").replace("functions/", "");
  if (code === "unauthenticated") return "Debes iniciar sesión de nuevo.";
  if (code === "permission-denied") return "No tienes permiso administrativo para gestionar accesos.";
  if (code === "already-exists") return error?.message || "El correo o el profesional ya tienen otro acceso vinculado.";
  if (code === "not-found") return error?.message || "No se encontró el profesional o usuario solicitado.";
  if (code === "invalid-argument") return error?.message || "Revisa los datos del acceso.";
  if (code === "unavailable") return "El servicio de accesos no está disponible en este momento.";
  return "No se pudo completar la gestión del acceso.";
}

async function listProfessionalAccesses() {
  try {
    const response = await listAccessesCallable({});
    return Array.isArray(response.data?.accesses) ? response.data.accesses : [];
  } catch (error) {
    throw new Error(accessErrorMessage(error));
  }
}

async function createOrLinkProfessionalAccess(input) {
  try {
    const response = await createOrLinkCallable(input);
    let invitationWarning = "";
    if (response.data?.requiresPasswordSetup) {
      try {
        await sendPasswordResetEmail(auth, response.data.access.email);
      } catch {
        invitationWarning = "El acceso se creó, pero no se pudo enviar el correo para establecer la contraseña.";
      }
    }
    return { ...response.data, invitationWarning };
  } catch (error) {
    throw new Error(accessErrorMessage(error));
  }
}

async function setProfessionalAccessActive(professionalId, active) {
  try {
    const response = await setAccessStateCallable({ professionalId, active });
    return response.data;
  } catch (error) {
    throw new Error(accessErrorMessage(error));
  }
}

export {
  createOrLinkProfessionalAccess,
  listProfessionalAccesses,
  setProfessionalAccessActive,
};
