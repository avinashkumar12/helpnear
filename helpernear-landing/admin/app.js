/* ═══════════════════════════════════════════
   HelperNear Admin Panel – app.js
   ═══════════════════════════════════════════ */

const API = '/api/v1';

// ── Branding ──
(async function loadBranding() {
  try {
    const res = await fetch(`${API}/public/branding`);
    if (!res.ok) return;
    const { data } = await res.json();
    if (data.logoLightUrl) document.querySelectorAll('img[src*="logo-light"]').forEach(el => { el.src = data.logoLightUrl; });
    if (data.logoUrl)      document.querySelectorAll('img[src*="/assets/logo.svg"]').forEach(el => { el.src = data.logoUrl; });
    if (data.logoIconUrl)  document.querySelectorAll('img[src*="logo-icon"]').forEach(el => { el.src = data.logoIconUrl; });
  } catch (_) {}
})();

// ── Chart instances ──
let workerStatusChart = null;
let roleChart = null;

// ── Cached data for client-side filtering ──
let _allWorkers = [];
let _allUsers = [];

// ══════════════════════════════
// CONFIRM MODAL
// ══════════════════════════════
function showConfirm({ title = 'Are you sure?', message = 'This action cannot be undone.', icon = 'trash-2', confirmText = 'Delete', danger = true } = {}) {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-icon').innerHTML = `<i data-lucide="${icon}"></i>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    const okBtn = document.getElementById('confirm-ok');
    okBtn.textContent = confirmText;
    okBtn.className = 'btn-confirm-ok' + (danger ? '' : ' confirm-primary');
    overlay.classList.remove('hidden');

    function cleanup(result) {
      overlay.classList.add('hidden');
      okBtn.onclick = null;
      document.getElementById('confirm-cancel').onclick = null;
      overlay.onclick = null;
      resolve(result);
    }

    okBtn.onclick = () => cleanup(true);
    document.getElementById('confirm-cancel').onclick = () => cleanup(false);
    overlay.onclick = e => { if (e.target === overlay) cleanup(false); };
  });
}

// ══════════════════════════════
// TOKEN / AUTH HELPERS
// ══════════════════════════════
function token() {
  return localStorage.getItem('hn_admin_token');
}

function currentAdmin() {
  const u = localStorage.getItem('hn_admin_user');
  return u ? JSON.parse(u) : null;
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token()
  };
}

// ══════════════════════════════
// LOADER
// ══════════════════════════════
function showLoader() {
  const el = document.getElementById('global-loader');
  if (el) el.style.display = 'flex';
}

function hideLoader() {
  const el = document.getElementById('global-loader');
  if (el) el.style.display = 'none';
}

// ══════════════════════════════
// TOAST
// ══════════════════════════════
let _toastTimer = null;

function showToast(msg, type = 'info', duration = 3500) {
  const el = document.getElementById('global-toast');
  if (!el) return;
  clearTimeout(_toastTimer);
  el.textContent = msg;
  el.className = 'toast show';
  if (type === 'success') el.classList.add('toast-success');
  else if (type === 'error') el.classList.add('toast-error');
  else el.classList.add('toast-info');
  _toastTimer = setTimeout(() => {
    el.classList.remove('show');
  }, duration);
}

function showLoginToast(msg, type = 'error') {
  const el = document.getElementById('login-toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'login-toast' + (type === 'success' ? ' success' : '');
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4500);
}

// ══════════════════════════════
// API FETCH WRAPPER
// ══════════════════════════════
async function apiFetch(path, options = {}) {
  try {
    const t = token();
    const headers = {
      'Content-Type': 'application/json',
      ...(t ? { 'Authorization': `Bearer ${t}` } : {}),
      ...(options.headers || {})
    };
    const res = await fetch(API + path, { ...options, headers });
    if (res.status === 401) {
      localStorage.removeItem('hn_admin_token');
      localStorage.removeItem('hn_admin_user');
      showAdminLogin();
      showLoginToast('Session expired. Please sign in again.', 'error');
      return null;
    }
    return res;
  } catch (e) {
    showToast('Network error. Please check your connection.', 'error');
    return null;
  }
}

// ══════════════════════════════
// SHOW / HIDE APP vs LOGIN
// ══════════════════════════════
function showAdminApp() {
  document.getElementById('page-login').style.display = 'none';
  document.getElementById('page-app').style.display = 'flex';

  const admin = currentAdmin();
  if (admin) {
    const initials = getInitials(admin.name || admin.email || 'A');
    const avatarEl = document.getElementById('admin-avatar');
    const nameEl = document.getElementById('admin-name');
    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl) nameEl.textContent = admin.name || admin.email || 'Admin';
  }

  // Restore last visited section from URL hash, or default to dashboard
  const validSections = Object.keys(sectionLoaders);
  const hashSection = location.hash.replace('#', '');
  navTo(validSections.includes(hashSection) ? hashSection : 'dashboard');

  // Fetch pending verification count for sidebar badge
  refreshVerificationBadge();

  // Re-render Lucide icons for dynamically injected content
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function showAdminLogin() {
  document.getElementById('page-app').style.display = 'none';
  document.getElementById('page-login').style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ══════════════════════════════
// AUTH – LOGIN
// ══════════════════════════════
async function adminLogin(event) {
  if (event) event.preventDefault();
  const email = document.getElementById('inp-email').value.trim();
  const password = document.getElementById('inp-password').value;
  if (!email || !password) {
    showLoginToast('Please enter your email and password.', 'error');
    return;
  }
  showLoader();
  try {
    const res = await fetch(API + '/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    hideLoader();
    const data = await res.json();
    if (res.ok && data.data?.accessToken) {
      localStorage.setItem('hn_admin_token', data.data.accessToken);
      localStorage.setItem('hn_admin_user', JSON.stringify(data.data.user || {}));
      showAdminApp();
    } else {
      showLoginToast(data.message || 'Invalid credentials. Please try again.', 'error');
    }
  } catch (e) {
    hideLoader();
    showLoginToast('Network error. Please check your connection.', 'error');
  }
}

function logout() {
  localStorage.removeItem('hn_admin_token');
  localStorage.removeItem('hn_admin_user');
  _allWorkers = [];
  _allUsers = [];
  showAdminLogin();
}

// ══════════════════════════════
// SIDEBAR TOGGLE (mobile)
// ══════════════════════════════
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar) return;
  const isOpen = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !isOpen);
  if (overlay) overlay.classList.toggle('open', !isOpen);
}

// ══════════════════════════════
// NAVIGATION
// ══════════════════════════════
const sectionTitles = {
  dashboard: 'Dashboard',
  people: 'People',
  verification: 'Verification Queue',
  reviews: 'Review Moderation',
  categories: 'Categories',
  banners: 'Banners',
  testimonials: 'Testimonials',
  faqs: 'FAQs',
  announcements: 'Announcements',
  coupons: 'Coupons & Referral Codes',
  complaints: 'Complaints',
  map: 'Worker Map',
  templates: 'Message Templates',
  activity: 'Activity Log',
  settings: 'Settings',
  pages: 'Pages',
  blog: 'Blog',
  contact: 'Contact Us'
};

const sectionLoaders = {
  dashboard: loadDashboard,
  people: loadPeople,
  verification: loadVerification,
  reviews: loadReviews,
  categories: loadCategories,
  banners: loadBanners,
  testimonials: loadTestimonials,
  faqs: loadFaqs,
  announcements: loadAnnouncements,
  coupons: loadCoupons,
  complaints: loadComplaints,
  map: loadMap,
  templates: loadTemplates,
  activity: loadActivity,
  settings: loadSettings,
  pages: loadPages,
  blog: loadBlog,
  contact: loadContact
};

function navTo(name) {
  // Persist in URL hash so refresh restores the same page
  if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.getElementById('nav-' + name);
  if (activeNav) activeNav.classList.add('active');

  // Show/hide sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('sec-' + name);
  if (sec) sec.classList.add('active');

  // Update topbar title
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = sectionTitles[name] || name;

  // Close sidebar on mobile after navigation
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  }

  // Destroy map when leaving so it re-inits cleanly on next visit
  if (name !== 'map' && _leafletMap) {
    _leafletMap.remove();
    _leafletMap = null;
    _mapMarkers = [];
  }

  // For map: section must be display:flex before Leaflet measures the container
  if (name === 'map') {
    setTimeout(() => { if (sectionLoaders['map']) sectionLoaders['map'](); }, 50);
  } else {
    if (sectionLoaders[name]) sectionLoaders[name]();
  }
}

// ══════════════════════════════
// DASHBOARD
// ══════════════════════════════
async function loadDashboard() {
  // Reset stat cards
  ['totalUsers', 'totalWorkers', 'verifiedWorkers', 'totalCategories', 'pendingComplaints'].forEach(key => {
    const el = document.getElementById('stat-' + key);
    if (el) el.textContent = '—';
  });

  const res = await apiFetch('/admin/stats', { headers: authHeaders() });
  if (!res || !res.ok) {
    showToast('Failed to load dashboard stats.', 'error');
    return;
  }
  const json = await res.json();
  const stats = json.data || json;

  const map = {
    totalUsers: stats.totalUsers,
    totalWorkers: stats.totalWorkers,
    verifiedWorkers: stats.verifiedWorkers,
    totalCategories: stats.totalCategories ?? stats.categories,
    pendingComplaints: stats.pendingComplaints ?? stats.totalComplaints
  };

  Object.entries(map).forEach(([key, val]) => {
    const el = document.getElementById('stat-' + key);
    if (el) el.textContent = val != null ? val : '—';
  });

  loadWorkerStatusChart();
  loadRoleChart();
  loadTrendsChart();
  loadComplaintsChart();
  loadCategoryWorkersChart();
}

async function loadWorkerStatusChart() {
  const res = await apiFetch('/admin/workers', { headers: authHeaders() });
  if (!res || !res.ok) return;
  const json = await res.json();
  const workers = json.data?.workers || json.data || [];

  const counts = { AVAILABLE: 0, BUSY: 0, OFFLINE: 0 };
  workers.forEach(w => {
    const s = (w.status || 'OFFLINE').toUpperCase();
    if (counts[s] != null) counts[s]++;
    else counts['OFFLINE']++;
  });

  const canvas = document.getElementById('workerStatusChart');
  if (!canvas) return;

  if (workerStatusChart) {
    workerStatusChart.destroy();
    workerStatusChart = null;
  }

  workerStatusChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Available', 'Busy', 'Offline'],
      datasets: [{
        label: 'Workers',
        data: [counts.AVAILABLE, counts.BUSY, counts.OFFLINE],
        backgroundColor: [
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(100, 116, 139, 0.7)'
        ],
        borderColor: [
          'rgba(16, 185, 129, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(100, 116, 139, 1)'
        ],
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

async function loadRoleChart() {
  const res = await apiFetch('/admin/users', { headers: authHeaders() });
  if (!res || !res.ok) return;
  const json = await res.json();
  const users = json.data?.users || json.data || [];

  const counts = {};
  users.forEach(u => {
    const role = (u.role || 'CUSTOMER').toUpperCase();
    counts[role] = (counts[role] || 0) + 1;
  });

  const labels = Object.keys(counts);
  const values = Object.values(counts);

  const palette = [
    'rgba(99, 102, 241, 0.85)',
    'rgba(16, 185, 129, 0.85)',
    'rgba(239, 68, 68, 0.85)',
    'rgba(245, 158, 11, 0.85)',
    'rgba(59, 130, 246, 0.85)'
  ];

  const canvas = document.getElementById('roleChart');
  if (!canvas) return;

  if (roleChart) {
    roleChart.destroy();
    roleChart = null;
  }

  roleChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels.map(l => l.charAt(0) + l.slice(1).toLowerCase()),
      datasets: [{
        data: values,
        backgroundColor: palette.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            usePointStyle: true,
            font: { size: 12, family: "'Inter', sans-serif" }
          }
        }
      }
    }
  });
}

let trendsChart = null;
async function loadTrendsChart() {
  const res = await apiFetch('/admin/stats/trends', { headers: authHeaders() });
  if (!res || !res.ok) return;
  const json = await res.json();
  const trends = json.data || [];
  const canvas = document.getElementById('trendsChart');
  if (!canvas) return;
  if (trendsChart) { trendsChart.destroy(); trendsChart = null; }
  trendsChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: trends.map(t => t.date),
      datasets: [
        {
          label: 'New Users',
          data: trends.map(t => t.users),
          borderColor: 'rgba(255,107,53,1)',
          backgroundColor: 'rgba(255,107,53,0.12)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(255,107,53,1)',
          tension: 0.35,
          fill: true,
        },
        {
          label: 'New Workers',
          data: trends.map(t => t.workers),
          borderColor: 'rgba(16,185,129,1)',
          backgroundColor: 'rgba(16,185,129,0.10)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(16,185,129,1)',
          tension: 0.35,
          fill: true,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, padding: 16, font: { family: "'Inter',sans-serif", size: 12 }, color: 'rgba(240,240,240,.7)' } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1, color: 'rgba(240,240,240,.45)' }, grid: { color: 'rgba(255,255,255,.05)' } },
        x: { ticks: { color: 'rgba(240,240,240,.45)' }, grid: { display: false } }
      }
    }
  });
}

let complaintsChart = null;
async function loadComplaintsChart() {
  const res = await apiFetch('/admin/stats/complaints-trends', { headers: authHeaders() });
  if (!res || !res.ok) return;
  const json = await res.json();
  const trends = json.data || [];
  const canvas = document.getElementById('complaintsChart');
  if (!canvas) return;
  if (complaintsChart) { complaintsChart.destroy(); complaintsChart = null; }
  complaintsChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: trends.map(t => t.date),
      datasets: [{
        label: 'Complaints',
        data: trends.map(t => t.complaints),
        backgroundColor: 'rgba(239,68,68,0.75)',
        borderColor: 'rgba(239,68,68,1)',
        borderWidth: 2,
        borderRadius: 5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1, color: 'rgba(240,240,240,.45)' }, grid: { color: 'rgba(255,255,255,.05)' } },
        x: { ticks: { color: 'rgba(240,240,240,.45)' }, grid: { display: false } }
      }
    }
  });
}

let categoryWorkersChart = null;
async function loadCategoryWorkersChart() {
  const res = await apiFetch('/admin/stats/workers-by-category', { headers: authHeaders() });
  if (!res || !res.ok) return;
  const json = await res.json();
  const cats = json.data || [];
  const canvas = document.getElementById('categoryWorkersChart');
  if (!canvas) return;
  if (categoryWorkersChart) { categoryWorkersChart.destroy(); categoryWorkersChart = null; }
  categoryWorkersChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: cats.map(c => c.name),
      datasets: [
        {
          label: 'Total',
          data: cats.map(c => c.total),
          backgroundColor: 'rgba(99,102,241,0.75)',
          borderColor: 'rgba(99,102,241,1)',
          borderWidth: 2,
          borderRadius: 5,
        },
        {
          label: 'Active',
          data: cats.map(c => c.active),
          backgroundColor: 'rgba(16,185,129,0.75)',
          borderColor: 'rgba(16,185,129,1)',
          borderWidth: 2,
          borderRadius: 5,
        },
        {
          label: 'Verified',
          data: cats.map(c => c.verified),
          backgroundColor: 'rgba(245,158,11,0.75)',
          borderColor: 'rgba(245,158,11,1)',
          borderWidth: 2,
          borderRadius: 5,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, padding: 14, font: { family: "'Inter',sans-serif", size: 12 }, color: 'rgba(240,240,240,.7)' } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1, color: 'rgba(240,240,240,.45)' }, grid: { color: 'rgba(255,255,255,.05)' } },
        x: { ticks: { color: 'rgba(240,240,240,.45)', maxRotation: 30 }, grid: { display: false } }
      }
    }
  });
}

