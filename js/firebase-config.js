/**
 * Configuração do Firebase Firestore - ACGO Energia Solar
 * Substitua as chaves abaixo pelos dados do seu projeto no Firebase Console.
 */
const firebaseConfig = {
  apiKey: "AIzaSyAoYLm4FdxUpb3domYsyolV3JJ0h1eikNs",
  authDomain: "acgo-energia-solar-280f1.firebaseapp.com",
  projectId: "acgo-energia-solar-280f1",
  storageBucket: "acgo-energia-solar-280f1.firebasestorage.app",
  messagingSenderId: "605659505490",
  appId: "1:605659505490:web:cdd20be8c7346deee1108b"
};

let db = null;
let isFirebaseConnected = false;

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "SUA_API_KEY_AQUI") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    isFirebaseConnected = true;
    console.log("Firebase Firestore conectado com sucesso.");
  } else {
    console.warn("Credenciais do Firebase não configuradas. Operando em modo LocalStorage.");
  }
} catch (error) {
  console.error("Erro ao inicializar Firebase:", error);
}