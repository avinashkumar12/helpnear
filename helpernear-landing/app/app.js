/* ═══════════════════════════════════════════
   HelperNear Web App – app.js
   ═══════════════════════════════════════════ */

const API = 'https://helpnear-production.up.railway.app/api/v1';

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

// ── State ──
let currentLat = null, currentLng = null;
let allWorkers = [], selectedCategoryId = '', categoriesCache = [];
let regLat = null, regLng = null;
let currentWorkerId = null; // worker profile being viewed
let selectedReviewRating = 0;
let myWorkerProfile = null; // logged-in user's worker profile (null if not a worker)

// ── Helpers ──
function token() { return localStorage.getItem('hn_token'); }
function currentUser() { try { return JSON.parse(localStorage.getItem('hn_user')); } catch { return null; } }
function authHeaders() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() }; }
function showLoader() { document.getElementById('global-loader').classList.remove('hidden'); }
function hideLoader() { document.getElementById('global-loader').classList.add('hidden'); }

let toastTimer = null;
function showToast(msg, type = 'info', duration = 3500) {
  const el = document.getElementById('global-toast');
  el.textContent = msg;
  el.className = 'global-toast ' + (type === 'success' ? 'success' : type === 'error' ? 'error' : '');
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
}

function handle401(res) {
  if (res && res.status === 401) {
    localStorage.removeItem('hn_token');
    localStorage.removeItem('hn_user');
    showPage('login');
    showToast('Session expired. Please log in again.', 'error');
    return true;
  }
  return false;
}

async function apiFetch(path, options = {}) {
  try {
    const t = token();
    const headers = { 'Content-Type': 'application/json', ...(t ? { 'Authorization': 'Bearer ' + t } : {}), ...(options.headers || {}) };
    const res = await fetch(API + path, { ...options, headers });
    if (handle401(res)) return null;
    return res;
  } catch (e) {
    if (e?.name === 'AbortError') throw e; // let caller handle cancellation silently
    showToast('Network error. Check your connection.', 'error');
    return null;
  }
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function getInitials(name) {
  if (!name) return 'U';
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : p[0].slice(0,2).toUpperCase();
}
const AVATAR_COLORS = ['#FF6B35','#7C3AED','#0891B2','#059669','#D97706','#DB2777','#4F46E5','#DC2626'];
function avatarColor(name) {
  let h = 0; for (let i = 0; i < (name||'').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Page routing ──
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => { p.classList.remove('active'); p.classList.add('hidden'); });
  const target = document.getElementById('page-' + name);
  if (target) { target.classList.remove('hidden'); target.classList.add('active'); }
  document.getElementById('nav-dropdown')?.classList.add('hidden');
  window.scrollTo(0, 0);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  if (name === 'home')             { updateFab(); updateHero(); }
  if (name === 'profile')          { loadMyProfile(); }
  if (name === 'register')         { loadRegCategories(); }
  if (name === 'worker-dashboard') { loadWorkerDashboard(); }
}

// ── Toggle dropdown ──
function toggleMenu() { document.getElementById('nav-dropdown')?.classList.toggle('hidden'); }
document.addEventListener('click', e => {
  if (!document.querySelector('.avatar-wrap')?.contains(e.target))
    document.getElementById('nav-dropdown')?.classList.add('hidden');
});

// ══════════════════════════════
// AUTH
// ══════════════════════════════
async function sendOtp() {
  const phone = document.getElementById('inp-phone').value.trim();
  if (!/^\d{10}$/.test(phone)) { showLoginToast('Enter a valid 10-digit phone number.', 'error'); return; }
  showLoader();
  const res = await fetch(API + '/auth/send-otp', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  }).catch(() => null);
  hideLoader();
  if (!res) return;
  const data = await res.json();
  if (res.ok) {
    document.getElementById('phone-display').textContent = '+91 ' + phone;
    document.getElementById('step-phone').classList.add('hidden');
    document.getElementById('step-otp').classList.remove('hidden');
    document.querySelectorAll('.otp-box').forEach(b => b.value = '');
    setupOtpBoxes();
    if (data.devOtp) {
      const boxes = document.querySelectorAll('.otp-box');
      [...data.devOtp].forEach((ch, i) => { if (boxes[i]) boxes[i].value = ch; });
      showLoginToast('Dev OTP auto-filled: ' + data.devOtp, 'success');
    } else {
      document.querySelectorAll('.otp-box')[0].focus();
      showLoginToast(data.message || 'OTP sent!', 'success');
    }
  } else { showLoginToast(data.message || 'Failed to send OTP.', 'error'); }
}

function setupOtpBoxes() {
  const boxes = document.querySelectorAll('.otp-box');
  boxes.forEach((box, i) => {
    box.oninput = () => { box.value = box.value.replace(/\D/g,''); if (box.value && i < boxes.length - 1) boxes[i+1].focus(); };
    box.onkeydown = e => { if (e.key === 'Backspace' && !box.value && i > 0) boxes[i-1].focus(); };
    box.onpaste = e => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,'');
      [...text.slice(0,4)].forEach((ch, j) => { if (boxes[j]) boxes[j].value = ch; });
      boxes[Math.min(text.length, 3)]?.focus();
    };
  });
}

async function verifyOtp() {
  const phone = document.getElementById('inp-phone').value.trim();
  const otp = [...document.querySelectorAll('.otp-box')].map(b => b.value).join('');
  if (otp.length !== 4) { showLoginToast('Enter the complete 4-digit OTP.', 'error'); return; }
  showLoader();
  const res = await fetch(API + '/auth/verify-otp', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp })
  }).catch(() => null);
  hideLoader();
  if (!res) { showLoginToast('Network error.', 'error'); return; }
  const data = await res.json();
  const t = data.data?.accessToken;
  const user = data.data?.user;
  if (res.ok && t) {
    localStorage.setItem('hn_token', t);
    localStorage.setItem('hn_user', JSON.stringify(user || {}));
    await afterLogin();
  } else { showLoginToast(data.message || 'Invalid OTP.', 'error'); }
}

async function afterLogin() {
  updateNavAvatar();
  await checkWorkerStatus(); // sets myWorkerProfile + updates nav dropdown
  showPage('home');
  loadCategories();
  silentGpsLocation();
  loadAppBanners();
}

async function loadAppBanners() {
  try {
    const res = await fetch(`${API}/public/banners`);
    if (!res.ok) return;
    const { data } = await res.json();
    const slides = (data || []).filter(b => b.isActive !== false);
    if (!slides.length) return;

    const wrap   = document.getElementById('app-banners');
    const track  = document.getElementById('app-banner-track');
    const dotsEl = document.getElementById('app-banner-dots');
    const prev   = document.getElementById('app-banner-prev');
    const next   = document.getElementById('app-banner-next');
    if (!wrap || !track) return;

    track.innerHTML = '';
    dotsEl.innerHTML = '';
    let current = 0, timer;

    const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    function goTo(idx) {
      current = (idx + slides.length) % slides.length;
      track.style.transform = `translateX(-${current * 100}%)`;
      dotsEl.querySelectorAll('.banner-dot').forEach((d, i) => d.classList.toggle('active', i === current));
    }
    function startAuto() {
      clearInterval(timer);
      timer = setInterval(() => goTo(current + 1), 4500);
    }

    slides.forEach((b, i) => {
      const a = document.createElement('a');
      a.className = 'banner-slide' + (b.imageUrl ? '' : ' banner-slide-no-img');
      a.href = b.linkUrl || '#';
      if (!b.linkUrl) a.onclick = e => e.preventDefault();
      if (b.imageUrl) a.innerHTML = `<img src="${esc(b.imageUrl)}" alt="${esc(b.title)}" loading="lazy"/><div class="banner-slide-overlay"></div>`;
      a.innerHTML += `<div class="banner-slide-text"><h3>${esc(b.title)}</h3>${b.subtitle ? `<p>${esc(b.subtitle)}</p>` : ''}</div>`;
      track.appendChild(a);

      const dot = document.createElement('button');
      dot.className = 'banner-dot' + (i === 0 ? ' active' : '');
      dot.onclick = () => { goTo(i); startAuto(); };
      dotsEl.appendChild(dot);
    });

    if (slides.length > 1) {
      prev.onclick = () => { goTo(current - 1); startAuto(); };
      next.onclick = () => { goTo(current + 1); startAuto(); };
      startAuto();
    } else {
      prev.style.display = 'none';
      next.style.display = 'none';
    }

    wrap.style.display = '';
  } catch (_) {}
}