// ══════════════════════════════
// PEOPLE (Customers + Workers)
// ══════════════════════════════
let _currentPeopleTab = 'customers';

async function loadPeople() {
  await Promise.all([loadCustomers(), loadWorkers()]);
}

// alias so sectionLoaders still works
async function loadUsers() { await loadPeople(); }
async function loadWorkers() {
  const tbody = document.getElementById('workers-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Loading...</td></tr>';
  const res = await apiFetch('/admin/workers', { headers: authHeaders() });
  if (!res || !res.ok) { if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Failed to load.</td></tr>'; return; }
  const json = await res.json();
  _allWorkers = json.data?.workers || json.data || [];
  renderWorkersTable(_allWorkers);
  const el = document.getElementById('tab-count-workers');
  if (el) el.textContent = _allWorkers.length;
}

async function loadCustomers() {
  const tbody = document.getElementById('customers-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Loading...</td></tr>';
  const res = await apiFetch('/admin/users', { headers: authHeaders() });
  if (!res || !res.ok) { if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Failed to load.</td></tr>'; return; }
  const json = await res.json();
  _allUsers = (json.data?.users || json.data || []).filter(u => u.role === 'CUSTOMER');
  renderCustomersTable(_allUsers);
  const el = document.getElementById('tab-count-customers');
  if (el) el.textContent = _allUsers.length;
}

function switchPeopleTab(tab) {
  _currentPeopleTab = tab;
  document.getElementById('tab-customers').classList.toggle('active', tab === 'customers');
  document.getElementById('tab-workers').classList.toggle('active', tab === 'workers');
  document.getElementById('pane-customers').style.display = tab === 'customers' ? '' : 'none';
  document.getElementById('pane-workers').style.display = tab === 'workers' ? '' : 'none';
  if (tab === 'workers' && _allWorkers.length === 0) loadWorkers();
}

function filterPeople(tab) {
  if (tab === 'customers') {
    const q = (document.getElementById('customerSearch')?.value || '').toLowerCase();
    renderCustomersTable(q ? _allUsers.filter(u => (u.name||'').toLowerCase().includes(q) || (u.phone||'').toLowerCase().includes(q)) : _allUsers);
  } else {
    const q = (document.getElementById('workerSearch')?.value || '').toLowerCase();
    renderWorkersTable(q ? _allWorkers.filter(w => (w.user?.name||'').toLowerCase().includes(q) || (w.user?.phone||'').toLowerCase().includes(q)) : _allWorkers);
  }
}

function renderCustomersTable(users) {
  const tbody = document.getElementById('customers-tbody');
  if (!tbody) return;
  if (!users.length) { tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No customers found.</td></tr>'; return; }
  tbody.innerHTML = users.map(u => {
    const name = u.name || 'Unnamed';
    const phone = u.phone || '—';
    const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—';
    const active = u.isActive !== false;
    const id = u.id || u._id;
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
    return `<tr>
      <td><input type="checkbox" class="row-checkbox" data-type="customers" data-id="${id}" onchange="onRowCheckbox('customers')" /></td>
      <td>
        <div style="display:flex;align-items:center;gap:.65rem">
          <div class="table-avatar" style="background:#6366f1">${escHtml(initials)}</div>
          <strong>${escHtml(name)}</strong>
        </div>
      </td>
      <td style="color:var(--text-muted)">${escHtml(phone)}</td>
      <td style="color:var(--text-muted)">${joined}</td>
      <td><span class="badge ${active ? 'badge-active' : 'badge-blocked'}">${active ? 'Active' : 'Inactive'}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn-sm btn-view" onclick='viewUserProfile(${JSON.stringify(u)})'>View</button>
          <button class="btn-sm ${active ? 'btn-block' : 'btn-verify'}" onclick="toggleUserActive('${id}',${active})">${active ? 'Deactivate' : 'Activate'}</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderWorkersTable(workers) {
  const tbody = document.getElementById('workers-tbody');
  if (!tbody) return;
  if (!workers.length) { tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No workers found.</td></tr>'; return; }
  tbody.innerHTML = workers.map(w => {
    const name = w.user?.name || '—';
    const phone = w.user?.phone || '—';
    const cats = (w.categories||[]).map(c => c.category?.name||c.name||c).filter(Boolean).join(', ') || '—';
    const verified = w.isVerified;
    const active = w.user?.isActive !== false;
    const status = (w.status||'OFFLINE').toUpperCase();
    const id = w.id || w._id;
    const userId = w.user?.id || w.userId;
    const initials = name.split(' ').map(x => x[0]).join('').toUpperCase().slice(0,2);
    return `<tr>
      <td><input type="checkbox" class="row-checkbox" data-type="workers" data-id="${userId}" onchange="onRowCheckbox('workers')" /></td>
      <td>
        <div style="display:flex;align-items:center;gap:.65rem">
          <div class="table-avatar" style="background:#ff6b35">${escHtml(initials)}</div>
          <strong>${escHtml(name)}</strong>
        </div>
      </td>
      <td style="color:var(--text-muted)">${escHtml(phone)}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(cats)}">${escHtml(cats)}</td>
      <td><span class="badge ${verified ? 'badge-verified' : 'badge-unverified'}">${verified ? 'Verified' : 'Pending'}</span></td>
      <td><span class="badge badge-${status.toLowerCase()}">${status}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn-sm btn-view" onclick='viewWorkerProfile(${JSON.stringify(w)})'>View</button>
          ${!verified ? `<button class="btn-sm btn-verify" onclick="verifyWorker('${id}')">Verify</button>` : ''}
          <button class="btn-sm btn-outline" onclick="openRatingModal('${id}','${escHtml(name)}')">Analytics</button>
          <button class="btn-sm ${active ? 'btn-block' : 'btn-unblock'}" onclick="toggleUserActive('${userId}',${active})">${active ? 'Deactivate' : 'Activate'}</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function toggleUserActive(userId, currentlyActive) {
  const ok = await showConfirm({
    title: currentlyActive ? 'Deactivate User?' : 'Activate User?',
    message: currentlyActive ? 'This user will no longer be able to use the app.' : 'This user will regain access to the app.',
    icon: currentlyActive ? 'ban' : 'check-circle',
    confirmText: currentlyActive ? 'Deactivate' : 'Activate',
    danger: currentlyActive
  });
  if (!ok) return;
  showLoader();
  const res = await apiFetch(`/admin/users/${userId}/toggle-active`, { method: 'PATCH', headers: authHeaders() });
  hideLoader();
  if (!res) return;
  const data = await res.json();
  if (res.ok) {
    showToast(currentlyActive ? 'User deactivated.' : 'User activated.', 'success');
    loadPeople();
  } else {
    showToast(data.message || 'Failed to update user.', 'error');
  }
}

async function verifyWorker(workerId) {
  const ok = await showConfirm({ title: 'Verify Worker?', message: 'This will approve the worker and make them visible to customers.', icon: 'check-circle', confirmText: 'Verify', danger: false });
  if (!ok) return;
  showLoader();
  const res = await apiFetch('/admin/verify-worker', { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ workerId }) });
  hideLoader();
  if (!res) return;
  const data = await res.json();
  if (res.ok) { showToast('Worker verified!', 'success'); loadWorkers(); }
  else showToast(data.message || 'Failed.', 'error');
}

// ── Profile Modals ──
function viewUserProfile(u) {
  const name = u.name || 'Unnamed';
  const active = u.isActive !== false;
  document.getElementById('pm-avatar').textContent = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('pm-avatar').style.background = '#6366f1';
  document.getElementById('pm-name').textContent = name;
  document.getElementById('pm-phone').textContent = u.phone || '—';
  document.getElementById('pm-badges').innerHTML = `
    <span class="badge badge-customer">CUSTOMER</span>
    <span class="badge ${active ? 'badge-active' : 'badge-blocked'}">${active ? 'Active' : 'Inactive'}</span>`;
  document.getElementById('pm-fields').innerHTML = `
    <div class="pm-field"><span>Joined</span><strong>${u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) : '—'}</strong></div>
    <div class="pm-field"><span>User ID</span><strong style="font-size:.72rem;color:var(--text-muted)">${u.id||u._id||'—'}</strong></div>`;
  document.getElementById('pm-footer').innerHTML = `
    <button class="btn-sm ${active ? 'btn-block' : 'btn-verify'}" style="padding:.6rem 1.4rem;font-size:.85rem" onclick="toggleUserActive('${u.id||u._id}',${active});closeProfileModal()">${active ? 'Deactivate User' : 'Activate User'}</button>`;
  document.getElementById('profile-overlay').classList.remove('hidden');
}

function viewWorkerProfile(w) {
  const name = w.user?.name || '—';
  const phone = w.user?.phone || '—';
  const active = w.user?.isActive !== false;
  const verified = w.isVerified;
  const cats = (w.categories||[]).map(c=>c.category?.name||c.name||c).filter(Boolean).join(', ') || '—';
  document.getElementById('pm-avatar').textContent = name.split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('pm-avatar').style.background = '#ff6b35';
  document.getElementById('pm-name').textContent = name;
  document.getElementById('pm-phone').textContent = phone;
  document.getElementById('pm-badges').innerHTML = `
    <span class="badge badge-worker">WORKER</span>
    <span class="badge ${verified ? 'badge-verified' : 'badge-unverified'}">${verified ? 'Verified' : 'Pending'}</span>
    <span class="badge ${active ? 'badge-active' : 'badge-blocked'}">${active ? 'Active' : 'Inactive'}</span>`;
  document.getElementById('pm-fields').innerHTML = `
    <div class="pm-field"><span>Categories</span><strong>${escHtml(cats)}</strong></div>
    <div class="pm-field"><span>Experience</span><strong>${w.experienceYears != null ? w.experienceYears + ' yrs' : '—'}</strong></div>
    <div class="pm-field"><span>Price Range</span><strong>${escHtml(w.priceRange||'—')}</strong></div>
    <div class="pm-field"><span>Work Status</span><strong>${w.status||'—'}</strong></div>
    ${w.bio ? `<div class="pm-field pm-field-full"><span>Bio</span><strong>${escHtml(w.bio)}</strong></div>` : ''}`;
  const uid = w.user?.id || w.userId;
  document.getElementById('pm-footer').innerHTML = `
    ${!verified ? `<button class="btn-sm btn-verify" style="padding:.6rem 1.4rem;font-size:.85rem" onclick="verifyWorker('${w.id||w._id}');closeProfileModal()">Verify Worker</button>` : ''}
    <button class="btn-sm ${active ? 'btn-block' : 'btn-unblock'}" style="padding:.6rem 1.4rem;font-size:.85rem" onclick="toggleUserActive('${uid}',${active});closeProfileModal()">${active ? 'Deactivate' : 'Activate'}</button>`;
  document.getElementById('profile-overlay').classList.remove('hidden');
}

function closeProfileModal() {
  document.getElementById('profile-overlay').classList.add('hidden');
}

// ══════════════════════════════
// CATEGORIES
// ══════════════════════════════
async function loadCategories() {
  const grid = document.getElementById('categories-grid');
  if (grid) grid.innerHTML = '<div class="table-empty" style="grid-column:1/-1;padding:3rem;text-align:center;">Loading categories...</div>';

  const res = await apiFetch('/categories');
  if (!res || !res.ok) {
    if (grid) grid.innerHTML = '<div class="table-empty" style="grid-column:1/-1;padding:3rem;text-align:center;color:var(--danger);">Failed to load categories.</div>';
    return;
  }
  const json = await res.json();
  const cats = Array.isArray(json.data) ? json.data : [];

  if (cats.length === 0) {
    if (grid) grid.innerHTML = '<div class="table-empty" style="grid-column:1/-1;padding:3rem;text-align:center;">No categories yet. Click "+ Add Category" to create one.</div>';
    return;
  }

  if (grid) {
    grid.innerHTML = cats.map(cat => {
      const id = cat._id || cat.id;
      const icon = cat.icon || '';
      const name = escHtml(cat.name || '');
      return `<div class="category-card">
        <button class="cat-delete-btn" onclick="deleteCategory('${id}', '${name}')" title="Delete category">
          <i data-lucide="trash-2"></i>
        </button>
        <div class="cat-icon-circle">${icon}</div>
        <div class="cat-card-name">${name}</div>
      </div>`;
    }).join('');

    // Re-render Lucide icons for new delete buttons
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function showAddCategoryModal() {
  const modal = document.getElementById('addCategoryModal');
  if (modal) {
    modal.style.display = 'flex';
    document.getElementById('categoryName').value = '';
    document.getElementById('categoryIcon').value = '';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    setTimeout(() => document.getElementById('categoryName')?.focus(), 50);
  }
}

function closeAddCategoryModal() {
  const modal = document.getElementById('addCategoryModal');
  if (modal) modal.style.display = 'none';
}

async function submitAddCategory() {
  const name = document.getElementById('categoryName').value.trim();
  const icon = document.getElementById('categoryIcon').value.trim();
  if (!name) {
    showToast('Category name is required.', 'error');
    return;
  }
  showLoader();
  const res = await apiFetch('/categories', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, icon: icon || undefined })
  });
  hideLoader();
  if (!res) return;
  const data = await res.json();
  if (res.ok) {
    showToast('Category added successfully!', 'success');
    closeAddCategoryModal();
    loadCategories();
  } else {
    showToast(data.message || 'Failed to add category.', 'error');
  }
}

async function deleteCategory(id, name) {
  const ok = await showConfirm({ title: 'Delete Category?', message: `"${name}" will be permanently removed. Workers in this category will lose it.`, icon: 'trash-2', confirmText: 'Delete', danger: true });
  if (!ok) return;
  showLoader();
  const res = await apiFetch('/categories/' + id, {
    method: 'DELETE',
    headers: authHeaders()
  });
  hideLoader();
  if (!res) return;
  if (res.ok) {
    showToast('Category deleted.', 'success');
    loadCategories();
  } else {
    const data = await res.json().catch(() => ({}));
    showToast(data.message || 'Failed to delete category.', 'error');
  }
}

// ══════════════════════════════
// CSV EXPORT
// ══════════════════════════════
function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportPeopleCSV(tab) {
  if (tab === 'customers') {
    if (!_allUsers.length) { showToast('No customer data to export.', 'error'); return; }
    const rows = [['Name','Phone','Joined','Active']];
    _allUsers.forEach(u => rows.push([u.name||'Unnamed', u.phone||'', u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '', u.isActive ? 'Yes' : 'No']));
    downloadCSV('customers.csv', rows);
  } else {
    if (!_allWorkers.length) { showToast('No worker data to export.', 'error'); return; }
    const rows = [['Name','Phone','Categories','Verified','Status','Experience']];
    _allWorkers.forEach(w => rows.push([w.user?.name||'', w.user?.phone||'', (w.categories||[]).map(c=>c.category?.name||'').join('; '), w.isVerified?'Yes':'No', w.status||'', w.experienceYears||0]));
    downloadCSV('workers.csv', rows);
  }
  showToast('CSV downloaded!', 'success');
}

function exportComplaintsCSV() {
  if (!_allComplaints.length) { showToast('No complaint data to export.', 'error'); return; }
  const rows = [['ID','Filed By','Against Worker','Description','Status','Admin Note','Date']];
  _allComplaints.forEach(c => rows.push([
    (c.id||'').slice(-6).toUpperCase(),
    c.reporter?.name||'',
    c.worker?.user?.name||'',
    c.reason||'',
    c.status||'',
    c.adminNote||'',
    c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : ''
  ]));
  downloadCSV('complaints.csv', rows);
  showToast('CSV downloaded!', 'success');
}

// ══════════════════════════════
// COMPLAINTS (with status management)
// ══════════════════════════════
let _allComplaints = [];
let _complaintFilter = '';

async function loadComplaints() {
  const tbody = document.getElementById('complaints-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Loading complaints...</td></tr>';
  const res = await apiFetch('/admin/complaints?limit=200', { headers: authHeaders() });
  if (!res || !res.ok) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Failed to load complaints.</td></tr>';
    return;
  }
  const json = await res.json();
  _allComplaints = json.data?.complaints || json.data || [];
  renderComplaints();
}

function setComplaintFilter(status) {
  _complaintFilter = status;
  document.querySelectorAll('.status-tab').forEach(t => t.classList.toggle('active', t.dataset.status === status));
  renderComplaints();
}

function renderComplaints() {
  const tbody = document.getElementById('complaints-tbody');
  if (!tbody) return;
  const filtered = _complaintFilter ? _allComplaints.filter(c => c.status === _complaintFilter) : _allComplaints;
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No complaints found.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(c => {
    const shortId = (c.id||'').slice(-6).toUpperCase();
    const filedBy = c.reporter?.name || '—';
    const against = c.worker?.user?.name || '—';
    const desc = c.reason || '—';
    const status = (c.status||'PENDING').toUpperCase();
    const date = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : '—';
    return `<tr>
      <td style="font-family:monospace;font-size:.8rem;color:var(--text-muted)">#${escHtml(shortId)}</td>
      <td><strong>${escHtml(filedBy)}</strong></td>
      <td>${escHtml(against)}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(desc)}">${escHtml(desc)}</td>
      <td><span class="badge badge-complaint-${status.toLowerCase()}">${status}</span></td>
      <td style="color:var(--text-muted)">${date}</td>
      <td>
        <button class="btn-sm btn-view" onclick='openComplaintModal(${JSON.stringify(c)})'>Manage</button>
      </td>
    </tr>`;
  }).join('');
}

function openComplaintModal(c) {
  document.getElementById('complaint-id').value = c.id;
  document.getElementById('complaint-status-select').value = c.status || 'PENDING';
  document.getElementById('complaint-admin-note').value = c.adminNote || '';
  const box = document.getElementById('complaint-detail-box');
  box.innerHTML = `
    <div class="complaint-detail-row"><span>Filed by</span><strong>${escHtml(c.reporter?.name||'—')}</strong></div>
    <div class="complaint-detail-row"><span>Against</span><strong>${escHtml(c.worker?.user?.name||'—')}</strong></div>
    <div class="complaint-detail-row"><span>Reason</span><span style="color:var(--text)">${escHtml(c.reason||'—')}</span></div>`;
  document.getElementById('complaintModal').style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeComplaintModal() {
  document.getElementById('complaintModal').style.display = 'none';
}

async function submitComplaintUpdate() {
  const id = document.getElementById('complaint-id').value;
  const status = document.getElementById('complaint-status-select').value;
  const adminNote = document.getElementById('complaint-admin-note').value.trim();
  showLoader();
  const res = await apiFetch(`/admin/complaints/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status, adminNote: adminNote || undefined })
  });
  hideLoader();
  if (!res) return;
  const data = await res.json();
  if (res.ok) {
    showToast('Complaint updated!', 'success');
    closeComplaintModal();
    loadComplaints();
  } else {
    showToast(data.message || 'Failed to update.', 'error');
  }
}

// ══════════════════════════════
// VERIFICATION QUEUE
// ══════════════════════════════
let _allPendingWorkers = [];

async function refreshVerificationBadge() {
  try {
    const res = await apiFetch('/admin/workers?limit=200');
    if (!res || !res.ok) return;
    const json = await res.json();
    const all = json.data?.workers || json.data || [];
    const count = all.filter(w => !w.isVerified).length;
    const badge = document.getElementById('nav-badge-verification');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count ? '' : 'none';
    }
  } catch (e) { /* silent */ }
}

async function loadVerification() {
  const tbody = document.getElementById('verification-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Loading...</td></tr>';
  const res = await apiFetch('/admin/workers?limit=200', { headers: authHeaders() });
  if (!res || !res.ok) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Failed to load.</td></tr>';
    return;
  }
  const json = await res.json();
  const all = json.data?.workers || json.data || [];
  _allPendingWorkers = all.filter(w => !w.isVerified);
  const badge = document.getElementById('nav-badge-verification');
  if (badge) { badge.textContent = _allPendingWorkers.length || ''; badge.style.display = _allPendingWorkers.length ? '' : 'none'; }
  const label = document.getElementById('verification-count-label');
  if (label) label.textContent = `${_allPendingWorkers.length} pending`;
  renderVerificationTable(_allPendingWorkers);
}

function filterVerification() {
  const q = (document.getElementById('verificationSearch')?.value || '').toLowerCase();
  renderVerificationTable(q ? _allPendingWorkers.filter(w => (w.user?.name||'').toLowerCase().includes(q) || (w.user?.phone||'').toLowerCase().includes(q)) : _allPendingWorkers);
}

function renderVerificationTable(workers) {
  const tbody = document.getElementById('verification-tbody');
  if (!tbody) return;
  if (!workers.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No workers pending verification. All clear!</td></tr>';
    return;
  }
  tbody.innerHTML = workers.map(w => {
    const name = w.user?.name || '—';
    const phone = w.user?.phone || '—';
    const cats = (w.categories||[]).map(c=>c.category?.name||'').filter(Boolean).join(', ') || '—';
    const exp = w.experienceYears != null ? w.experienceYears + ' yrs' : '—';
    const date = w.createdAt ? new Date(w.createdAt).toLocaleDateString('en-IN') : '—';
    const initials = name.split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2);
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:.65rem">
          <div class="table-avatar" style="background:#ff6b35">${escHtml(initials)}</div>
          <div>
            <strong>${escHtml(name)}</strong>
            ${w.bio ? `<div style="font-size:.75rem;color:var(--text-muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(w.bio)}</div>` : ''}
          </div>
        </div>
      </td>
      <td style="color:var(--text-muted)">${escHtml(phone)}</td>
      <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(cats)}">${escHtml(cats)}</td>
      <td>${exp}</td>
      <td style="color:var(--text-muted)">${date}</td>
      <td>
        <div class="table-actions">
          <button class="btn-sm btn-verify" onclick="verifyWorkerFromQueue('${w.id}')"><i data-lucide="check"></i> Verify</button>
          <button class="btn-sm btn-view" onclick='viewWorkerProfile(${JSON.stringify(w)})'>View</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function verifyWorkerFromQueue(workerId) {
  const ok = await showConfirm({ title: 'Verify Worker?', message: 'This will approve the worker and make them visible to customers.', icon: 'check-circle', confirmText: 'Verify', danger: false });
  if (!ok) return;
  showLoader();
  const res = await apiFetch('/admin/verify-worker', { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ workerId }) });
  hideLoader();
  if (!res) return;
  const data = await res.json();
  if (res.ok) {
    showToast('Worker verified!', 'success');
    loadVerification();
    refreshVerificationBadge();
  } else showToast(data.message || 'Failed.', 'error');
}

// ══════════════════════════════
// REVIEWS
// ══════════════════════════════
let _allReviews = [];

async function loadReviews() {
  const tbody = document.getElementById('reviews-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Loading...</td></tr>';
  const res = await apiFetch('/admin/reviews?limit=200', { headers: authHeaders() });
  if (!res || !res.ok) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Failed to load.</td></tr>';
    return;
  }
  const json = await res.json();
  _allReviews = json.data?.reviews || json.data || [];
  renderReviewsTable(_allReviews);
}

function filterReviews() {
  const q = (document.getElementById('reviewSearch')?.value || '').toLowerCase();
  const rating = document.getElementById('reviewRatingFilter')?.value;
  let filtered = _allReviews;
  if (q) filtered = filtered.filter(r => (r.user?.name||'').toLowerCase().includes(q) || (r.worker?.user?.name||'').toLowerCase().includes(q));
  if (rating) filtered = filtered.filter(r => r.rating == rating);
  renderReviewsTable(filtered);
}

function renderReviewsTable(reviews) {
  const tbody = document.getElementById('reviews-tbody');
  if (!tbody) return;
  if (!reviews.length) { tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No reviews found.</td></tr>'; return; }
  tbody.innerHTML = reviews.map(r => {
    const reviewer = r.user?.name || '—';
    const worker = r.worker?.user?.name || '—';
    const stars = '★'.repeat(r.rating||0) + '☆'.repeat(5-(r.rating||0));
    const comment = r.comment || '—';
    const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '—';
    return `<tr>
      <td><strong>${escHtml(reviewer)}</strong></td>
      <td>${escHtml(worker)}</td>
      <td style="color:#f59e0b;letter-spacing:.05em">${stars}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(comment)}">${escHtml(comment)}</td>
      <td style="color:var(--text-muted)">${date}</td>
      <td>
        <button class="btn-sm btn-block" onclick="deleteReview('${r.id}')">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

async function deleteReview(id) {
  const ok = await showConfirm({ title: 'Delete Review?', message: 'This review will be permanently removed.', icon: 'trash-2', confirmText: 'Delete', danger: true });
  if (!ok) return;
  showLoader();
  const res = await apiFetch(`/admin/reviews/${id}`, { method: 'DELETE', headers: authHeaders() });
  hideLoader();
  if (res && res.ok) { showToast('Review deleted.', 'success'); loadReviews(); }
  else showToast('Failed to delete review.', 'error');
}

// ══════════════════════════════
// BANNERS
// ══════════════════════════════
let _allBanners = [];

async function loadBanners() {
  const list = document.getElementById('banners-list');
  if (list) list.innerHTML = '<div class="table-empty" style="padding:3rem;text-align:center;">Loading banners...</div>';
  const res = await apiFetch('/admin/banners', { headers: authHeaders() });
  if (!res || !res.ok) {
    if (list) list.innerHTML = '<div class="table-empty" style="padding:3rem;text-align:center;color:var(--danger);">Failed to load.</div>';
    return;
  }
  const json = await res.json();
  _allBanners = json.data || [];
  renderBannersList();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderBannersList() {
  const list = document.getElementById('banners-list');
  if (!list) return;
  if (!_allBanners.length) {
    list.innerHTML = '<div class="table-empty" style="padding:3rem;text-align:center;">No banners yet. Click "+ Add Banner" to create one.</div>';
    return;
  }
  list.innerHTML = _allBanners.map(b => `
    <div class="banner-card ${b.isActive ? '' : 'content-card--inactive'}">
      ${b.imageUrl ? `<div class="banner-thumb"><img src="${escHtml(b.imageUrl)}" alt="" onerror="this.parentElement.style.display='none'"/></div>` : '<div class="banner-thumb banner-thumb--empty"><i data-lucide="image"></i></div>'}
      <div class="content-card-body">
        <div class="content-card-title">${escHtml(b.title)}</div>
        ${b.subtitle ? `<p class="content-card-text">${escHtml(b.subtitle)}</p>` : ''}
        ${b.linkUrl ? `<p style="font-size:.78rem;color:var(--primary);margin:.3rem 0 0">${escHtml(b.linkUrl)}</p>` : ''}
      </div>
      <div class="content-card-actions">
        <span class="badge ${b.isActive ? 'badge-active' : 'badge-blocked'}">${b.isActive ? 'Active' : 'Hidden'}</span>
        <button class="btn-sm btn-view" onclick='editBanner(${JSON.stringify(b)})'>Edit</button>
        <button class="btn-sm" onclick="toggleBannerActive('${b.id}',${b.isActive})">${b.isActive ? 'Hide' : 'Show'}</button>
        <button class="btn-sm btn-block" onclick="deleteBanner('${b.id}','${escHtml(b.title)}')">Delete</button>
      </div>
    </div>`).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function showBannerModal(data = null) {
  document.getElementById('banner-id').value = data?.id || '';
  document.getElementById('banner-title').value = data?.title || '';
  document.getElementById('banner-subtitle').value = data?.subtitle || '';
  document.getElementById('banner-image').value = data?.imageUrl || '';
  document.getElementById('banner-link').value = data?.linkUrl || '';
  document.getElementById('banner-order').value = data?.sortOrder ?? 0;
  const isEdit = !!data;
  document.getElementById('banner-modal-title').textContent = isEdit ? 'Edit Banner' : 'Add Banner';
  document.getElementById('banner-submit-label').textContent = isEdit ? 'Save Changes' : 'Add Banner';
  const modal = document.getElementById('bannerModal');
  modal.style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
  setTimeout(() => document.getElementById('banner-title')?.focus(), 50);
}

function editBanner(b) { showBannerModal(b); }

function closeBannerModal() {
  document.getElementById('bannerModal').style.display = 'none';
}

async function submitBanner() {
  const id = document.getElementById('banner-id').value;
  const title = document.getElementById('banner-title').value.trim();
  const subtitle = document.getElementById('banner-subtitle').value.trim();
  const imageUrl = document.getElementById('banner-image').value.trim();
  const linkUrl = document.getElementById('banner-link').value.trim();
  const sortOrder = parseInt(document.getElementById('banner-order').value) || 0;
  if (!title) { showToast('Title is required.', 'error'); return; }
  showLoader();
  const isEdit = !!id;
  const res = await apiFetch(isEdit ? `/admin/banners/${id}` : '/admin/banners', {
    method: isEdit ? 'PATCH' : 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title, subtitle: subtitle||undefined, imageUrl: imageUrl||undefined, linkUrl: linkUrl||undefined, sortOrder })
  });
  hideLoader();
  if (!res) return;
  const data = await res.json();
  if (res.ok) {
    showToast(isEdit ? 'Banner updated!' : 'Banner added!', 'success');
    closeBannerModal();
    loadBanners();
  } else showToast(data.message || 'Failed.', 'error');
}

async function toggleBannerActive(id, current) {
  showLoader();
  const res = await apiFetch(`/admin/banners/${id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ isActive: !current }) });
  hideLoader();
  if (res && res.ok) { showToast(current ? 'Banner hidden.' : 'Banner shown.', 'success'); loadBanners(); }
  else showToast('Failed.', 'error');
}

async function deleteBanner(id, name) {
  const ok = await showConfirm({ title: 'Delete Banner?', message: `"${name}" will be permanently removed.`, icon: 'trash-2', confirmText: 'Delete', danger: true });
  if (!ok) return;
  showLoader();
  const res = await apiFetch(`/admin/banners/${id}`, { method: 'DELETE', headers: authHeaders() });
  hideLoader();
  if (res && res.ok) { showToast('Banner deleted.', 'success'); loadBanners(); }
  else showToast('Failed.', 'error');
}

// ══════════════════════════════
// UTILITIES
// ══════════════════════════════
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getInitials(name) {
  if (!name) return 'A';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

// ══════════════════════════════
// CLOSE MODAL ON OVERLAY CLICK
// ══════════════════════════════
document.addEventListener('click', (e) => {
  if (e.target === document.getElementById('addCategoryModal')) closeAddCategoryModal();
  if (e.target === document.getElementById('testimonialModal')) closeTestimonialModal();
  if (e.target === document.getElementById('faqModal')) closeFaqModal();
  if (e.target === document.getElementById('bannerModal')) closeBannerModal();
  if (e.target === document.getElementById('complaintModal')) closeComplaintModal();
  if (e.target === document.getElementById('workerEditModal')) closeWorkerEditModal();
});

// ══════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAddCategoryModal();
    closeTestimonialModal();
    closeFaqModal();
    closeBannerModal();
    closeComplaintModal();
    closeWorkerEditModal();
  }
});

// ══════════════════════════════
// PAGINATION HELPER
// ══════════════════════════════
function renderPagination(containerId, page, totalPages, onPageFn) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  const maxBtn = 5;
  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, start + maxBtn - 1);
  if (end - start < maxBtn - 1) start = Math.max(1, end - maxBtn + 1);

  let html = `<button class="pg-btn" ${page === 1 ? 'disabled' : ''} onclick="${onPageFn}(${page - 1})">‹</button>`;
  if (start > 1) html += `<button class="pg-btn" onclick="${onPageFn}(1)">1</button>${start > 2 ? '<span class="pg-ellipsis">…</span>' : ''}`;
  for (let i = start; i <= end; i++) {
    html += `<button class="pg-btn ${i === page ? 'pg-btn--active' : ''}" onclick="${onPageFn}(${i})">${i}</button>`;
  }
  if (end < totalPages) html += `${end < totalPages - 1 ? '<span class="pg-ellipsis">…</span>' : ''}<button class="pg-btn" onclick="${onPageFn}(${totalPages})">${totalPages}</button>`;
  html += `<button class="pg-btn" ${page === totalPages ? 'disabled' : ''} onclick="${onPageFn}(${page + 1})">›</button>`;
  html += `<span class="pg-info">Page ${page} of ${totalPages}</span>`;
  el.innerHTML = html;
}

