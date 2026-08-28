import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyBhz_dnEJwK77bSdvoVF06nlGIbMiuOOnI",
  authDomain: "mini-erp-22686.firebaseapp.com",
  projectId: "mini-erp-22686",
  storageBucket: "mini-erp-22686.firebasestorage.app",
  messagingSenderId: "489573697037",
  appId: "1:489573697037:web:4a2faf59a9aed40765b744",
  measurementId: "G-9QPV08MKJT",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "europe-west1");

if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_FUNCTIONS_EMULATOR === "true") {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

export { app, auth, db, functions };
