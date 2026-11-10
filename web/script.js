/* ============================================================
   ComplexCar Autoservis Třebíč – script.js
   Kompletní systém: Registrace, Přihlášení (Admin + Uživatel),
   Vytváření objednávek, Správa aktivních objednávek, Export,
   Tisk zakázkového listu, Profil zákazníka a Detailní filtry.
   ============================================================ */

'use strict';

/* ============================================================
   DATABÁZOVÁ VRSTVA (LocalStorage Persistence)
   ============================================================ */

const STORAGE_USERS = 'complexcar_users_db';
const STORAGE_ORDERS = 'complexcar_orders_db';
const STORAGE_SESSION = 'complexcar_current_session';

// Inicializace výchozích dat, pokud ještě neexistují
function initDatabase() {
  // 1. Zajištění Admin účtu
  let users = JSON.parse(localStorage.getItem(STORAGE_USERS) || '[]');
  const adminExists = users.some(u => u.email.toLowerCase() === 'admin');

  if (!adminExists) {
    users.push({
      id: 'usr_admin',
      name: 'Správce servisu (Admin)',
      phone: '+420 774 851 840',
      email: 'admin',
      password: 'admin6758',
      role: 'admin',
      createdAt: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
  }

  // 2. Objednávky - začínáme s prázdnou databází, zobrazují se POUZE reálně odeslané objednávky
  let orders = JSON.parse(localStorage.getItem(STORAGE_ORDERS) || 'null');
  if (!orders) {
    orders = [];
    localStorage.setItem(STORAGE_ORDERS, JSON.stringify(orders));
  } else {
    // Odstraníme případné dřívější ukázkové/fiktivní objednávky
    orders = orders.filter(o => o.id !== 'CC-2026-001' && o.id !== 'CC-2026-002');
    localStorage.setItem(STORAGE_ORDERS, JSON.stringify(orders));
  }
}

initDatabase();

function getUsers() {
  return JSON.parse(localStorage.getItem(STORAGE_USERS) || '[]');
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
}

function getOrders() {
  return JSON.parse(localStorage.getItem(STORAGE_ORDERS) || '[]');
}

function saveOrders(orders) {
  localStorage.setItem(STORAGE_ORDERS, JSON.stringify(orders));
}

function getCurrentUser() {
  return JSON.parse(localStorage.getItem(STORAGE_SESSION) || 'null');
}

function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(STORAGE_SESSION, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_SESSION);
  }
  updateNavUserArea();
  renderPortal();
}

/* ============================================================
   NAVIGACE & USER CHIP
   ============================================================ */

const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
const navUserArea = document.getElementById('navUserArea');

hamburger?.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  navLinks.classList.toggle('open');
});

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    hamburger?.classList.remove('active');
    navLinks?.classList.remove('open');
  });
});

function updateNavUserArea() {
  if (!navUserArea) return;
  const user = getCurrentUser();

  if (!user) {
    navUserArea.innerHTML = `
      <a href="#objednavky" class="btn btn-primary btn-sm" onclick="switchPortalTab('login')">
        Přihlášení / Registrace
      </a>
    `;
  } else if (user.role === 'admin') {
    navUserArea.innerHTML = `
      <div class="nav-user-chip is-admin">
        <span class="badge-admin">Admin</span>
        <span>Aktivní objednávky</span>
        <button type="button" class="btn btn-ghost btn-sm" style="padding:2px 6px;" onclick="handleLogout()" title="Odhlásit se">🚪</button>
      </div>
    `;
  } else {
    navUserArea.innerHTML = `
      <div class="nav-user-chip">
        <span>👤 ${escapeHtml(user.name.split(' ')[0] || user.name)}</span>
        <button type="button" class="btn btn-ghost btn-sm" style="padding:2px 6px;" onclick="handleLogout()" title="Odhlásit se">Odhlásit</button>
      </div>
    `;
  }
}

function handleLogout() {
  setCurrentUser(null);
  showToast('Byli jste úspěšně odhlášeni.');
}

window.handleLogout = handleLogout;

/* ============================================================
   PORTÁLOVÉ STAVY (Tab switcher)
   ============================================================ */

let currentPortalTab = 'book'; // 'book' | 'my-orders' | 'admin-orders' | 'login' | 'register'
let adminFilterStatus = 'all';
let adminSearchQuery = '';