// ══════════════════════════════
// PAGINATED PEOPLE OVERRIDES
// ══════════════════════════════
const PAGE_SIZE = 15;
let _customerPage = 1, _workerPage = 1, _reviewPage = 1, _complaintPage = 1;

function goCustomerPage(p) { _customerPage = p; renderCustomersTable(_allUsers); }
function goWorkerPage(p)   { _workerPage = p;   renderWorkersTable(_allWorkers); }
function goReviewPage(p)   { _reviewPage = p;   renderReviewsTable(_allReviews); }
function goComplaintPage(p){ _complaintPage = p; renderComplaints(); }

// Patch renderCustomersTable to paginate
const _origRenderCustomers = renderCustomersTable;
renderCustomersTable = function(users) {
  _customerPage = Math.min(_customerPage, Math.max(1, Math.ceil(users.length / PAGE_SIZE)));
  const slice = users.slice((_customerPage - 1) * PAGE_SIZE, _customerPage * PAGE_SIZE);
  _origRenderCustomers(slice);
  renderPagination('customers-pagination', _customerPage, Math.ceil(users.length / PAGE_SIZE), 'goCustomerPage');
};

const _origRenderWorkers = renderWorkersTable;
renderWorkersTable = function(workers) {
  _workerPage = Math.min(_workerPage, Math.max(1, Math.ceil(workers.length / PAGE_SIZE)));
  const slice = workers.slice((_workerPage - 1) * PAGE_SIZE, _workerPage * PAGE_SIZE);
  _origRenderWorkers(slice);
  renderPagination('workers-pagination', _workerPage, Math.ceil(workers.length / PAGE_SIZE), 'goWorkerPage');
};