function showLoginToast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'toast ' + (type || '');
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3500);
}

function goBack() {
  document.getElementById('step-otp').classList.add('hidden');
  document.getElementById('step-phone').classList.remove('hidden');
}

function logout() {
  localStorage.removeItem('hn_token'); localStorage.removeItem('hn_user');
  allWorkers = []; currentLat = null; currentLng = null; selectedCategoryId = '';
  myWorkerProfile = null;
  showPage('login');
}

// ══════════════════════════════
// USER
// ══════════════════════════════
async function getMe() {
  const res = await apiFetch('/users/me');
  if (!res || !res.ok) return null;
  const data = await res.json();
  const u = data.data || data.user || data;
  if (u?.id) localStorage.setItem('hn_user', JSON.stringify({ ...(currentUser()||{}), ...u }));
  return u;
}

function updateNavAvatar() {
  const user = currentUser();
  const el = document.getElementById('nav-avatar');
  if (el && user) el.textContent = getInitials(user.name || user.phone || 'U');
}

async function checkWorkerStatus() {
  try {
    const res = await apiFetch('/workers/my-profile');
    if (res && res.ok) {
      const data = await res.json();
      myWorkerProfile = data.data || data.worker || data;
    } else {
      myWorkerProfile = null;
    }
  } catch { myWorkerProfile = null; }
  updateNavDropdown();
}

function updateNavDropdown() {
  const ddDash = document.getElementById('dd-worker-dashboard');
  const ddBecome = document.getElementById('dd-become-worker');
  if (myWorkerProfile) {
    ddDash?.classList.remove('hidden');
    ddBecome?.classList.add('hidden');
  } else {
    ddDash?.classList.add('hidden');
    ddBecome?.classList.remove('hidden');
  }
}

async function loadMyProfile() {
  showLoader();
  const user = await getMe();
  hideLoader();
  if (!user) return;
  document.getElementById('my-avatar').textContent = getInitials(user.name || user.phone || 'U');
  document.getElementById('my-name').textContent = user.name || '—';
  document.getElementById('my-phone').textContent = '+91 ' + (user.phone || '');
  document.getElementById('my-role').textContent = user.role || 'CUSTOMER';
  document.getElementById('inp-name').value = user.name || '';
}

async function updateProfile() {
  const name = document.getElementById('inp-name').value.trim();
  if (!name) { showToast('Please enter your name.', 'error'); return; }
  showLoader();
  const res = await apiFetch('/users/profile', { method: 'PATCH', body: JSON.stringify({ name }) });
  hideLoader();
  if (!res) return;
  const data = await res.json();
  if (res.ok) {
    const user = currentUser() || {};
    user.name = name;
    localStorage.setItem('hn_user', JSON.stringify(user));
    updateNavAvatar();
    showToast('Profile updated!', 'success');
  } else { showToast(data.message || 'Update failed.', 'error'); }
}

async function updateHero() {
  const user = currentUser();
  const greet = document.getElementById('hero-greeting');
  if (greet && user?.name) {
    const h = new Date().getHours();
    greet.textContent = (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + ', ' + user.name.split(' ')[0];
  }
  try {
    const res = await fetch(API + '/public/stats');
    if (res && res.ok) {
      const json = await res.json();
      const s = json.data || {};
      const wEl = document.getElementById('hstat-workers'); const cEl = document.getElementById('hstat-cats');
      if (wEl) wEl.textContent = s.verifiedWorkers ?? '—';
      if (cEl) cEl.textContent = s.totalCategories ?? '—';
      // Also update login trust badges
      if (s.verifiedWorkers) { const el = document.getElementById('lt-workers'); if (el) el.textContent = s.verifiedWorkers + '+'; }
      if (s.totalUsers)      { const el = document.getElementById('lt-users');   if (el) el.textContent = s.totalUsers > 1000 ? (s.totalUsers/1000).toFixed(0)+'K+' : s.totalUsers + '+'; }
    }
  } catch {}
}

async function updateFab() {
  const fab = document.getElementById('fab-register');
  if (!fab) return;
  if (myWorkerProfile) { fab.classList.add('hidden'); return; }
  fab.classList.remove('hidden');
}

// ══════════════════════════════
// CATEGORIES
// ══════════════════════════════
async function getCategories() {
  const res = await fetch(API + '/categories').catch(() => null);
  if (!res || !res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : (data.categories || []));
}

async function loadCategories() {
  const cats = await getCategories();
  categoriesCache = cats;
  renderCategoryChips(cats);
}

function renderCategoryChips(cats) {
  const container = document.getElementById('cat-chips');
  container.innerHTML = '<button class="chip active" data-cat="">All</button>';
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.dataset.catId = cat.id || '';
    btn.textContent = (cat.icon ? cat.icon + ' ' : '') + (cat.name || '');
    btn.onclick = () => {
      document.querySelectorAll('#cat-chips .chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      selectedCategoryId = btn.dataset.catId;
      searchWorkers();
    };
    container.appendChild(btn);
  });
  container.querySelector('[data-cat=""]').onclick = () => {
    document.querySelectorAll('#cat-chips .chip').forEach(c => c.classList.remove('active'));
    container.querySelector('[data-cat=""]').classList.add('active');
    selectedCategoryId = '';
    searchWorkers();
  };
}

// ══════════════════════════════
// GEOLOCATION & LOCATION MODAL
// ══════════════════════════════
let _locSearchTimer = null;

