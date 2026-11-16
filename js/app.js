const ACGO_TARIFF = 0.75; // R$ 0,75 por kWh

const MONTH_ABBR = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

// Paleta de cores distintas para diferenciar cada endereço nos gráficos e tags
const ADDRESS_PALETTE = [
  { hex: '#2E7D32', bgSoft: '#ECFDF5', border: '#A7F3D0', text: '#047857' }, // Verde Esmeralda
  { hex: '#1E88E5', bgSoft: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' }, // Azul Solar
  { hex: '#D97706', bgSoft: '#FFFBEB', border: '#FDE68A', text: '#B45309' }, // Dourado Âmbar
  { hex: '#7C3AED', bgSoft: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9' }, // Violeta
  { hex: '#0D9488', bgSoft: '#F0FDFA', border: '#99F6E4', text: '#0F766E' }, // Turquesa
  { hex: '#E11D48', bgSoft: '#FFF1F2', border: '#FECDD3', text: '#BE123C' }, // Carmesim
  { hex: '#EA580C', bgSoft: '#FFF7ED', border: '#FED7AA', text: '#C2410C' }, // Laranja
  { hex: '#0284C7', bgSoft: '#F0F9FF', border: '#BAE6FD', text: '#0369A1' }  // Ciano
];

const app = {
  state: {
    users: [],
    addresses: [],
    invoices: [],
    activeSessionUserId: null,
    currentView: 'dashboard',
    charts: { consumption: null, financial: null }
  },

  async init() {
    this.updateDbBadge();
    try {
      await this.loadAllData();
      await this.seedInitialDataIfEmpty();
    } catch (err) {
      console.error('Erro na carga inicial:', err);
    }

    const savedUserId = sessionStorage.getItem('acgo_logged_user_id');
    const validUser = this.state.users.find(u => u.id === savedUserId);
    if (validUser) {
      this.enterApp(validUser.id);
    } else {
      this.showLoginScreen();
    }
  },

  updateDbBadge() {
    const badge = document.getElementById('dbStatusBadge');
    const loginBadge = document.getElementById('loginDbBadge');
    if (isFirebaseConnected) {
      if (badge) {
        badge.className = 'hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800';
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span> Firebase Conectado';
      }
      if (loginBadge) {
        loginBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800';
        loginBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span> Banco Firebase Conectado';
      }
    } else {
      if (badge) {
        badge.className = 'hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800';
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-500"></span> Modo Local (Configure Firebase)';
      }
      if (loginBadge) {
        loginBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800';
        loginBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-500"></span> Modo Local Ativo';
      }
    }
  },

  // --- CORES E FORMATAÇÃO DE MÊS ---
  getAddressColor(addressId) {
    if (!addressId || addressId === 'all') {
      return { hex: '#0A2558', bgSoft: '#EFF6FF', border: '#BFDBFE', text: '#0A2558' };
    }
    const idx = this.state.addresses.findIndex(a => a.id === addressId);
    const safeIdx = idx >= 0 ? idx : 0;
    return ADDRESS_PALETTE[safeIdx % ADDRESS_PALETTE.length];
  },

  formatMonthYear(dateStr) {
    const parts = (dateStr || '').split('/');
    if (parts.length !== 3) return dateStr;
    const monthIdx = parseInt(parts[1], 10) - 1;
    const year = parts[2];
    const abbr = MONTH_ABBR[monthIdx] || parts[1];
    return `${abbr}/${year}`;
  },

  // --- AUTENTICAÇÃO E CONTROLE DE ACESSO ---
  showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appShell').classList.add('hidden');
  },

  async handleLogin(e) {
    e.preventDefault();
    const emailInput = String(document.getElementById('loginEmail').value || '').trim().toLowerCase();
    const passInput = String(document.getElementById('loginPassword').value || '').trim();
    const errorEl = document.getElementById('loginErrorMsg');
    const submitBtn = document.getElementById('loginSubmitBtn');

    errorEl.classList.add('hidden');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verificando credenciais...';
    }

    try {
      await this.loadAllData();
      await this.seedInitialDataIfEmpty();
    } catch (err) {
      console.error('Erro ao consultar usuários:', err);
      errorEl.textContent = `Erro ao conectar ao banco: ${err.message || 'verifique as permissões do Firestore.'}`;
      errorEl.classList.remove('hidden');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Entrar na Plataforma';
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Entrar na Plataforma';
    }

    const matchedUser = this.state.users.find(u => {
      const dbEmail = String(u.email ?? '').trim().toLowerCase();
      const dbPass = String(u.password ?? '').trim();
      return dbEmail === emailInput && dbPass === passInput && passInput.length > 0;
    });

    if (!matchedUser) {
      errorEl.textContent = 'E-mail ou senha inválidos. Verifique com o administrador.';
      errorEl.classList.remove('hidden');
      return;
    }

    document.getElementById('loginForm').reset();
    sessionStorage.setItem('acgo_logged_user_id', matchedUser.id);
    this.enterApp(matchedUser.id);
  },

  enterApp(userId) {
    this.state.activeSessionUserId = userId;
    const user = this.getActiveUser();
    if (!user) {
      this.showLoginScreen();
      return;
    }

    document.getElementById('loggedUserBadge').textContent =
      `${user.name} (${user.role === 'administrador' ? 'Admin' : 'Comum'})`;

    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');
    this.applyRolePermissions();
    this.navigate('dashboard');
  },

  logout() {
    sessionStorage.removeItem('acgo_logged_user_id');
    this.state.activeSessionUserId = null;
    this.showLoginScreen();
  },

  // --- PERSISTÊNCIA (FIREBASE + FALLBACK LOCALSTORAGE) ---
  async loadCollection(name) {
    if (isFirebaseConnected && db) {
      const snap = await db.collection(name).get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return JSON.parse(localStorage.getItem(`acgo_${name}`) || '[]');
  },

  async saveDocument(collection, id, data) {
    if (isFirebaseConnected && db) {
      if (id) {
        await db.collection(collection).doc(id).set(data, { merge: true });
        return id;
      } else {
        const ref = await db.collection(collection).add(data);
        return ref.id;
      }
    } else {
      const list = JSON.parse(localStorage.getItem(`acgo_${collection}`) || '[]');
      const docId = id || 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const idx = list.findIndex(item => item.id === docId);
      if (idx >= 0) list[idx] = { id: docId, ...data };
      else list.push({ id: docId, ...data });
      localStorage.setItem(`acgo_${collection}`, JSON.stringify(list));
      return docId;
    }
  },

  async deleteDocument(collection, id) {
    if (isFirebaseConnected && db) {
      await db.collection(collection).doc(id).delete();
    } else {
      const list = JSON.parse(localStorage.getItem(`acgo_${collection}`) || '[]');
      localStorage.setItem(`acgo_${collection}`, JSON.stringify(list.filter(i => i.id !== id)));
    }
  },

  async loadAllData() {
    this.state.users = await this.loadCollection('users');
    this.state.addresses = await this.loadCollection('addresses');
    this.state.invoices = await this.loadCollection('invoices');
  },

  async seedInitialDataIfEmpty() {
    if (this.state.users.length > 0) return;

    const addr1Id = await this.saveDocument('addresses', null, {
      logradouro: 'Av. Boa Viagem',
      numero: '3420',
      bairro: 'Boa Viagem',
      cep: '51021-000',
      cidade: 'Recife'
    });

    const addr2Id = await this.saveDocument('addresses', null, {
      logradouro: 'Rua das Graças',
      numero: '185',
      bairro: 'Graças',
      cep: '52011-200',
      cidade: 'Recife'
    });

    await this.saveDocument('users', null, {
      name: 'Administrador Usina ACGO',
      email: 'admin@acgosolar.com.br',
      password: 'admin123',
      role: 'administrador',
      addressIds: []
    });

    await this.saveDocument('users', null, {
      name: 'Carlos Eduardo Mendes',
      email: 'carlos.mendes@email.com',
      password: '123456',
      role: 'comum',
      addressIds: [addr1Id, addr2Id]
    });

    await this.saveDocument('invoices', null, {
      addressId: addr1Id,
      date: '15/09/2026',
      initialReading: 12400,
      finalReading: 13050,
      neoFee: 38.50,
      fioBDiscount: 42.00,
      neoRate: 0.98
    });

    await this.saveDocument('invoices', null, {
      addressId: addr2Id,
      date: '15/10/2026',
      initialReading: 8200,
      finalReading: 8740,
      neoFee: 39.10,
      fioBDiscount: 36.50,
      neoRate: 0.98
    });

    await this.loadAllData();
  },

  // --- MÁSCARAS E VALIDAÇÕES ---
  maskCurrency(input) {
    let v = input.value.replace(/\D/g, '');
    if (!v) v = '0';
    const num = (parseInt(v, 10) / 100).toFixed(2);
    const [intPart, decPart] = num.split('.');
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    input.value = `R$ ${formattedInt},${decPart}`;
  },

  parseCurrency(str) {
    if (typeof str === 'number') return str;
    const clean = String(str || '0').replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  },

  formatCurrency(val) {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },

  maskDate(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 8);
    if (v.length >= 5) input.value = `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
    else if (v.length >= 3) input.value = `${v.slice(0, 2)}/${v.slice(2)}`;
    else input.value = v;
  },

  isValidDate(str) {
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = str.match(regex);
    if (!match) return false;
    const d = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const y = parseInt(match[3], 10);
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return false;
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  },

  maskCep(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 8);
    input.value = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
  },

  // --- NAVEGAÇÃO ---
  getActiveUser() {
    return this.state.users.find(u => u.id === this.state.activeSessionUserId) || this.state.users[0];
  },

  applyRolePermissions() {
    const activeUser = this.getActiveUser();
    const isAdmin = activeUser && activeUser.role === 'administrador';
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = isAdmin ? '' : 'none';
    });
  },

  navigate(view) {
    const activeUser = this.getActiveUser();
    if (activeUser && activeUser.role !== 'administrador' && view !== 'dashboard') {
      view = 'dashboard';
    }
    this.state.currentView = view;

    document.querySelectorAll('main > section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.nav === view);
    });

    if (view === 'dashboard') this.setupDashboardFilters();
    if (view === 'users') this.renderUsersView();
    if (view === 'addresses') this.renderAddressesView();
    if (view === 'invoices') this.renderInvoicesView();
  },

  openUserDashboard(userId) {
    this.navigate('dashboard');
    const dashUserSelect = document.getElementById('dashUserSelect');
    if (dashUserSelect) {
      dashUserSelect.value = userId;
      this.renderDashboard();
    }
  },

  // --- DASHBOARD ---
  setupDashboardFilters() {
    const activeUser = this.getActiveUser();
    const isAdmin = activeUser && activeUser.role === 'administrador';
    const userFilterWrapper = document.getElementById('userFilterWrapper');
    const dashUserSelect = document.getElementById('dashUserSelect');

    if (isAdmin) {
      userFilterWrapper.classList.remove('hidden');
      dashUserSelect.innerHTML = `<option value="all">Todos os Clientes</option>` +
        this.state.users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    } else {
      userFilterWrapper.classList.add('hidden');
      dashUserSelect.innerHTML = `<option value="${activeUser.id}">${activeUser.name}</option>`;
      dashUserSelect.value = activeUser.id;
    }
    this.renderDashboard();
  },

  clearDashboardPeriod() {
    document.getElementById('dashDateStart').value = '';
    document.getElementById('dashDateEnd').value = '';
    this.renderDashboard();
  },

  updateAddressBadges(selectedAddrId, availableAddrs) {
    const color = this.getAddressColor(selectedAddrId);
    const addrObj = availableAddrs.find(a => a.id === selectedAddrId);
    const labelText = addrObj
      ? `${addrObj.logradouro}, ${addrObj.numero} — ${addrObj.bairro}`
      : `Todos os endereços (${availableAddrs.length})`;

    const mainTag = document.getElementById('dashActiveAddressTag');
    const mainDot = document.getElementById('dashActiveAddressDot');
    const mainLabel = document.getElementById('dashActiveAddressLabel');

    if (mainTag && mainDot && mainLabel) {
      mainTag.style.backgroundColor = color.bgSoft;
      mainTag.style.borderColor = color.border;
      mainTag.style.color = color.text;
      mainDot.style.backgroundColor = color.hex;
      mainLabel.textContent = labelText;
    }

    ['chart1AddressBadge', 'chart2AddressBadge'].forEach(badgeId => {
      const badgeEl = document.getElementById(badgeId);
      if (!badgeEl) return;
      badgeEl.style.backgroundColor = color.bgSoft;
      badgeEl.style.borderColor = color.border;
      badgeEl.style.color = color.text;
      badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full" style="background-color: ${color.hex};"></span> ${labelText}`;
    });
  },

  renderDashboard() {
    const activeUser = this.getActiveUser();
    const isAdmin = activeUser && activeUser.role === 'administrador';
    const selectedUserId = isAdmin ? document.getElementById('dashUserSelect').value : activeUser.id;

    let allowedAddressIds = this.state.addresses.map(a => a.id);
    if (selectedUserId !== 'all') {
      const targetUser = this.state.users.find(u => u.id === selectedUserId);
      allowedAddressIds = targetUser ? (targetUser.addressIds || []) : [];
      document.getElementById('dashTitle').textContent = `Dashboard — ${targetUser ? targetUser.name : ''}`;
      document.getElementById('dashRoleBadge').textContent = targetUser?.role === 'administrador' ? 'Administrador' : 'Cliente';
    } else {
      document.getElementById('dashTitle').textContent = 'Painel Consolidado da Usina';
      document.getElementById('dashRoleBadge').textContent = 'Administrador';
    }

    const dashAddressSelect = document.getElementById('dashAddressSelect');
    const currentAddrFilter = dashAddressSelect.value;
    const availableAddrs = this.state.addresses.filter(a => allowedAddressIds.includes(a.id));

    dashAddressSelect.innerHTML = `<option value="all">Todos os endereços (${availableAddrs.length})</option>` +
      availableAddrs.map(a => `<option value="${a.id}">${a.logradouro}, ${a.numero} - ${a.bairro}</option>`).join('');

    if (availableAddrs.some(a => a.id === currentAddrFilter)) {
      dashAddressSelect.value = currentAddrFilter;
    }

    const finalAddrFilter = dashAddressSelect.value;
    this.updateAddressBadges(finalAddrFilter, availableAddrs);

    const startStr = (document.getElementById('dashDateStart')?.value || '').trim();
    const endStr = (document.getElementById('dashDateEnd')?.value || '').trim();
    const startTs = this.isValidDate(startStr) ? this.dateToTimestamp(startStr) : null;
    const endTs = this.isValidDate(endStr) ? this.dateToTimestamp(endStr) : null;

    const periodBadge = document.getElementById('dashPeriodSummaryBadge');
    if (periodBadge) {
      if (startTs && endTs) periodBadge.textContent = `Período: ${startStr} até ${endStr}`;
      else if (startTs) periodBadge.textContent = `A partir de ${startStr}`;
      else if (endTs) periodBadge.textContent = `Até ${endStr}`;
      else periodBadge.textContent = 'Todo o histórico';
    }

    const filteredInvoices = this.state.invoices
      .filter(inv => allowedAddressIds.includes(inv.addressId))
      .filter(inv => finalAddrFilter === 'all' || inv.addressId === finalAddrFilter)
      .filter(inv => {
        const invTs = this.dateToTimestamp(inv.date);
        if (startTs && invTs < startTs) return false;
        if (endTs && invTs > endTs) return false;
        return true;
      })
      .sort((a, b) => this.dateToTimestamp(a.date) - this.dateToTimestamp(b.date));

    let totalKwh = 0, totalAcgo = 0, totalNeo = 0;

    const rowsHtml = filteredInvoices.map(inv => {
      const calc = this.calculateInvoice(inv);
      totalKwh += calc.consumption;
      totalAcgo += calc.acgoTotal;
      totalNeo += calc.neoTotal;
      const addr = this.state.addresses.find(a => a.id === inv.addressId);
      const addrColor = this.getAddressColor(inv.addressId);
      const addrLabel = addr ? `${addr.logradouro}, ${addr.numero}` : 'Endereço removido';

      return `
        <tr class="hover:bg-slate-50">
          <td class="py-3.5 px-4 font-semibold text-slate-800">${inv.date}</td>
          <td class="py-3.5 px-4">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                  style="background-color: ${addrColor.bgSoft}; border-color: ${addrColor.border}; color: ${addrColor.text};">
              <span class="w-2 h-2 rounded-full" style="background-color: ${addrColor.hex};"></span>
              ${addrLabel}
            </span>
          </td>
          <td class="py-3.5 px-4 text-slate-600">${inv.initialReading} → ${inv.finalReading}</td>
          <td class="py-3.5 px-4 font-bold text-[#0A2558]">${calc.consumption} kWh</td>
          <td class="py-3.5 px-4 text-slate-700 font-medium">${this.formatCurrency(calc.energyCost)}</td>
          <td class="py-3.5 px-4 text-slate-600">${this.formatCurrency(inv.neoFee)}</td>
          <td class="py-3.5 px-4 text-emerald-700 font-medium">- ${this.formatCurrency(inv.fioBDiscount)}</td>
          <td class="py-3.5 px-4 font-extrabold text-[#1E88E5]">${this.formatCurrency(calc.acgoTotal)}</td>
          <td class="py-3.5 px-4 font-bold text-emerald-600">${this.formatCurrency(calc.savings)}</td>
        </tr>
      `;
    }).join('');

    const totalSavings = totalNeo - totalAcgo;
    const savingsPct = totalNeo > 0 ? ((totalSavings / totalNeo) * 100).toFixed(1) : '0.0';

    document.getElementById('kpiConsumption').textContent = `${totalKwh.toLocaleString('pt-BR')} kWh`;
    document.getElementById('kpiAcgoTotal').textContent = this.formatCurrency(totalAcgo);
    document.getElementById('kpiNeoenergiaTotal').textContent = this.formatCurrency(totalNeo);
    document.getElementById('kpiSavings').textContent = this.formatCurrency(totalSavings);
    document.getElementById('kpiSavingsPercent').textContent = `${savingsPct}% de redução frente à concessionária`;

    document.getElementById('dashInvoicesTable').innerHTML = rowsHtml ||
      `<tr><td colspan="9" class="py-8 text-center text-slate-400">Nenhuma leitura lançada para o endereço ou período selecionado.</td></tr>`;

    this.renderCharts(filteredInvoices);
  },

  dateToTimestamp(dateStr) {
    const [d, m, y] = (dateStr || '01/01/2000').split('/').map(Number);
    return new Date(y, m - 1, d).getTime();
  },

  calculateInvoice(inv) {
    const consumption = Math.max(0, Number(inv.finalReading) - Number(inv.initialReading));
    const energyCost = consumption * ACGO_TARIFF;
    const neoFee = Number(inv.neoFee || 0);
    const fioBDiscount = Number(inv.fioBDiscount || 0);
    const neoRate = Number(inv.neoRate || 0.98);

    const acgoTotal = Math.max(0, energyCost + neoFee - fioBDiscount);
    const neoTotal = (consumption * neoRate) + neoFee;
    const savings = neoTotal - acgoTotal;

    return { consumption, energyCost, neoFee, fioBDiscount, acgoTotal, neoTotal, savings };
  },

  renderCharts(invoices) {
    if (this.state.charts.consumption) this.state.charts.consumption.destroy();
    if (this.state.charts.financial) this.state.charts.financial.destroy();

    const presentAddressIds = [...new Set(invoices.map(i => i.addressId))].sort((a, b) => {
      return this.state.addresses.findIndex(x => x.id === a) - this.state.addresses.findIndex(x => x.id === b);
    });

    // GRÁFICO 1 (BARRAS): Agrupado por cor/endereço lado a lado, com rótulo curto MMM/AAAA abaixo
    const groupedItems = [];
    presentAddressIds.forEach(addrId => {
      const addrInvoices = invoices
        .filter(i => i.addressId === addrId)
        .sort((a, b) => this.dateToTimestamp(a.date) - this.dateToTimestamp(b.date));
      addrInvoices.forEach(inv => groupedItems.push(inv));
    });

    const barLabels = groupedItems.map(inv => this.formatMonthYear(inv.date));
    const barValues = groupedItems.map(inv => this.calculateInvoice(inv).consumption);
    const barColors = groupedItems.map(inv => this.getAddressColor(inv.addressId).hex);

    const consumptionLegendDatasets = presentAddressIds.map((addrId, index) => {
      const addr = this.state.addresses.find(a => a.id === addrId);
      const color = this.getAddressColor(addrId).hex;
      const addrName = addr ? `${addr.logradouro}, ${addr.numero}` : 'Endereço';

      return {
        label: addrName,
        data: index === 0 ? barValues : [],
        backgroundColor: index === 0 ? barColors : color,
        borderColor: color,
        borderRadius: 6,
        grouped: false
      };
    });

    this.state.charts.consumption = new Chart(document.getElementById('chartConsumption'), {
      type: 'bar',
      data: {
        labels: barLabels,
        datasets: consumptionLegendDatasets.length ? consumptionLegendDatasets : [{
          label: 'Sem dados',
          data: [],
          backgroundColor: '#1E88E5'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: {
              maxRotation: 0,
              autoSkip: false,
              font: { weight: 'bold', size: 11 }
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              pointStyle: 'rectRounded',
              font: { size: 11, weight: '600' },
              generateLabels: () => presentAddressIds.map(addrId => {
                const addr = this.state.addresses.find(a => a.id === addrId);
                const color = this.getAddressColor(addrId).hex;
                return {
                  text: addr ? `${addr.logradouro}, ${addr.numero}` : 'Endereço',
                  fillStyle: color,
                  strokeStyle: color,
                  lineWidth: 0,
                  hidden: false
                };
              })
            }
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0]?.dataIndex ?? 0;
                const inv = groupedItems[idx];
                if (!inv) return '';
                const addr = this.state.addresses.find(a => a.id === inv.addressId);
                return `${this.formatMonthYear(inv.date)} — ${addr ? `${addr.logradouro}, ${addr.numero}` : ''}`;
              },
              label: (ctx) => ` Consumo: ${ctx.parsed.y} kWh`
            }
          }
        }
      }
    });

    // GRÁFICO 2 (LINHAS): Meses curtos MMM/AAAA no eixo X e uma série colorida por endereço + Neoenergia
    const uniqueMonthKeys = [];
    const monthTimestampMap = {};
    invoices.forEach(inv => {
      const mKey = this.formatMonthYear(inv.date);
      if (!monthTimestampMap[mKey]) {
        monthTimestampMap[mKey] = this.dateToTimestamp(inv.date);
        uniqueMonthKeys.push(mKey);
      }
    });
    uniqueMonthKeys.sort((a, b) => monthTimestampMap[a] - monthTimestampMap[b]);

    const financialDatasets = presentAddressIds.map(addrId => {
      const addr = this.state.addresses.find(a => a.id === addrId);
      const color = this.getAddressColor(addrId).hex;
      const addrName = addr ? `${addr.logradouro}, ${addr.numero}` : 'Endereço';

      const seriesData = uniqueMonthKeys.map(mKey => {
        const match = invoices.find(i => i.addressId === addrId && this.formatMonthYear(i.date) === mKey);
        return match ? this.calculateInvoice(match).acgoTotal : null;
      });

      return {
        label: `ACGO — ${addrName}`,
        data: seriesData,
        borderColor: color,
        backgroundColor: color,
        pointBackgroundColor: color,
        pointRadius: 5,
        borderWidth: 3,
        spanGaps: true,
        tension: 0.3
      };
    });

    if (uniqueMonthKeys.length > 0) {
      const neoSeriesData = uniqueMonthKeys.map(mKey => {
        const monthInvs = invoices.filter(i => this.formatMonthYear(i.date) === mKey);
        if (!monthInvs.length) return null;
        const avgNeo = monthInvs.reduce((acc, item) => acc + this.calculateInvoice(item).neoTotal, 0) / monthInvs.length;
        return Number(avgNeo.toFixed(2));
      });

      financialDatasets.push({
        label: 'Neoenergia Sem Solar (Média R$)',
        data: neoSeriesData,
        borderColor: '#0A2558',
        backgroundColor: '#0A2558',
        borderDash: [5, 5],
        pointRadius: 4,
        tension: 0.3
      });
    }

    this.state.charts.financial = new Chart(document.getElementById('chartFinancial'), {
      type: 'line',
      data: {
        labels: uniqueMonthKeys,
        datasets: financialDatasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: {
              maxRotation: 0,
              font: { weight: 'bold', size: 11 }
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              font: { size: 11, weight: '600' }
            }
          }
        }
      }
    });
  },

  // --- CRUD USUÁRIOS ---
  renderUsersView() {
    const checklist = document.getElementById('userAddressesChecklist');
    checklist.innerHTML = this.state.addresses.length
      ? this.state.addresses.map(a => `
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="userAddrCheck" value="${a.id}" class="rounded text-[#0A2558]" />
            <span>${a.logradouro}, ${a.numero} — ${a.bairro} (${a.cidade})</span>
          </label>
        `).join('')
      : '<p class="text-xs text-slate-400">Nenhum endereço cadastrado ainda.</p>';

    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = this.state.users.map(u => {
      const addrs = (u.addressIds || [])
        .map(id => this.state.addresses.find(a => a.id === id))
        .filter(Boolean)
        .map(a => `${a.logradouro}, ${a.numero}`)
        .join(' • ');

      return `
        <tr class="hover:bg-slate-50">
          <td class="py-3.5 px-4">
            <button onclick="app.openUserDashboard('${u.id}')" class="font-bold text-[#0A2558] hover:underline text-left">${u.name}</button>
            <span class="block text-xs text-slate-500">${u.email}</span>
            <span class="block text-[11px] font-mono text-slate-400 mt-0.5">Senha: ${u.password || '—'}</span>
          </td>
          <td class="py-3.5 px-4">
            <span class="px-2.5 py-1 rounded-full text-xs font-bold ${u.role === 'administrador' ? 'bg-blue-100 text-[#0A2558]' : 'bg-emerald-100 text-emerald-800'}">
              ${u.role === 'administrador' ? 'Administrador' : 'Comum'}
            </span>
          </td>
          <td class="py-3.5 px-4 text-xs text-slate-600">${addrs || 'Nenhum vinculado'}</td>
          <td class="py-3.5 px-4 text-right space-x-2">
            <button onclick="app.editUser('${u.id}')" class="text-xs font-bold text-[#1E88E5] hover:underline">Editar</button>
            <button onclick="app.removeUser('${u.id}')" class="text-xs font-bold text-red-600 hover:underline">Excluir</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async saveUser(e) {
    e.preventDefault();
    const id = document.getElementById('userId').value || null;
    const selectedAddressIds = Array.from(document.querySelectorAll('input[name="userAddrCheck"]:checked')).map(cb => cb.value);

    const inlineLog = document.getElementById('inlineAddrLogradouro').value.trim();
    const inlineNum = document.getElementById('inlineAddrNumero').value.trim();
    const inlineBairro = document.getElementById('inlineAddrBairro').value.trim();
    const inlineCep = document.getElementById('inlineAddrCep').value.trim();
    const inlineCidade = document.getElementById('inlineAddrCidade').value.trim();

    if (inlineLog && inlineNum && inlineBairro && inlineCep && inlineCidade) {
      const newAddrId = await this.saveDocument('addresses', null, {
        logradouro: inlineLog,
        numero: inlineNum,
        bairro: inlineBairro,
        cep: inlineCep,
        cidade: inlineCidade
      });
      selectedAddressIds.push(newAddrId);
    }

    await this.saveDocument('users', id, {
      name: document.getElementById('userName').value.trim(),
      email: document.getElementById('userEmail').value.trim(),
      password: String(document.getElementById('userPassword').value || '').trim(),
      role: document.getElementById('userRole').value,
      addressIds: [...new Set(selectedAddressIds)]
    });

    await this.loadAllData();
    this.resetUserForm();
    this.renderUsersView();
  },

  editUser(id) {
    const u = this.state.users.find(user => user.id === id);
    if (!u) return;
    document.getElementById('userFormTitle').textContent = 'Editar Usuário';
    document.getElementById('userId').value = u.id;
    document.getElementById('userName').value = u.name;
    document.getElementById('userEmail').value = u.email;
    document.getElementById('userPassword').value = u.password || '';
    document.getElementById('userRole').value = u.role;
    document.querySelectorAll('input[name="userAddrCheck"]').forEach(cb => {
      cb.checked = (u.addressIds || []).includes(cb.value);
    });
  },

  async removeUser(id) {
    if (id === this.state.activeSessionUserId) {
      alert('Você não pode excluir o usuário que está logado no momento.');
      return;
    }
    if (!confirm('Deseja remover este usuário?')) return;
    await this.deleteDocument('users', id);
    await this.loadAllData();
    this.renderUsersView();
  },

  resetUserForm() {
    document.getElementById('userFormTitle').textContent = 'Cadastrar Novo Usuário';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
  },

  // --- CRUD ENDEREÇOS ---
  renderAddressesView() {
    document.getElementById('addressesTableBody').innerHTML = this.state.addresses.map(a => {
      const color = this.getAddressColor(a.id);
      return `
        <tr class="hover:bg-slate-50">
          <td class="py-3.5 px-4 font-semibold text-slate-800">
            <span class="inline-block w-2.5 h-2.5 rounded-full mr-2" style="background-color: ${color.hex};"></span>
            ${a.logradouro}, ${a.numero}
          </td>
          <td class="py-3.5 px-4 text-slate-600">${a.bairro} — ${a.cidade}</td>
          <td class="py-3.5 px-4 text-slate-600">${a.cep}</td>
          <td class="py-3.5 px-4 text-right space-x-2">
            <button onclick="app.editAddress('${a.id}')" class="text-xs font-bold text-[#1E88E5] hover:underline">Editar</button>
            <button onclick="app.removeAddress('${a.id}')" class="text-xs font-bold text-red-600 hover:underline">Excluir</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async saveAddress(e) {
    e.preventDefault();
    const cep = document.getElementById('addrCep').value.trim();
    if (!/^\d{5}-\d{3}$/.test(cep)) {
      alert('Informe um CEP válido no formato 00000-000.');
      return;
    }

    const id = document.getElementById('addressId').value || null;
    await this.saveDocument('addresses', id, {
      logradouro: document.getElementById('addrLogradouro').value.trim(),
      numero: document.getElementById('addrNumero').value.trim(),
      bairro: document.getElementById('addrBairro').value.trim(),
      cep,
      cidade: document.getElementById('addrCidade').value.trim()
    });

    await this.loadAllData();
    this.resetAddressForm();
    this.renderAddressesView();
  },

  editAddress(id) {
    const a = this.state.addresses.find(addr => addr.id === id);
    if (!a) return;
    document.getElementById('addressFormTitle').textContent = 'Editar Endereço';
    document.getElementById('addressId').value = a.id;
    document.getElementById('addrLogradouro').value = a.logradouro;
    document.getElementById('addrNumero').value = a.numero;
    document.getElementById('addrBairro').value = a.bairro;
    document.getElementById('addrCep').value = a.cep;
    document.getElementById('addrCidade').value = a.cidade;
  },

  async removeAddress(id) {
    if (!confirm('Deseja excluir este endereço?')) return;
    await this.deleteDocument('addresses', id);
    await this.loadAllData();
    this.renderAddressesView();
  },

  resetAddressForm() {
    document.getElementById('addressFormTitle').textContent = 'Cadastrar / Editar Endereço';
    document.getElementById('addressForm').reset();
    document.getElementById('addressId').value = '';
  },

  // --- CRUD FATURAS ---
  renderInvoicesView() {
    const sel = document.getElementById('invAddressId');
    sel.innerHTML = this.state.addresses.map(a =>
      `<option value="${a.id}">${a.logradouro}, ${a.numero} (${a.bairro} - ${a.cidade})</option>`
    ).join('');

    document.getElementById('invoicesTableBody').innerHTML = this.state.invoices.map(inv => {
      const addr = this.state.addresses.find(a => a.id === inv.addressId);
      const calc = this.calculateInvoice(inv);
      return `
        <tr class="hover:bg-slate-50">
          <td class="py-3.5 px-4 font-semibold">${inv.date}</td>
          <td class="py-3.5 px-4 text-slate-600">${addr ? `${addr.logradouro}, ${addr.numero}` : 'N/A'}</td>
          <td class="py-3.5 px-4 font-bold text-[#0A2558]">${calc.consumption} kWh</td>
          <td class="py-3.5 px-4 text-slate-600">${this.formatCurrency(calc.neoFee)}</td>
          <td class="py-3.5 px-4 font-extrabold text-[#2E7D32]">${this.formatCurrency(calc.acgoTotal)}</td>
          <td class="py-3.5 px-4 text-right space-x-2">
            <button onclick="app.editInvoice('${inv.id}')" class="text-xs font-bold text-[#1E88E5] hover:underline">Editar</button>
            <button onclick="app.removeInvoice('${inv.id}')" class="text-xs font-bold text-red-600 hover:underline">Excluir</button>
          </td>
        </tr>
      `;
    }).join('');
    this.recalcInvoicePreview();
  },

  recalcInvoicePreview() {
    const initial = Number(document.getElementById('invInitialReading').value || 0);
    const final = Number(document.getElementById('invFinalReading').value || 0);
    const neoFee = this.parseCurrency(document.getElementById('invNeoFee').value);
    const fioBDiscount = this.parseCurrency(document.getElementById('invFioBDiscount').value);
    const neoRate = this.parseCurrency(document.getElementById('invNeoRate').value) || 0.98;

    const calc = this.calculateInvoice({ initialReading: initial, finalReading: final, neoFee, fioBDiscount, neoRate });
    document.getElementById('prevConsumption').textContent = `${calc.consumption} kWh`;
    document.getElementById('prevEnergyCost').textContent = this.formatCurrency(calc.energyCost);
    document.getElementById('prevNeoFee').textContent = `+ ${this.formatCurrency(calc.neoFee)}`;
    document.getElementById('prevFioBDiscount').textContent = `- ${this.formatCurrency(calc.fioBDiscount)}`;
    document.getElementById('prevTotalAcgo').textContent = this.formatCurrency(calc.acgoTotal);
    document.getElementById('prevSavings').textContent = this.formatCurrency(calc.savings);
  },

  async saveInvoice(e) {
    e.preventDefault();
    const date = document.getElementById('invDate').value.trim();
    if (!this.isValidDate(date)) {
      alert('Data inválida. Utilize o formato dd/mm/aaaa.');
      return;
    }

    const initialReading = Number(document.getElementById('invInitialReading').value);
    const finalReading = Number(document.getElementById('invFinalReading').value);
    if (finalReading < initialReading) {
      alert('A leitura final deve ser maior ou igual à leitura inicial.');
      return;
    }

    const id = document.getElementById('invoiceId').value || null;
    await this.saveDocument('invoices', id, {
      addressId: document.getElementById('invAddressId').value,
      date,
      initialReading,
      finalReading,
      neoFee: this.parseCurrency(document.getElementById('invNeoFee').value),
      fioBDiscount: this.parseCurrency(document.getElementById('invFioBDiscount').value),
      neoRate: this.parseCurrency(document.getElementById('invNeoRate').value) || 0.98
    });

    await this.loadAllData();
    this.resetInvoiceForm();
    this.renderInvoicesView();
  },

  editInvoice(id) {
    const inv = this.state.invoices.find(i => i.id === id);
    if (!inv) return;
    document.getElementById('invoiceFormTitle').textContent = 'Editar Fatura';
    document.getElementById('invoiceId').value = inv.id;
    document.getElementById('invAddressId').value = inv.addressId;
    document.getElementById('invDate').value = inv.date;
    document.getElementById('invInitialReading').value = inv.initialReading;
    document.getElementById('invFinalReading').value = inv.finalReading;
    document.getElementById('invNeoFee').value = this.formatCurrency(inv.neoFee);
    document.getElementById('invFioBDiscount').value = this.formatCurrency(inv.fioBDiscount);
    document.getElementById('invNeoRate').value = this.formatCurrency(inv.neoRate || 0.98);
    this.recalcInvoicePreview();
  },

  async removeInvoice(id) {
    if (!confirm('Deseja excluir esta fatura?')) return;
    await this.deleteDocument('invoices', id);
    await this.loadAllData();
    this.renderInvoicesView();
  },

  resetInvoiceForm() {
    document.getElementById('invoiceFormTitle').textContent = 'Lançar / Editar Leitura & Fatura';
    document.getElementById('invoiceForm').reset();
    document.getElementById('invoiceId').value = '';
    document.getElementById('invNeoFee').value = 'R$ 0,00';
    document.getElementById('invFioBDiscount').value = 'R$ 0,00';
    document.getElementById('invNeoRate').value = 'R$ 0,98';
    this.recalcInvoicePreview();
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());