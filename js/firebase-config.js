// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Credenciais reais configuradas para o projeto ACGO Energia Solar
export const firebaseConfig = {
    apiKey: "AIzaSyAo6SGtUGfadJiqx-GGJLXs7p51tkzv_dw",
    authDomain: "acgo-energia-solar.firebaseapp.com",
    projectId: "acgo-energia-solar",
    storageBucket: "acgo-energia-solar.firebasestorage.app",
    messagingSenderId: "1079975869742",
    appId: "1:1079975869742:web:294d17e4c676c2bb700ebf"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
