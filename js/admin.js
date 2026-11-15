import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, setDoc, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUser = null;
let usersCache = [];
let addressesCache = [];
let readingsCache = [];
let overviewChartInstance = null;

const TARIFF_RATE = 0.75; // R$ 0,75 por kWh

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    currentUser = user;
    document.getElementById("userEmailDisplay").textContent = user.email;

    const userSnap = await getDoc(doc(db, "users", user.uid));
    let role = "client";
    if (userSnap.exists()) {
        role = userSnap.data().role || "client";
    } else {
        const altRef = doc(db, "users", user.email.replace(/[^a-zA-Z0-9]/g, "_"));
        const altSnap = await getDoc(altRef);
        if (altSnap.exists()) role = altSnap.data().role || "client";
    }

    if (role !== "admin") {
        alert("Acesso negado. Apenas administradores.");
        window.location.href = "dashboard-client.html";
        return;
    }

    await loadAllData();
});

document.getElementById("btnLogout").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
});

window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('text-blue-900', 'border-b-2', 'border-blue-900');
        btn.classList.add('text-slate-500');
    });
    document.getElementById(`tab-${tabName}`).classList.add('text-blue-900', 'border-b-2', 'border-blue-900');
    document.getElementById(`tab-${tabName}`).classList.remove('text-slate-500');

    ['overview', 'users', 'readings'].forEach(sec => {
        document.getElementById(`section-${sec}`).classList.add('hidden');
    });
    document.getElementById(`section-${tabName}`).classList.remove('hidden');
}

async function loadAllData() {
    const usersSnap = await getDocs(collection(db, "users"));
    usersCache = [];
    addressesCache = [];
    usersSnap.forEach(d => {
        const data = d.data();
        usersCache.push({ id: d.id, ...data });
        if (data.addresses && Array.isArray(data.addresses)) {
            data.addresses.forEach((addr, idx) => {
                addressesCache.push({
                    id: `${d.id}_addr_${idx}`,
                    userId: d.id,
                    userEmail: data.email,
                    addressText: addr
                });
            });
        }
    });

    const readingsSnap = await getDocs(collection(db, "readings"));
    readingsCache = [];
    readingsSnap.forEach(d => {
        readingsCache.push({ id: d.id, ...d.data() });
    });

    renderOverview();
    renderUsersTable();
    renderReadingsTable();
    populateAddressSelect();
}

function renderOverview() {
    document.getElementById("statTotalUsers").textContent = usersCache.length;
    document.getElementById("statTotalAddresses").textContent = addressesCache.length;

    let totalKwh = 0;
    let totalEconomy = 0;

    readingsCache.forEach(r => {
        const kwh = Number(r.kwh) || 0;
        totalKwh += kwh;
        const neoCost = kwh * 1.10;
        const solarCost = (kwh * TARIFF_RATE) + (Number(r.neoFee) || 0) - (Number(r.fioB) || 0);
        totalEconomy += Math.max(0, neoCost - solarCost);
    });

    document.getElementById("statTotalKwh").textContent = `${totalKwh.toLocaleString()} kWh`;
    document.getElementById("statTotalEconomy").textContent = `R$ ${totalEconomy.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const periods = [...new Set(readingsCache.map(r => r.period))];
    const kwhPerPeriod = periods.map(p => {
        return readingsCache.filter(r => r.period === p).reduce((sum, r) => sum + (Number(r.kwh) || 0), 0);
    });

    const ctx = document.getElementById("adminOverviewChart").getContext("2d");
    if (overviewChartInstance) overviewChartInstance.destroy();

    overviewChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: periods.length ? periods : ['Sem dados'],
            datasets: [{
                label: 'Consumo Geral da Usina (kWh)',
                data: kwhPerPeriod.length ? kwhPerPeriod : [0],
                backgroundColor: '#0B2545',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

function renderUsersTable() {
    const tbody = document.getElementById("usersTableBody");
    tbody.innerHTML = "";
    if (usersCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Nenhum usuário cadastrado.</td></tr>`;
        return;
    }

    usersCache.forEach(u => {
        const addrs = u.addresses ? u.addresses.join('<br>') : '<span class="text-slate-400">Nenhum endereço</span>';
        tbody.innerHTML += `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="p-4 font-medium text-slate-800">${u.email}</td>
                <td class="p-4"><span class="px-2 py-1 rounded text-xs font-semibold ${u.role === 'admin' ? 'bg-blue-100 text-blue-900' : 'bg-emerald-100 text-emerald-800'}">${u.role.toUpperCase()}</span></td>
                <td class="p-4 text-xs text-slate-600">${addrs}</td>
                <td class="p-4 text-right">
                    <button onclick="deleteUserDoc('${u.id}')" class="text-slate-500 hover:text-red-600"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function renderReadingsTable() {
    const tbody = document.getElementById("readingsTableBody");
    tbody.innerHTML = "";
    if (readingsCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Nenhuma leitura lançada.</td></tr>`;
        return;
    }

    readingsCache.forEach(r => {
        const total = (r.kwh * TARIFF_RATE) + (Number(r.neoFee) || 0) - (Number(r.fioB) || 0);
        tbody.innerHTML += `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="p-4 font-semibold text-slate-800">${r.period}</td>
                <td class="p-4 text-xs"><strong>${r.userEmail}</strong><br><span class="text-slate-500">${r.address}</span></td>
                <td class="p-4">${r.initialReading} / ${r.finalReading}</td>
                <td class="p-4 font-bold text-emerald-600">${r.kwh} kWh</td>
                <td class="p-4">R$ ${Number(r.neoFee || 0).toFixed(2)}</td>
                <td class="p-4 text-red-600">- R$ ${Number(r.fioB || 0).toFixed(2)}</td>
                <td class="p-4 font-bold text-slate-800">R$ ${total.toFixed(2)}</td>
            </tr>
        `;
    });
}