window.switchPortalTab = function(tabName) {
  currentPortalTab = tabName;
  renderPortal();
  const el = document.getElementById('objednavky');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

/* ============================================================
   HLAVNÍ RENDERER PORTÁLU
   ============================================================ */

function renderPortal() {
  const container = document.getElementById('portalContainer');
  if (!container) return;

  const user = getCurrentUser();

  // Logika určení vhodné záložky podle stavu přihlášení
  if (user && user.role === 'admin') {
    if (currentPortalTab !== 'admin-orders' && currentPortalTab !== 'book') {
      currentPortalTab = 'admin-orders';
    }
  } else if (user && user.role !== 'admin') {
    if (currentPortalTab === 'admin-orders' || currentPortalTab === 'login' || currentPortalTab === 'register') {
      currentPortalTab = 'book';
    }
  } else {
    // Nepřihlášený uživatel
    if (currentPortalTab === 'my-orders' || currentPortalTab === 'admin-orders') {
      currentPortalTab = 'login';
    }
  }

  // Tvorba Navigačních záložek
  let tabsNavHtml = '';

  if (!user) {
    tabsNavHtml = `
      <div class="portal-tabs-nav">
        <button class="portal-tab-btn ${currentPortalTab === 'book' ? 'active' : ''}" onclick="switchPortalTab('book')">
          📝 Objednat termín
        </button>
        <button class="portal-tab-btn ${currentPortalTab === 'login' ? 'active' : ''}" onclick="switchPortalTab('login')">
          🔑 Přihlášení
        </button>
        <button class="portal-tab-btn ${currentPortalTab === 'register' ? 'active' : ''}" onclick="switchPortalTab('register')">
          ✨ Registrace
        </button>
      </div>
    `;
  } else if (user.role === 'admin') {
    tabsNavHtml = `
      <div class="portal-tabs-nav">
        <button class="portal-tab-btn ${currentPortalTab === 'admin-orders' ? 'active' : ''}" onclick="switchPortalTab('admin-orders')">
          ⚙️ Aktivní a všechny objednávky (ADMIN)
        </button>
        <button class="portal-tab-btn ${currentPortalTab === 'book' ? 'active' : ''}" onclick="switchPortalTab('book')">
          ➕ Nová zakázka
        </button>
      </div>
    `;
  } else {
    // Běžný přihlášený zákazník
    tabsNavHtml = `
      <div class="portal-tabs-nav">
        <button class="portal-tab-btn ${currentPortalTab === 'book' ? 'active' : ''}" onclick="switchPortalTab('book')">
          📝 Nová objednávka
        </button>
        <button class="portal-tab-btn ${currentPortalTab === 'my-orders' ? 'active' : ''}" onclick="switchPortalTab('my-orders')">
          📋 Moje objednávky
        </button>
      </div>
    `;
  }

  // Tvorba obsahu
  let contentHtml = '';

  if (currentPortalTab === 'login') {
    contentHtml = renderLoginForm();
  } else if (currentPortalTab === 'register') {
    contentHtml = renderRegisterForm();
  } else if (currentPortalTab === 'my-orders') {
    contentHtml = renderMyOrders(user);
  } else if (currentPortalTab === 'admin-orders') {
    contentHtml = renderAdminOrders();
  } else {
    contentHtml = renderBookingForm(user);
  }

  container.innerHTML = `
    ${tabsNavHtml}
    <div class="portal-body">
      ${renderUserStatusBanner(user)}
      ${contentHtml}
    </div>
  `;

  attachPortalEvents();
}

/* User status banner uvnitř portálu */
function renderUserStatusBanner(user) {
  if (!user) {
    return `
      <div class="info-notice">
        <span>ℹ️</span>
        <div>
          Pro zobrazení historie vašich objednávek se prosím 
          <a href="javascript:void(0)" onclick="switchPortalTab('login')" style="text-decoration:underline; font-weight:700;">přihlaste</a> 
          nebo 
          <a href="javascript:void(0)" onclick="switchPortalTab('register')" style="text-decoration:underline; font-weight:700;">zaregistrujte</a>.
          Objednávku můžete odeslat i přímo vyplněním níže uvedeného formuláře.
        </div>
      </div>
    `;
  }

  return `
    <div class="portal-user-banner">
      <div class="pub-info">
        <strong>${escapeHtml(user.name)} ${user.role === 'admin' ? '<span class="badge-admin">Admin</span>' : ''}</strong>
        <span>Email: ${escapeHtml(user.email)} ${user.phone ? '· Tel: ' + escapeHtml(user.phone) : ''}</span>
      </div>
      <div class="pub-actions">
        ${user.role === 'admin' ? `
          <button type="button" class="btn btn-outline btn-sm" onclick="switchPortalTab('admin-orders')">
            Zobrazit objednávky
          </button>
        ` : `
          <button type="button" class="btn btn-outline btn-sm" onclick="switchPortalTab('my-orders')">
            Moje objednávky
          </button>
        `}
        <button type="button" class="btn btn-danger btn-sm" onclick="handleLogout()">Odhlásit</button>
      </div>
    </div>
  `;
}

/* ============================================================
   FORMULÁŘ PRO PŘIHLÁŠENÍ (LOGIN)
   ============================================================ */

function renderLoginForm() {
  return `
    <div style="max-width:440px; margin:0 auto;">
      <h3 style="font-size:1.35rem; font-weight:900; margin-bottom:8px; text-align:center;">Přihlášení do systému</h3>
      <p style="color:var(--muted); font-size:0.88rem; text-align:center; margin-bottom:24px;">
        Zadejte svůj e-mail a heslo pro přístup k vašim objednávkám.
      </p>

      <form id="loginForm" novalidate>
        <div class="form-group">
          <label class="form-label" for="loginEmail">E-mail nebo přihlašovací jméno <span class="req">*</span></label>
          <input type="text" id="loginEmail" class="form-input" autocomplete="username" required />
          <span class="form-error" id="err-loginEmail"></span>
        </div>

        <div class="form-group">
          <label class="form-label" for="loginPassword">Heslo <span class="req">*</span></label>
          <input type="password" id="loginPassword" class="form-input" autocomplete="current-password" required />
          <span class="form-error" id="err-loginPassword"></span>
        </div>

        <div class="form-error" id="loginGeneralError" style="text-align:center; margin-bottom:14px;"></div>

        <button type="submit" class="btn btn-primary" style="width:100%;">
          Přihlásit se do účtu ↗
        </button>

        <div class="auth-switch-text">
          Nemáte ještě účet? 
          <span class="auth-switch-link" onclick="switchPortalTab('register')">Zaregistrujte se</span>
        </div>

        <div style="margin-top:24px; padding:12px; background:var(--bg); border-radius:var(--radius); font-size:0.78rem; color:var(--muted); text-align:center;">
          🔒 <strong>Administrátorský přístup:</strong><br/>
          E-mail: <code style="font-weight:700;">admin</code> &nbsp;|&nbsp; Heslo: <code style="font-weight:700;">admin6758</code>
        </div>
      </form>
    </div>
  `;
}

/* ============================================================
   FORMULÁŘ PRO REGISTRACI (REGISTER)
   ============================================================ */

function renderRegisterForm() {
  return `
    <div style="max-width:520px; margin:0 auto;">
      <h3 style="font-size:1.35rem; font-weight:900; margin-bottom:8px; text-align:center;">Registrace nového zákazníka</h3>
      <p style="color:var(--muted); font-size:0.88rem; text-align:center; margin-bottom:24px;">
        Vytvořte si účet pro jednoduché objednávání a sledování stavu zakázek.
      </p>

      <form id="registerForm" novalidate>
        <div class="form-group">
          <label class="form-label" for="regName">Jméno a příjmení <span class="req">*</span></label>
          <input type="text" id="regName" class="form-input" required />
          <span class="form-error" id="err-regName"></span>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="regPhone">Telefonní číslo <span class="req">*</span></label>
            <input type="tel" id="regPhone" class="form-input" required />
            <span class="form-error" id="err-regPhone"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="regEmail">E-mail <span class="req">*</span></label>
            <input type="email" id="regEmail" class="form-input" required />
            <span class="form-error" id="err-regEmail"></span>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="regPassword">Heslo <span class="req">*</span></label>
            <input type="password" id="regPassword" class="form-input" autocomplete="new-password" required />
            <span class="form-error" id="err-regPassword"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="regPasswordConfirm">Potvrzení hesla <span class="req">*</span></label>
            <input type="password" id="regPasswordConfirm" class="form-input" autocomplete="new-password" required />
            <span class="form-error" id="err-regPasswordConfirm"></span>
          </div>
        </div>

        <div class="terms-check-box">
          <label class="terms-label">
            <input type="checkbox" id="regTerms" required />
            <span>
              Souhlasím s <a href="javascript:void(0)" onclick="openTermsModal('terms')" class="terms-link">obchodními podmínkami</a> 
              a se <a href="javascript:void(0)" onclick="openTermsModal('privacy')" class="terms-link">zpracováním osobních údajů (GDPR)</a>. <span class="req">*</span>
            </span>
          </label>
          <span class="form-error" id="err-regTerms"></span>
        </div>

        <div class="form-error" id="regGeneralError" style="text-align:center; margin-bottom:14px;"></div>

        <button type="submit" class="btn btn-primary" style="width:100%;">
          Dokončit registraci a vytvořit účet ↗
        </button>

        <div class="auth-switch-text">
          Již máte účet? 
          <span class="auth-switch-link" onclick="switchPortalTab('login')">Přihlaste se</span>
        </div>
      </form>
    </div>
  `;
}

/* ============================================================
   FORMULÁŘ OBJEDNÁVKY (BOOKING)
   ============================================================ */

function renderBookingForm(user) {
  // Datum minimálně zítra (bez neděle)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  while (tomorrow.getDay() === 0) {
    tomorrow.setDate(tomorrow.getDate() + 1);
  }
  const minDate = tomorrow.toISOString().split('T')[0];

  return `
    <div>
      <div style="margin-bottom:24px;">
        <h3 style="font-size:1.35rem; font-weight:900; margin-bottom:6px;">Objednání do servisu</h3>
        <p style="color:var(--muted); font-size:0.9rem;">
          Vyplňte údaje o vozidle a požadované službě. Budeme vás neprodleně kontaktovat s potvrzením termínu.
        </p>
      </div>

      <form id="bookingOrderForm" novalidate>
        <!-- Kontaktní údaje (pokud je přihlášen, předvyplní se) -->
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="bookName">Jméno a příjmení <span class="req">*</span></label>
            <input type="text" id="bookName" class="form-input" value="${user ? escapeHtml(user.name) : ''}" required />
            <span class="form-error" id="err-bookName"></span>
          </div>

          <div class="form-group">
            <label class="form-label" for="bookPhone">Telefonní číslo <span class="req">*</span></label>
            <input type="tel" id="bookPhone" class="form-input" value="${user && user.phone ? escapeHtml(user.phone) : ''}" required />
            <span class="form-error" id="err-bookPhone"></span>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="bookEmail">E-mail <span class="req">*</span></label>
            <input type="email" id="bookEmail" class="form-input" value="${user && user.email !== 'admin' ? escapeHtml(user.email) : ''}" required />
            <span class="form-error" id="err-bookEmail"></span>
          </div>

          <div class="form-group">
            <label class="form-label" for="bookCarPlate">SPZ vozidla <span class="req">*</span></label>
            <input type="text" id="bookCarPlate" class="form-input" required />
            <span class="form-error" id="err-bookCarPlate"></span>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="bookCarModel">Značka a model vozidla</label>
            <input type="text" id="bookCarModel" class="form-input" />
            <span class="form-error" id="err-bookCarModel"></span>
          </div>

          <div class="form-group">
            <label class="form-label" for="bookService">Požadovaná služba <span class="req">*</span></label>
            <select id="bookService" class="form-select" required>
              <option value="">– Vyberte službu ze seznamu –</option>
              <option>Servis a údržba vozidel</option>
              <option>Pneuservis</option>
              <option>Oprava motorů</option>
              <option>Servis automatických převodovek</option>
              <option>Autoelektrika</option>
              <option>Servis klimatizací</option>
              <option>Geometrie kol</option>
              <option>Výměna čelních skel</option>
              <option>Montáž tažných zařízení</option>
              <option>Čištění interiérů</option>
              <option>Strojní leštění autolaků</option>
              <option>Renovace světlometů</option>
              <option>Příprava na STK</option>
              <option>Diagnostika a jiná oprava</option>
            </select>
            <span class="form-error" id="err-bookService"></span>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="bookDate">Preferovaný termín přistavení <span class="req">*</span></label>
            <input type="date" id="bookDate" class="form-input" min="${minDate}" required />
            <span class="form-error" id="err-bookDate"></span>
          </div>

          <div class="form-group">
            <label class="form-label" for="bookTime">Čas přistavení</label>
            <input type="time" id="bookTime" class="form-input" />
          </div>
        </div>

        <div class="form-group full">
          <label class="form-label" for="bookNote">Popis závady / poznámka k zakázce</label>
          <textarea id="bookNote" class="form-textarea" rows="3"></textarea>
        </div>

        <!-- Podmínky -->
        <div class="terms-check-box">
          <label class="terms-label">
            <input type="checkbox" id="bookTerms" required />
            <span>
              Souhlasím s <a href="javascript:void(0)" onclick="openTermsModal('terms')" class="terms-link">obchodními podmínkami servisu</a> 
              a se <a href="javascript:void(0)" onclick="openTermsModal('privacy')" class="terms-link">zpracováním osobních údajů</a>. Beru na vědomí, že přesný rozsah prací bude stanoven při předání vozidla. <span class="req">*</span>
            </span>
          </label>
          <span class="form-error" id="err-bookTerms"></span>
        </div>

        <button type="submit" class="btn btn-primary" style="width:100%; font-size:1rem; padding:14px;">
          Odeslat závaznou objednávku servisu ↗
        </button>
      </form>
    </div>
  `;
}