const _origRenderReviews = renderReviewsTable;
renderReviewsTable = function(reviews) {
  _reviewPage = Math.min(_reviewPage, Math.max(1, Math.ceil(reviews.length / PAGE_SIZE)));
  const slice = reviews.slice((_reviewPage - 1) * PAGE_SIZE, _reviewPage * PAGE_SIZE);
  _origRenderReviews(slice);
  renderPagination('reviews-pagination', _reviewPage, Math.ceil(reviews.length / PAGE_SIZE), 'goReviewPage');
};

const _origRenderComplaints = renderComplaints;
renderComplaints = function() {
  const filtered = _complaintFilter ? _allComplaints.filter(c => c.status === _complaintFilter) : _allComplaints;
  _complaintPage = Math.min(_complaintPage, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const tbody = document.getElementById('complaints-tbody');
  if (!tbody) return;
  const slice = filtered.slice((_complaintPage - 1) * PAGE_SIZE, _complaintPage * PAGE_SIZE);
  if (!slice.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No complaints found.</td></tr>';
    renderPagination('complaints-pagination', 1, 1, 'goComplaintPage');
    return;
  }
  tbody.innerHTML = slice.map(c => {
    const shortId = (c.id||'').slice(-6).toUpperCase();
    const filedBy = c.reporter?.name || '—';
    const against = c.worker?.user?.name || '—';
    const desc = c.reason || '—';
    const status = (c.status||'PENDING').toUpperCase();
    const date = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : '—';
    return `<tr>
      <td style="font-family:monospace;font-size:.8rem;color:var(--text-muted)">#${escHtml(shortId)}</td>
      <td><strong>${escHtml(filedBy)}</strong></td>
      <td>${escHtml(against)}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(desc)}">${escHtml(desc)}</td>
      <td><span class="badge badge-complaint-${status.toLowerCase()}">${status}</span></td>
      <td style="color:var(--text-muted)">${date}</td>
      <td><button class="btn-sm btn-view" onclick='openComplaintModal(${JSON.stringify(c)})'>Manage</button></td>
    </tr>`;
  }).join('');
  renderPagination('complaints-pagination', _complaintPage, Math.ceil(filtered.length / PAGE_SIZE), 'goComplaintPage');
};

// ══════════════════════════════
// BULK VERIFY
// ══════════════════════════════
function toggleSelectAllVerification(checked) {
  document.querySelectorAll('.verify-row-cb').forEach(cb => cb.checked = checked);
  updateBulkVerifyBtn();
}

function updateBulkVerifyBtn() {
  const selected = document.querySelectorAll('.verify-row-cb:checked');
  const btn = document.getElementById('bulk-verify-btn');
  const lbl = document.getElementById('bulk-verify-label');
  if (!btn) return;
  btn.style.display = selected.length > 0 ? '' : 'none';
  if (lbl) lbl.textContent = `Verify ${selected.length} Selected`;
}

// Patch renderVerificationTable to include checkboxes
const _origRenderVerification = renderVerificationTable;
renderVerificationTable = function(workers) {
  const tbody = document.getElementById('verification-tbody');
  if (!tbody) return;
  if (!workers.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No workers pending verification. All clear!</td></tr>';
    document.getElementById('bulk-verify-btn').style.display = 'none';
    return;
  }
  tbody.innerHTML = workers.map(w => {
    const name = w.user?.name || '—';
    const phone = w.user?.phone || '—';
    const cats = (w.categories||[]).map(c=>c.category?.name||'').filter(Boolean).join(', ') || '—';
    const exp = w.experienceYears != null ? w.experienceYears + ' yrs' : '—';
    const date = w.createdAt ? new Date(w.createdAt).toLocaleDateString('en-IN') : '—';
    const initials = name.split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2);
    return `<tr>
      <td><input type="checkbox" class="verify-row-cb" value="${w.id}" onchange="updateBulkVerifyBtn()" /></td>
      <td>
        <div style="display:flex;align-items:center;gap:.65rem">
          <div class="table-avatar" style="background:#ff6b35">${escHtml(initials)}</div>
          <div>
            <strong>${escHtml(name)}</strong>
            ${w.bio ? `<div style="font-size:.75rem;color:var(--text-muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(w.bio)}</div>` : ''}
          </div>
        </div>
      </td>
      <td style="color:var(--text-muted)">${escHtml(phone)}</td>
      <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(cats)}">${escHtml(cats)}</td>
      <td>${exp}</td>
      <td style="color:var(--text-muted)">${date}</td>
      <td>
        <div class="table-actions">
          <button class="btn-sm btn-verify" onclick="verifyWorkerFromQueue('${w.id}')"><i data-lucide="check"></i> Verify</button>
          <button class="btn-sm btn-view" onclick='openWorkerEditModal(${JSON.stringify(w)})'>Edit</button>
        </div>
      </td>
    </tr>`;
  }).join('');
};

async function bulkVerify() {
  const selected = [...document.querySelectorAll('.verify-row-cb:checked')].map(cb => cb.value);
  if (!selected.length) return;
  const ok = await showConfirm({ title: `Verify ${selected.length} Workers?`, message: 'All selected workers will be approved and visible to customers.', icon: 'check-circle', confirmText: 'Verify All', danger: false });
  if (!ok) return;
  showLoader();
  const res = await apiFetch('/admin/verify-workers/bulk', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ workerIds: selected }) });
  hideLoader();
  if (!res) return;
  const data = await res.json();
  if (res.ok) { showToast(`${selected.length} workers verified!`, 'success'); loadVerification(); }
  else showToast(data.message || 'Failed.', 'error');
}

// ══════════════════════════════
// WORKER EDIT MODAL
// ══════════════════════════════
let _allCatsForEdit = [];

async function openWorkerEditModal(w) {
  document.getElementById('we-id').value = w.id;
  document.getElementById('we-bio').value = w.bio || '';
  document.getElementById('we-photo').value = w.photoUrl || '';
  document.getElementById('we-exp').value = w.experienceYears ?? 0;
  document.getElementById('we-price').value = w.priceRange || '';
  document.getElementById('we-status').value = w.status || 'OFFLINE';
  document.getElementById('we-verified').checked = !!w.isVerified;

  // Load categories if not cached
  if (!_allCatsForEdit.length) {
    const res = await apiFetch('/categories');
    if (res && res.ok) { const j = await res.json(); _allCatsForEdit = j.data || []; }
  }
  const workerCatIds = (w.categories||[]).map(c => c.categoryId || c.category?.id).filter(Boolean);
  const grid = document.getElementById('we-categories');
  grid.innerHTML = _allCatsForEdit.map(cat => `
    <label class="we-cat-chip ${workerCatIds.includes(cat.id) ? 'we-cat-chip--on' : ''}">
      <input type="checkbox" value="${cat.id}" ${workerCatIds.includes(cat.id) ? 'checked' : ''} onchange="this.closest('label').classList.toggle('we-cat-chip--on',this.checked)" />
      ${cat.icon || ''} ${escHtml(cat.name)}
    </label>`).join('');

  document.getElementById('workerEditModal').style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeWorkerEditModal() {
  document.getElementById('workerEditModal').style.display = 'none';
}

async function submitWorkerEdit() {
  const id = document.getElementById('we-id').value;
  const bio = document.getElementById('we-bio').value.trim();
  const photoUrl = document.getElementById('we-photo').value.trim();
  const experienceYears = parseInt(document.getElementById('we-exp').value) || 0;
  const priceRange = document.getElementById('we-price').value.trim();
  const status = document.getElementById('we-status').value;
  const isVerified = document.getElementById('we-verified').checked;
  const categoryIds = [...document.querySelectorAll('#we-categories input:checked')].map(cb => cb.value);

  showLoader();
  const res = await apiFetch(`/admin/workers/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ bio: bio||undefined, photoUrl: photoUrl||undefined, experienceYears, priceRange: priceRange||undefined, status, isVerified, categoryIds })
  });
  hideLoader();
  if (!res) return;
  const data = await res.json();
  if (res.ok) {
    showToast('Worker profile updated!', 'success');
    closeWorkerEditModal();
    loadPeople();
    if (document.getElementById('sec-verification')?.classList.contains('active')) loadVerification();
  } else showToast(data.message || 'Failed.', 'error');
}

// ══════════════════════════════
// WORKER MAP
// ══════════════════════════════
let _leafletMap = null;
let _mapWorkers = [];
let _mapMarkers = [];

async function loadMap() {
  const mapEl = document.getElementById('worker-map');
  if (!mapEl) return;

  // Destroy previous instance completely — clears Leaflet's _leaflet_id too
  if (_leafletMap) {
    _leafletMap.remove();
    _leafletMap = null;
    _mapMarkers = [];
  }
  // Replace the node so Leaflet starts with a 100% clean element
  const fresh = document.createElement('div');
  fresh.id = 'worker-map';
  fresh.className = 'worker-map-container';
  mapEl.replaceWith(fresh);
  const container = document.getElementById('worker-map');

  const res = await apiFetch('/admin/workers?limit=500');
  if (!res || !res.ok) return;
  const json = await res.json();
  _mapWorkers = (json.data?.workers || json.data || []).filter(w => w.latitude && w.longitude);

  // Populate category filter
  const sel = document.getElementById('map-category-filter');
  if (sel) {
    while (sel.options.length > 1) sel.remove(1);
    const cats = [...new Map(_mapWorkers.flatMap(w => w.categories||[]).map(c => [c.category?.id, c.category])).values()].filter(Boolean);
    cats.forEach(cat => { const o = document.createElement('option'); o.value = cat.id; o.textContent = (cat.icon||'') + ' ' + cat.name; sel.appendChild(o); });
  }

  _leafletMap = L.map(container, {
    preferCanvas: true,
    zoomControl: true,
    attributionControl: true,
  }).setView([20.5937, 78.9629], 5);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    crossOrigin: true,
  }).addTo(_leafletMap);

  // Wait for container to be fully painted, then size + plot
  setTimeout(() => {
    _leafletMap.invalidateSize({ animate: false });
    filterMap();
  }, 200);
}

function filterMap() {
  if (!_leafletMap) return;
  const catId = document.getElementById('map-category-filter')?.value || '';
  const filtered = catId
    ? _mapWorkers.filter(w => (w.categories||[]).some(c => (c.categoryId||c.category?.id) === catId))
    : _mapWorkers;

  _mapMarkers.forEach(m => m.remove());
  _mapMarkers = [];

  const colorMap = { AVAILABLE: '#10b981', BUSY: '#f59e0b', OFFLINE: '#6b7280' };

  filtered.forEach(w => {
    const status = w.status || 'OFFLINE';
    const color = colorMap[status] || '#6b7280';
    const name = w.user?.name || 'Worker';
    const cats = (w.categories||[]).map(c=>c.category?.name||'').filter(Boolean).join(', ');
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:#fff">${escHtml(name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase())}</div>`,
      iconSize: [32, 32], iconAnchor: [16, 16],
    });
    const marker = L.marker([w.latitude, w.longitude], { icon })
      .bindPopup(`<div style="min-width:160px"><strong>${escHtml(name)}</strong><br/><span style="color:${color};font-size:.8rem">● ${status}</span><br/><span style="font-size:.78rem;color:#666">${escHtml(cats||'No category')}</span></div>`)
      .addTo(_leafletMap);
    _mapMarkers.push(marker);
  });

  if (_mapMarkers.length) {
    const group = L.featureGroup(_mapMarkers);
    _leafletMap.fitBounds(group.getBounds().pad(0.15), { animate: false });
  } else {
    _leafletMap.setView([20.5937, 78.9629], 5, { animate: false });
  }

  // One final size correction after tiles settle
  setTimeout(() => {
    if (_leafletMap) _leafletMap.invalidateSize({ animate: false });
  }, 300);
}

// ══════════════════════════════
// ACTIVITY LOG
// ══════════════════════════════
let _activityPage = 1;
const ACTIVITY_PAGE_SIZE = 50;

function goActivityPage(p) { _activityPage = p; loadActivity(); }

