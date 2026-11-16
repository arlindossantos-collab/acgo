const ACGO_TARIFF = 0.75; // R$ 0,75 por kWh
const MAX_RECEIPT_BYTES = 720 * 1024;

const MONTH_ABBR = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const ADDRESS_PALETTE = [
  { hex: '#2E7D32', bgSoft: '#ECFDF5', border: '#A7F3D0', text: '#047857' },
  { hex: '#1E88E5', bgSoft: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
  { hex: '#D97706', bgSoft: '#FFFBEB', border: '#FDE68A', text: '#B45309' },
  { hex: '#7C3AED', bgSoft: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9' },
  { hex: '#0D9488', bgSoft: '#F0FDFA', border: '#99F6E4', text: '#0F766E' },
  { hex: '#E11D48', bgSoft: '#FFF1F2', border: '#FECDD3', text: '#BE123C' },
  { hex: '#EA580C', bgSoft: '#FFF7ED', border: '#FED7AA', text: '#C2410C' },
  { hex: '#0284C7', bgSoft: '#F0F9FF', border: '#BAE6FD', text: '#0369A1' }
];

const app = {
  state: {
    users: [],
    addresses: [],
    invoices: [],
    activeSessionUserId: null,
    currentView: 'dashboard',
    pendingReceipt: null,
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
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span> Banco conectado';
      }
      if (loginBadge) {
        loginBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800';
        loginBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span> Banco conectado';
      }
    } else {
      if (badge) {
        badge.className = 'hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800';
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-500"></span> Modo Local';
      }
      if (loginBadge) {
        loginBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800';
        loginBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-500"></span> Modo Local Ativo';
      }
    }
  },

  // --- FORMATAÇÃO DE ENDEREÇO COM APARTAMENTO ---
  formatAddressShort(addr) {
    if (!addr) return 'Endereço removido';
    const apto = (addr.apartamento || '').trim();
    return apto
      ? `${addr.logradouro}, ${addr.numero} - ${apto}`
      : `${addr.logradouro}, ${addr.numero}`;
  },

  formatAddressFull(addr) {
    if (!addr) return 'Endereço removido';
    return `${this.formatAddressShort(addr)} — ${addr.bairro} (${addr.cidade})`;
  },

  // --- DIÁLOGO DE CONFIRMAÇÃO DE EXCLUSÃO (SIM / NÃO) ---
  confirmDeletion(itemLabel) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmDeleteModal');
      const msgEl = document.getElementById('confirmDeleteMessage');
      const yesBtn = document.getElementById('confirmDeleteYesBtn');
      const noBtn = document.getElementById('confirmDeleteNoBtn');

      msgEl.innerHTML = `Você realmente deseja excluir este <strong>${itemLabel}</strong>?`;
      modal.classList.remove('hidden');

      const cleanup = (result) => {
        modal.classList.add('hidden');
        yesBtn.removeEventListener('click', onYes);
        noBtn.removeEventListener('click', onNo);
        resolve(result);
      };

      const onYes = () => cleanup(true);
      const onNo = () => cleanup(false);

      yesBtn.addEventListener('click', onYes);
      noBtn.addEventListener('click', onNo);
    });
  },

  // --- CORES, DATAS E STATUS DE PAGAMENTO ---
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

  getPaymentStatusBadge(inv) {
    if (inv.paymentStatus === 'pago') {
      const paidOn = inv.paidDate ? ` em ${inv.paidDate}` : '';
      return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        ✓ Pago${paidOn}
      </span>`;
    }

    if (!inv.dueDate || !this.isValidDate(inv.dueDate)) {
      return `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
        Pendente
      </span>`;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [d, m, y] = inv.dueDate.split('/').map(Number);
    const due = new Date(y, m - 1, d);
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const lateDays = Math.abs(diffDays);
      return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
        ⚠ Atrasado (${lateDays}d)
      </span>`;
    }

    if (diffDays === 0) {
      return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
        Vence hoje
      </span>`;
    }

    return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
      Vence em ${diffDays} dia${diffDays > 1 ? 's' : ''}
    </span>`;
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
      errorEl.textContent = `Erro ao conectar ao banco: ${err.message || 'verifique as permissões.'}`;
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

    document.getElementById('loggedUserBadge').textContent = user.name;

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

  // --- PERSISTÊNCIA ---
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
      apartamento: 'Apto 801',
      bairro: 'Boa Viagem',
      cep: '51021-000',
      cidade: 'Recife'
    });

    const addr2Id = await this.saveDocument('addresses', null, {
      logradouro: 'Rua das Graças',
      numero: '185',
      apartamento: '',
      bairro: 'Graças',
      cep: '52011-200',
      cidade: 'Recife'
    });

    await this.saveDocument('users', null, {
      name: 'Administrador Usina ACGO',
      email: 'admin@acgosolar.com.br',
      password: 'admin123',
      phones: ['(81) 99999-0000'],
      role: 'administrador',
      addressIds: []
    });

    await this.saveDocument('users', null, {
      name: 'Carlos Eduardo Mendes',
      email: 'carlos.mendes@email.com',
      password: '123456',
      phones: ['(81) 98888-1122', '(81) 3322-4455'],
      role: 'comum',
      addressIds: [addr1Id, addr2Id]
    });

    await this.saveDocument('invoices', null, {
      addressId: addr1Id,
      date: '15/09/2026',
      dueDate: '25/09/2026',
      paymentStatus: 'pago',
      paidDate: '24/09/2026',
      initialReading: 12400,
      finalReading: 13050,
      neoFee: 38.50,
      fioBDiscount: 42.00,
      neoRate: 0.98
    });

    await this.saveDocument('invoices', null, {
      addressId: addr2Id,
      date: '15/11/2026',
      dueDate: '25/11/2026',
      paymentStatus: 'pendente',
      paidDate: '',
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

  maskPhone(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 10) {
      input.value = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    } else if (v.length > 6) {
      input.value = `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
    } else if (v.length > 2) {
      input.value = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    } else if (v.length > 0) {
      input.value = `(${v}`;
    } else {
      input.value = '';
    }
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

  // --- CONTATOS TELEFÔNICOS DINÂMICOS NO FORMULÁRIO DE USUÁRIO ---
  addPhoneField(value = '') {
    const container = document.getElementById('userPhonesContainer');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';
    row.innerHTML = `
      <input type="text" name="userPhoneInput" value="${value}" maxlength="15" oninput="app.maskPhone(this)" placeholder="(81) 99999-9999" class="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-[#1E88E5] focus:outline-none" />
      <button type="button" onclick="app.removePhoneField(this)" title="Remover telefone" class="px-2.5 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition">
        ✕
      </button>
    `;
    container.appendChild(row);
  },

  removePhoneField(btn) {
    const container = document.getElementById('userPhonesContainer');
    const row = btn.closest('div');
    if (row) row.remove();
    if (container && container.children.length === 0) {
      this.addPhoneField('');
    }
  },

  setUserPhoneFields(phones = []) {
    const container = document.getElementById('userPhonesContainer');
    if (!container) return;
    container.innerHTML = '';
    const list = Array.isArray(phones) && phones.length ? phones : [''];
    list.forEach(p => this.addPhoneField(p));
  },

  // --- COMPROVANTE DE PAGAMENTO ---
  async handleReceiptSelect(event) {
    const file = event.target.files[0];
    const infoEl = document.getElementById('invReceiptInfo');
    if (!file) return;

    if (file.type.startsWith('image/')) {
      try {
        const compressedDataUrl = await this.compressImage(file, 1200, 0.72);
        if (compressedDataUrl.length > MAX_RECEIPT_BYTES * 1.37) {
          alert('A imagem continua acima de 700 KB mesmo após compactação. Escolha uma foto menor.');
          event.target.value = '';
          return;
        }
        this.state.pendingReceipt = {
          name: file.name,
          type: 'image/jpeg',
          dataUrl: compressedDataUrl
        };
        infoEl.textContent = `Imagem pronta: ${file.name}`;
      } catch (err) {
        alert('Não foi possível processar a imagem selecionada.');
      }
      return;
    }

    if (file.size > MAX_RECEIPT_BYTES) {
      alert('Na versão gratuita do banco, arquivos PDF devem ter no máximo 700 KB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.state.pendingReceipt = {
        name: file.name,
        type: file.type || 'application/pdf',
        dataUrl: reader.result
      };
      infoEl.textContent = `Arquivo pronto: ${file.name}`;
    };
    reader.readAsDataURL(file);
  },

  compressImage(file, maxWidth, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxWidth / img.width);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  openReceipt(invoiceId) {
    const inv = this.state.invoices.find(i => i.id === invoiceId);
    if (!inv || !inv.receiptDataUrl) {
      alert('Nenhum comprovante anexado a esta fatura.');
      return;
    }

    const win = window.open();
    if (win) {
      win.document.title = inv.receiptName || 'Comprovante ACGO';
      win.document.body.style.margin = '0';
      win.document.body.innerHTML = `<iframe src="${inv.receiptDataUrl}" frameborder="0" style="border:0;width:100vw;height:100vh;" allowfullscreen></iframe>`;
    } else {
      const a = document.createElement('a');
      a.href = inv.receiptDataUrl;
      a.download = inv.receiptName || 'comprovante-acgo';
      a.click();
    }
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
      ? `${this.formatAddressShort(addrObj)} — ${addrObj.bairro}`
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
    } else {
      document.getElementById('dashTitle').textContent = 'Painel Consolidado da Usina';
    }

    const dashAddressSelect = document.getElementById('dashAddressSelect');
    const currentAddrFilter = dashAddressSelect.value;
    const availableAddrs = this.state.addresses.filter(a => allowedAddressIds.includes(a.id));

    dashAddressSelect.innerHTML = `<option value="all">Todos os endereços (${availableAddrs.length})</option>` +
      availableAddrs.map(a => `<option value="${a.id}">${this.formatAddressShort(a)} - ${a.bairro}</option>`).join('');

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
      const addrLabel = this.formatAddressShort(addr);

      const receiptBtn = inv.receiptDataUrl
        ? `<button onclick="app.openReceipt('${inv.id}')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#0A2558] text-xs font-bold transition">📄 Ver</button>`
        : `<span class="text-xs text-slate-400">—</span>`;

      return `
        <tr class="hover:bg-slate-50">
          <td class="py-3.5 px-4 font-semibold text-slate-800">${inv.date}</td>
          <td class="py-3.5 px-4 text-slate-600">${inv.dueDate || '—'}</td>
          <td class="py-3.5 px-4">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                  style="background-color: ${addrColor.bgSoft}; border-color: ${addrColor.border}; color: ${addrColor.text};">
              <span class="w-2 h-2 rounded-full" style="background-color: ${addrColor.hex};"></span>
              ${addrLabel}
            </span>
          </td>
          <td class="py-3.5 px-4 font-bold text-[#0A2558]">${calc.consumption} kWh</td>
          <td class="py-3.5 px-4 font-extrabold text-[#1E88E5]">${this.formatCurrency(calc.acgoTotal)}</td>
          <td class="py-3.5 px-4 font-bold text-emerald-600">${this.formatCurrency(calc.savings)}</td>
          <td class="py-3.5 px-4">${this.getPaymentStatusBadge(inv)}</td>
          <td class="py-3.5 px-4 text-right">${receiptBtn}</td>
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
      `<tr><td colspan="8" class="py-8 text-center text-slate-400">Nenhuma leitura lançada para o endereço ou período selecionado.</td></tr>`;

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
      const addrName = this.formatAddressShort(addr);

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
                  text: this.formatAddressShort(addr),
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
                return `${this.formatMonthYear(inv.date)} — ${this.formatAddressShort(addr)}`;
              },
              label: (ctx) => ` Consumo: ${ctx.parsed.y} kWh`
            }
          }
        }
      }
    });

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
      const addrName = this.formatAddressShort(addr);

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
    const container = document.getElementById('userPhonesContainer');
    if (container && container.children.length === 0) {
      this.setUserPhoneFields([]);
    }

    const checklist = document.getElementById('userAddressesChecklist');
    checklist.innerHTML = this.state.addresses.length
      ? this.state.addresses.map(a => `
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="userAddrCheck" value="${a.id}" class="rounded text-[#0A2558]" />
            <span>${this.formatAddressFull(a)}</span>
          </label>
        `).join('')
      : '<p class="text-xs text-slate-400">Nenhum endereço cadastrado ainda.</p>';

    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = this.state.users.map(u => {
      const addrs = (u.addressIds || [])
        .map(id => this.state.addresses.find(a => a.id === id))
        .filter(Boolean)
        .map(a => this.formatAddressShort(a))
        .join(' • ');

      const phonesList = Array.isArray(u.phones) && u.phones.length
        ? u.phones.join(' • ')
        : 'Sem telefone';

      return `
        <tr class="hover:bg-slate-50">
          <td class="py-3.5 px-4">
            <button onclick="app.openUserDashboard('${u.id}')" class="font-bold text-[#0A2558] hover:underline text-left">${u.name}</button>
            <span class="block text-xs text-slate-500">${u.email}</span>
            <span class="block text-[11px] font-medium text-emerald-700 mt-0.5">📞 ${phonesList}</span>
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

    const phones = Array.from(document.querySelectorAll('input[name="userPhoneInput"]'))
      .map(inp => inp.value.trim())
      .filter(Boolean);

    const inlineLog = document.getElementById('inlineAddrLogradouro').value.trim();
    const inlineNum = document.getElementById('inlineAddrNumero').value.trim();
    const inlineApto = document.getElementById('inlineAddrApartamento').value.trim();
    const inlineBairro = document.getElementById('inlineAddrBairro').value.trim();
    const inlineCep = document.getElementById('inlineAddrCep').value.trim();
    const inlineCidade = document.getElementById('inlineAddrCidade').value.trim();

    if (inlineLog && inlineNum && inlineBairro && inlineCep && inlineCidade) {
      const newAddrId = await this.saveDocument('addresses', null, {
        logradouro: inlineLog,
        numero: inlineNum,
        apartamento: inlineApto,
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
      phones,
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
    this.setUserPhoneFields(u.phones || []);
    document.querySelectorAll('input[name="userAddrCheck"]').forEach(cb => {
      cb.checked = (u.addressIds || []).includes(cb.value);
    });
  },

  async removeUser(id) {
    if (id === this.state.activeSessionUserId) {
      alert('Você não pode excluir o usuário que está logado no momento.');
      return;
    }
    const targetUser = this.state.users.find(u => u.id === id);
    const label = targetUser ? `usuário (${targetUser.name})` : 'usuário';
    const confirmed = await this.confirmDeletion(label);
    if (!confirmed) return;

    await this.deleteDocument('users', id);
    await this.loadAllData();
    this.renderUsersView();
  },

  resetUserForm() {
    document.getElementById('userFormTitle').textContent = 'Cadastrar Novo Usuário';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    this.setUserPhoneFields([]);
  },

  // --- CRUD ENDEREÇOS ---
  renderAddressesView() {
    document.getElementById('addressesTableBody').innerHTML = this.state.addresses.map(a => {
      const color = this.getAddressColor(a.id);
      return `
        <tr class="hover:bg-slate-50">
          <td class="py-3.5 px-4 font-semibold text-slate-800">
            <span class="inline-block w-2.5 h-2.5 rounded-full mr-2" style="background-color: ${color.hex};"></span>
            ${this.formatAddressShort(a)}
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
      apartamento: document.getElementById('addrApartamento').value.trim(),
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
    document.getElementById('addrApartamento').value = a.apartamento || '';
    document.getElementById('addrBairro').value = a.bairro;
    document.getElementById('addrCep').value = a.cep;
    document.getElementById('addrCidade').value = a.cidade;
  },

  async removeAddress(id) {
    const targetAddr = this.state.addresses.find(a => a.id === id);
    const label = targetAddr ? `endereço (${this.formatAddressShort(targetAddr)})` : 'endereço';
    const confirmed = await this.confirmDeletion(label);
    if (!confirmed) return;

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
  togglePaidDateField() {
    const status = document.getElementById('invPaymentStatus').value;
    const wrapper = document.getElementById('paidDateWrapper');
    if (status === 'pago') {
      wrapper.classList.remove('hidden');
      const paidInput = document.getElementById('invPaidDate');
      if (!paidInput.value) {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        paidInput.value = `${dd}/${mm}/${yyyy}`;
      }
    } else {
      wrapper.classList.add('hidden');
    }
  },

  renderInvoicesView() {
    const sel = document.getElementById('invAddressId');
    sel.innerHTML = this.state.addresses.map(a =>
      `<option value="${a.id}">${this.formatAddressFull(a)}</option>`
    ).join('');

    const sortedInvoices = [...this.state.invoices].sort(
      (a, b) => this.dateToTimestamp(b.date) - this.dateToTimestamp(a.date)
    );

    document.getElementById('invoicesTableBody').innerHTML = sortedInvoices.map(inv => {
      const addr = this.state.addresses.find(a => a.id === inv.addressId);
      const calc = this.calculateInvoice(inv);
      const receiptCell = inv.receiptDataUrl
        ? `<button onclick="app.openReceipt('${inv.id}')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#0A2558] text-xs font-bold transition">📄 Ver</button>`
        : `<span class="text-xs text-slate-400">—</span>`;

      return `
        <tr class="hover:bg-slate-50">
          <td class="py-3.5 px-3">
            <span class="block font-semibold text-slate-800">${inv.date}</span>
            <span class="block text-[11px] text-slate-500">Venc: ${inv.dueDate || '—'}</span>
          </td>
          <td class="py-3.5 px-3 text-slate-600 text-xs">${this.formatAddressShort(addr)}</td>
          <td class="py-3.5 px-3 font-extrabold text-[#2E7D32]">${this.formatCurrency(calc.acgoTotal)}</td>
          <td class="py-3.5 px-3">${this.getPaymentStatusBadge(inv)}</td>
          <td class="py-3.5 px-3">${receiptCell}</td>
          <td class="py-3.5 px-3 text-right space-x-2">
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
    const dueDate = document.getElementById('invDueDate').value.trim();
    if (!this.isValidDate(date) || !this.isValidDate(dueDate)) {
      alert('Data de leitura ou vencimento inválida. Utilize o formato dd/mm/aaaa.');
      return;
    }

    const paymentStatus = document.getElementById('invPaymentStatus').value;
    const paidDate = document.getElementById('invPaidDate').value.trim();
    if (paymentStatus === 'pago' && !this.isValidDate(paidDate)) {
      alert('Informe uma data de pagamento válida no formato dd/mm/aaaa.');
      return;
    }

    const initialReading = Number(document.getElementById('invInitialReading').value);
    const finalReading = Number(document.getElementById('invFinalReading').value);
    if (finalReading < initialReading) {
      alert('A leitura final deve ser maior ou igual à leitura inicial.');
      return;
    }

    const id = document.getElementById('invoiceId').value || null;
    const existingInv = id ? this.state.invoices.find(i => i.id === id) : null;

    const payload = {
      addressId: document.getElementById('invAddressId').value,
      date,
      dueDate,
      paymentStatus,
      paidDate: paymentStatus === 'pago' ? paidDate : '',
      initialReading,
      finalReading,
      neoFee: this.parseCurrency(document.getElementById('invNeoFee').value),
      fioBDiscount: this.parseCurrency(document.getElementById('invFioBDiscount').value),
      neoRate: this.parseCurrency(document.getElementById('invNeoRate').value) || 0.98,
      receiptName: this.state.pendingReceipt ? this.state.pendingReceipt.name : (existingInv?.receiptName || ''),
      receiptType: this.state.pendingReceipt ? this.state.pendingReceipt.type : (existingInv?.receiptType || ''),
      receiptDataUrl: this.state.pendingReceipt ? this.state.pendingReceipt.dataUrl : (existingInv?.receiptDataUrl || '')
    };

    const btn = document.getElementById('invoiceSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
      await this.saveDocument('invoices', id, payload);
      await this.loadAllData();
      this.resetInvoiceForm();
      this.renderInvoicesView();
    } catch (err) {
      alert(`Erro ao salvar fatura: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Salvar Fatura';
    }
  },

  editInvoice(id) {
    const inv = this.state.invoices.find(i => i.id === id);
    if (!inv) return;
    this.state.pendingReceipt = null;
    document.getElementById('invoiceFormTitle').textContent = 'Editar Fatura';
    document.getElementById('invoiceId').value = inv.id;
    document.getElementById('invAddressId').value = inv.addressId;
    document.getElementById('invDate').value = inv.date;
    document.getElementById('invDueDate').value = inv.dueDate || '';
    document.getElementById('invInitialReading').value = inv.initialReading;
    document.getElementById('invFinalReading').value = inv.finalReading;
    document.getElementById('invNeoFee').value = this.formatCurrency(inv.neoFee);
    document.getElementById('invFioBDiscount').value = this.formatCurrency(inv.fioBDiscount);
    document.getElementById('invNeoRate').value = this.formatCurrency(inv.neoRate || 0.98);
    document.getElementById('invPaymentStatus').value = inv.paymentStatus || 'pendente';
    document.getElementById('invPaidDate').value = inv.paidDate || '';
    this.togglePaidDateField();

    document.getElementById('invReceiptInfo').textContent = inv.receiptName
      ? `Comprovante salvo: ${inv.receiptName} (selecione outro para substituir)`
      : 'Nenhum arquivo anexado (máx. 700 KB).';

    this.recalcInvoicePreview();
  },

  async removeInvoice(id) {
    const targetInv = this.state.invoices.find(i => i.id === id);
    const addr = targetInv ? this.state.addresses.find(a => a.id === targetInv.addressId) : null;
    const invInfo = targetInv
      ? `fatura (${targetInv.date}${addr ? ` — ${this.formatAddressShort(addr)}` : ''})`
      : 'fatura';
    const confirmed = await this.confirmDeletion(invInfo);
    if (!confirmed) return;

    await this.deleteDocument('invoices', id);
    await this.loadAllData();
    this.renderInvoicesView();
  },

  resetInvoiceForm() {
    this.state.pendingReceipt = null;
    document.getElementById('invoiceFormTitle').textContent = 'Lançar / Editar Leitura & Fatura';
    document.getElementById('invoiceForm').reset();
    document.getElementById('invoiceId').value = '';
    document.getElementById('invNeoFee').value = 'R$ 0,00';
    document.getElementById('invFioBDiscount').value = 'R$ 0,00';
    document.getElementById('invNeoRate').value = 'R$ 0,98';
    document.getElementById('invPaymentStatus').value = 'pendente';
    document.getElementById('invReceiptInfo').textContent = 'Nenhum arquivo anexado (máx. 700 KB).';
    this.togglePaidDateField();
    this.recalcInvoicePreview();
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());