/* ============================================================
   MOJE OBJEDNÁVKY (Zákazník)
   ============================================================ */

function renderMyOrders(user) {
  const allOrders = getOrders();
  // Filtrujeme pouze objednávky tohoto uživatele
  const myOrders = allOrders.filter(o => 
    o.userId === user.id || 
    (o.customerEmail && o.customerEmail.toLowerCase() === user.email.toLowerCase())
  );

  if (myOrders.length === 0) {
    return `
      <div>
        <div class="orders-header-bar">
          <h3 style="font-size:1.3rem; font-weight:900;">Moje objednávky</h3>
          <button type="button" class="btn btn-primary btn-sm" onclick="switchPortalTab('book')">
            ➕ Nová objednávka
          </button>
        </div>
        <div class="empty-orders-state">
          <div style="font-size:3rem; margin-bottom:12px;">📋</div>
          <h4>Zatím nemáte žádné aktivní objednávky</h4>
          <p>Potřebujete servis, přezutí nebo opravu vašeho vozu? Vytvořte si svou první rezervaci.</p>
          <button type="button" class="btn btn-primary" style="margin-top:16px;" onclick="switchPortalTab('book')">
            Objednat se do servisu ↗
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div>
      <div class="orders-header-bar">
        <div>
          <h3 style="font-size:1.3rem; font-weight:900;">Moje objednávky (${myOrders.length})</h3>
          <p style="color:var(--muted); font-size:0.84rem;">Přehled stavu vašich rezervací v servisu ComplexCar.</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="switchPortalTab('book')">
          ➕ Nová objednávka
        </button>
      </div>

      <div class="orders-list">
        ${myOrders.map(order => renderOrderCard(order, false)).join('')}
      </div>
    </div>
  `;
}

/* ============================================================
   ADMINISTRACE OBJEDNÁVEK (ADMIN PANEL)
   ============================================================ */

function renderAdminOrders() {
  const allOrders = getOrders();

  // Filtrování
  let filtered = allOrders.slice();

  if (adminFilterStatus !== 'all') {
    filtered = filtered.filter(o => o.status === adminFilterStatus);
  }

  if (adminSearchQuery.trim()) {
    const q = adminSearchQuery.toLowerCase().trim();
    filtered = filtered.filter(o => 
      (o.id && o.id.toLowerCase().includes(q)) ||
      (o.customerName && o.customerName.toLowerCase().includes(q)) ||
      (o.customerPhone && o.customerPhone.includes(q)) ||
      (o.carPlate && o.carPlate.toLowerCase().includes(q)) ||
      (o.carModel && o.carModel.toLowerCase().includes(q)) ||
      (o.service && o.service.toLowerCase().includes(q))
    );
  }

  // Statistiky
  const total = allOrders.length;
  const countNova = allOrders.filter(o => o.status === 'nova').length;
  const countVreseni = allOrders.filter(o => o.status === 'v-reseni' || o.status === 'prijato').length;
  const countDokonceno = allOrders.filter(o => o.status === 'dokonceno').length;

  return `
    <div>
      <div class="orders-header-bar">
        <div>
          <h3 style="font-size:1.35rem; font-weight:900;">
            Správa všech zakázek (Admin Panel)
          </h3>
          <p style="color:var(--muted); font-size:0.84rem;">
            Kompletní evidence objednávek servisu ComplexCar s možností změny stavu, tisku a exportu.
          </p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn btn-outline btn-sm" onclick="exportOrdersToCSV()" title="Stáhnout jako tabulku">
            📥 Export CSV
          </button>
        </div>
      </div>

      <!-- Souhrnné statistiky -->
      <div class="orders-stats-row">
        <div class="ostat-card">
          <span class="ostat-num">${total}</span>
          <span class="ostat-label">Všechny</span>
        </div>
        <div class="ostat-card" style="border-color:#fde68a;">
          <span class="ostat-num" style="color:#92400e;">${countNova}</span>
          <span class="ostat-label">Nové k vyřízení</span>
        </div>
        <div class="ostat-card" style="border-color:#fef08a;">
          <span class="ostat-num" style="color:#854d0e;">${countVreseni}</span>
          <span class="ostat-label">V řešení / Přijaté</span>
        </div>
        <div class="ostat-card" style="border-color:#bbf7d0;">
          <span class="ostat-num" style="color:#166534;">${countDokonceno}</span>
          <span class="ostat-label">Dokončené</span>
        </div>
      </div>

      <!-- Filtry a hledání -->
      <div class="orders-filter-row">
        <button class="filter-btn ${adminFilterStatus === 'all' ? 'active' : ''}" onclick="setAdminFilter('all')">Všechny (${total})</button>
        <button class="filter-btn ${adminFilterStatus === 'nova' ? 'active' : ''}" onclick="setAdminFilter('nova')">Nové (${countNova})</button>
        <button class="filter-btn ${adminFilterStatus === 'prijato' ? 'active' : ''}" onclick="setAdminFilter('prijato')">Přijato</button>
        <button class="filter-btn ${adminFilterStatus === 'v-reseni' ? 'active' : ''}" onclick="setAdminFilter('v-reseni')">V řešení</button>
        <button class="filter-btn ${adminFilterStatus === 'dokonceno' ? 'active' : ''}" onclick="setAdminFilter('dokonceno')">Dokončeno</button>
        <button class="filter-btn ${adminFilterStatus === 'zruseno' ? 'active' : ''}" onclick="setAdminFilter('zruseno')">Zrušeno</button>

        <input 
          type="text" 
          class="orders-search-input" 
          id="adminSearchInput" 
          placeholder="Hledat SPZ, jméno, telefon..." 
          value="${escapeHtml(adminSearchQuery)}"
        />
      </div>

      <!-- Seznam objednávek -->
      <div class="orders-list">
        ${allOrders.length === 0 ? `
          <div class="empty-orders-state">
            <div style="font-size:2.8rem; margin-bottom:10px;">📥</div>
            <h4>Zatím nebyly přijaty žádné objednávky</h4>
            <p>Jakmile zákazník odešle objednávku z formuláře na webu, okamžitě se zde zobrazí v reálném čase.</p>
          </div>
        ` : (filtered.length === 0 ? `
          <div class="empty-orders-state">
            <h4>Žádné objednávky neodpovídají zadanému filtru</h4>
            <p>Zkuste upravit vyhledávací dotaz nebo vybrat jiný stav zakázky.</p>
          </div>
        ` : filtered.map(order => renderOrderCard(order, true)).join(''))}
      </div>
    </div>
  `;
}

window.setAdminFilter = function(status) {
  adminFilterStatus = status;
  renderPortal();
};

/* Karta jednotlivé objednávky */
function renderOrderCard(order, isAdmin) {
  const statusLabels = {
    'nova': 'Nová objednávka',
    'prijato': 'Přijato do servisu',
    'v-reseni': 'V řešení / Na dílně',
    'dokonceno': 'Dokončeno',
    'zruseno': 'Zrušeno'
  };

  const statusIcons = {
    'nova': '🟡',
    'prijato': '🔵',
    'v-reseni': '⚙️',
    'dokonceno': '✅',
    'zruseno': '❌'
  };

  const dateFormatted = order.date ? formatDateCz(order.date) : 'Nespecifikováno';

  return `
    <div class="order-card" id="order-${order.id}">
      <div class="order-top">
        <div>
          <span class="order-id">#${escapeHtml(order.id)}</span>
          <span class="order-created">Vytvořeno: ${formatDateTimeCz(order.createdAt)}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="status-badge ${order.status}">
            <span>${statusIcons[order.status] || '•'}</span>
            <span>${statusLabels[order.status] || order.status}</span>
          </span>
          <button type="button" class="btn btn-outline btn-sm" onclick="printOrderSheet('${order.id}')" title="Vytisknout zakázkový list" style="padding:4px 8px;">
            🖨️ Tisk
          </button>
        </div>
      </div>

      <div class="order-grid-details">
        <div class="ogd-item">
          <strong>Zákazník</strong>
          <span>${escapeHtml(order.customerName)}</span>
        </div>
        <div class="ogd-item">
          <strong>Vozidlo</strong>
          <span>${escapeHtml(order.carPlate)} ${order.carModel ? '· ' + escapeHtml(order.carModel) : ''}</span>
        </div>
        <div class="ogd-item">
          <strong>Požadovaná služba</strong>
          <span style="color:var(--black); font-weight:700;">${escapeHtml(order.service)}</span>
        </div>
        <div class="ogd-item">
          <strong>Termín přistavení</strong>
          <span>📅 ${dateFormatted} v ${escapeHtml(order.time || '8:00')}</span>
        </div>
      </div>

      ${order.note ? `
        <div class="order-note-block">
          <strong>Poznámka / Závada:</strong> ${escapeHtml(order.note)}
        </div>
      ` : ''}

      <div class="order-bottom-actions">
        <div class="order-contact-quick">
          <span>📞 <a href="tel:${escapeHtml(order.customerPhone)}">${escapeHtml(order.customerPhone)}</a></span>
          ${order.customerEmail ? `<span>✉️ <a href="mailto:${escapeHtml(order.customerEmail)}">${escapeHtml(order.customerEmail)}</a></span>` : ''}
        </div>

        ${isAdmin ? `
          <div class="admin-status-change">
            <span style="font-size:0.78rem; font-weight:700; color:var(--muted); text-transform:uppercase;">Stav:</span>
            <select class="admin-status-select" onchange="changeOrderStatus('${order.id}', this.value)">
              <option value="nova" ${order.status === 'nova' ? 'selected' : ''}>🟡 Nová</option>
              <option value="prijato" ${order.status === 'prijato' ? 'selected' : ''}>🔵 Přijato</option>
              <option value="v-reseni" ${order.status === 'v-reseni' ? 'selected' : ''}>⚙️ V řešení</option>
              <option value="dokonceno" ${order.status === 'dokonceno' ? 'selected' : ''}>✅ Dokončeno</option>
              <option value="zruseno" ${order.status === 'zruseno' ? 'selected' : ''}>❌ Zrušeno</option>
            </select>
            <button type="button" class="btn btn-outline btn-sm" onclick="deleteOrder('${order.id}')" title="Smazat zakázku" style="color:#dc2626;">
              🗑️
            </button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

window.changeOrderStatus = function(orderId, newStatus) {
  const orders = getOrders();
  const order = orders.find(o => o.id === orderId);
  if (order) {
    order.status = newStatus;
    saveOrders(orders);
    showToast(`Stav objednávky #${orderId} byl změněn.`);
    renderPortal();
  }
};

window.deleteOrder = function(orderId) {
  if (confirm(`Opravdu si přejete smazat objednávku #${orderId}?`)) {
    let orders = getOrders();
    orders = orders.filter(o => o.id !== orderId);
    saveOrders(orders);
    showToast(`Objednávka #${orderId} byla odstraněna.`);
    renderPortal();
  }
};

/* ============================================================
   TISK ZAKÁZKOVÉHO LISTU & EXPORT CSV
   ============================================================ */

window.printOrderSheet = function(orderId) {
  const orders = getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    alert('Povolte vyskakovací okna pro tisk zakázkového listu.');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="cs">
    <head>
      <meta charset="UTF-8">
      <title>Zakázkový list #${escapeHtml(order.id)} – ComplexCar</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.5; font-size: 14px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1a1a1a; padding-bottom: 15px; margin-bottom: 25px; }
        .logo { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
        .order-title { font-size: 20px; font-weight: 800; margin-bottom: 20px; }
        .box { border: 1px solid #ccc; padding: 15px; margin-bottom: 20px; border-radius: 4px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #666; margin-bottom: 2px; }
        .val { font-size: 15px; font-weight: 600; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 50px; }
        .sign-line { border-top: 1px dashed #666; padding-top: 8px; text-align: center; font-size: 12px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">ComplexCar – Autoservis</div>
          <div>Areál TRADO, Průmyslová 154, Třebíč 674 01</div>
          <div>Tel: +420 774 851 840 | Email: info@complexcar.cz</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 18px; font-weight: 800;">ZAKÁZKOVÝ LIST</div>
          <div>Ev. číslo: <strong>#${escapeHtml(order.id)}</strong></div>
          <div>Datum: ${formatDateTimeCz(order.createdAt)}</div>
        </div>
      </div>

      <div class="box">
        <div class="grid">
          <div>
            <div class="label">Zákazník</div>
            <div class="val">${escapeHtml(order.customerName)}</div>
            <div style="margin-top:4px;">Tel: ${escapeHtml(order.customerPhone)}</div>
            ${order.customerEmail ? `<div>Email: ${escapeHtml(order.customerEmail)}</div>` : ''}
          </div>
          <div>
            <div class="label">Vozidlo</div>
            <div class="val">${escapeHtml(order.carPlate)}</div>
            <div>Model: ${escapeHtml(order.carModel || 'Neuvedeno')}</div>
          </div>
        </div>
      </div>

      <div class="box">
        <div class="grid">
          <div>
            <div class="label">Požadovaná služba</div>
            <div class="val">${escapeHtml(order.service)}</div>
          </div>
          <div>
            <div class="label">Termín přistavení</div>
            <div class="val">${formatDateCz(order.date)} v ${escapeHtml(order.time || '8:00')}</div>
          </div>
        </div>
        ${order.note ? `
          <div style="margin-top:15px; padding-top:10px; border-top:1px solid #eee;">
            <div class="label">Popis závady / Poznámka</div>
            <div>${escapeHtml(order.note)}</div>
          </div>
        ` : ''}
      </div>

      <div class="signatures">
        <div>
          <div class="sign-line">Podpis přejímajícího technika</div>
        </div>
        <div>
          <div class="sign-line">Podpis zákazníka (souhlas s podmínkami)</div>
        </div>
      </div>
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};

window.exportOrdersToCSV = function() {
  const orders = getOrders();
  if (orders.length === 0) {
    showToast('Žádné objednávky k exportu.');
    return;
  }

  const headers = ['ID', 'Datum vytvoření', 'Zákazník', 'Telefon', 'Email', 'SPZ', 'Model', 'Služba', 'Termín', 'Čas', 'Stav', 'Poznámka'];
  const rows = orders.map(o => [
    `"${o.id}"`,
    `"${o.createdAt}"`,
    `"${(o.customerName || '').replace(/"/g, '""')}"`,
    `"${o.customerPhone || ''}"`,
    `"${o.customerEmail || ''}"`,
    `"${o.carPlate || ''}"`,
    `"${(o.carModel || '').replace(/"/g, '""')}"`,
    `"${(o.service || '').replace(/"/g, '""')}"`,
    `"${o.date || ''}"`,
    `"${o.time || ''}"`,
    `"${o.status || ''}"`,
    `"${(o.note || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `complexcar_objednavky_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Export CSV byl stažen.');
};

/* ============================================================
   OBSLUHA UDÁLOSTÍ FORMULÁŘŮ
   ============================================================ */

function attachPortalEvents() {
  // 1. LOGIN SUBMIT
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      clearErrors(['loginEmail', 'loginPassword', 'loginGeneralError']);

      const emailVal = document.getElementById('loginEmail')?.value.trim();
      const passVal = document.getElementById('loginPassword')?.value;

      let valid = true;
      if (!emailVal) {
        showError('loginEmail', 'Zadejte e-mail nebo přihlašovací jméno.');
        valid = false;
      }
      if (!passVal) {
        showError('loginPassword', 'Zadejte heslo.');
        valid = false;
      }

      if (!valid) return;

      const users = getUsers();
      const user = users.find(u => 
        (u.email.toLowerCase() === emailVal.toLowerCase()) && 
        u.password === passVal
      );

      if (!user) {
        showError('loginGeneralError', 'Neplatné přihlašovací jméno nebo heslo.');
        return;
      }

      // Úspěšné přihlášení
      setCurrentUser(user);
      showToast(`Vítejte zpět, ${user.name}!`);
    });
  }

  // 2. REGISTER SUBMIT
  const regForm = document.getElementById('registerForm');
  if (regForm) {
    regForm.addEventListener('submit', (e) => {
      e.preventDefault();
      clearErrors(['regName', 'regPhone', 'regEmail', 'regPassword', 'regPasswordConfirm', 'regTerms', 'regGeneralError']);

      const name = document.getElementById('regName')?.value.trim();
      const phone = document.getElementById('regPhone')?.value.trim();
      const email = document.getElementById('regEmail')?.value.trim();
      const pass = document.getElementById('regPassword')?.value;
      const passConf = document.getElementById('regPasswordConfirm')?.value;
      const terms = document.getElementById('regTerms')?.checked;

      let valid = true;

      if (!name || name.length < 2) {
        showError('regName', 'Zadejte prosím vaše celé jméno.');
        valid = false;
      }
      if (!phone || phone.length < 9) {
        showError('regPhone', 'Zadejte platné telefonní číslo.');
        valid = false;
      }
      if (!email || !validateEmail(email)) {
        showError('regEmail', 'Zadejte platnou e-mailovou adresu.');
        valid = false;
      }
      if (!pass || pass.length < 4) {
        showError('regPassword', 'Heslo musí mít alespoň 4 znaky.');
        valid = false;
      }
      if (pass !== passConf) {
        showError('regPasswordConfirm', 'Zadaná hesla se neshodují.');
        valid = false;
      }
      if (!terms) {
        showError('regTerms', 'Pro dokončení registrace musíte souhlasit s podmínkami.');
        valid = false;
      }

      if (!valid) return;

      const users = getUsers();
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        showError('regGeneralError', 'Uživatel s tímto e-mailem již existuje. Přihlaste se.');
        return;
      }

      // Vytvoření uživatele
      const newUser = {
        id: 'usr_' + Date.now(),
        name: name,
        phone: phone,
        email: email,
        password: pass,
        role: 'user',
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      saveUsers(users);

      setCurrentUser(newUser);
      showToast('Váš účet byl úspěšně vytvořen!');
    });
  }

  // 3. BOOKING ORDER SUBMIT
  const bookForm = document.getElementById('bookingOrderForm');
  if (bookForm) {
    bookForm.addEventListener('submit', (e) => {
      e.preventDefault();
      clearErrors(['bookName', 'bookPhone', 'bookEmail', 'bookCarPlate', 'bookService', 'bookDate', 'bookTerms']);

      const name = document.getElementById('bookName')?.value.trim();
      const phone = document.getElementById('bookPhone')?.value.trim();
      const email = document.getElementById('bookEmail')?.value.trim();
      const carPlate = document.getElementById('bookCarPlate')?.value.trim();
      const carModel = document.getElementById('bookCarModel')?.value.trim();
      const service = document.getElementById('bookService')?.value;
      const date = document.getElementById('bookDate')?.value;
      const time = document.getElementById('bookTime')?.value;
      const note = document.getElementById('bookNote')?.value.trim();
      const terms = document.getElementById('bookTerms')?.checked;

      let valid = true;

      if (!name || name.length < 2) {
        showError('bookName', 'Zadejte prosím jméno a příjmení.');
        valid = false;
      }
      if (!phone || phone.length < 9) {
        showError('bookPhone', 'Zadejte telefonní kontakt.');
        valid = false;
      }
      if (!email || !validateEmail(email)) {
        showError('bookEmail', 'Zadejte platný e-mail.');
        valid = false;
      }
      if (!carPlate || carPlate.length < 2) {
        showError('bookCarPlate', 'Zadejte SPZ vozidla.');
        valid = false;
      }
      if (!service) {
        showError('bookService', 'Vyberte požadovanou službu.');
        valid = false;
      }
      if (!date) {
        showError('bookDate', 'Vyberte termín přistavení vozu.');
        valid = false;
      }
      if (!terms) {
        showError('bookTerms', 'Potvrďte prosím souhlas s obchodními podmínkami.');
        valid = false;
      }

      if (!valid) return;

      const user = getCurrentUser();
      const newOrderId = 'CC-' + new Date().getFullYear() + '-' + String(Math.floor(100 + Math.random() * 900));

      const newOrder = {
        id: newOrderId,
        userId: user ? user.id : 'guest_' + Date.now(),
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        carPlate: carPlate.toUpperCase(),
        carModel: carModel,
        service: service,
        date: date,
        time: time,
        note: note,
        status: 'nova',
        createdAt: new Date().toISOString()
      };

      const orders = getOrders();
      orders.unshift(newOrder);
      saveOrders(orders);

      showOrderSuccess(newOrder);
    });
  }

  // 4. ADMIN SEARCH REALTIME
  const adminSearchInput = document.getElementById('adminSearchInput');
  if (adminSearchInput) {
    adminSearchInput.addEventListener('input', (e) => {
      adminSearchQuery = e.target.value;
      // Re-render seznamu bez ztráty focusu
      const filtered = getOrders().filter(o => {
        if (adminFilterStatus !== 'all' && o.status !== adminFilterStatus) return false;
        if (!adminSearchQuery.trim()) return true;
        const q = adminSearchQuery.toLowerCase().trim();
        return (
          (o.id && o.id.toLowerCase().includes(q)) ||
          (o.customerName && o.customerName.toLowerCase().includes(q)) ||
          (o.customerPhone && o.customerPhone.includes(q)) ||
          (o.carPlate && o.carPlate.toLowerCase().includes(q)) ||
          (o.service && o.service.toLowerCase().includes(q))
        );
      });

      const listEl = document.querySelector('.orders-list');
      if (listEl) {
        listEl.innerHTML = filtered.length === 0 ? `
          <div class="empty-orders-state">
            <h4>Žádné objednávky neodpovídají zadanému dotazu</h4>
          </div>
        ` : filtered.map(o => renderOrderCard(o, true)).join('');
      }
    });
  }
}

function showOrderSuccess(order) {
  const container = document.getElementById('portalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="portal-body">
      <div class="portal-success">
        <div class="portal-success-icon">✅</div>
        <h3>Objednávka #${escapeHtml(order.id)} byla přijata!</h3>
        <p>
          Děkujeme za vaši rezervaci. Objednávku jsme zaevidovali na jméno 
          <strong>${escapeHtml(order.customerName)}</strong> pro vůz <strong>${escapeHtml(order.carPlate)}</strong> 
          na termín <strong>${formatDateCz(order.date)} v ${escapeHtml(order.time)}</strong>.
          Budeme vás kontaktovat na čísle <strong>${escapeHtml(order.customerPhone)}</strong>.
        </p>

        <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
          <button type="button" class="btn btn-outline" onclick="printOrderSheet('${order.id}')">
            🖨️ Vytisknout potvrzení
          </button>
          <button type="button" class="btn btn-primary" onclick="switchPortalTab('book')">
            Vytvořit další objednávku
          </button>
          ${getCurrentUser() ? `
            <button type="button" class="btn btn-outline" onclick="switchPortalTab('${getCurrentUser().role === 'admin' ? 'admin-orders' : 'my-orders'}')">
              Přejít na seznam objednávek ↗
            </button>
          ` : `
            <button type="button" class="btn btn-outline" onclick="switchPortalTab('register')">
              Vytvořit si účet a sledovat zakázky
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   MODAL OBCHODNÍCH PODMÍNEK A GDPR
   ============================================================ */

const termsModal = document.getElementById('termsModal');
const termsClose = document.getElementById('termsClose');
const termsOverlay = document.getElementById('termsOverlay');
const termsOkBtn = document.getElementById('termsOkBtn');
const openTermsBtn = document.getElementById('openTermsBtn');
const openPrivacyBtn = document.getElementById('openPrivacyBtn');

window.openTermsModal = function(type) {
  if (!termsModal) return;
  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) {
    modalTitle.textContent = type === 'privacy' 
      ? 'Zásady zpracování osobních údajů (GDPR)' 
      : 'Obchodní podmínky a reklamační řád servisu';
  }
  termsModal.classList.add('open');
  termsModal.setAttribute('aria-hidden', 'false');
};

function closeTermsModal() {
  if (!termsModal) return;
  termsModal.classList.remove('open');
  termsModal.setAttribute('aria-hidden', 'true');
}

termsClose?.addEventListener('click', closeTermsModal);
termsOverlay?.addEventListener('click', closeTermsModal);
termsOkBtn?.addEventListener('click', closeTermsModal);

openTermsBtn?.addEventListener('click', () => openTermsModal('terms'));
openPrivacyBtn?.addEventListener('click', () => openTermsModal('privacy'));

/* Kliknutí na tlačítko služby předvybere službu ve formuláři */
document.querySelectorAll('.srv-btn, .srv-link').forEach(link => {
  link.addEventListener('click', (e) => {
    const srvName = link.dataset.service;
    if (srvName) {
      setTimeout(() => {
        const select = document.getElementById('bookService');
        if (select) {
          select.value = srvName;
        }
      }, 100);
    }
  });
});

/* ============================================================
   POMOCNÉ FUNKCE
   ============================================================ */

function showError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const err = document.getElementById('err-' + fieldId) || (fieldId === 'loginGeneralError' || fieldId === 'regGeneralError' ? input : null);
  if (input && input.classList) {
    input.classList.add('error');
  }
  if (err) {
    err.textContent = message;
  }
}

function clearErrors(fieldIds) {
  fieldIds.forEach(id => {
    const input = document.getElementById(id);
    const err = document.getElementById('err-' + id);
    if (input && input.classList) input.classList.remove('error');
    if (err) err.textContent = '';
  });
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateCz(isoDate) {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[2], 10)}. ${parseInt(parts[1], 10)}. ${parts[0]}`;
  }
  return isoDate;
}

function formatDateTimeCz(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()} v ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 100000;
    background: #121316;
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    border: 1px solid #d4a017;
    font-size: 0.88rem;
    font-weight: 600;
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    transition: transform 0.3s ease, opacity 0.3s ease;
    transform: translateY(-20px);
    opacity: 0;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => toast.remove(), 350);
  }, 3200);
}

/* ============================================================
   BACK TO TOP
   ============================================================ */
const backTop = document.getElementById('backTop');
window.addEventListener('scroll', () => {
  backTop?.classList.toggle('visible', window.scrollY > 450);
}, { passive: true });
backTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// Prvotní spuštění vykreslení
updateNavUserArea();
renderPortal();
