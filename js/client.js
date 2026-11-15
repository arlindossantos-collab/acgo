import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
const $=id=>document.getElementById(id), RATE=0.75;
const money=n=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let consumptionChart,valueChart;
onAuthStateChanged(auth,async user=>{
 if(!user){location.href="index.html";return;}
 $("clientEmailDisplay").textContent=user.email||"";
 try{
  const snap=await getDoc(doc(db,"users",user.uid));
  if(!snap.exists()||snap.data().active===false){await signOut(auth);location.href="index.html";return;}
  const profile=snap.data();
  if(profile.role==="admin"){location.href="dashboard-admin.html";return;}
  $("clientStatAddresses").textContent=(profile.addresses||[]).length;
  await loadReadings(user.uid);
 }catch(e){console.error(e);alert("Não foi possível carregar seus dados. Verifique a conexão ou as regras do Firebase.");}
});
$("btnLogout").addEventListener("click",async()=>{await signOut(auth);location.href="index.html";});
async function loadReadings(uid){
 const snap=await getDocs(query(collection(db,"readings"),where("ownerUid","==",uid)));
 const rows=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.period).localeCompare(String(b.period)));
 const kwh=rows.reduce((s,r)=>s+(Number(r.kwh)||0),0);
 const economy=rows.reduce((s,r)=>{const c=Number(r.kwh)||0;return s+Math.max(0,c*1.10-(c*RATE)-(Number(r.neoFee)||0)+(Number(r.fioB)||0));},0);
 $("clientStatKwh").textContent=`${kwh.toLocaleString("pt-BR")} kWh`;$("clientStatEconomy").textContent=money(economy);
 renderTable(rows);renderCharts(rows);
}
function renderTable(rows){
 const body=$("clientReadingsTableBody");
 if(!rows.length){body.innerHTML='<tr><td colspan="8" class="p-4 text-center text-slate-400">Nenhuma fatura registrada.</td></tr>';return;}
 body.innerHTML=rows.map(r=>{const c=Number(r.kwh)||0,solar=c*RATE+(Number(r.neoFee)||0)-(Number(r.fioB)||0),economy=Math.max(0,c*1.10-solar);
 return `<tr class="border-b border-slate-100"><td class="p-4 font-semibold">${esc(r.period)}</td><td class="p-4">${esc(r.address)}</td><td class="p-4">${esc(r.initialReading)} / ${esc(r.finalReading)}</td><td class="p-4 font-bold text-emerald-600">${c.toLocaleString("pt-BR")} kWh</td><td class="p-4">${money(r.neoFee)}</td><td class="p-4">${money(r.fioB)}</td><td class="p-4 font-bold">${money(solar)}</td><td class="p-4 font-bold text-emerald-600">${money(economy)}</td></tr>`;}).join("");
}
function renderCharts(rows){
 const periods=[...new Set(rows.map(r=>r.period))],consumption=periods.map(p=>rows.filter(r=>r.period===p).reduce((s,r)=>s+(Number(r.kwh)||0),0));
 const solar=periods.map(p=>rows.filter(r=>r.period===p).reduce((s,r)=>s+(Number(r.kwh)||0)*RATE+(Number(r.neoFee)||0)-(Number(r.fioB)||0),0));
 const economy=periods.map(p=>rows.filter(r=>r.period===p).reduce((s,r)=>{const c=Number(r.kwh)||0;return s+Math.max(0,c*1.10-(c*RATE)-(Number(r.neoFee)||0)+(Number(r.fioB)||0));},0));
 const labels=periods.length?periods:["Sem dados"];
 if(consumptionChart)consumptionChart.destroy();if(valueChart)valueChart.destroy();
 consumptionChart=new Chart($("clientConsumptionChart"),{type:"bar",data:{labels,datasets:[{label:"Consumo (kWh)",data:consumption.length?consumption:[0],backgroundColor:"#16a34a",borderRadius:8}]},options:{responsive:true,maintainAspectRatio:false}});
 valueChart=new Chart($("clientValueChart"),{type:"line",data:{labels,datasets:[{label:"Valor Solar (R$)",data:solar.length?solar:[0],borderColor:"#2563eb",tension:.3},{label:"Economia (R$)",data:economy.length?economy:[0],borderColor:"#16a34a",tension:.3}]},options:{responsive:true,maintainAspectRatio:false}});
}