function openLocationModal() {
  const overlay = document.getElementById('location-modal-overlay');
  overlay.classList.remove('hidden');
  // Show current location in the modal header row
  const label = document.getElementById('loc-current-label');
  const locText = document.getElementById('loc-text').textContent;
  label.textContent = (currentLat && currentLng)
    ? locText + ' (' + currentLat.toFixed(3) + ', ' + currentLng.toFixed(3) + ')'
    : 'No location set yet';
  // Clear previous results and search input
  document.getElementById('loc-search-input').value = '';
  document.getElementById('loc-results').innerHTML = '';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeLocationModal() {
  document.getElementById('location-modal-overlay').classList.add('hidden');
}

function setLocationDisplay(name) {
  document.getElementById('loc-text').textContent = name;
  const icon = document.getElementById('loc-icon');
  if (icon) { icon.innerHTML = '<i data-lucide="map-pin"></i>'; if (typeof lucide !== 'undefined') lucide.createIcons(); }
}

function useGpsLocation() {
  const btn = document.getElementById('loc-gps-btn');
  btn.disabled = true;
  btn.querySelector('strong').textContent = 'Detecting…';
  if (!navigator.geolocation) {
    showToast('Geolocation not supported by your browser.', 'error');
    btn.disabled = false; btn.querySelector('strong').textContent = 'Use my current location';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async pos => {
      currentLat = pos.coords.latitude;
      currentLng = pos.coords.longitude;
      btn.disabled = false;
      btn.querySelector('strong').textContent = 'Use my current location';
      // Reverse-geocode to get a human-readable name
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${currentLat}&lon=${currentLng}&format=json`, {
          headers: { 'Accept-Language': 'en' }
        });
        const data = await res.json();
        const addr = data.address || {};
        const name = addr.suburb || addr.neighbourhood || addr.city_district || addr.city || addr.town || addr.village || 'Current Location';
        setLocationDisplay(name);
      } catch {
        setLocationDisplay('Current Location');
      }
      closeLocationModal();
      searchWorkers();
    },
    () => {
      showToast('Could not get location. Please allow location access.', 'error');
      btn.disabled = false;
      btn.querySelector('strong').textContent = 'Use my current location';
    },
    { timeout: 10000 }
  );
}

function debounceLocationSearch() {
  clearTimeout(_locSearchTimer);
  const q = document.getElementById('loc-search-input').value.trim();
  if (!q) { document.getElementById('loc-results').innerHTML = ''; return; }
  _locSearchTimer = setTimeout(searchLocation, 500);
}

async function searchLocation() {
  const q = document.getElementById('loc-search-input').value.trim();
  if (!q) return;
  const resultsEl = document.getElementById('loc-results');
  const searchBtn = document.querySelector('.loc-search-btn');
  resultsEl.innerHTML = '<div class="loc-results-loading"><div class="loc-spinner"></div><span>Searching…</span></div>';
  if (searchBtn) searchBtn.disabled = true;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6&countrycodes=in`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const places = await res.json();
    if (!places.length) {
      resultsEl.innerHTML = '<div class="loc-results-empty">No places found. Try a different search.</div>';
      return;
    }
    resultsEl.innerHTML = places.map((p, i) => {
      const addr = p.address || {};
      const primary = addr.suburb || addr.neighbourhood || addr.city_district || addr.road || addr.amenity || p.display_name.split(',')[0];
      const secondary = [addr.city || addr.town || addr.village, addr.state].filter(Boolean).join(', ');
      return `<div class="loc-result-item" onclick="selectLocation(${p.lat}, ${p.lon}, '${escJs(primary)}')">
        <div class="loc-result-icon"><i data-lucide="map-pin"></i></div>
        <div>
          <div class="loc-result-name">${escHtml(primary)}</div>
          ${secondary ? `<div class="loc-result-addr">${escHtml(secondary)}</div>` : ''}
        </div>
      </div>`;
    }).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch {
    resultsEl.innerHTML = '<div class="loc-results-empty">Search failed. Please check your connection.</div>';
  } finally {
    if (searchBtn) searchBtn.disabled = false;
  }
}

function selectLocation(lat, lng, name) {
  currentLat = parseFloat(lat);
  currentLng = parseFloat(lng);
  setLocationDisplay(name);
  closeLocationModal();
  searchWorkers();
}

function escJs(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Silent background GPS attempt on page load — never opens a modal or shows errors
function silentGpsLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    async pos => {
      currentLat = pos.coords.latitude;
      currentLng = pos.coords.longitude;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${currentLat}&lon=${currentLng}&format=json`, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        const addr = data.address || {};
        const name = addr.suburb || addr.neighbourhood || addr.city_district || addr.city || addr.town || addr.village || 'Nearby';
        setLocationDisplay(name);
      } catch { setLocationDisplay('Nearby'); }
      searchWorkers();
    },
    () => { /* permission denied — user must click the button to set location */ },
    { timeout: 8000 }
  );
}

// Manual button / inline onclick="getLocation()" — opens the modal
function getLocation() { openLocationModal(); }

function getRegLocation() {
  if (!navigator.geolocation) { showToast('Geolocation not supported.', 'error'); return; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      regLat = pos.coords.latitude; regLng = pos.coords.longitude;
      document.getElementById('reg-loc-text').textContent = 'Location captured (' + regLat.toFixed(4) + ', ' + regLng.toFixed(4) + ')';
    },
    () => showToast('Could not get location.', 'error'), { timeout: 10000 }
  );
}

// ══════════════════════════════
// SEARCH WORKERS
// ══════════════════════════════
let _searchAbort = null;

async function searchWorkers() {
  if (currentLat === null || currentLng === null) return;

  // Cancel any in-flight request
  if (_searchAbort) { _searchAbort.abort(); }
  _searchAbort = new AbortController();

  const grid = document.getElementById('workers-grid');
  if (grid) grid.style.opacity = '0.45';
  showLoader();

  const radius = document.getElementById('radius-sel').value;
  let url = '/workers/nearby?lat=' + currentLat + '&lng=' + currentLng + '&radius=' + radius;
  if (selectedCategoryId) url += '&categoryId=' + selectedCategoryId;

  try {
    const res = await apiFetch(url, { signal: _searchAbort.signal });
    if (!res || !res.ok) return;
    const data = await res.json();
    allWorkers = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : (data.workers || []));
    renderWorkers();
  } catch (e) {
    if (e?.name === 'AbortError') return; // newer request superseded this one
  } finally {
    if (grid) grid.style.opacity = '1';
    hideLoader();
  }
}

function showSkeletons(grid, count) {
  const n = count || 4;
  grid.innerHTML = Array.from({ length: n }, () => `
    <div class="worker-card skeleton-card">
      <div class="wc-top">
        <div class="skeleton skeleton-avatar"></div>
        <div class="wc-info" style="flex:1">
          <div class="skeleton skeleton-line" style="width:60%;height:16px;margin-bottom:8px"></div>
          <div class="skeleton skeleton-line" style="width:40%;height:12px"></div>
        </div>
        <div class="skeleton skeleton-badge"></div>
      </div>
      <div class="skeleton skeleton-line" style="width:80%;height:12px;margin:10px 0 6px"></div>
      <div class="skeleton skeleton-line" style="width:55%;height:12px"></div>
      <div class="wc-actions" style="margin-top:14px;gap:8px;display:flex">
        <div class="skeleton skeleton-btn" style="flex:1"></div>
        <div class="skeleton skeleton-btn" style="flex:1"></div>
      </div>
    </div>`).join('');
}

// ── Map view ─────────────────────────────────────────────
let _map = null;
let _currentView = 'list';

function switchView(view) {
  _currentView = view;
  const grid = document.getElementById('workers-grid');
  const mapEl = document.getElementById('workers-map');
  const btnList = document.getElementById('btn-list-view');
  const btnMap = document.getElementById('btn-map-view');

  if (view === 'map') {
    grid.classList.add('hidden');
    mapEl.classList.remove('hidden');
    btnList.classList.remove('active');
    btnMap.classList.add('active');
    initMap();
  } else {
    grid.classList.remove('hidden');
    mapEl.classList.add('hidden');
    btnList.classList.add('active');
    btnMap.classList.remove('active');
  }
}

function initMap() {
  if (!window.L) return;
  const lat = currentLat || 20.5937;
  const lng = currentLng || 78.9629;

  if (!_map) {
    _map = L.map('workers-map').setView([lat, lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(_map);
  } else {
    _map.setView([lat, lng], 13);
  }

  // clear existing markers
  _map.eachLayer(layer => { if (layer instanceof L.Marker) _map.removeLayer(layer); });

  // user location marker
  if (currentLat && currentLng) {
    L.circleMarker([currentLat, currentLng], {
      radius: 8, fillColor: '#FF6B35', color: '#fff',
      weight: 2, opacity: 1, fillOpacity: 1,
    }).addTo(_map).bindPopup('<strong>Your Location</strong>');
  }

  // worker markers
  const query = (document.getElementById('search-input')?.value || '').toLowerCase();
  const filtered = query
    ? allWorkers.filter(w => {
        const name = (w.user?.name || '').toLowerCase();
        const cats = (w.categories || []).map(c => (c.category?.name || c.name || '').toLowerCase()).join(' ');
        return name.includes(query) || cats.includes(query);
      })
    : allWorkers;

  filtered.forEach(w => {
    if (!w.latitude || !w.longitude) return;
    const name = w.user?.name || 'Worker';
    const cats = (w.categories || []).map(c => c.category?.name || c.name || '').filter(Boolean).join(', ');
    const dist = w.distance ? `${Number(w.distance).toFixed(1)} km away` : '';
    const rating = w.averageRating ? `⭐ ${Number(w.averageRating).toFixed(1)}` : '';
    const statusColor = w.status === 'AVAILABLE' ? '#22c55e' : w.status === 'BUSY' ? '#f59e0b' : '#6b7280';

    const icon = L.divIcon({
      className: '',
      html: `<div style="width:36px;height:36px;border-radius:50%;background:${statusColor};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:.7rem;">${getInitials(name)}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    L.marker([w.latitude, w.longitude], { icon })
      .addTo(_map)
      .bindPopup(`
        <div class="map-popup">
          <strong>${escHtml(name)}</strong>
          <small>${escHtml(cats)}</small><br/>
          <small>${dist} ${rating}</small>
          <button class="mp-btn" onclick="openWorkerProfile('${w.id}')">View Profile</button>
        </div>
      `);
  });

  setTimeout(() => _map.invalidateSize(), 100);
}

function renderWorkers() {
  if (_currentView === 'map') { initMap(); return; }

  const query    = (document.getElementById('search-input')?.value || '').toLowerCase();
  const avOnly   = document.getElementById('filter-available')?.checked;
  const minRat   = parseFloat(document.getElementById('filter-rating')?.value || '0');
  const sortBy   = document.getElementById('filter-sort')?.value || 'distance';

  let filtered = allWorkers.filter(w => {
    if (avOnly && w.status !== 'AVAILABLE') return false;
    if (minRat > 0 && (w.averageRating == null || Number(w.averageRating) < minRat)) return false;
    if (query) {
      const name = (w.user?.name || '').toLowerCase();
      const cats = (w.categories || []).map(c => (c.category?.name || c.name || '').toLowerCase()).join(' ');
      if (!name.includes(query) && !cats.includes(query)) return false;
    }
    return true;
  });

  // Sorting
  if (sortBy === 'rating') {
    filtered = filtered.slice().sort((a, b) => (Number(b.averageRating) || 0) - (Number(a.averageRating) || 0));
  } else if (sortBy === 'reviews') {
    filtered = filtered.slice().sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
  }
  // 'distance' keeps the API order (already sorted by proximity)

  const grid = document.getElementById('workers-grid');
  document.getElementById('results-count').textContent = filtered.length + ' ' + t('home.found');
  document.getElementById('results-title').textContent = selectedCategoryId
    ? (categoriesCache.find(c => c.id === selectedCategoryId)?.name || 'Workers') + ' Nearby'
    : t('home.nearby');

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="search-x"></i></div><h3>${t('home.no_workers')}</h3><p>${t('home.no_workers_sub')}</p></div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }
  grid.innerHTML = '';
  filtered.forEach(w => grid.appendChild(buildWorkerCard(w)));
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function buildWorkerCard(w) {
  const name = w.user?.name || 'Worker';
  const phone = w.user?.phone || '';
  const cats = (w.categories || []).map(c => c.category?.name || c.name || '').filter(Boolean).join(' · ');
  const dist = w.distance != null ? (w.distance < 1 ? (w.distance*1000).toFixed(0)+' m' : w.distance.toFixed(1)+' km') : null;
  const avgRating = w.averageRating ? Number(w.averageRating).toFixed(1) : null;
  const reviewCount = w.reviewCount || 0;
  const status = w.status || 'OFFLINE';
  const color = avatarColor(name);
  const card = document.createElement('div');
  card.className = 'worker-card';
  const statusLabel = { AVAILABLE: t('worker.available'), BUSY: t('worker.busy'), OFFLINE: t('worker.offline_status') }[status] || status;
  card.innerHTML = `
    <div class="card-header">
      <div class="card-avatar" style="background:${color}">${getInitials(name)}<span class="status-dot ${status}" title="${statusLabel}"></span></div>
      <div class="card-info">
        <div class="card-name-row">
          <span class="card-name">${escHtml(name)}</span>
          ${w.isVerified ? `<span class="verified-badge"><i data-lucide="shield-check"></i> ${t('worker.verified')}</span>` : ''}
        </div>
        <div class="card-cats">${escHtml(cats) || t('worker.general')}</div>
      </div>
    </div>
    <div class="card-divider"></div>
    <div class="card-meta">
      ${dist ? `<span class="card-dist"><i data-lucide="map-pin"></i> ${dist}</span>` : ''}
      ${avgRating ? `<span class="card-rating">★ ${avgRating}</span>${reviewCount ? `<span class="card-reviews">(${reviewCount})</span>` : ''}` : `<span class="card-rating no-rating">${t('worker.no_reviews')}</span>`}
      ${w.priceRange ? `<span class="card-price">${escHtml(w.priceRange)}</span>` : ''}
    </div>
    <div class="card-actions">
      <a href="tel:${phone}" class="card-call" onclick="event.stopPropagation();logContactAttempt('${w.id||w._id}','call')"><i data-lucide="phone"></i> ${t('worker.call')}</a>
      <a href="https://wa.me/${phone.replace(/\D/g,'')}" class="card-wa" target="_blank" onclick="event.stopPropagation();logContactAttempt('${w.id||w._id}','whatsapp')"><i data-lucide="message-circle"></i> ${t('worker.whatsapp')}</a>
      <button class="card-view" onclick="event.stopPropagation();openWorkerProfile('${w.id||w._id}')">${t('worker.view_profile')}</button>
    </div>`;
  return card;
}

// ══════════════════════════════
// WORKER PROFILE VIEW
// ══════════════════════════════
function logContactAttempt(workerId, channel) {
  // fire-and-forget — don't block the call/whatsapp navigation
  apiFetch(`/workers/${workerId}/contact`, { method: 'POST', body: JSON.stringify({ channel }) }).catch(() => {});
}

async function openWorkerProfile(id) {
  showLoader();
  const res = await apiFetch('/workers/' + id);
  hideLoader();
  if (!res || !res.ok) { showToast('Could not load profile.', 'error'); return; }
  const data = await res.json();
  const w = data.data || data.worker || data;
  currentWorkerId = w.id || w._id;

  const name = w.user?.name || 'Worker';
  const phone = w.user?.phone || '';
  const cats = (w.categories||[]).map(c => c.category?.name||c.name||'').filter(Boolean);
  const status = w.status || 'OFFLINE';
  const avgRating = w.averageRating ? Number(w.averageRating).toFixed(1) : null;
  const reviews = w.reviews || [];
  const color = avatarColor(name);

  const avatarEl = document.getElementById('wp-avatar');
  avatarEl.textContent = getInitials(name);
  avatarEl.style.background = `linear-gradient(135deg, ${color}, ${color}aa)`;

  document.getElementById('wp-name').textContent = name;
  document.getElementById('wp-verified-badge').classList.toggle('hidden', !w.isVerified);
  document.getElementById('wp-cats').innerHTML = cats.length ? cats.map(c=>`<span>${escHtml(c)}</span>`).join('') : '<span>General Worker</span>';

  const statusEl = document.getElementById('wp-status-badge');
  statusEl.textContent = status; statusEl.className = 'status-badge ' + status;

  const distEl = document.getElementById('wp-dist');
  if (w.distance != null) { distEl.textContent = w.distance < 1 ? (w.distance*1000).toFixed(0)+' m away' : w.distance.toFixed(1)+' km away'; distEl.style.display = ''; }
  else distEl.style.display = 'none';

  document.getElementById('wp-rating').textContent = avgRating ? '★ ' + avgRating : '★ No ratings';
  document.getElementById('wp-exp').textContent = w.experienceYears != null ? w.experienceYears + ' yrs' : '—';
  document.getElementById('wp-price').textContent = w.priceRange || '—';
  document.getElementById('wp-avg-rating').textContent = avgRating ? avgRating + ' ★' : '—';
  document.getElementById('wp-reviews-count').textContent = w.reviewCount || reviews.length || 0;
  document.getElementById('wp-bio').textContent = w.bio || 'No bio provided.';
  document.getElementById('wp-call').href = phone ? 'tel:+91' + phone : '#';
  document.getElementById('wp-call').onclick = () => logContactAttempt(w.id || w._id, 'call');
  document.getElementById('wp-wa').href = phone ? 'https://wa.me/91' + phone.replace(/\D/g,'') : '#';
  document.getElementById('wp-wa').onclick = () => logContactAttempt(w.id || w._id, 'whatsapp');

  // Point 7: hide contact buttons when worker is OFFLINE
  const contactBtns = document.getElementById('wp-contact-btns');
  const offlineNotice = document.getElementById('wp-offline-notice');
  if (status === 'OFFLINE') {
    if (contactBtns) contactBtns.style.display = 'none';
    if (offlineNotice) offlineNotice.style.display = '';
  } else {
    if (contactBtns) contactBtns.style.display = '';
    if (offlineNotice) offlineNotice.style.display = 'none';
  }

  // Show/hide review form (only for logged-in non-workers who haven't reviewed yet)
  const reviewCard = document.getElementById('review-form-card');
  const isOwnProfile = myWorkerProfile && (myWorkerProfile.id === currentWorkerId || myWorkerProfile._id === currentWorkerId);
  if (token() && !isOwnProfile) {
    if (w.hasReviewed) {
      reviewCard.style.display = '';
      reviewCard.innerHTML = '<div class="already-reviewed"><i data-lucide="check-circle"></i> You have already reviewed this worker.</div>';
      lucide.createIcons();
    } else {
      reviewCard.style.display = '';
      resetReviewForm();
    }
  } else {
    reviewCard.style.display = 'none';
    resetReviewForm();
  }

  renderReviews(reviews);
  showPage('worker');
}

function renderReviews(reviews) {
  const el = document.getElementById('wp-reviews-list');
  if (!reviews.length) { el.innerHTML = '<p class="no-reviews">No reviews yet. Be the first to review!</p>'; return; }
  el.innerHTML = reviews.map(r => {
    const filled = Math.round(r.rating || 0);
    const stars = '★'.repeat(filled) + '☆'.repeat(5 - filled);
    const reviewer = r.user?.name || 'Anonymous';
    const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'}) : '';
    return `<div class="review-item">
      <div class="review-header">
        <div class="review-author-row">
          <div class="review-avatar">${getInitials(reviewer)}</div>
          <div><span class="review-author">${escHtml(reviewer)}</span><span class="review-date">${date}</span></div>
        </div>
        <span class="review-stars">${stars}</span>
      </div>
      ${r.comment ? `<p class="review-text">${escHtml(r.comment)}</p>` : ''}
    </div>`;
  }).join('');
}

// ── Star picker ──
// ══════════════════════════════
// COMPLAINT / REPORT WORKER
// ══════════════════════════════
function openComplaintModal() {
  // Reset state
  document.querySelectorAll('input[name="complaint-reason"]').forEach(r => r.checked = false);
  const details = document.getElementById('complaint-details');
  if (details) details.value = '';
  const errEl = document.getElementById('complaint-error');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  // Restore form if previously showing success
  const modal = document.querySelector('.complaint-modal');
  const existing = modal?.querySelector('.complaint-success');
  if (existing) existing.remove();
  modal?.querySelectorAll('.complaint-reasons, .form-group, .complaint-modal-sub, [id="complaint-submit-btn"]').forEach(el => el.style.display = '');
  const submitRow = document.querySelector('.complaint-modal > div:last-child');
  if (submitRow) submitRow.style.display = '';

  document.getElementById('complaint-modal-overlay').classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeComplaintModal() {
  document.getElementById('complaint-modal-overlay').classList.add('hidden');
}

async function submitComplaint() {
  const reasonEl = document.querySelector('input[name="complaint-reason"]:checked');
  const errEl = document.getElementById('complaint-error');
  errEl.style.display = 'none';

  if (!reasonEl) {
    errEl.textContent = 'Please select a reason.';
    errEl.style.display = '';
    return;
  }

  const details = document.getElementById('complaint-details').value.trim();
  const reason = reasonEl.value + (details ? ': ' + details : '');

  if (!currentWorkerId) { showToast('Could not identify worker.', 'error'); return; }

  const btn = document.getElementById('complaint-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-2" style="animation:spin .7s linear infinite"></i> Submitting…';
  if (typeof lucide !== 'undefined') lucide.createIcons();

  const res = await apiFetch('/users/complaints', {
    method: 'POST',
    body: JSON.stringify({ workerId: currentWorkerId, reason }),
  });

  btn.disabled = false;

  if (!res) return;
  const data = await res.json();

  if (res.ok) {
    // Show success state inside the modal
    const modal = document.querySelector('.complaint-modal');
    modal.querySelectorAll('.complaint-reasons, textarea, .complaint-modal-sub').forEach(el => el.style.display = 'none');
    document.querySelector('.complaint-modal > div:last-child').style.display = 'none'; // hide button row
    errEl.style.display = 'none';
    const successEl = document.createElement('div');
    successEl.className = 'complaint-success';
    successEl.innerHTML = `
      <div class="complaint-success-icon"><i data-lucide="check"></i></div>
      <h4>Report Submitted</h4>
      <p>${escHtml(data.message || 'Our team will review this within 24 hours.')}</p>
      <button class="btn-primary" style="margin-top:.5rem" onclick="closeComplaintModal()">Done</button>`;
    modal.appendChild(successEl);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } else {
    errEl.textContent = data.message || 'Failed to submit. Please try again.';
    errEl.style.display = '';
    btn.innerHTML = '<i data-lucide="send"></i> Submit Report';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function resetReviewForm() {
  selectedReviewRating = 0;
  document.querySelectorAll('.star-btn').forEach(s => s.classList.remove('active'));
  const ta = document.getElementById('review-comment');
  if (ta) ta.value = '';
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.star-btn').forEach(btn => {
    const val = parseInt(btn.dataset.val);
    btn.onmouseover = () => highlightStars(val);
    btn.onmouseout  = () => highlightStars(selectedReviewRating);
    btn.onclick     = () => { selectedReviewRating = val; highlightStars(val); };
  });
});

function highlightStars(val) {
  document.querySelectorAll('.star-btn').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.val) <= val);
  });
}

