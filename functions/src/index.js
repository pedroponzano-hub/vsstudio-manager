import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  ProfessionalAccessError,
  createOrLinkProfessionalUserCore,
  isAuthorizedAdminProfile,
  normalizeAccessEmail,
  normalizeAccessRole,
  permissionsForRole,
  setProfessionalUserAccessStateCore,
} from "./professionalAccessCore.js";

if (getApps().length === 0) initializeApp();

const auth = getAuth();
const firestore = getFirestore();
const REGION = "europe-west1";

function profileData(snapshot) {
  return snapshot?.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function findProfileByUid(uid) {
  return profileData(await firestore.doc(`users/${uid}`).get());
}

async function firstProfileForQuery(field, value) {
  if (!value) return null;
  const snapshot = await firestore.collection("users").where(field, "==", value).limit(1).get();
  return snapshot.empty ? null : profileData(snapshot.docs[0]);
}

async function findProfileByEmail(email) {
  return firstProfileForQuery("email", normalizeAccessEmail(email));
}

async function findProfileByProfessionalId(professionalId) {
  const profile = await firstProfileForQuery("professionalId", professionalId);
  if (!profile || profile.uid || !profile.email) return profile;
  const authUser = await findAuthUserByEmail(normalizeAccessEmail(profile.email));
  return authUser ? { ...profile, uid: authUser.uid } : profile;
}

async function findCallerProfile(request) {
  const uid = request.auth?.uid;
  const email = normalizeAccessEmail(request.auth?.token?.email);
  return uid
    ? await findProfileByUid(uid)
      || await firstProfileForQuery("uid", uid)
      || await findProfileByEmail(email)
    : null;
}

async function requireAuthorizedAdmin(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  const profile = await findCallerProfile(request);
  if (!isAuthorizedAdminProfile(profile || {}, request.auth.token || {})) {
    throw new HttpsError("permission-denied", "No tienes permiso administrativo para gestionar accesos.");
  }
  return { uid: request.auth.uid, email: normalizeAccessEmail(request.auth.token?.email) };
}

async function getProfessional(professionalId) {
  const snapshot = await firestore.doc("config/main").get();
  const employeeSettings = snapshot.exists && Array.isArray(snapshot.data()?.employeeSettings)
    ? snapshot.data().employeeSettings
    : [];
  return employeeSettings.find((professional) => String(professional.id || "") === professionalId) || null;
}

async function findAuthUserByEmail(email) {
  try {
    return await auth.getUserByEmail(email);
  } catch (error) {
    if (error?.code === "auth/user-not-found") return null;
    throw error;
  }
}

const adapters = {
  getProfessional,
  findAuthUserByEmail,
  createAuthUser: async ({ email, displayName }) => {
    try {
      return { user: await auth.createUser({ email, displayName, disabled: false }), created: true };
    } catch (error) {
      if (error?.code !== "auth/email-already-exists") throw error;
      return { user: await auth.getUserByEmail(email), created: false };
    }
  },
  findProfileByUid,
  findProfileByEmail,
  findProfileByProfessionalId,
  setAuthDisabled: (uid, disabled) => auth.updateUser(uid, { disabled }),
  setAuthClaims: async (uid, claims) => {
    const authUser = await auth.getUser(uid);
    await auth.setCustomUserClaims(uid, { ...(authUser.customClaims || {}), ...claims });
  },
  saveUserProfile: (uid, profile) => firestore.doc(`users/${uid}`).set(profile, { merge: true }),
};

function safeCallableError(error) {
  if (error instanceof HttpsError) return error;
  if (error instanceof ProfessionalAccessError) return new HttpsError(error.code, error.message);
  console.error("Professional access operation failed", error);
  return new HttpsError("internal", "No se pudo completar la operación de acceso.");
}

export const createOrLinkProfessionalUser = onCall({ region: REGION }, async (request) => {
  try {
    const actor = await requireAuthorizedAdmin(request);
    return await createOrLinkProfessionalUserCore({ input: request.data, actor, adapters });
  } catch (error) {
    throw safeCallableError(error);
  }
});

export const setProfessionalUserAccessState = onCall({ region: REGION }, async (request) => {
  try {
    const actor = await requireAuthorizedAdmin(request);
    return await setProfessionalUserAccessStateCore({ input: request.data, actor, adapters });
  } catch (error) {
    throw safeCallableError(error);
  }
});

export const listProfessionalUserAccesses = onCall({ region: REGION }, async (request) => {
  try {
    await requireAuthorizedAdmin(request);
    const snapshot = await firestore.collection("users").get();
    const profiles = snapshot.docs
      .map(profileData)
      .filter((profile) => String(profile.professionalId || "").trim());
    const uniqueProfiles = [...new Map(profiles.map((profile) => [profile.uid || profile.id, profile])).values()];
    const accesses = await Promise.all(uniqueProfiles.map(async (profile) => {
      let authUser = null;
      try {
        authUser = profile.uid
          ? await auth.getUser(profile.uid)
          : await auth.getUserByEmail(normalizeAccessEmail(profile.email));
      } catch (error) {
        if (error?.code !== "auth/user-not-found") throw error;
      }
      const active = profile.active !== false && authUser?.disabled !== true;
      const pending = active && authUser && !authUser.metadata?.lastSignInTime;
      return {
        uid: authUser?.uid || profile.uid || profile.id,
        email: normalizeAccessEmail(profile.email || authUser?.email),
        role: normalizeAccessRole(profile.role),
        professionalId: profile.professionalId,
        permissions: Array.isArray(profile.permissions) ? profile.permissions : permissionsForRole(profile.role),
        active,
        status: !authUser ? "error" : !active ? "disabled" : pending ? "pending" : "active",
      };
    }));
    return { accesses };
  } catch (error) {
    throw safeCallableError(error);
  }
});