async function loadActivity() {
  const tbody = document.getElementById('activity-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Loading...</td></tr>';
  const res = await apiFetch(`/admin/activity-logs?page=${_activityPage}&limit=${ACTIVITY_PAGE_SIZE}`, { headers: authHeaders() });
  if (!res || !res.ok) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Failed to load.</td></tr>';
    return;
  }
  const json = await res.json();
  const { logs, totalPages } = json.data || { logs: [], totalPages: 1 };
  if (!tbody) return;
  if (!logs.length) { tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No activity yet.</td></tr>'; return; }

  const actionLabels = {
    VERIFY_WORKER:    { label: 'Verified worker',    icon: 'check-circle',  cls: 'badge-active' },
    BLOCK_WORKER:     { label: 'Blocked worker',     icon: 'ban',           cls: 'badge-blocked' },
    EDIT_WORKER:      { label: 'Edited worker',      icon: 'pencil',        cls: 'badge-unverified' },
    DELETE_REVIEW:    { label: 'Deleted review',     icon: 'trash-2',       cls: 'badge-blocked' },
    UPDATE_COMPLAINT: { label: 'Updated complaint',  icon: 'clipboard-list',cls: 'badge-complaint-reviewed' },
    CREATE_BLOG_POST: { label: 'Created blog post',  icon: 'pen-square',    cls: 'badge-active' },
    UPDATE_BLOG_POST: { label: 'Updated blog post',  icon: 'pen-square',    cls: 'badge-unverified' },
    DELETE_BLOG_POST: { label: 'Deleted blog post',  icon: 'trash-2',       cls: 'badge-blocked' },
    UPSERT_PAGE:      { label: 'Saved page',         icon: 'file-text',     cls: 'badge-unverified' },
    DELETE_PAGE:      { label: 'Deleted page',       icon: 'trash-2',       cls: 'badge-blocked' },
    DELETE_CONTACT:   { label: 'Deleted contact',    icon: 'trash-2',       cls: 'badge-blocked' },
    UPDATE_SETTINGS:  { label: 'Updated settings',   icon: 'settings',      cls: 'badge-unverified' },
    UPLOAD_LOGO:      { label: 'Uploaded logo',      icon: 'image',         cls: 'badge-unverified' },
  };

  tbody.innerHTML = logs.map(log => {
    const meta = actionLabels[log.action] || { label: log.action, icon: 'settings', cls: '' };
    const time = log.createdAt ? new Date(log.createdAt).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';
    const target = log.target ? log.target.replace(/^\w+:/, '') : '—';
    return `<tr>
      <td><strong>${escHtml(log.adminName || 'Admin')}</strong></td>
      <td><span class="badge ${meta.cls}"><i data-lucide="${meta.icon}"></i> ${meta.label}</span></td>
      <td style="font-family:monospace;font-size:.78rem;color:var(--text-muted)">${escHtml(target.slice(0,8))}…</td>
      <td style="color:var(--text-muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(log.details||'—')}</td>
      <td style="color:var(--text-muted);white-space:nowrap">${time}</td>
    </tr>`;
  }).join('');

  renderPagination('activity-pagination', _activityPage, totalPages || 1, 'goActivityPage');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ══════════════════════════════
// GLOBAL SEARCH
// ══════════════════════════════
let _searchTimer = null;

function onGlobalSearch(q) {
  clearTimeout(_searchTimer);
  if (!q || q.trim().length < 2) { document.getElementById('search-dropdown').innerHTML = ''; document.getElementById('search-dropdown').classList.add('hidden'); return; }
  _searchTimer = setTimeout(() => runGlobalSearch(q.trim()), 350);
}

async function runGlobalSearch(q) {
  const dd = document.getElementById('search-dropdown');
  if (!dd) return;
  dd.innerHTML = '<div class="search-dd-loading">Searching…</div>';
  dd.classList.remove('hidden');

  const res = await apiFetch(`/admin/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
  if (!res || !res.ok) { dd.classList.add('hidden'); return; }
  const json = await res.json();
  const { workers, users } = json.data || { workers: [], users: [] };

  if (!workers.length && !users.length) {
    dd.innerHTML = '<div class="search-dd-empty">No results found</div>';
    return;
  }

  let html = '';
  if (workers.length) {
    html += '<div class="search-dd-group">Workers</div>';
    html += workers.map(w => `
      <div class="search-dd-item" onmousedown="navTo('people');switchPeopleTab('workers');setTimeout(()=>{document.getElementById('workerSearch').value=${JSON.stringify(w.user?.name||'')};filterPeople('workers')},300);document.getElementById('global-search-input').value='';hideSearchDropdown()">
        <div class="search-dd-avatar" style="background:#ff6b35">${(w.user?.name||'W').slice(0,1).toUpperCase()}</div>
        <div>
          <div class="search-dd-name">${escHtml(w.user?.name||'—')}</div>
          <div class="search-dd-sub">${escHtml(w.user?.phone||'')} · ${w.isVerified?'Verified':'Pending'}</div>
        </div>
      </div>`).join('');
  }
  if (users.length) {
    html += '<div class="search-dd-group">Customers</div>';
    html += users.filter(u => u.role === 'CUSTOMER').map(u => `
      <div class="search-dd-item" onmousedown="navTo('people');switchPeopleTab('customers');setTimeout(()=>{document.getElementById('customerSearch').value=${JSON.stringify(u.name||'')};filterPeople('customers')},300);document.getElementById('global-search-input').value='';hideSearchDropdown()">
        <div class="search-dd-avatar" style="background:#6366f1">${(u.name||'U').slice(0,1).toUpperCase()}</div>
        <div>
          <div class="search-dd-name">${escHtml(u.name||'Unnamed')}</div>
          <div class="search-dd-sub">${escHtml(u.phone||'')}</div>
        </div>
      </div>`).join('');
  }
  dd.innerHTML = html || '<div class="search-dd-empty">No results found</div>';
}

function showSearchDropdown() {
  const q = document.getElementById('global-search-input')?.value || '';
  if (q.trim().length >= 2) document.getElementById('search-dropdown')?.classList.remove('hidden');
}
function hideSearchDropdown() {
  setTimeout(() => document.getElementById('search-dropdown')?.classList.add('hidden'), 200);
}

// ══════════════════════════════
// ══════════════════════════════
// SETTINGS
// ══════════════════════════════
let _settingsData = [];

async function loadBrandingPreviews() {
  try {
    const res = await fetch(`${API}/public/branding`);
    if (!res.ok) return;
    const json = await res.json();
    const b = json.data || {};
    if (b.logoUrl)      { const el = document.getElementById('preview-logo');       if (el) el.src = b.logoUrl; }
    if (b.logoLightUrl) { const el = document.getElementById('preview-logo-light'); if (el) el.src = b.logoLightUrl; }
    if (b.logoIconUrl)  { const el = document.getElementById('preview-logo-icon');  if (el) el.src = b.logoIconUrl; }
  } catch (_) {}
}

async function uploadLogo(input, type, previewId) {
  const file = input.files[0];
  if (!file) return;
  const label = input.previousElementSibling;
  const origHtml = label.innerHTML;
  label.innerHTML = '<span style="opacity:.7">Uploading…</span>';

  const form = new FormData();
  form.append('file', file);
  form.append('type', type);

  try {
    const res = await apiFetch('/admin/settings/upload-logo', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token() },
      body: form,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Upload failed');
    const preview = document.getElementById(previewId);
    if (preview) preview.src = json.data.url + '?t=' + Date.now();
    showToast('Logo updated successfully', 'success');
  } catch (e) {
    showToast(e.message || 'Upload failed', 'error');
  } finally {
    label.innerHTML = origHtml;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    input.value = '';
  }
}

const groupMeta = {
  otp:      { label: 'OTP Configuration',        icon: 'key-round',    desc: 'Control how one-time passwords are sent to users.' },
  twilio:   { label: 'Twilio (SMS)',              icon: 'phone',        desc: 'Credentials for sending OTP via Twilio SMS.' },
  smtp:     { label: 'SMTP (Email)',              icon: 'mail',         desc: 'Email server credentials for sending notifications.' },
  firebase: { label: 'Firebase Push Notifications', icon: 'bell',      desc: 'Firebase Cloud Messaging (FCM) credentials for sending push notifications to the mobile app.' },
  app:      { label: 'App Settings',             icon: 'sliders',      desc: 'General application configuration.' },
};

async function loadFcmSettings() {
  try {
    const res = await fetch(`${API}/public/fcm-config`);
    if (!res.ok) return;
    const { data } = await res.json();
    if (data.projectId)         document.getElementById('fcm-project-id').value  = data.projectId;
    if (data.apiKey)            document.getElementById('fcm-api-key').value      = data.apiKey;
    if (data.appId)             document.getElementById('fcm-app-id').value       = data.appId;
    if (data.messagingSenderId) document.getElementById('fcm-sender-id').value    = data.messagingSenderId;
    if (data.vapidKey)          document.getElementById('fcm-vapid-key').value    = data.vapidKey;
    if (data.authDomain)        document.getElementById('fcm-auth-domain').value  = data.authDomain;
    // Note: clientEmail and privateKey are not exposed publicly; must be re-entered each save
  } catch (_) {}
}

async function saveFcmSettings() {
  const pairs = [
    { key: 'fcm_project_id',         value: document.getElementById('fcm-project-id').value.trim() },
    { key: 'fcm_client_email',        value: document.getElementById('fcm-client-email').value.trim() },
    { key: 'fcm_private_key',         value: document.getElementById('fcm-private-key').value.trim() },
    { key: 'fcm_api_key',             value: document.getElementById('fcm-api-key').value.trim() },
    { key: 'fcm_app_id',              value: document.getElementById('fcm-app-id').value.trim() },
    { key: 'fcm_messaging_sender_id', value: document.getElementById('fcm-sender-id').value.trim() },
    { key: 'fcm_vapid_key',           value: document.getElementById('fcm-vapid-key').value.trim() },
    { key: 'fcm_auth_domain',         value: document.getElementById('fcm-auth-domain').value.trim() },
  ].filter(p => p.value);

  if (!pairs.length) { showToast('Enter at least one FCM value.', 'error'); return; }
  showLoader();
  for (const p of pairs) {
    await apiFetch('/admin/settings', { method: 'POST', body: JSON.stringify({ key: p.key, value: p.value, label: p.key, group: 'fcm', isSecret: p.key.includes('private_key') || p.key.includes('client_email') }) });
  }
  hideLoader();
  showToast('FCM settings saved!', 'success');
}

async function loadSettings() {
  loadBrandingPreviews();
  loadFcmSettings();
  const container = document.getElementById('settings-container');
  container.innerHTML = '<div class="settings-loading"><i data-lucide="loader-2" class="spin"></i> Loading settings...</div>';
  if (typeof lucide !== 'undefined') lucide.createIcons();

  const res = await apiFetch('/admin/settings', { headers: authHeaders() });
  if (!res || !res.ok) {
    container.innerHTML = '<div class="settings-loading" style="color:var(--danger)">Failed to load settings.</div>';
    return;
  }
  const json = await res.json();
  _settingsData = json.data || [];

  // Group settings
  const groups = {};
  _settingsData.forEach(s => {
    if (!groups[s.group]) groups[s.group] = [];
    groups[s.group].push(s);
  });

  container.innerHTML = Object.entries(groups).map(([group, items]) => {
    const meta = groupMeta[group] || { label: group, icon: 'settings', desc: '' };
    return `
      <div class="settings-card" data-group="${group}">
        <div class="settings-card-header">
          <div class="settings-card-icon"><i data-lucide="${meta.icon}"></i></div>
          <div>
            <h3>${meta.label}</h3>
            <p>${meta.desc}</p>
          </div>
          <button class="btn-save-group" onclick="saveSettingsGroup('${group}', this)">
            Save Changes
          </button>
        </div>
        <div class="settings-fields">
          ${items.map(s => renderSettingField(s)).join('')}
        </div>
      </div>
    `;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderSettingField(s) {
  const inputId = 'setting-' + s.key;

  if (s.key === 'static_otp_enabled' || s.key === 'maintenance_mode') {
    const checked = s.value === 'true' ? 'checked' : '';
    return `
      <div class="setting-row setting-toggle-row">
        <div class="setting-info">
          <label class="setting-label" for="${inputId}">${escHtml(s.label)}</label>
          ${s.description ? `<span class="setting-desc">${escHtml(s.description)}</span>` : ''}
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="${inputId}" data-key="${s.key}" ${checked} onchange="onToggleChange(this)">
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;
  }

  // Private key needs a textarea (multi-line PEM block)
  if (s.key === 'fcm_private_key') {
    return `
      <div class="setting-row">
        <label class="setting-label" for="${inputId}">${escHtml(s.label)}</label>
        ${s.description ? `<span class="setting-desc">${escHtml(s.description)}</span>` : ''}
        <div class="setting-input-wrap">
          <textarea
            id="${inputId}"
            data-key="${s.key}"
            rows="5"
            autocomplete="off"
            class="setting-input setting-textarea"
            placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEvQIBADANBgkq...&#10;-----END PRIVATE KEY-----"
          >${escHtml(s.value)}</textarea>
          <div class="setting-key-hint"><i data-lucide="shield-check"></i> Stored encrypted — never exposed in API responses</div>
        </div>
      </div>
    `;
  }

  const inputType = s.isSecret ? 'password' : 'text';
  const autocomplete = s.isSecret ? 'new-password' : 'off';
  return `
    <div class="setting-row">
      <label class="setting-label" for="${inputId}">${escHtml(s.label)}</label>
      ${s.description ? `<span class="setting-desc">${escHtml(s.description)}</span>` : ''}
      <div class="setting-input-wrap">
        <input
          type="${inputType}"
          id="${inputId}"
          data-key="${s.key}"
          value="${escHtml(s.value)}"
          placeholder="${s.isSecret && s.value ? '••••••••' : ''}"
          autocomplete="${autocomplete}"
          class="setting-input ${s.isSecret ? 'secret-input' : ''}"
        />
        ${s.isSecret ? `<button class="toggle-visibility-btn" onclick="toggleSecretVisibility('${inputId}')" title="Show/hide"><i data-lucide="eye"></i></button>` : ''}
      </div>
    </div>
  `;
}

function onToggleChange(checkbox) {
  // Visual feedback only — value saved on "Save All"
  const label = checkbox.closest('.setting-toggle-row')?.querySelector('.setting-label');
  if (label) {
    const on = checkbox.checked;
    label.style.fontWeight = on ? '700' : '';
  }
}

function toggleSecretVisibility(inputId) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

async function saveSettingsGroup(group, btn) {
  const card = document.querySelector(`.settings-card[data-group="${group}"]`);
  if (!card) return;

  const inputs = card.querySelectorAll('[data-key]');
  const updates = [];
  inputs.forEach(el => {
    updates.push({ key: el.dataset.key, value: el.type === 'checkbox' ? String(el.checked) : el.value });
  });

  if (!updates.length) return;

  // Button loading state
  const origHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Saving...';

  const res = await apiFetch('/admin/settings', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ updates })
  });

  btn.disabled = false;
  if (res && res.ok) {
    btn.innerHTML = '<i data-lucide="check"></i> Saved';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    btn.classList.add('btn-save-group--saved');
    showToast('Settings saved.', 'success');
    setTimeout(() => {
      btn.innerHTML = origHTML;
      btn.classList.remove('btn-save-group--saved');
    }, 2500);
    const json = await res.json();
    _settingsData = json.data || _settingsData;
  } else {
    btn.innerHTML = origHTML;
    const data = res ? await res.json() : {};
    showToast(data.message || 'Failed to save.', 'error');
  }
}

// ══════════════════════════════
// TESTIMONIALS
// ══════════════════════════════
let _allTestimonials = [];