async function submitReview() {
  if (!currentWorkerId) return;
  if (!selectedReviewRating) { showToast('Please select a star rating.', 'error'); return; }
  const comment = document.getElementById('review-comment').value.trim();
  showLoader();
  const res = await apiFetch('/reviews', {
    method: 'POST',
    body: JSON.stringify({ workerId: currentWorkerId, rating: selectedReviewRating, comment: comment || undefined })
  });
  hideLoader();
  if (!res) return;
  const data = await res.json();
  if (res.ok) {
    showToast('Review submitted! Thank you.', 'success');
    resetReviewForm();
    document.getElementById('review-form-card').style.display = 'none';
    // Reload reviews
    const res2 = await apiFetch('/workers/' + currentWorkerId + '/reviews');
    if (res2 && res2.ok) {
      const d = await res2.json();
      renderReviews(d.data || []);
    }
  } else { showToast(data.message || 'Could not submit review.', 'error'); }
}

// ══════════════════════════════
// WORKER REGISTRATION
// ══════════════════════════════
async function loadRegCategories() {
  const container = document.getElementById('reg-categories');
  container.innerHTML = '<div class="loading-text">Loading categories...</div>';
  if (!categoriesCache.length) categoriesCache = await getCategories();
  if (!categoriesCache.length) { container.innerHTML = '<div class="loading-text">No categories found.</div>'; return; }
  container.innerHTML = '';
  categoriesCache.forEach(cat => {
    const id = cat.id || '';
    const label = document.createElement('label');
    label.className = 'cat-checkbox-item';
    label.innerHTML = `<input type="checkbox" value="${id}"> ${cat.icon ? cat.icon + ' ' : ''}${escHtml(cat.name)}`;
    label.querySelector('input').addEventListener('change', e => label.classList.toggle('checked', e.target.checked));
    container.appendChild(label);
  });
}

