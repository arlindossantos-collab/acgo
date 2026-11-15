import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUser = null;
let userData = null;
let consumptionChartInstance = null;
let valueChartInstance = null;

const TARIFF_RATE = 0.75; // R$ 0,75 por kWh

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    currentUser = user;
    document.getElementById("clientEmailDisplay").textContent = user.email;

    const userDocRef = doc(db, "users", user.uid);
    let userSnap = await getDoc(userDocRef);
    
    if (!userSnap.exists()) {
        const altRef = doc(db, "users", user.email.replace(/[^a-zA-Z0-9]/g, "_"));
        userSnap = await getDoc(altRef);
    }

    if (userSnap.exists()) {
        userData = userSnap.data();
    } else {
        userData = { email: user.email, addresses: [] };
    }

    await loadClientData(user.email);
});

document.getElementById("btnLogout").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
});

async function loadClientData(email) {
    const q = query(collection(db, "readings"), where("userEmail", "==", email));
    const querySnapshot = await getDocs(q);
    const readings = [];
    querySnapshot.forEach(d => {
        readings.push({ id: d.id, ...d.data() });
    });

    const addresses = userData.addresses || [];
    document.getElementById("clientStatAddresses").textContent = addresses.length;

    let totalKwh = 0;
    let totalEconomy = 0;

    readings.forEach(r => {
        const kwh = Number(r.kwh) || 0;
        totalKwh += kwh;
        const neoCost = kwh * 1.10;
        const solarCost = (kwh * TARIFF_RATE) + (Number(r.neoFee) || 0) - (Number(r.fioB) || 0);
        totalEconomy += Math.max(0, neoCost - solarCost);
    });

    document.getElementById("clientStatKwh").textContent = `${totalKwh.toLocaleString()} kWh`;
    document.getElementById("clientStatEconomy").textContent = `R$ ${totalEconomy.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    renderClientTable(readings);
    renderClientCharts(readings);
}

function renderClientTable(readings) {
    const tbody = document.getElementById("clientReadingsTableBody");
    tbody.innerHTML = "";
    if (readings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-400">Nenhuma fatura registrada para os seus endereços.</td></tr>`;
        return;
    }

    readings.forEach(r => {
        const kwh = Number(r.kwh) || 0;
        const solarTotal = (kwh * TARIFF_RATE) + (Number(r.neoFee) || 0) - (Number(r.fioB) || 0);
        const neoCost = kwh * 1.10;
        const economy = Math.max(0, neoCost - solarTotal);

        tbody.innerHTML += `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="p-4 font-semibold text-slate-800">${r.period}</td>
                <td class="p-4 text-xs text-slate-600">${r.address}</td>
                <td class="p-4">${r.initialReading} / ${r.finalReading}</td>
                <td class="p-4 font-bold text-emerald-600">${kwh} kWh</td>
                <td class="p-4">R$ ${Number(r.neoFee || 0).toFixed(2)}</td>
                <td class="p-4 text-red-600">- R$ ${Number(r.fioB || 0).toFixed(2)}</td>
                <td class="p-4 font-bold text-slate-800">R$ ${solarTotal.toFixed(2)}</td>
                <td class="p-4 font-bold text-emerald-600">+ R$ ${economy.toFixed(2)}</td>
            </tr>
        `;
    });
}

function renderClientCharts(readings) {
    const periods = [...new Set(readings.map(r => r.period))];
    const kwhData = periods.map(p => readings.filter(r => r.period === p).reduce((sum, r) => sum + (Number(r.kwh) || 0), 0));
    const valueData = periods.map(p => readings.filter(r => r.period === p).reduce((sum, r) => {
        const kwh = Number(r.kwh) || 0;
        return sum + ((kwh * TARIFF_RATE) + (Number(r.neoFee) || 0) - (Number(r.fioB) || 0));
    }, 0));

    const economyData = periods.map(p => readings.filter(r => r.period === p).reduce((sum, r) => {
        const kwh = Number(r.kwh) || 0;
        const solar = (kwh * TARIFF_RATE) + (Number(r.neoFee) || 0) - (Number(r.fioB) || 0);
        const neo = kwh * 1.10;
        return sum + Math.max(0, neo - solar);
    }, 0));

    const ctxConsumption = document.getElementById("clientConsumptionChart").getContext("2d");
    if (consumptionChartInstance) consumptionChartInstance.destroy();

    consumptionChartInstance = new Chart(ctxConsumption, {
        type: 'bar',
        data: {
            labels: periods.length ? periods : ['Sem dados'],
            datasets: [{
                label: 'Consumo (kWh)',
                data: kwhData.length ? kwhData : [0],
                backgroundColor: '#10b981',
                borderRadius: 8
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const ctxValue = document.getElementById("clientValueChart").getContext("2d");
    if (valueChartInstance) valueChartInstance.destroy();

    valueChartInstance = new Chart(ctxValue, {
        type: 'line',
        data: {
            labels: periods.length ? periods : ['Sem dados'],
            datasets: [
                {
                    label: 'Valor Solar (R$)',
                    data: valueData.length ? valueData : [0],
                    borderColor: '#0B2545',
                    backgroundColor: 'rgba(11, 37, 69, 0.1)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Economia Gerada (R$)',
                    data: economyData.length ? economyData : [0],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.3
                }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}
