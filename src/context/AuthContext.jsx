import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { normalizeProfileEmail, normalizeUserProfile } from "../utils/userProfile.js";

const AuthContext = createContext(null);

function normalizeEmail(email = "") {
  return normalizeProfileEmail(email);
}

async function findUserProfile(firebaseUser) {
  const email = normalizeEmail(firebaseUser.email);
  const localPart = email.split("@")[0];
  const candidateIds = [firebaseUser.uid, localPart].filter(Boolean);

  for (const id of candidateIds) {
    const snapshot = await getDoc(doc(db, "users", id));
    if (snapshot.exists()) return { id: snapshot.id, ...snapshot.data() };
  }

  const exactEmailQuery = query(collection(db, "users"), where("email", "==", email), limit(1));
  const exactEmailSnapshot = await getDocs(exactEmailQuery);
  if (!exactEmailSnapshot.empty) {
    const profileDoc = exactEmailSnapshot.docs[0];
    return { id: profileDoc.id, ...profileDoc.data() };
  }

  const authEmailQuery = query(collection(db, "users"), where("email", "==", firebaseUser.email), limit(1));
  const authEmailSnapshot = await getDocs(authEmailQuery);
  if (!authEmailSnapshot.empty) {
    const profileDoc = authEmailSnapshot.docs[0];
    return { id: profileDoc.id, ...profileDoc.data() };
  }

  return null;
}

function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      if (!firebaseUser) {
        setAuthUser(null);
        setLoading(false);
        return;
      }

      try {
        const profile = await findUserProfile(firebaseUser);
        if (!profile) {
          setAuthUser(null);
          setAuthError("Usuario sin permisos configurados.");
          await signOut(auth);
          return;
        }

        const tokenResult = await firebaseUser.getIdTokenResult();
        const normalizedProfile = normalizeUserProfile(profile, firebaseUser, tokenResult.claims || {});
        if (!normalizedProfile.active) {
          setAuthUser(null);
          setAuthError("Usuario inactivo. Contacta con direccion.");
          await signOut(auth);
          return;
        }

        setAuthError("");
        setAuthUser(normalizedProfile);
      } catch (error) {
        console.warn("Auth profile load failed", error);
        setAuthUser(null);
        setAuthError("No se pudo cargar el perfil de usuario.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    setAuthError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.warn("Login failed", error);
      setAuthError("Email o contrasena incorrectos.");
      throw error;
    }
  };

  const logout = () => signOut(auth);

  const value = useMemo(() => ({
    user: authUser,
    loading,
    authError,
    login,
    logout,
  }), [authUser, loading, authError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export { AuthProvider, useAuth };
