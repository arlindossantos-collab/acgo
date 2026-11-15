import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const form = document.getElementById("loginForm");
const alertBox = document.getElementById("alertBox");
function showAlert(message) {
  alertBox.textContent = message;
  alertBox.className = "mb-4 p-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200";
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.getElementById("loginBtn");
  button.disabled = true; button.textContent = "Verificando acesso...";
  try {
    const credential = await signInWithEmailAndPassword(auth,
      document.getElementById("email").value.trim(),
      document.getElementById("password").value);
    const profile = await getDoc(doc(db, "users", credential.user.uid));
    if (!profile.exists() || profile.data().active === false) {
      await signOut(auth);
      throw new Error("Perfil não cadastrado ou desativado. Procure o administrador.");
    }
    location.href = profile.data().role === "admin" ? "dashboard-admin.html" : "dashboard-client.html";
  } catch (error) {
    showAlert(error.code === "auth/invalid-credential" ? "E-mail ou senha inválidos." : error.message || "Não foi possível entrar.");
    button.disabled = false; button.innerHTML = '<i class="fa-solid fa-right-to-bracket mr-2"></i>Entrar';
  }
});
