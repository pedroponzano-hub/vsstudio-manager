import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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
const db = getFirestore(app);

export { app, db };
