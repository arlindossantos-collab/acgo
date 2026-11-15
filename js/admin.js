import { app, auth, db, firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut as secondarySignOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc, setDoc, addDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const TARIFF_RATE = 0.75;
let currentUser, usersCache = [], addressesCache = [], readingsCache = [], chart;
const $ = id => document.getElementById(id);
const money = n => Number(n || 0).toLocaleString("pt-BR", {style:"currency",currency:"BRL"});
const safe = value => String(value ?? "");
function showError(error, context) { console.error(context, error); alert(`${context}: ${error.message || error}`); }

onAuthStateChanged(auth, async user => {
  if (!user) { location.href = "index.html"; return; }
  currentUser = user; $("userEmailDisplay").textContent = user.email || "";
  try {
    const snap = await getDoc(doc(db,"users",user.uid));
    if (!snap.exists() || snap.data().role !== "admin" || snap.data().active === false) {
      alert("Acesso restrito a administradores."); location.href = "dashboard-client.html"; return;
    }
    await loadAllData();
  } catch (e) { showError(e,"Falha ao validar administrador"); }
});
$("btnLogout").addEventListener("click", async()=>{await signOut(auth);location.href="index.html";});

window.switchTab = name => {
  ["overview","users","readings"].forEach(key=>{
    $("section-"+key).classList.toggle("hidden",key!==name);
    const tab=$("tab-"+key); if(tab){tab.classList.toggle("text-emerald-600",key===name);tab.classList.toggle("border-b-2",key===name);tab.classList.toggle("border-emerald-600",key===name);tab.classList.toggle("text-slate-500",key!==name);}
  });
};
async function loadAllData(){
  const [uSnap,rSnap]=await Promise.all([getDocs(collection(db,"users")),getDocs(collection(db,"readings"))]);
  usersCache=uSnap.docs.map(d=>({id:d.id,...d.data()}));
  addressesCache=[];
  usersCache.forEach(u=>(Array.isArray(u.addresses)?u.addresses:[]).forEach((address,index)=>addressesCache.push({id:`${u.id}_${index}`,userId:u.id,userEmail:u.email,addressText:address})));
  readingsCache=rSnap.docs.map(d=>({id:d.id,...d.data()}));
  renderOverview();renderUsersTable();renderReadingsTable();populateAddressSelect();
}
function renderOverview(){
  $("statTotalUsers").textContent=usersCache.length;$("statTotalAddresses").textContent=addressesCache.length;
  const totalKwh=readingsCache.reduce((s,r)=>s+(Number(r.kwh)||0),0);
  const economy=readingsCache.reduce((s,r)=>{const k=Number(r.kwh)||0;return s+Math.max(0,k*1.10-(k*TARIFF_RATE)-(Number(r.neoFee)||0)+(Number(r.fioB)||0));},0);
  $("statTotalKwh").textContent=`${totalKwh.toLocaleString("pt-BR")} kWh`;$("statTotalEconomy").textContent=money(economy);
  const periods=[...new Set(readingsCache.map(r=>r.period).filter(Boolean))];
  const data=periods.map(p=>readingsCache.filter(r=>r.period===p).reduce((s,r)=>s+(Number(r.kwh)||0),0));
  if(chart)chart.destroy();
  if(window.Chart && $("adminOverviewChart")) chart=new Chart($("adminOverviewChart"),{type:"bar",data:{labels:periods.length?periods:["Sem dados"],datasets:[{label:"Consumo (kWh)",data:data.length?data:[0],backgroundColor:"#16a34a",borderRadius:8}]},options:{responsive:true,maintainAspectRatio:false}});
}
function renderUsersTable(){
  const body=$("usersTableBody");body.replaceChildren();
  if(!usersCache.length){body.innerHTML='<tr><td colspan="4" class="p-4 text-center text-slate-400">Nenhum usuário cadastrado.</td></tr>';return;}
  usersCache.forEach(u=>{
    const tr=document.createElement("tr");tr.className="border-b border-slate-100";
    [u.email,u.role==="admin"?"ADMIN":"USUÁRIO COMUM",(u.addresses||[]).join(" • ")||"Nenhum endereço"].forEach(v=>{const td=document.createElement("td");td.className="p-4";td.textContent=safe(v);tr.appendChild(td);});
    const action=document.createElement("td");action.className="p-4 text-right";
    if(u.id!==currentUser.uid){const btn=document.createElement("button");btn.className="text-red-600 hover:underline";btn.textContent=u.active===false?"Reativar":"Desativar";btn.addEventListener("click",()=>toggleUser(u));action.appendChild(btn);} else action.textContent="Sessão atual";
    tr.appendChild(action);body.appendChild(tr);
  });
}
async function toggleUser(user){
  const active=user.active===false;
  if(!confirm(`${active?"Reativar":"Desativar"} o acesso de ${user.email}?`))return;
  try{await setDoc(doc(db,"users",user.id),{active,updatedAt:serverTimestamp()},{merge:true});await loadAllData();}
  catch(e){showError(e,"Não foi possível atualizar usuário");}
}
function renderReadingsTable(){
  const body=$("readingsTableBody");body.replaceChildren();
  if(!readingsCache.length){body.innerHTML='<tr><td colspan="7" class="p-4 text-center text-slate-400">Nenhuma leitura lançada.</td></tr>';return;}
  readingsCache.forEach(r=>{
    const total=(Number(r.kwh)||0)*TARIFF_RATE+(Number(r.neoFee)||0)-(Number(r.fioB)||0);
    const tr=document.createElement("tr");tr.className="border-b border-slate-100";
    [r.period,`${r.userEmail||""} — ${r.address||""}`,`${r.initialReading} / ${r.finalReading}`,`${r.kwh} kWh`,money(r.neoFee),`- ${money(r.fioB)}`,money(total)].forEach(v=>{const td=document.createElement("td");td.className="p-4";td.textContent=safe(v);tr.appendChild(td);});
    body.appendChild(tr);
  });
}
function populateAddressSelect(){
  const select=$("readAddressSelect");select.replaceChildren();
  addressesCache.forEach(a=>{const option=document.createElement("option");option.value=JSON.stringify({ownerUid:a.userId,userEmail:a.userEmail,address:a.addressText});option.textContent=`${a.userEmail} — ${a.addressText}`;select.appendChild(option);});
}
window.openUserModal=()=>{$("userModal").classList.remove("hidden");$("userModal").classList.add("flex");$("userForm").reset();$("addressContainer").replaceChildren();window.addAddressField();};
window.closeUserModal=()=>{$("userModal").classList.add("hidden");$("userModal").classList.remove("flex");};
window.addAddressField=(value="")=>{const wrap=document.createElement("div");wrap.className="flex gap-2";const input=document.createElement("input");input.className="addr-input flex-1 px-3 py-2 text-sm border rounded-lg";input.placeholder="Endereço do cliente";input.value=value;input.maxLength=250;const remove=document.createElement("button");remove.type="button";remove.className="text-red-500 px-2";remove.textContent="Remover";remove.onclick=()=>wrap.remove();wrap.append(input,remove);$("addressContainer").appendChild(wrap);};
$("userForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const email=$("modalUserEmail").value.trim().toLowerCase(),password=$("modalUserPass").value,role=$("modalUserRole").value;
  const addresses=[...document.querySelectorAll(".addr-input")].map(x=>x.value.trim()).filter(Boolean);
  if(password.length<6){alert("A senha inicial deve ter pelo menos 6 caracteres.");return;}
  const submit=e.submitter; if(submit)submit.disabled=true;
  let secondaryApp;
  try{
    // Auth secundário cria a conta sem encerrar a sessão do administrador.
    secondaryApp=initializeApp(firebaseConfig,`acgo-user-${Date.now()}`);
    const secondaryAuth=getAuth(secondaryApp);
    const credential=await createUserWithEmailAndPassword(secondaryAuth,email,password);
    await setDoc(doc(db,"users",credential.user.uid),{uid:credential.user.uid,email,role,addresses,active:true,createdAt:serverTimestamp(),createdBy:currentUser.uid});
    await secondarySignOut(secondaryAuth);
    window.closeUserModal();await loadAllData();alert("Usuário criado no Firebase Authentication e registrado no Firestore.");
  }catch(err){showError(err,"Erro ao criar usuário");}
  finally{if(secondaryApp){try{const {deleteApp}=await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");await deleteApp(secondaryApp);}catch(_){}}if(submit)submit.disabled=false;}
});
window.openReadingModal=()=>{$("readingModal").classList.remove("hidden");$("readingModal").classList.add("flex");};
window.closeReadingModal=()=>{$("readingModal").classList.add("hidden");$("readingModal").classList.remove("flex");};
function calculatePreview(){
 const ini=Number($("readInitial").value)||0,fin=Number($("readFinal").value)||0,neo=Number($("readNeoFee").value)||0,fio=Number($("readFioB").value)||0,kwh=fin-ini,total=kwh*TARIFF_RATE+neo-fio;
 $("previewTotalCalc").textContent=`Total: ${money(total)} (${Math.max(0,kwh)} kWh)`;
}
["readInitial","readFinal","readNeoFee","readFioB"].forEach(id=>$(id).addEventListener("input",calculatePreview));
$("readingForm").addEventListener("submit",async e=>{
 e.preventDefault();
 try{
  if(!$("readAddressSelect").value)throw new Error("Cadastre um usuário com endereço antes de lançar a leitura.");
  const selected=JSON.parse($("readAddressSelect").value),initialReading=Number($("readInitial").value),finalReading=Number($("readFinal").value);
  if(finalReading<initialReading)throw new Error("A leitura final não pode ser menor que a inicial.");
  const kwh=finalReading-initialReading,neoFee=Number($("readNeoFee").value)||0,fioB=Number($("readFioB").value)||0;
  await addDoc(collection(db,"readings"),{period:$("readPeriod").value.trim(),...selected,initialReading,finalReading,kwh,neoFee,fioB,createdAt:serverTimestamp(),createdBy:currentUser.uid});
  window.closeReadingModal();$("readingForm").reset();await loadAllData();alert("Leitura registrada.");
 }catch(err){showError(err,"Erro ao lançar leitura");}
});