async function submitWorkerRegistration() {
  const bio = document.getElementById('reg-bio').value.trim();
  const expVal = document.getElementById('reg-exp').value;
  const priceRange = document.getElementById('reg-price').value.trim();
  const selectedCats = [...document.querySelectorAll('#reg-categories input[type=checkbox]:checked')].map(cb => cb.value);
  if (!bio)              { showToast('Please add a bio.', 'error'); return; }
  if (!selectedCats.length) { showToast('Select at least one category.', 'error'); return; }
  if (regLat === null)   { showToast('Please capture your location first.', 'error'); return; }

  showLoader();
  const res = await apiFetch('/workers/profile', {
    method: 'POST',
    body: JSON.stringify({ bio, experienceYears: expVal ? parseInt(expVal) : 0, priceRange: priceRange||undefined, categoryIds: selectedCats, latitude: regLat, longitude: regLng })
  });
  hideLoader();
  if (!res) return;
  const data = await res.json();
  if (res.ok) {
    myWorkerProfile = data.data || data.worker || data;
    updateNavDropdown();
    showToast('Worker profile created! Pending admin verification.', 'success');
    showPage('home');
    updateFab();
  } else { showToast(data.message || 'Registration failed.', 'error'); }
}

// ══════════════════════════════
// WORKER DASHBOARD
// ══════════════════════════════
async function loadWorkerDashboard() {
  showLoader();
  const res = await apiFetch('/workers/my-profile');
  hideLoader();
  if (!res || !res.ok) { showToast('Could not load worker profile.', 'error'); showPage('home'); return; }
  const data = await res.json();
  const w = data.data || data.worker || data;
  myWorkerProfile = w;

  const name = (currentUser()?.name) || 'Worker';
  const cats = (w.categories||[]).map(c => c.category?.name||c.name||'').filter(Boolean).join(' · ');

  document.getElementById('wd-avatar').textContent = getInitials(name);
  document.getElementById('wd-avatar').style.background = `linear-gradient(135deg, ${avatarColor(name)}, ${avatarColor(name)}aa)`;

  // Show existing photo in upload preview
  const photoPreview = document.getElementById('wd-photo-preview');
  if (photoPreview && w.photoUrl) {
    photoPreview.outerHTML = `<img id="wd-photo-preview" src="${escHtml(w.photoUrl)}" class="wd-photo-preview" alt="Profile photo" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid var(--primary)"/>`;
  }
  document.getElementById('wd-name').textContent = name;
  document.getElementById('wd-cats').textContent = cats || 'No categories set';

  document.getElementById('wd-verified-chip').classList.toggle('hidden', !w.isVerified);
  document.getElementById('wd-pending-chip').classList.toggle('hidden', w.isVerified);

  const avgR = w.averageRating ? Number(w.averageRating).toFixed(1) : '—';
  document.getElementById('wd-rating').textContent = avgR !== '—' ? avgR + ' ★' : '—';
  document.getElementById('wd-reviews').textContent = w.reviewCount || (w.reviews||[]).length || 0;
  document.getElementById('wd-exp-val').textContent = w.experienceYears != null ? w.experienceYears + ' yrs' : '—';
  document.getElementById('wd-price-val').textContent = w.priceRange || '—';

  // Status buttons
  document.querySelectorAll('.status-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.status === w.status));

  // Location
  const locText = document.getElementById('wd-loc-text');
  if (w.latitude && w.longitude) locText.textContent = Number(w.latitude).toFixed(4) + ', ' + Number(w.longitude).toFixed(4);
  else locText.textContent = 'Location not set — customers cannot find you';

  // Edit form
  document.getElementById('wd-bio').value = w.bio || '';
  document.getElementById('wd-exp').value = w.experienceYears ?? '';
  document.getElementById('wd-price').value = w.priceRange || '';

  // Categories checkboxes
  await loadWdCategories(w);

  // Reviews
  renderWdReviews(w.reviews || []);

  // Contact / Reach stats
  loadReachStats();
}

async function uploadWorkerPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  const label = input.previousElementSibling;
  const origHtml = label.innerHTML;
  label.innerHTML = '<span style="opacity:.6">Uploading…</span>';

  const form = new FormData();
  form.append('photo', file);

  try {
    const res = await fetch(`${API}/workers/profile/photo`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('hn_token') || '') },
      body: form,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Upload failed');

    // update preview
    const preview = document.getElementById('wd-photo-preview');
    const img = document.createElement('img');
    img.src = json.data.photoUrl + '?t=' + Date.now();
    img.className = 'wd-photo-preview';
    img.alt = 'Profile photo';
    preview.replaceWith(img);
    img.id = 'wd-photo-preview';

    // update nav avatar if photo
    showToast('Profile photo updated!', 'success');
  } catch (e) {
    showToast(e.message || 'Upload failed', 'error');
  } finally {
    label.innerHTML = origHtml;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    input.value = '';
  }
}

