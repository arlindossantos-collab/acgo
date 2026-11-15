/**
 * Configuração do Firebase Firestore - ACGO Energia Solar
 * Substitua as chaves abaixo pelos dados do seu projeto no Firebase Console.
 */
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:000000000000000000"
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