function populateAddressSelect() {
    const sel = document.getElementById("readAddressSelect");
    sel.innerHTML = "";
    addressesCache.forEach(a => {
        sel.innerHTML += `<option value="${a.userEmail}|${a.addressText}">${a.userEmail} - ${a.addressText}</option>`;
    });
}

window.openUserModal = function() {
    document.getElementById("userModal").classList.remove("hidden");
    document.getElementById("userModal").classList.add("flex");
    document.getElementById("addressContainer").innerHTML = '';
    addAddressField();
}

window.closeUserModal = function() {
    document.getElementById("userModal").classList.add("hidden");
    document.getElementById("userModal").classList.remove("flex");
}

window.addAddressField = function(val = "") {
    const container = document.getElementById("addressContainer");
    const div = document.createElement("div");
    div.className = "flex gap-2";
    div.innerHTML = `
        <input type="text" value="${val}" placeholder="Ex: Rua das Flores, 123" class="addr-input flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600" required>
        <button type="button" onclick="this.parentElement.remove()" class="text-red-500 px-2 hover:bg-red-50 rounded"><i class="fa-solid fa-trash"></i></button>
    `;
    container.appendChild(div);
}

document.getElementById("userForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("modalUserEmail").value.trim();
    const role = document.getElementById("modalUserRole").value;
    const addrInputs = document.querySelectorAll(".addr-input");
    const addresses = Array.from(addrInputs).map(i => i.value.trim()).filter(v => v !== "");

    try {
        const docRef = doc(db, "users", email.replace(/[^a-zA-Z0-9]/g, "_"));
        await setDoc(docRef, { email, role, addresses }, { merge: true });
        closeUserModal();
        await loadAllData();
        alert("Usuário e endereços salvos com sucesso!");
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar usuário: " + err.message);
    }
});

window.deleteUserDoc = async function(docId) {
    if (confirm("Tem certeza que deseja excluir este usuário?")) {
        await deleteDoc(doc(db, "users", docId));
        await loadAllData();
    }
}

window.openReadingModal = function() {
    document.getElementById("readingModal").classList.remove("hidden");
    document.getElementById("readingModal").classList.add("flex");
}

window.closeReadingModal = function() {
    document.getElementById("readingModal").classList.add("hidden");
    document.getElementById("readingModal").classList.remove("flex");
}

function calculateReadingPreview() {
    const ini = parseFloat(document.getElementById("readInitial").value) || 0;
    const fin = parseFloat(document.getElementById("readFinal").value) || 0;
    const neoFee = parseFloat(document.getElementById("readNeoFee").value) || 0;
    const fioB = parseFloat(document.getElementById("readFioB").value) || 0;
    const kwh = Math.max(0, fin - ini);
    const total = (kwh * TARIFF_RATE) + neoFee - fioB;
    document.getElementById("previewTotalCalc").textContent = `Total: R$ ${total.toFixed(2)} (${kwh} kWh)`;
}

['readInitial', 'readFinal', 'readNeoFee', 'readFioB'].forEach(id => {
    document.getElementById(id).addEventListener("input", calculateReadingPreview);
});

document.getElementById("readingForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const period = document.getElementById("readPeriod").value.trim();
    const addrVal = document.getElementById("readAddressSelect").value;
    const [userEmail, address] = addrVal.split("|");
    const initialReading = parseFloat(document.getElementById("readInitial").value);
    const finalReading = parseFloat(document.getElementById("readFinal").value);
    const neoFee = parseFloat(document.getElementById("readNeoFee").value) || 0;
    const fioB = parseFloat(document.getElementById("readFioB").value) || 0;
    const kwh = Math.max(0, finalReading - initialReading);

    try {
        await addDoc(collection(db, "readings"), {
            period,
            userEmail,
            address,
            initialReading,
            finalReading,
            kwh,
            neoFee,
            fioB,
            timestamp: new Date()
        });
        closeReadingModal();
        await loadAllData();
        alert("Leitura e fatura lançadas com sucesso!");
    } catch (err) {
        console.error(err);
        alert("Erro ao lançar fatura: " + err.message);
    }
});