async function loadReachStats() {
  const res = await apiFetch('/workers/me/contact-stats');
  if (!res || !res.ok) return;
  const { data: s } = await res.json();

  document.getElementById('reach-total').textContent = s.total ?? '—';
  document.getElementById('reach-today').textContent = s.todayCount ?? 0;
  document.getElementById('reach-week').textContent  = s.weekCount  ?? 0;
  document.getElementById('reach-month').textContent = s.monthCount ?? 0;
  document.getElementById('reach-calls').textContent = s.calls      ?? 0;
  document.getElementById('reach-wa').textContent    = s.whatsapps  ?? 0;

  const list = document.getElementById('reach-recent-list');
  if (!s.recent || !s.recent.length) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:.82rem;padding:.5rem">No contact attempts yet.</p>';
    return;
  }
  list.innerHTML = s.recent.map(r => {
    const name = r.user?.name || 'Anonymous';
    const ch   = r.channel === 'whatsapp' ? 'whatsapp' : 'call';
    const label = ch === 'whatsapp' ? '💬 WhatsApp' : '📞 Call';
    const time  = new Date(r.createdAt).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    return `<div class="reach-recent-item">
      <span>${escHtml(name)}</span>
      <span class="rri-channel rri-${ch}">${label}</span>
      <span class="rri-time">${time}</span>
    </div>`;
  }).join('');
}

