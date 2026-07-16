import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCe_fBo7M-2kROpNPpMfnI6qbZPXfHj8dE",
  authDomain: "startone-d8aee.firebaseapp.com",
  projectId: "startone-d8aee",
  storageBucket: "startone-d8aee.firebasestorage.app",
  messagingSenderId: "656485405720",
  appId: "1:656485405720:web:8c6473209c12103c43df6d",
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth(app);

console.log("Firebase App:", app);
console.log("API KEY:", firebaseConfig.apiKey);

export { db, auth };