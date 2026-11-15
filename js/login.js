import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loginForm = document.getElementById("loginForm");
const alertBox = document.getElementById("alertBox");

function showAlert(msg, type = "error") {
    alertBox.className = `mb-4 p-3 rounded-lg text-sm ${type === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`;
    alertBox.textContent = msg;
    alertBox.classList.remove("hidden");
}

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const user = userCred.user;

        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        let role = "client";
        if (userSnap.exists()) {
            role = userSnap.data().role || "client";
        } else {
            await setDoc(userDocRef, { email: user.email, role: "client", addresses: [] }, { merge: true });
        }

        if (role === "admin") {
            window.location.href = "dashboard-admin.html";
        } else {
            window.location.href = "dashboard-client.html";
        }
    } catch (error) {
        console.error(error);
        showAlert("Erro ao entrar: " + error.message);
    }
});