async function loadWdCategories(w) {
  const container = document.getElementById('wd-categories');
  container.innerHTML = '<div class="loading-text">Loading…</div>';
  if (!categoriesCache.length) categoriesCache = await getCategories();
  if (!categoriesCache.length) { container.innerHTML = '<div class="loading-text">No categories.</div>'; return; }
  const myIds = new Set((w.categories||[]).map(c => c.categoryId || c.category?.id || ''));
  container.innerHTML = '';
  categoriesCache.forEach(cat => {
    const id = cat.id || '';
    const label = document.createElement('label');
    label.className = 'cat-checkbox-item' + (myIds.has(id) ? ' checked' : '');
    label.innerHTML = `<input type="checkbox" value="${id}"${myIds.has(id)?' checked':''}> ${cat.icon ? cat.icon+' ' : ''}${escHtml(cat.name)}`;
    label.querySelector('input').addEventListener('change', e => label.classList.toggle('checked', e.target.checked));
    container.appendChild(label);
  });
}

async function setWorkerStatus(status) {
  const res = await apiFetch('/workers/status', { method: 'PATCH', body: JSON.stringify({ status }) });
  if (!res) return;
  const data = await res.json();
  if (res.ok) {
    if (myWorkerProfile) myWorkerProfile.status = status;
    document.querySelectorAll('.status-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.status === status));
    showToast('Status updated to ' + status, 'success');
  } else { showToast(data.message || 'Failed to update status.', 'error'); }
}

async function updateWorkerLocation() {
  if (!navigator.geolocation) { showToast('Geolocation not supported.', 'error'); return; }
  showLoader();
  navigator.geolocation.getCurrentPosition(async pos => {
    const latitude = pos.coords.latitude, longitude = pos.coords.longitude;
    const res = await apiFetch('/workers/location', { method: 'PATCH', body: JSON.stringify({ latitude, longitude }) });
    hideLoader();
    if (!res) return;
    const data = await res.json();
    if (res.ok) {
      document.getElementById('wd-loc-text').textContent = latitude.toFixed(4) + ', ' + longitude.toFixed(4);
      showToast('Location updated!', 'success');
    } else { showToast(data.message || 'Failed.', 'error'); }
  }, () => { hideLoader(); showToast('Could not get location.', 'error'); }, { timeout: 10000 });
}

async function saveWorkerProfile() {
  const bio = document.getElementById('wd-bio').value.trim();
  const experienceYears = parseInt(document.getElementById('wd-exp').value) || 0;
  const priceRange = document.getElementById('wd-price').value.trim();
  const categoryIds = [...document.querySelectorAll('#wd-categories input[type=checkbox]:checked')].map(cb => cb.value);
  if (!bio) { showToast('Bio is required.', 'error'); return; }
  if (!categoryIds.length) { showToast('Select at least one category.', 'error'); return; }
  showLoader();
  const res = await apiFetch('/workers/profile', { method: 'PATCH', body: JSON.stringify({ bio, experienceYears, priceRange: priceRange||undefined, categoryIds }) });
  hideLoader();
  if (!res) return;
  const data = await res.json();
  if (res.ok) {
    myWorkerProfile = data.data || myWorkerProfile;
    showToast('Profile saved!', 'success');
  } else { showToast(data.message || 'Save failed.', 'error'); }
}

function renderWdReviews(reviews) {
  const el = document.getElementById('wd-reviews-list');
  if (!reviews.length) { el.innerHTML = '<p class="no-reviews">No reviews yet.</p>'; return; }
  el.innerHTML = reviews.map(r => {
    const filled = Math.round(r.rating || 0);
    const stars = '★'.repeat(filled) + '☆'.repeat(5 - filled);
    const reviewer = r.user?.name || 'Anonymous';
    const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'}) : '';
    return `<div class="review-item">
      <div class="review-header">
        <div class="review-author-row">
          <div class="review-avatar">${getInitials(reviewer)}</div>
          <div><span class="review-author">${escHtml(reviewer)}</span><span class="review-date">${date}</span></div>
        </div>
        <span class="review-stars">${stars}</span>
      </div>
      ${r.comment ? `<p class="review-text">${escHtml(r.comment)}</p>` : ''}
    </div>`;
  }).join('');
}

// ══════════════════════════════
// SERVICE WORKER (PWA)
// ══════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/app/sw.js').catch(() => {});
  });
}