async function loadTestimonials() {
  const list = document.getElementById('testimonials-list');
  if (list) list.innerHTML = '<div class="table-empty" style="padding:3rem;text-align:center;">Loading testimonials...</div>';

  const res = await apiFetch('/admin/testimonials', { headers: authHeaders() });
  if (!res || !res.ok) {
    if (list) list.innerHTML = '<div class="table-empty" style="padding:3rem;text-align:center;color:var(--danger);">Failed to load.</div>';
    return;
  }
  const json = await res.json();
  _allTestimonials = json.data || [];
  renderTestimonialsList();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderTestimonialsList() {
  const list = document.getElementById('testimonials-list');
  if (!list) return;
  if (!_allTestimonials.length) {
    list.innerHTML = '<div class="table-empty" style="padding:3rem;text-align:center;">No testimonials yet. Click "+ Add Testimonial" to create one.</div>';
    return;
  }
  list.innerHTML = _allTestimonials.map(t => {
    const stars = '★'.repeat(Math.min(5, Math.max(1, t.rating || 5)));
    const initials = (t.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    return `<div class="content-card ${t.isActive ? '' : 'content-card--inactive'}">
      <div class="content-card-avatar" style="background:var(--primary)">${escHtml(initials)}</div>
      <div class="content-card-body">
        <div class="content-card-title">${escHtml(t.name)}<span class="content-card-role">${escHtml(t.role || '')}</span></div>
        <div class="content-card-stars">${stars}</div>
        <p class="content-card-text">"${escHtml(t.quote)}"</p>
      </div>
      <div class="content-card-actions">
        <span class="badge ${t.isActive ? 'badge-active' : 'badge-blocked'}">${t.isActive ? 'Active' : 'Hidden'}</span>
        <button class="btn-sm btn-view" onclick='editTestimonial(${JSON.stringify(t)})'>Edit</button>
        <button class="btn-sm" onclick="toggleTestimonialActive('${t.id}', ${t.isActive})">${t.isActive ? 'Hide' : 'Show'}</button>
        <button class="btn-sm btn-block" onclick="deleteTestimonial('${t.id}', '${escHtml(t.name)}')">Delete</button>
      </div>
    </div>`;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function switchLangTab(prefix, lang, btn) {
  const modal = btn.closest('.modal-box');
  modal.querySelectorAll('.lang-tab-btn').forEach(b => b.classList.remove('active'));
  modal.querySelectorAll('.lang-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const panel = document.getElementById(`${prefix}-lang-${lang}`);
  if (panel) panel.classList.add('active');
}

function getLangTr(prefix, fields) {
  const hi = {};
  fields.forEach(f => {
    const el = document.getElementById(`${prefix}-${f}-hi`);
    if (el) hi[f] = el.value.trim();
  });
  const hasHi = Object.values(hi).some(v => v);
  return hasHi ? { hi } : undefined;
}

function setLangTrFields(prefix, fields, translations) {
  const hi = (translations && (typeof translations === 'string' ? JSON.parse(translations) : translations)?.hi) || {};
  fields.forEach(f => {
    const el = document.getElementById(`${prefix}-${f}-hi`);
    if (el) el.value = hi[f] || '';
  });
}

function showTestimonialModal(data = null) {
  document.getElementById('testimonial-id').value = data?.id || '';
  document.getElementById('testimonial-name').value = data?.name || '';
  document.getElementById('testimonial-role').value = data?.role || '';
  document.getElementById('testimonial-quote').value = data?.quote || '';
  document.getElementById('testimonial-rating').value = data?.rating ?? 5;
  document.getElementById('testimonial-order').value = data?.sortOrder ?? 0;
  document.getElementById('testimonial-photo').value = data?.photoUrl || '';
  setLangTrFields('testimonial', ['role', 'quote'], data?.translations);
  const isEdit = !!data;
  document.getElementById('testimonial-modal-title').textContent = isEdit ? 'Edit Testimonial' : 'Add Testimonial';
  document.getElementById('testimonial-submit-label').textContent = isEdit ? 'Save Changes' : 'Add Testimonial';
  const modal = document.getElementById('testimonialModal');
  modal.style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
  setTimeout(() => document.getElementById('testimonial-name')?.focus(), 50);
}

function editTestimonial(t) { showTestimonialModal(t); }

function closeTestimonialModal() {
  document.getElementById('testimonialModal').style.display = 'none';
}

async function submitTestimonial() {
  const id = document.getElementById('testimonial-id').value;
  const name = document.getElementById('testimonial-name').value.trim();
  const role = document.getElementById('testimonial-role').value.trim();
  const quote = document.getElementById('testimonial-quote').value.trim();
  const rating = parseInt(document.getElementById('testimonial-rating').value) || 5;
  const sortOrder = parseInt(document.getElementById('testimonial-order').value) || 0;
  const photoUrl = document.getElementById('testimonial-photo').value.trim();

  if (!name || !quote) { showToast('Name and quote are required.', 'error'); return; }

  showLoader();
  const isEdit = !!id;
  const res = await apiFetch(isEdit ? `/admin/testimonials/${id}` : '/admin/testimonials', {
    method: isEdit ? 'PATCH' : 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, role: role || undefined, quote, rating, sortOrder, photoUrl: photoUrl || undefined, translations: getLangTr('testimonial', ['role', 'quote']) })
  });
  hideLoader();
  if (!res) return;
  const data = await res.json();
  if (res.ok) {
    showToast(isEdit ? 'Testimonial updated!' : 'Testimonial added!', 'success');
    closeTestimonialModal();
    loadTestimonials();
  } else {
    showToast(data.message || 'Failed.', 'error');
  }
}

async function toggleTestimonialActive(id, current) {
  showLoader();
  const res = await apiFetch(`/admin/testimonials/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ isActive: !current })
  });
  hideLoader();
  if (res && res.ok) {
    showToast(current ? 'Testimonial hidden.' : 'Testimonial shown.', 'success');
    loadTestimonials();
  } else {
    showToast('Failed to update.', 'error');
  }
}

async function deleteTestimonial(id, name) {
  const ok = await showConfirm({ title: 'Delete Testimonial?', message: `"${name}" will be permanently removed.`, icon: 'trash-2', confirmText: 'Delete', danger: true });
  if (!ok) return;
  showLoader();
  const res = await apiFetch(`/admin/testimonials/${id}`, { method: 'DELETE', headers: authHeaders() });
  hideLoader();
  if (res && res.ok) { showToast('Testimonial deleted.', 'success'); loadTestimonials(); }
  else showToast('Failed to delete.', 'error');
}

// ══════════════════════════════
// FAQS
// ══════════════════════════════
let _allFaqs = [];

async function loadFaqs() {
  const list = document.getElementById('faqs-list');
  if (list) list.innerHTML = '<div class="table-empty" style="padding:3rem;text-align:center;">Loading FAQs...</div>';

  const res = await apiFetch('/admin/faqs', { headers: authHeaders() });
  if (!res || !res.ok) {
    if (list) list.innerHTML = '<div class="table-empty" style="padding:3rem;text-align:center;color:var(--danger);">Failed to load.</div>';
    return;
  }
  const json = await res.json();
  _allFaqs = json.data || [];
  renderFaqsList();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderFaqsList() {
  const list = document.getElementById('faqs-list');
  if (!list) return;
  if (!_allFaqs.length) {
    list.innerHTML = '<div class="table-empty" style="padding:3rem;text-align:center;">No FAQs yet. Click "+ Add FAQ" to create one.</div>';
    return;
  }
  list.innerHTML = _allFaqs.map((f, i) => `
    <div class="faq-card ${f.isActive ? '' : 'content-card--inactive'}">
      <div class="faq-card-head">
        <span class="faq-num">${i + 1}</span>
        <p class="faq-question">${escHtml(f.question)}</p>
        <div class="content-card-actions">
          <span class="badge ${f.isActive ? 'badge-active' : 'badge-blocked'}">${f.isActive ? 'Active' : 'Hidden'}</span>
          <button class="btn-sm btn-view" onclick='editFaq(${JSON.stringify(f)})'>Edit</button>
          <button class="btn-sm" onclick="toggleFaqActive('${f.id}', ${f.isActive})">${f.isActive ? 'Hide' : 'Show'}</button>
          <button class="btn-sm btn-block" onclick="deleteFaq('${f.id}')">Delete</button>
        </div>
      </div>
      <p class="faq-answer">${escHtml(f.answer)}</p>
    </div>`).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function showFaqModal(data = null) {
  document.getElementById('faq-id').value = data?.id || '';
  document.getElementById('faq-question').value = data?.question || '';
  document.getElementById('faq-answer').value = data?.answer || '';
  document.getElementById('faq-order').value = data?.sortOrder ?? 0;
  setLangTrFields('faq', ['question', 'answer'], data?.translations);
  const isEdit = !!data;
  document.getElementById('faq-modal-title').textContent = isEdit ? 'Edit FAQ' : 'Add FAQ';
  document.getElementById('faq-submit-label').textContent = isEdit ? 'Save Changes' : 'Add FAQ';
  const modal = document.getElementById('faqModal');
  modal.style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
  setTimeout(() => document.getElementById('faq-question')?.focus(), 50);
}

function editFaq(f) { showFaqModal(f); }

function closeFaqModal() {
  document.getElementById('faqModal').style.display = 'none';
}

async function submitFaq() {
  const id = document.getElementById('faq-id').value;
  const question = document.getElementById('faq-question').value.trim();
  const answer = document.getElementById('faq-answer').value.trim();
  const sortOrder = parseInt(document.getElementById('faq-order').value) || 0;

  if (!question || !answer) { showToast('Question and answer are required.', 'error'); return; }

  showLoader();
  const isEdit = !!id;
  const res = await apiFetch(isEdit ? `/admin/faqs/${id}` : '/admin/faqs', {
    method: isEdit ? 'PATCH' : 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ question, answer, sortOrder, translations: getLangTr('faq', ['question', 'answer']) })
  });
  hideLoader();
  if (!res) return;
  const data = await res.json();
  if (res.ok) {
    showToast(isEdit ? 'FAQ updated!' : 'FAQ added!', 'success');
    closeFaqModal();
    loadFaqs();
  } else {
    showToast(data.message || 'Failed.', 'error');
  }
}

async function toggleFaqActive(id, current) {
  showLoader();
  const res = await apiFetch(`/admin/faqs/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ isActive: !current })
  });
  hideLoader();
  if (res && res.ok) {
    showToast(current ? 'FAQ hidden.' : 'FAQ shown.', 'success');
    loadFaqs();
  } else {
    showToast('Failed to update.', 'error');
  }
}

async function deleteFaq(id) {
  const ok = await showConfirm({ title: 'Delete FAQ?', message: 'This FAQ will be permanently removed.', icon: 'trash-2', confirmText: 'Delete', danger: true });
  if (!ok) return;
  showLoader();
  const res = await apiFetch(`/admin/faqs/${id}`, { method: 'DELETE', headers: authHeaders() });
  hideLoader();
  if (res && res.ok) { showToast('FAQ deleted.', 'success'); loadFaqs(); }
  else showToast('Failed to delete.', 'error');
}

// ══════════════════════════════
// BULK DEACTIVATE
// ══════════════════════════════
function toggleSelectAll(type) {
  const master = document.getElementById(`sel-all-${type}`);
  document.querySelectorAll(`.row-checkbox[data-type="${type}"]`).forEach(cb => cb.checked = master.checked);
  updateBulkBtn(type);
}

function onRowCheckbox(type) {
  const all = document.querySelectorAll(`.row-checkbox[data-type="${type}"]`);
  const checked = document.querySelectorAll(`.row-checkbox[data-type="${type}"]:checked`);
  const master = document.getElementById(`sel-all-${type}`);
  if (master) { master.checked = checked.length === all.length; master.indeterminate = checked.length > 0 && checked.length < all.length; }
  updateBulkBtn(type);
}

function updateBulkBtn(type) {
  const checked = document.querySelectorAll(`.row-checkbox[data-type="${type}"]:checked`).length;
  const btn = document.getElementById(`bulk-deactivate-${type}-btn`);
  if (btn) btn.style.display = checked > 0 ? '' : 'none';
}

async function bulkDeactivate(type) {
  const ids = [...document.querySelectorAll(`.row-checkbox[data-type="${type}"]:checked`)].map(cb => cb.dataset.id);
  if (!ids.length) return;
  const ok = await showConfirm({ title: `Deactivate ${ids.length} ${type}?`, message: 'They will lose access until reactivated.', confirmText: 'Deactivate', icon: '⚠️' });
  if (!ok) return;
  let done = 0;
  for (const id of ids) {
    try { await apiFetch(`/admin/users/${id}/toggle-active`, { method: 'PATCH', body: JSON.stringify({ isActive: false }) }); done++; } catch {}
  }
  showToast(`Deactivated ${done} ${type}.`);
  await loadPeople();
}

// ══════════════════════════════
// DARK / LIGHT MODE
// ══════════════════════════════
function initDarkMode() {
  const saved = localStorage.getItem('hn_theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('hn_theme', theme);
  const icon = document.getElementById('darkModeIcon');
  if (icon) { icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon'); if (typeof lucide !== 'undefined') lucide.createIcons(); }
}

function toggleDarkMode() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ══════════════════════════════
// ADMIN PROFILE
// ══════════════════════════════
function openAdminProfileModal() {
  const user = JSON.parse(localStorage.getItem('hn_admin_user') || '{}');
  document.getElementById('profile-name-input').value = user.name || '';
  document.getElementById('profile-display-name').textContent = user.name || 'Admin';
  document.getElementById('profile-display-email').textContent = user.email || user.phone || '';
  const initials = (user.name || 'A').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('profile-avatar-initials').textContent = initials;
  document.getElementById('profile-current-pass').value = '';
  document.getElementById('profile-new-pass').value = '';
  document.getElementById('profile-confirm-pass').value = '';
  document.getElementById('adminProfileModal').style.display = 'flex';
}

function closeAdminProfileModal() { document.getElementById('adminProfileModal').style.display = 'none'; }

async function saveAdminProfile() {
  const name = document.getElementById('profile-name-input').value.trim();
  if (!name) return showToast('Name cannot be empty.', 'error');
  try {
    const res = await apiFetch('/admin/profile', { method: 'PATCH', body: JSON.stringify({ name }) });
    const user = JSON.parse(localStorage.getItem('hn_admin_user') || '{}');
    user.name = name;
    localStorage.setItem('hn_admin_user', JSON.stringify(user));
    document.getElementById('profile-display-name').textContent = name;
    document.getElementById('profile-avatar-initials').textContent = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    showToast('Profile updated.');
  } catch (e) { showToast(e.message || 'Failed to update profile.', 'error'); }
}

async function saveAdminPassword() {
  const current = document.getElementById('profile-current-pass').value;
  const next = document.getElementById('profile-new-pass').value;
  const confirm = document.getElementById('profile-confirm-pass').value;
  if (!current || !next) return showToast('All password fields are required.', 'error');
  if (next !== confirm) return showToast('Passwords do not match.', 'error');
  if (next.length < 6) return showToast('New password must be at least 6 characters.', 'error');
  try {
    await apiFetch('/admin/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: current, newPassword: next }) });
    showToast('Password changed successfully.');
    document.getElementById('profile-current-pass').value = '';
    document.getElementById('profile-new-pass').value = '';
    document.getElementById('profile-confirm-pass').value = '';
  } catch (e) { showToast(e.message || 'Failed to change password.', 'error'); }
}

// ══════════════════════════════
// WORKER RATING ANALYTICS
// ══════════════════════════════
async function openRatingModal(workerId, workerName) {
  document.getElementById('ratingAnalyticsTitle').textContent = `Rating Analytics — ${workerName}`;
  document.getElementById('rating-analytics-content').innerHTML = '<div class="table-empty" style="padding:2rem;text-align:center;">Loading...</div>';
  document.getElementById('ratingAnalyticsModal').style.display = 'flex';
  try {
    const res = await apiFetch(`/admin/workers/${workerId}/analytics`);
    const d = res.data || res;
    document.getElementById('rating-analytics-content').innerHTML = `
      <div class="rating-analytics-grid">
        <div class="ra-card"><div class="ra-val">${d.averageRating?.toFixed(1) || '—'}</div><div class="ra-label">Avg Rating</div></div>
        <div class="ra-card"><div class="ra-val">${d.totalReviews ?? 0}</div><div class="ra-label">Total Reviews</div></div>
        <div class="ra-card"><div class="ra-val">${d.fiveStarCount ?? 0}</div><div class="ra-label">5-Star</div></div>
        <div class="ra-card"><div class="ra-val">${d.oneStarCount ?? 0}</div><div class="ra-label">1-Star</div></div>
      </div>
      <h4 style="margin:1.2rem 0 .6rem;color:var(--text)">Rating Distribution</h4>
      <div class="ra-dist">
        ${[5,4,3,2,1].map(s => {
          const count = d.distribution?.[s] || 0;
          const pct = d.totalReviews ? Math.round(count / d.totalReviews * 100) : 0;
          return `<div class="ra-bar-row"><span class="ra-star-label">${s}★</span><div class="ra-bar-bg"><div class="ra-bar-fill" style="width:${pct}%"></div></div><span class="ra-bar-count">${count}</span></div>`;
        }).join('')}
      </div>
      ${d.recentReviews?.length ? `
        <h4 style="margin:1.2rem 0 .6rem;color:var(--text)">Recent Reviews</h4>
        <div class="ra-reviews">
          ${d.recentReviews.map(r => `
            <div class="ra-review-item">
              <div class="ra-review-header">
                <span class="ra-review-user">${escHtml(r.user?.name||'User')}</span>
                <span class="ra-review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
                <span class="ra-review-date">${new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
              </div>
              ${r.comment ? `<div class="ra-review-comment">${escHtml(r.comment)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  } catch (e) {
    document.getElementById('rating-analytics-content').innerHTML = `<div class="table-empty" style="padding:2rem;text-align:center;color:var(--danger)">Failed to load analytics.</div>`;
  }
}

function closeRatingModal() { document.getElementById('ratingAnalyticsModal').style.display = 'none'; }

// ══════════════════════════════
// ANNOUNCEMENTS
// ══════════════════════════════
let _allAnnouncements = [];

async function loadAnnouncements() {
  const el = document.getElementById('announcements-list');
  if (!el) return;
  el.innerHTML = '<div class="table-empty" style="padding:3rem;text-align:center;">Loading...</div>';
  try {
    const res = await apiFetch('/admin/announcements');
    _allAnnouncements = res.data || res;
    renderAnnouncementsList(_allAnnouncements);
  } catch (e) { el.innerHTML = '<div class="table-empty" style="padding:2rem;text-align:center;">Failed to load.</div>'; }
}

function renderAnnouncementsList(items) {
  const el = document.getElementById('announcements-list');
  if (!items.length) { el.innerHTML = '<div class="table-empty" style="padding:3rem;text-align:center;">No announcements yet.</div>'; return; }
  const typeColors = { INFO: '#6366f1', WARNING: '#f59e0b', SUCCESS: '#10b981', PROMO: '#FF6B35' };
  el.innerHTML = items.map(a => `
    <div class="ann-card">
      <div class="ann-card-header">
        <span class="ann-type-badge" style="background:${typeColors[a.type]||'#6366f1'}20;color:${typeColors[a.type]||'#6366f1'}">${a.type}</span>
        <span class="ann-audience-badge">${a.targetAudience}</span>
        <span class="ann-status-badge ${a.isActive ? 'ann-active' : 'ann-inactive'}">${a.isActive ? 'Active' : 'Inactive'}</span>
        <div style="margin-left:auto;display:flex;gap:.4rem">
          <button class="btn-sm btn-view" onclick='editAnnouncement(${JSON.stringify(a)})'>Edit</button>
          <button class="btn-sm btn-block" onclick="deleteAnnouncement('${a.id}')">Delete</button>
        </div>
      </div>
      <div class="ann-card-title">${escHtml(a.title)}</div>
      <div class="ann-card-message">${escHtml(a.message)}</div>
      <div class="ann-card-date">${new Date(a.createdAt).toLocaleString('en-IN')}</div>
    </div>
  `).join('');
}

function showAnnouncementModal(data) {
  document.getElementById('announcementModalTitle').textContent = data ? 'Edit Announcement' : 'New Announcement';
  document.getElementById('ann-id').value = data?.id || '';
  document.getElementById('ann-title').value = data?.title || '';
  document.getElementById('ann-message').value = data?.message || '';
  document.getElementById('ann-type').value = data?.type || 'INFO';
  document.getElementById('ann-audience').value = data?.targetAudience || 'ALL';
  document.getElementById('ann-active').checked = data ? data.isActive : true;
  setLangTrFields('ann', ['title', 'message'], data?.translations);
  document.getElementById('announcementModal').style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function editAnnouncement(a) { showAnnouncementModal(a); }

function closeAnnouncementModal() { document.getElementById('announcementModal').style.display = 'none'; }

async function submitAnnouncement() {
  const id = document.getElementById('ann-id').value;
  const body = {
    title: document.getElementById('ann-title').value.trim(),
    message: document.getElementById('ann-message').value.trim(),
    type: document.getElementById('ann-type').value,
    targetAudience: document.getElementById('ann-audience').value,
    isActive: document.getElementById('ann-active').checked,
    translations: getLangTr('ann', ['title', 'message'])
  };
  if (!body.title || !body.message) return showToast('Title and message are required.', 'error');
  try {
    if (id) await apiFetch(`/admin/announcements/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    else await apiFetch('/admin/announcements', { method: 'POST', body: JSON.stringify(body) });
    closeAnnouncementModal();
    showToast(id ? 'Announcement updated.' : 'Announcement created.');
    loadAnnouncements();
  } catch (e) { showToast(e.message || 'Failed to save.', 'error'); }
}

async function deleteAnnouncement(id) {
  const ok = await showConfirm({ title: 'Delete announcement?', message: 'This cannot be undone.', confirmText: 'Delete', icon: 'trash-2' });
  if (!ok) return;
  try { await apiFetch(`/admin/announcements/${id}`, { method: 'DELETE' }); showToast('Deleted.'); loadAnnouncements(); }
  catch (e) { showToast(e.message || 'Failed.', 'error'); }
}

// ══════════════════════════════
// COUPONS
// ══════════════════════════════
let _allCoupons = [], _couponPage = 1;
const COUPON_PAGE_SIZE = 15;

async function loadCoupons() {
  const tbody = document.getElementById('coupons-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Loading...</td></tr>';
  try {
    const res = await apiFetch('/admin/coupons');
    _allCoupons = res.data || res;
    _couponPage = 1;
    renderCouponsTable(_allCoupons);
  } catch (e) { tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Failed to load.</td></tr>'; }
}

function filterCoupons() {
  const q = (document.getElementById('couponSearch')?.value || '').toLowerCase();
  const status = document.getElementById('couponStatusFilter')?.value;
  let list = _allCoupons;
  if (q) list = list.filter(c => c.code.toLowerCase().includes(q) || (c.description||'').toLowerCase().includes(q));
  if (status === 'active') list = list.filter(c => c.isActive);
  if (status === 'inactive') list = list.filter(c => !c.isActive);
  _couponPage = 1;
  renderCouponsTable(list);
}

function renderCouponsTable(list) {
  const tbody = document.getElementById('coupons-tbody');
  if (!tbody) return;
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / COUPON_PAGE_SIZE));
  const slice = list.slice((_couponPage - 1) * COUPON_PAGE_SIZE, _couponPage * COUPON_PAGE_SIZE);
  if (!slice.length) { tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No coupons found.</td></tr>'; renderPagination('coupons-pagination', _couponPage, 0, 'goCouponPage'); return; }
  tbody.innerHTML = slice.map(c => {
    const disc = c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `₹${c.discountValue}`;
    const uses = `${c.usedCount}${c.maxUses ? ' / ' + c.maxUses : ' / ∞'}`;
    const expires = c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('en-IN') : 'Never';
    const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
    return `<tr>
      <td><strong>${escHtml(c.code)}</strong>${c.description ? `<div style="font-size:.78rem;color:var(--muted)">${escHtml(c.description)}</div>` : ''}</td>
      <td>${disc}</td>
      <td>${uses}</td>
      <td style="color:${expired ? 'var(--danger)' : 'var(--text-muted)'}">${expires}</td>
      <td><span class="badge ${c.isActive && !expired ? 'badge-active' : 'badge-blocked'}">${c.isActive && !expired ? 'Active' : 'Inactive'}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn-sm btn-view" onclick='showCouponModal(${JSON.stringify(c)})'>Edit</button>
          <button class="btn-sm btn-block" onclick="deleteCoupon('${c.id}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  renderPagination('coupons-pagination', _couponPage, totalPages, 'goCouponPage');
}

function goCouponPage(p) { _couponPage = p; filterCoupons(); }

function showCouponModal(data) {
  document.getElementById('couponModalTitle').textContent = data?.id ? 'Edit Coupon' : 'Add Coupon';
  document.getElementById('coupon-id').value = data?.id || '';
  document.getElementById('coupon-code').value = data?.code || '';
  document.getElementById('coupon-type').value = data?.discountType || 'PERCENTAGE';
  document.getElementById('coupon-value').value = data?.discountValue || '';
  document.getElementById('coupon-maxuses').value = data?.maxUses || '';
  document.getElementById('coupon-desc').value = data?.description || '';
  document.getElementById('coupon-expires').value = data?.expiresAt ? new Date(data.expiresAt).toISOString().slice(0,16) : '';
  document.getElementById('coupon-active').checked = data ? data.isActive : true;
  document.getElementById('couponModal').style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeCouponModal() { document.getElementById('couponModal').style.display = 'none'; }

async function submitCoupon() {
  const id = document.getElementById('coupon-id').value;
  const code = document.getElementById('coupon-code').value.trim().toUpperCase();
  const value = parseFloat(document.getElementById('coupon-value').value);
  if (!code) return showToast('Coupon code is required.', 'error');
  if (isNaN(value) || value <= 0) return showToast('Discount value must be positive.', 'error');
  const body = {
    code, discountValue: value,
    discountType: document.getElementById('coupon-type').value,
    description: document.getElementById('coupon-desc').value.trim() || undefined,
    maxUses: parseInt(document.getElementById('coupon-maxuses').value) || undefined,
    expiresAt: document.getElementById('coupon-expires').value || undefined,
    isActive: document.getElementById('coupon-active').checked
  };
  try {
    if (id) await apiFetch(`/admin/coupons/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    else await apiFetch('/admin/coupons', { method: 'POST', body: JSON.stringify(body) });
    closeCouponModal();
    showToast(id ? 'Coupon updated.' : 'Coupon created.');
    loadCoupons();
  } catch (e) { showToast(e.message || 'Failed to save.', 'error'); }
}

async function deleteCoupon(id) {
  const ok = await showConfirm({ title: 'Delete coupon?', message: 'This cannot be undone.', confirmText: 'Delete', icon: 'trash-2' });
  if (!ok) return;
  try { await apiFetch(`/admin/coupons/${id}`, { method: 'DELETE' }); showToast('Deleted.'); loadCoupons(); }
  catch (e) { showToast(e.message || 'Failed.', 'error'); }
}

function exportCouponsCSV() {
  if (!_allCoupons.length) return showToast('No data to export.', 'error');
  const rows = [['Code','Type','Value','MaxUses','UsedCount','ExpiresAt','Active']];
  _allCoupons.forEach(c => rows.push([c.code, c.discountType, c.discountValue, c.maxUses||'', c.usedCount, c.expiresAt||'', c.isActive]));
  downloadCSVRows('coupons.csv', rows);
}

function downloadCSVRows(filename, rows) {
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = filename;
  a.click();
}

// ══════════════════════════════
// NOTIFICATION TEMPLATES
// ══════════════════════════════
let _allTemplates = [];

async function loadTemplates() {
  const el = document.getElementById('templates-list');
  if (!el) return;
  el.innerHTML = '<div class="table-empty" style="padding:3rem;text-align:center;">Loading...</div>';
  try {
    const res = await apiFetch('/admin/notification-templates');
    _allTemplates = res.data || res;
    renderTemplatesList(_allTemplates);
  } catch (e) { el.innerHTML = '<div class="table-empty" style="padding:2rem;text-align:center;">Failed to load.</div>'; }
}

function renderTemplatesList(items) {
  const el = document.getElementById('templates-list');
  if (!items.length) { el.innerHTML = '<div class="table-empty" style="padding:3rem;text-align:center;">No templates yet.</div>'; return; }
  const typeColors = { SMS: '#6366f1', EMAIL: '#10b981', PUSH: '#f59e0b' };
  el.innerHTML = items.map(t => `
    <div class="tpl-card">
      <div class="tpl-card-header">
        <span class="ann-type-badge" style="background:${typeColors[t.type]||'#6366f1'}20;color:${typeColors[t.type]||'#6366f1'}">${t.type}</span>
        <strong class="tpl-card-name">${escHtml(t.name)}</strong>
        <span class="ann-status-badge ${t.isActive ? 'ann-active' : 'ann-inactive'}">${t.isActive ? 'Active' : 'Inactive'}</span>
        <div style="margin-left:auto;display:flex;gap:.4rem">
          <button class="btn-sm btn-view" onclick='showTemplateModal(${JSON.stringify(t)})'>Edit</button>
          <button class="btn-sm btn-block" onclick="deleteTemplate('${t.id}')">Delete</button>
        </div>
      </div>
      ${t.subject ? `<div class="tpl-subject">Subject: ${escHtml(t.subject)}</div>` : ''}
      <div class="tpl-body">${escHtml(t.body)}</div>
      ${t.variables ? `<div class="tpl-vars">Variables: <code>${escHtml(t.variables)}</code></div>` : ''}
    </div>
  `).join('');
}

function showTemplateModal(data) {
  document.getElementById('templateModalTitle').textContent = data?.id ? 'Edit Template' : 'Add Template';
  document.getElementById('tpl-id').value = data?.id || '';
  document.getElementById('tpl-name').value = data?.name || '';
  document.getElementById('tpl-type').value = data?.type || 'SMS';
  document.getElementById('tpl-subject').value = data?.subject || '';
  document.getElementById('tpl-body').value = data?.body || '';
  document.getElementById('tpl-vars').value = data?.variables || '';
  document.getElementById('tpl-active').checked = data ? data.isActive : true;
  setLangTrFields('tpl', ['subject', 'body'], data?.translations);
  toggleTemplateSubject(data?.type || 'SMS');
  document.getElementById('templateModal').style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
  document.getElementById('tpl-type').onchange = e => toggleTemplateSubject(e.target.value);
}

function toggleTemplateSubject(type) {
  const wrap = document.getElementById('tpl-subject-wrap');
  if (wrap) wrap.style.display = type === 'EMAIL' ? '' : 'none';
}

function closeTemplateModal() { document.getElementById('templateModal').style.display = 'none'; }

async function submitTemplate() {
  const id = document.getElementById('tpl-id').value;
  const body = {
    name: document.getElementById('tpl-name').value.trim(),
    type: document.getElementById('tpl-type').value,
    subject: document.getElementById('tpl-subject').value.trim() || undefined,
    body: document.getElementById('tpl-body').value.trim(),
    variables: document.getElementById('tpl-vars').value.trim() || undefined,
    isActive: document.getElementById('tpl-active').checked,
    translations: getLangTr('tpl', ['subject', 'body'])
  };
  if (!body.name || !body.body) return showToast('Name and body are required.', 'error');
  try {
    // Backend uses upsert-by-name via POST for both create and update
    await apiFetch('/admin/notification-templates', { method: 'POST', body: JSON.stringify(body) });
    closeTemplateModal();
    showToast(id ? 'Template updated.' : 'Template created.');
    loadTemplates();
  } catch (e) { showToast(e.message || 'Failed to save.', 'error'); }
}

async function deleteTemplate(id) {
  const ok = await showConfirm({ title: 'Delete template?', message: 'This cannot be undone.', confirmText: 'Delete', icon: 'trash-2' });
  if (!ok) return;
  try { await apiFetch(`/admin/notification-templates/${id}`, { method: 'DELETE' }); showToast('Deleted.'); loadTemplates(); }
  catch (e) { showToast(e.message || 'Failed.', 'error'); }
}

// ══════════════════════════════
// INIT
// ══════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons for static HTML
  if (typeof lucide !== 'undefined') lucide.createIcons();

  initDarkMode();

  // Invalidate Leaflet size on window resize when map is active
  window.addEventListener('resize', () => {
    if (_leafletMap && document.getElementById('sec-map')?.classList.contains('active')) {
      _leafletMap.invalidateSize({ animate: false });
    }
  });

  // Browsers ignore autocomplete="off" — clear autofilled fields explicitly
  setTimeout(() => {
    const s = document.getElementById('global-search-input');
    if (s) s.value = '';
  }, 100);

  if (token()) {
    showAdminApp();
  } else {
    showAdminLogin();
  }
});

// ══════════════════════════════
// PAGES
// ══════════════════════════════
let _allPages = [];

async function loadPages() {
  const tbody = document.getElementById('pages-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Loading...</td></tr>';
  const res = await apiFetch('/admin/pages');
  if (!res || !res.ok) return;
  const json = await res.json();
  _allPages = json.data || [];
  renderPagesTable(_allPages);
}

function renderPagesTable(pages) {
  const tbody = document.getElementById('pages-tbody');
  if (!tbody) return;
  if (!pages.length) { tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No pages yet. Create your first page.</td></tr>'; return; }
  tbody.innerHTML = pages.map(p => {
    const date = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    return `<tr>
      <td><strong>${escHtml(p.title)}</strong></td>
      <td><code style="background:rgba(255,255,255,.06);padding:.15rem .5rem;border-radius:4px;font-size:.78rem">/${escHtml(p.slug)}</code></td>
      <td>${p.isActive ? '<span class="status-chip active">Active</span>' : '<span class="status-chip inactive">Hidden</span>'}</td>
      <td style="color:var(--text-muted)">${date}</td>
      <td>
        <div class="table-actions">
          <button class="btn-sm btn-view" onclick='editPage(${JSON.stringify(p)})'>Edit</button>
          <button class="btn-sm btn-danger-sm" onclick="deletePage('${p.id}','${escHtml(p.title)}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

let _pageQuillEN = null;
let _pageQuillHI = null;

function showPageModal(page = null) {
  document.getElementById('page-edit-id').value = page?.id || '';
  document.getElementById('page-modal-title').textContent = page ? 'Edit Page' : 'New Page';
  document.getElementById('page-title').value = page?.title || '';
  document.getElementById('page-slug').value = page?.slug || '';
  document.getElementById('page-active').checked = page ? page.isActive : true;
  setLangTrFields('page', ['title'], page?.translations);
  document.getElementById('pageModal').style.display = 'flex';

  setTimeout(() => {
    if (!_pageQuillEN) {
      _pageQuillEN = new Quill('#page-content-quill', { theme: 'snow', placeholder: 'Write page content here…', modules: { toolbar: [[{ header: [1,2,3,false] }], ['bold','italic','underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link'], ['clean']] } });
    }
    if (!_pageQuillHI) {
      _pageQuillHI = new Quill('#page-content-hi-quill', { theme: 'snow', placeholder: 'हिंदी में पृष्ठ सामग्री लिखें…', modules: { toolbar: [[{ header: [1,2,3,false] }], ['bold','italic','underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link'], ['clean']] } });
    }
    _pageQuillEN.root.innerHTML = page?.content || '';
    const hiContent = (typeof page?.translations === 'object' ? page.translations : {})?.hi?.content || '';
    _pageQuillHI.root.innerHTML = hiContent;
  }, 50);

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function editPage(p) { showPageModal(p); }
function closePageModal() { document.getElementById('pageModal').style.display = 'none'; }

async function submitPage() {
  const id = document.getElementById('page-edit-id').value;
  const slug = document.getElementById('page-slug').value.trim().toLowerCase().replace(/\s+/g, '-');
  const title = document.getElementById('page-title').value.trim();
  const content = _pageQuillEN ? _pageQuillEN.root.innerHTML.replace(/<p><br><\/p>/g,'').trim() : '';
  const contentHI = _pageQuillHI ? _pageQuillHI.root.innerHTML.replace(/<p><br><\/p>/g,'').trim() : '';
  const isActive = document.getElementById('page-active').checked;
  const trBase = getLangTr('page', ['title']);
  if (contentHI && trBase.hi) trBase.hi.content = contentHI;
  else if (contentHI) trBase.hi = { content: contentHI };
  if (!slug || !title || !content) { showToast('Slug, title and content are required.', 'error'); return; }
  showLoader();
  const res = await apiFetch('/admin/pages', { method: 'POST', body: JSON.stringify({ slug, title, content, isActive, translations: trBase }) });
  hideLoader();
  if (!res) return;
  const data = await res.json();
  if (res.ok) { showToast('Page saved!', 'success'); closePageModal(); loadPages(); }
  else showToast(data.message || 'Failed to save page.', 'error');
}

async function deletePage(id, title) {
  const ok = await showConfirm({ title: 'Delete Page?', message: `"${title}" will be permanently deleted.`, confirmText: 'Delete', danger: true });
  if (!ok) return;
  showLoader();
  const res = await apiFetch('/admin/pages/' + id, { method: 'DELETE' });
  hideLoader();
  if (res && res.ok) { showToast('Page deleted.', 'success'); loadPages(); }
  else showToast('Failed to delete.', 'error');
}

// ══════════════════════════════
// BLOG
// ══════════════════════════════
let _allBlogPosts = [];

async function loadBlog() {
  const tbody = document.getElementById('blog-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Loading...</td></tr>';
  const res = await apiFetch('/admin/blog');
  if (!res || !res.ok) return;
  const json = await res.json();
  _allBlogPosts = json.data || [];
  renderBlogTable(_allBlogPosts);
}

function renderBlogTable(posts) {
  const tbody = document.getElementById('blog-tbody');
  if (!tbody) return;
  if (!posts.length) { tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No posts yet. Write your first post.</td></tr>'; return; }
  tbody.innerHTML = posts.map(p => {
    const date = (p.publishedAt || p.createdAt) ? new Date(p.publishedAt || p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    return `<tr>
      <td><strong>${escHtml(p.title)}</strong>${p.excerpt ? `<div style="font-size:.75rem;color:var(--text-muted);margin-top:.2rem;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(p.excerpt)}</div>` : ''}</td>
      <td><code style="background:rgba(255,255,255,.06);padding:.15rem .5rem;border-radius:4px;font-size:.78rem">${escHtml(p.slug)}</code></td>
      <td style="color:var(--text-muted)">${escHtml(p.author || '—')}</td>
      <td>${p.isPublished ? '<span class="status-chip active">Published</span>' : '<span class="status-chip inactive">Draft</span>'}</td>
      <td style="color:var(--text-muted)">${date}</td>
      <td>
        <div class="table-actions">
          <button class="btn-sm btn-view" onclick='editBlogPost(${JSON.stringify(p)})'>Edit</button>
          <button class="btn-sm btn-danger-sm" onclick="deleteBlogPost('${p.id}','${escHtml(p.title)}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function autoSlug() {
  const title = document.getElementById('blog-title')?.value || '';
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const slugEl = document.getElementById('blog-slug');
  if (slugEl && !slugEl.dataset.manualEdit) slugEl.value = slug;
}

let _blogQuillEN = null;
let _blogQuillHI = null;

function showBlogModal(post = null) {
  document.getElementById('blog-edit-id').value = post?.id || '';
  document.getElementById('blog-modal-title').textContent = post ? 'Edit Post' : 'New Blog Post';
  document.getElementById('blog-title').value = post?.title || '';
  const slugEl = document.getElementById('blog-slug');
  slugEl.value = post?.slug || '';
  slugEl.dataset.manualEdit = post ? 'true' : '';
  slugEl.oninput = () => { slugEl.dataset.manualEdit = 'true'; };
  document.getElementById('blog-excerpt').value = post?.excerpt || '';
  document.getElementById('blog-author').value = post?.author || 'HelperNear Team';
  document.getElementById('blog-cover').value = post?.coverImage || '';
  document.getElementById('blog-published').checked = post?.isPublished || false;
  setLangTrFields('blog', ['title', 'excerpt'], post?.translations);
  document.getElementById('blogModal').style.display = 'flex';

  // Init Quill editors after modal is visible
  setTimeout(() => {
    if (!_blogQuillEN) {
      _blogQuillEN = new Quill('#blog-content-quill', { theme: 'snow', placeholder: 'Write your blog post here…', modules: { toolbar: [[{ header: [1,2,3,false] }], ['bold','italic','underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link','image'], ['clean']] } });
    }
    if (!_blogQuillHI) {
      _blogQuillHI = new Quill('#blog-content-hi-quill', { theme: 'snow', placeholder: 'हिंदी में ब्लॉग पोस्ट लिखें…', modules: { toolbar: [[{ header: [1,2,3,false] }], ['bold','italic','underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link'], ['clean']] } });
    }
    _blogQuillEN.root.innerHTML = post?.content || '';
    const hiContent = (typeof post?.translations === 'object' ? post.translations : {})?.hi?.content || '';
    _blogQuillHI.root.innerHTML = hiContent;
  }, 50);

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function editBlogPost(p) { showBlogModal(p); }
function closeBlogModal() {
  document.getElementById('blogModal').style.display = 'none';
}

async function submitBlogPost() {
  const id = document.getElementById('blog-edit-id').value;
  const contentEN = _blogQuillEN ? _blogQuillEN.root.innerHTML.replace(/<p><br><\/p>/g,'').trim() : '';
  const contentHI = _blogQuillHI ? _blogQuillHI.root.innerHTML.replace(/<p><br><\/p>/g,'').trim() : '';
  const trBase = getLangTr('blog', ['title', 'excerpt']);
  if (contentHI && trBase.hi) trBase.hi.content = contentHI;
  else if (contentHI) trBase.hi = { content: contentHI };

  const payload = {
    title:      document.getElementById('blog-title').value.trim(),
    slug:       document.getElementById('blog-slug').value.trim().toLowerCase().replace(/\s+/g,'-'),
    excerpt:    document.getElementById('blog-excerpt').value.trim() || undefined,
    author:     document.getElementById('blog-author').value.trim() || 'HelperNear Team',
    coverImage: document.getElementById('blog-cover').value.trim() || undefined,
    content:    contentEN,
    isPublished: document.getElementById('blog-published').checked,
    translations: trBase,
  };
  if (!payload.title || !payload.slug || !payload.content) { showToast('Title, slug and content are required.', 'error'); return; }
  showLoader();
  const res = id
    ? await apiFetch('/admin/blog/' + id, { method: 'PATCH', body: JSON.stringify(payload) })
    : await apiFetch('/admin/blog',       { method: 'POST',  body: JSON.stringify(payload) });
  hideLoader();
  if (!res) return;
  const data = await res.json();
  if (res.ok) { showToast(id ? 'Post updated!' : 'Post created!', 'success'); closeBlogModal(); loadBlog(); }
  else showToast(data.message || 'Failed.', 'error');
}

async function deleteBlogPost(id, title) {
  const ok = await showConfirm({ title: 'Delete Post?', message: `"${title}" will be permanently deleted.`, confirmText: 'Delete', danger: true });
  if (!ok) return;
  showLoader();
  const res = await apiFetch('/admin/blog/' + id, { method: 'DELETE' });
  hideLoader();
  if (res && res.ok) { showToast('Post deleted.', 'success'); loadBlog(); }
  else showToast('Failed to delete.', 'error');
}

// ══════════════════════════════
// CONTACT SUBMISSIONS
// ══════════════════════════════
let _contactPage = 1;

async function loadContact(page = 1) {
  _contactPage = page;
  const tbody = document.getElementById('contact-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Loading...</td></tr>';
  const res = await apiFetch('/admin/contact?page=' + page + '&limit=20');
  if (!res || !res.ok) return;
  const json = await res.json();
  const { items = [], total = 0, totalPages = 1 } = json.data || {};

  // Update sidebar unread badge
  const unread = items.filter(i => !i.isRead).length;
  const badge = document.getElementById('nav-badge-contact');
  if (badge) { badge.textContent = unread; badge.style.display = unread ? '' : 'none'; }

  renderContactTable(items);
  renderPagination('contact-pagination', page, totalPages, 'loadContact');
}

function renderContactTable(items) {
  const tbody = document.getElementById('contact-tbody');
  if (!tbody) return;
  if (!items.length) { tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No messages yet.</td></tr>'; return; }
  tbody.innerHTML = items.map(c => {
    const date = new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const rowStyle = c.isRead ? '' : 'style="font-weight:600"';
    return `<tr ${rowStyle}>
      <td>${escHtml(c.name)}</td>
      <td style="color:var(--text-muted)">${escHtml(c.email)}</td>
      <td>${escHtml(c.subject)}</td>
      <td style="color:var(--text-muted)">${date}</td>
      <td>${c.isRead ? '<span class="status-chip active">Read</span>' : '<span class="status-chip pending">Unread</span>'}</td>
      <td>
        <div class="table-actions">
          <button class="btn-sm btn-view" onclick='viewContact(${JSON.stringify(c)})'>View</button>
          <button class="btn-sm btn-danger-sm" onclick="deleteContact('${c.id}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function viewContact(c) {
  // Mark as read
  if (!c.isRead) {
    await apiFetch('/admin/contact/' + c.id + '/read', { method: 'PATCH', body: JSON.stringify({ isRead: true }) });
    loadContact(_contactPage);
  }
  const body = document.getElementById('contact-view-body');
  const date = new Date(c.createdAt).toLocaleString('en-IN');
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1rem">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <div><div style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:.25rem">Name</div><div>${escHtml(c.name)}</div></div>
        <div><div style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:.25rem">Email</div><div>${escHtml(c.email)}</div></div>
        ${c.phone ? `<div><div style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:.25rem">Phone</div><div>${escHtml(c.phone)}</div></div>` : ''}
        <div><div style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:.25rem">Date</div><div style="color:var(--text-muted)">${date}</div></div>
      </div>
      <div style="border-top:1px solid var(--border);padding-top:1rem">
        <div style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:.5rem">Subject</div>
        <div style="font-weight:600">${escHtml(c.subject)}</div>
      </div>
      <div>
        <div style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:.5rem">Message</div>
        <div style="background:var(--main-bg);border:1px solid var(--border);border-radius:8px;padding:1rem;line-height:1.7;color:var(--text)">${escHtml(c.message).replace(/\n/g,'<br>')}</div>
      </div>
      <div style="display:flex;gap:.75rem">
        <a href="mailto:${escHtml(c.email)}?subject=Re: ${escHtml(c.subject)}" class="btn-primary" style="text-decoration:none;font-size:.85rem;padding:.55rem 1rem">Reply by Email</a>
        ${c.phone ? `<a href="tel:${escHtml(c.phone)}" class="btn-outline" style="text-decoration:none;font-size:.85rem;padding:.55rem 1rem">Call</a>` : ''}
      </div>
    </div>`;
  document.getElementById('contactViewModal').style.display = 'flex';
}

function closeContactModal() { document.getElementById('contactViewModal').style.display = 'none'; }

async function deleteContact(id) {
  const ok = await showConfirm({ title: 'Delete Message?', message: 'This contact message will be permanently deleted.', confirmText: 'Delete', danger: true });
  if (!ok) return;
  showLoader();
  const res = await apiFetch('/admin/contact/' + id, { method: 'DELETE' });
  hideLoader();
  if (res && res.ok) { showToast('Message deleted.', 'success'); loadContact(_contactPage); }
  else showToast('Failed to delete.', 'error');
}