// ══════════════════════════════
// I18N — Hindi / English
// ══════════════════════════════
const TRANSLATIONS = {
  en: {
    // Nav
    'nav.home': 'Home', 'nav.bookings': 'Bookings', 'nav.profile': 'Profile',
    // Home / search
    'home.search_placeholder': 'Search workers, services…',
    'home.nearby': 'Nearby Workers', 'home.no_location': 'Set your location to see workers nearby',
    'home.set_location': 'Set Location', 'home.found': 'found',
    'home.no_workers': 'No workers found', 'home.no_workers_sub': 'Try increasing the radius or changing the category.',
    'home.share_location': 'Share your location', 'home.share_location_sub': "We'll find the best verified workers in your area",
    // Filters
    'filter.available_only': 'Available only', 'filter.all_ratings': 'All ratings',
    'filter.min4': '4★ & above', 'filter.min3': '3★ & above',
    'filter.sort_distance': 'Nearest first', 'filter.sort_rating': 'Top rated',
    'filter.sort_reviews': 'Most reviewed',
    // Worker card
    'worker.call': 'Call', 'worker.whatsapp': 'WhatsApp', 'worker.report': 'Report',
    'worker.verified': 'Verified', 'worker.view_profile': 'View Profile',
    'worker.no_reviews': 'No reviews', 'worker.general': 'General Worker',
    'worker.available': 'Available', 'worker.busy': 'Busy', 'worker.offline_status': 'Offline',
    'worker.offline': 'This worker is currently unavailable. Check back later.',
    'worker.already_reviewed': 'You have already reviewed this worker.',
    // Review
    'review.title': 'Leave a Review', 'review.submit': 'Submit Review',
    'review.placeholder': 'Share your experience…',
    // Login
    'login.title': 'Sign In', 'login.phone_placeholder': 'Mobile Number (10 digits)',
    'login.send_otp': 'Send OTP', 'login.verify': 'Verify OTP',
    // Register
    'register.title': 'Become a Worker', 'register.submit': 'Complete Registration',
    'register.bio': 'About You', 'register.bio_placeholder': 'Describe your skills and experience…',
    'register.categories': 'Your Skills / Services', 'register.experience': 'Years of Experience',
    'register.price_range': 'Price Range', 'register.price_placeholder': '₹200–500/hr',
    // Worker dashboard
    'wd.reach': 'Reach & Visibility', 'wd.calls': 'Calls', 'wd.whatsapp': 'WhatsApp',
    'wd.edit_profile': 'Edit Profile', 'wd.bio': 'Your Bio', 'wd.bio_placeholder': 'Tell customers about yourself…',
    'wd.status': 'Your Status', 'wd.location': 'Your Location', 'wd.update_location': 'Update Location',
    'wd.reviews': 'Your Reviews', 'wd.no_reviews': 'No reviews yet.',
    'wd.save': 'Save Changes', 'wd.saving': 'Saving…',
    // Complaint
    'complaint.title': 'Report Worker', 'complaint.submit': 'Submit Report',
    'complaint.success': 'Report submitted. Our team will review it.',
    // Location modal
    'loc.title': 'Set Location', 'loc.use_gps': 'Use Current Location',
    'loc.search_placeholder': 'Search city, area, landmark…',
    // Errors
    'err.phone': 'Enter a valid 10-digit mobile number.',
    'err.otp': 'Enter the 6-digit OTP.',
    'err.name': 'Please enter your name.',
    'err.location': 'Please set your location first.',
    'err.review_rating': 'Please select a rating.',
    'err.complaint_reason': 'Please describe the issue.',
  },
  hi: {
    // Nav
    'nav.home': 'होम', 'nav.bookings': 'बुकिंग', 'nav.profile': 'प्रोफ़ाइल',
    // Home / search
    'home.search_placeholder': 'कारीगर, सेवाएं खोजें…',
    'home.nearby': 'नज़दीकी कारीगर', 'home.no_location': 'नज़दीकी कारीगर देखने के लिए अपनी लोकेशन सेट करें',
    'home.set_location': 'लोकेशन सेट करें', 'home.found': 'मिले',
    'home.no_workers': 'कोई कारीगर नहीं मिला', 'home.no_workers_sub': 'दायरा बढ़ाएं या श्रेणी बदलें।',
    'home.share_location': 'अपनी लोकेशन साझा करें', 'home.share_location_sub': 'हम आपके क्षेत्र के सर्वश्रेष्ठ कारीगर खोजेंगे',
    // Filters
    'filter.available_only': 'केवल उपलब्ध', 'filter.all_ratings': 'सभी रेटिंग',
    'filter.min4': '4★ व अधिक', 'filter.min3': '3★ व अधिक',
    'filter.sort_distance': 'सबसे नज़दीकी', 'filter.sort_rating': 'सर्वश्रेष्ठ रेटिंग',
    'filter.sort_reviews': 'सर्वाधिक समीक्षा',
    // Worker card
    'worker.call': 'कॉल', 'worker.whatsapp': 'व्हाट्सऐप', 'worker.report': 'रिपोर्ट',
    'worker.verified': 'सत्यापित', 'worker.view_profile': 'प्रोफ़ाइल देखें',
    'worker.no_reviews': 'कोई समीक्षा नहीं', 'worker.general': 'सामान्य कारीगर',
    'worker.available': 'उपलब्ध', 'worker.busy': 'व्यस्त', 'worker.offline_status': 'ऑफलाइन',
    'worker.offline': 'यह कारीगर अभी उपलब्ध नहीं है। बाद में देखें।',
    'worker.already_reviewed': 'आप पहले ही इस कारीगर की समीक्षा कर चुके हैं।',
    // Review
    'review.title': 'समीक्षा दें', 'review.submit': 'समीक्षा जमा करें',
    'review.placeholder': 'अपना अनुभव साझा करें…',
    // Login
    'login.title': 'साइन इन', 'login.phone_placeholder': 'मोबाइल नंबर (10 अंक)',
    'login.send_otp': 'OTP भेजें', 'login.verify': 'OTP सत्यापित करें',
    // Register
    'register.title': 'कारीगर बनें', 'register.submit': 'पंजीकरण पूरा करें',
    'register.bio': 'आपके बारे में', 'register.bio_placeholder': 'अपने कौशल और अनुभव के बारे में बताएं…',
    'register.categories': 'आपके कौशल / सेवाएं', 'register.experience': 'अनुभव के वर्ष',
    'register.price_range': 'मूल्य सीमा', 'register.price_placeholder': '₹200–500/घंटा',
    // Worker dashboard
    'wd.reach': 'पहुंच और दृश्यता', 'wd.calls': 'कॉल्स', 'wd.whatsapp': 'व्हाट्सऐप',
    'wd.edit_profile': 'प्रोफ़ाइल संपादित करें', 'wd.bio': 'आपका परिचय', 'wd.bio_placeholder': 'ग्राहकों को अपने बारे में बताएं…',
    'wd.status': 'आपकी स्थिति', 'wd.location': 'आपकी लोकेशन', 'wd.update_location': 'लोकेशन अपडेट करें',
    'wd.reviews': 'आपकी समीक्षाएं', 'wd.no_reviews': 'अभी कोई समीक्षा नहीं।',
    'wd.save': 'बदलाव सहेजें', 'wd.saving': 'सहेजा जा रहा है…',
    // Complaint
    'complaint.title': 'कारीगर की रिपोर्ट करें', 'complaint.submit': 'रिपोर्ट जमा करें',
    'complaint.success': 'रिपोर्ट जमा हो गई। हमारी टीम समीक्षा करेगी।',
    // Location modal
    'loc.title': 'लोकेशन सेट करें', 'loc.use_gps': 'वर्तमान स्थान उपयोग करें',
    'loc.search_placeholder': 'शहर, क्षेत्र, लैंडमार्क खोजें…',
    // Errors
    'err.phone': '10 अंकों का सही मोबाइल नंबर दर्ज करें।',
    'err.otp': '6 अंकों का OTP दर्ज करें।',
    'err.name': 'कृपया अपना नाम दर्ज करें।',
    'err.location': 'पहले अपनी लोकेशन सेट करें।',
    'err.review_rating': 'कृपया रेटिंग चुनें।',
    'err.complaint_reason': 'कृपया समस्या का विवरण दें।',
  }
};

let currentLang = localStorage.getItem('hn_lang') || 'en';

function t(key) {
  return (TRANSLATIONS[currentLang] || TRANSLATIONS.en)[key] || (TRANSLATIONS.en[key] || key);
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    if (attr) el.setAttribute(attr, t(key));
    else el.textContent = t(key);
  });
  // Translate select option text
  document.querySelectorAll('[data-i18n-opt]').forEach(opt => {
    const key = opt.getAttribute('data-i18n-opt');
    opt.textContent = t(key);
  });
  // Translate placeholder attributes
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-ph'));
  });
  document.documentElement.lang = currentLang;
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('hn_lang', lang);
  applyTranslations();
  // Update toggle button state
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
}

// ══════════════════════════════
// INIT
// ══════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof lucide !== 'undefined') lucide.createIcons();
  // Sync lang toggle button state with saved preference
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === currentLang));
  applyTranslations();
  setupOtpBoxes();

  if (token()) {
    const res = await fetch(API + '/auth/me', { headers: { 'Authorization': 'Bearer ' + token() } }).catch(() => null);
    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.data) localStorage.setItem('hn_user', JSON.stringify({ ...(currentUser()||{}), ...data.data }));
      updateNavAvatar();
      await checkWorkerStatus();
      showPage('home');
      loadCategories();
      silentGpsLocation();
      initFcm();
    } else {
      localStorage.removeItem('hn_token'); localStorage.removeItem('hn_user');
      showPage('login');
    }
  } else {
    showPage('login');
    // Load stats for login trust badges
    updateHero();
  }
});

// ── Share Worker Profile ──
function shareWorkerProfile() {
  if (!myWorkerProfile?.id) return;
  const url = `${location.origin}/worker.html?id=${myWorkerProfile.id}`;
  if (navigator.share) {
    navigator.share({ title: 'My HelperNear Profile', url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => showToast('Profile link copied!', 'success')).catch(() => {
      prompt('Copy your profile link:', url);
    });
  }
}

// ── Push Notifications (Firebase FCM) ──
async function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initFcm() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  try {
    const cfgRes = await fetch(`${API}/public/fcm-config`);
    if (!cfgRes.ok) return;
    const { data: cfg } = await cfgRes.json();
    if (!cfg?.apiKey || !cfg?.vapidKey) return; // FCM not configured in admin settings

    await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

    if (!window.firebase.apps.length) {
      window.firebase.initializeApp({
        apiKey: cfg.apiKey,
        authDomain: cfg.authDomain,
        projectId: cfg.projectId,
        messagingSenderId: cfg.messagingSenderId,
        appId: cfg.appId,
      });
    }

    const messaging = window.firebase.messaging();
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });

    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission !== 'granted') return;

    const fcmToken = await messaging.getToken({ vapidKey: cfg.vapidKey, serviceWorkerRegistration: swReg });
    if (!fcmToken) return;

    await apiFetch('/users/fcm-token', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ token: fcmToken }),
    });

    messaging.onMessage(payload => {
      const n = payload.notification || {};
      showToast((n.title ? n.title + ': ' : '') + (n.body || 'New notification'), 'info');
    });
  } catch (_) {}
}
