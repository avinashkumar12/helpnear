// Worker-side extras: profile strength, ID verification, work gallery, price list,
// QR code, lead stats, and "load more" pagination. Relies on globals from app.js.

// ── helpers ──────────────────────────────────────────────
async function weUpload(path, form, method) {
  const res = await fetch(API + path, {
    method: method || 'POST',
    headers: { Authorization: 'Bearer ' + (store.get('hn_token') || '') },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || 'Request failed');
  return json;
}

function weIcons() { if (typeof lucide !== 'undefined') lucide.createIcons(); }

// ── dashboard entry point (called from loadWorkerDashboard) ──
function renderWorkerExtras(w) {
  renderStrengthCard(w);
  renderVerifyCard(w);
  renderGallery(w.gallery || []);
  const svc = document.getElementById('wd-services');
  if (svc) {
    svc.value = (Array.isArray(w.services) ? w.services : [])
      .map(function (s) { return s.name + ' | ' + s.price; }).join('\n');
  }
}

// Parses "Tap repair | ₹300" lines into [{name, price}]
function parseServices() {
  const el = document.getElementById('wd-services');
  if (!el) return undefined;
  return el.value.split('\n').map(function (line) {
    const parts = line.split('|');
    return { name: (parts[0] || '').trim(), price: (parts.slice(1).join('|') || '').trim() };
  }).filter(function (s) { return s.name; }).slice(0, 15);
}

// ── profile strength ─────────────────────────────────────
function renderStrengthCard(w) {
  const box = document.getElementById('wd-strength-card');
  if (!box || !w.completeness) return;
  const c = w.completeness;
  const missing = c.missing.map(function (m) { return '<li>' + escHtml(m.label) + '</li>'; }).join('');
  box.innerHTML =
    '<div class="info-card strength-card">' +
      '<div class="strength-head"><h3>Profile Strength</h3><strong>' + c.score + '%</strong></div>' +
      '<div class="strength-bar"><span style="width:' + c.score + '%"></span></div>' +
      (missing
        ? '<p class="card-sub">Complete these to get more customers:</p><ul class="strength-list">' + missing + '</ul>'
        : '<p class="card-sub">Great job — your profile is complete!</p>') +
    '</div>';
}

// ── ID verification ──────────────────────────────────────
function renderVerifyCard(w) {
  const box = document.getElementById('wd-verify-card');
  if (!box) return;
  const st = w.verificationStatus || 'NONE';
  let body;
  if (st === 'APPROVED') {
    body = '<p class="verify-ok"><i data-lucide="shield-check"></i> Your profile is verified. Customers see the Verified badge.</p>';
  } else if (st === 'PENDING') {
    body = '<p class="card-sub">Your ID is under review. We usually respond within 24 hours.</p>';
  } else {
    const rejected = st === 'REJECTED'
      ? '<p class="verify-rejected">Last submission was rejected: ' + escHtml(w.verificationNote || 'please upload a clearer document') + '</p>'
      : '<p class="card-sub">Upload a government ID to earn the Verified badge. Only our admin team can see it.</p>';
    body = rejected +
      '<div class="form-group"><label>ID type</label>' +
      '<select id="wd-id-type"><option value="AADHAAR">Aadhaar</option><option value="PAN">PAN</option>' +
      '<option value="VOTER_ID">Voter ID</option><option value="DRIVING_LICENSE">Driving licence</option>' +
      '<option value="OTHER">Other</option></select></div>' +
      '<div class="form-group"><label>Photo or PDF of the ID (max 5MB)</label>' +
      '<input type="file" id="wd-id-file" accept=".jpg,.jpeg,.png,.webp,.pdf"/></div>' +
      '<button class="btn-primary" onclick="submitVerificationDoc()"><i data-lucide="upload"></i> Submit for verification</button>';
  }
  box.innerHTML = '<div class="info-card"><h3>Verification</h3>' + body + '</div>';
  weIcons();
}

async function submitVerificationDoc() {
  const file = document.getElementById('wd-id-file').files[0];
  if (!file) { showToast('Please choose a file first.', 'error'); return; }
  const form = new FormData();
  form.append('idType', document.getElementById('wd-id-type').value);
  form.append('idDoc', file);
  showLoader();
  try {
    const json = await weUpload('/workers/verification', form);
    showToast(json.message || 'Submitted!', 'success');
    await loadWorkerDashboard();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    hideLoader();
  }
}

// ── work gallery ─────────────────────────────────────────
function renderGallery(urls) {
  const box = document.getElementById('wd-gallery');
  if (!box) return;
  const thumbs = urls.map(function (u) {
    return '<div class="gal-item"><img src="' + escHtml(u) + '" alt="Work photo"/>' +
      '<button type="button" class="gal-del" data-url="' + escHtml(u) + '" onclick="removeGalleryPhoto(this.dataset.url)" aria-label="Remove photo">&times;</button></div>';
  }).join('');
  box.innerHTML =
    '<div class="gal-grid">' + thumbs + '</div>' +
    (urls.length < 8
      ? '<label class="btn-upload-photo" for="wd-gallery-input"><i data-lucide="image-plus"></i> Add work photos</label>' +
        '<input type="file" id="wd-gallery-input" accept=".jpg,.jpeg,.png,.webp" multiple style="display:none" onchange="uploadGallery(this)"/>'
      : '<p class="card-sub">Maximum of 8 photos reached.</p>');
  weIcons();
}

async function uploadGallery(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  const form = new FormData();
  files.forEach(function (f) { form.append('photos', f); });
  showLoader();
  try {
    const json = await weUpload('/workers/profile/gallery', form);
    renderGallery(json.data.gallery || []);
    if (myWorkerProfile) myWorkerProfile.gallery = json.data.gallery;
    showToast('Photos added!', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    hideLoader();
    input.value = '';
  }
}

async function removeGalleryPhoto(url) {
  showLoader();
  try {
    const res = await apiFetch('/workers/profile/gallery?url=' + encodeURIComponent(url), { method: 'DELETE' });
    const json = res ? await res.json() : null;
    if (!res || !res.ok) throw new Error((json && json.message) || 'Could not remove photo');
    renderGallery(json.data.gallery || []);
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    hideLoader();
  }
}

// ── QR code ──────────────────────────────────────────────
async function showProfileQr() {
  if (!myWorkerProfile || !myWorkerProfile.id) return;
  showLoader();
  try {
    const res = await apiFetch('/workers/' + myWorkerProfile.id + '/qr');
    const json = res ? await res.json() : null;
    if (!res || !res.ok) throw new Error('Could not generate QR');
    const url = json.data.url;
    const old = document.getElementById('qr-overlay');
    if (old) old.remove();
    const wrap = document.createElement('div');
    wrap.id = 'qr-overlay';
    wrap.className = 'qr-overlay';
    wrap.innerHTML =
      '<div class="qr-box"><h3>Scan to view my profile</h3>' +
      '<div class="qr-svg">' + json.data.svg + '</div>' +
      '<p class="qr-url">' + escHtml(url) + '</p>' +
      '<div class="qr-actions"><button class="btn-primary" onclick="window.print()">Print</button>' +
      '<button class="btn-outline" onclick="document.getElementById(\'qr-overlay\').remove()">Close</button></div></div>';
    wrap.addEventListener('click', function (e) { if (e.target === wrap) wrap.remove(); });
    document.body.appendChild(wrap);
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    hideLoader();
  }
}

// ── lead stats (called from loadReachStats) ──────────────
function renderLeadStats(s) {
  const box = document.getElementById('reach-lead');
  if (!box) return;
  const pct = function (v) { return v == null ? '—' : v + '%'; };
  const daily = s.daily || [];
  const max = Math.max.apply(null, daily.map(function (d) { return d.count; }).concat([1]));
  const bars = daily.map(function (d) {
    const label = new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
    return '<div class="lead-bar" title="' + d.count + ' contacts"><span style="height:' +
      Math.round((d.count / max) * 100) + '%"></span><small>' + escHtml(label.slice(0, 1)) + '</small></div>';
  }).join('');
  box.innerHTML =
    '<div class="reach-stats-grid lead-grid">' +
      '<div class="reach-stat"><span>' + (s.profileViews || 0) + '</span><small>Profile views</small></div>' +
      '<div class="reach-stat"><span>' + pct(s.contactRate) + '</span><small>Views → contacts</small></div>' +
      '<div class="reach-stat"><span>' + (s.hired || 0) + '</span><small>Marked hired</small></div>' +
      '<div class="reach-stat"><span>' + pct(s.hireRate) + '</span><small>Hire rate</small></div>' +
    '</div>' +
    '<p class="card-sub" style="margin:.2rem 0 .4rem">Contacts, last 7 days</p>' +
    '<div class="lead-bars">' + bars + '</div>';
}

// ── customer-facing worker page: gallery + price list ────
function renderPublicExtras(w) {
  const box = document.getElementById('wp-extras');
  if (!box) return;
  const services = Array.isArray(w.services) ? w.services : [];
  const gallery = Array.isArray(w.gallery) ? w.gallery : [];
  let html = '';
  if (services.length) {
    html += '<div class="info-card"><h3>Services &amp; Prices</h3><ul class="svc-list">' +
      services.map(function (s) {
        return '<li><span>' + escHtml(s.name) + '</span><strong>' + escHtml(s.price) + '</strong></li>';
      }).join('') + '</ul></div>';
  }
  if (gallery.length) {
    html += '<div class="info-card"><h3>Recent Work</h3><div class="gal-grid">' +
      gallery.map(function (u) {
        return '<a class="gal-item" href="' + escHtml(u) + '" target="_blank" rel="noopener"><img src="' + escHtml(u) + '" alt="Work photo" loading="lazy"/></a>';
      }).join('') + '</div></div>';
  }
  box.innerHTML = html;
}

// ── pagination: "Load more" ──────────────────────────────
var _searchPage = 1;
var _searchHasMore = false;
var _searchBaseUrl = '';
var _searchPageSize = 50;

function setSearchPagination(url, resultCount) {
  _searchBaseUrl = url;
  _searchPage = 1;
  _searchHasMore = resultCount >= _searchPageSize;
}

function renderLoadMore() {
  const grid = document.getElementById('workers-grid');
  if (!grid) return;
  const old = document.getElementById('load-more-wrap');
  if (old) old.remove();
  if (!_searchHasMore) return;
  const wrap = document.createElement('div');
  wrap.id = 'load-more-wrap';
  wrap.className = 'load-more-wrap';
  wrap.innerHTML = '<button class="btn-outline" onclick="loadMoreWorkers()">Load more</button>';
  grid.insertAdjacentElement('afterend', wrap);
}

async function loadMoreWorkers() {
  if (!_searchBaseUrl) return;
  showLoader();
  try {
    const next = _searchPage + 1;
    const res = await apiFetch(_searchBaseUrl + '&page=' + next);
    if (!res || !res.ok) return;
    const json = await res.json();
    const more = Array.isArray(json.data) ? json.data : [];
    _searchPage = next;
    _searchHasMore = more.length >= _searchPageSize;
    allWorkers = allWorkers.concat(more);
    renderWorkers();
  } finally {
    hideLoader();
  }
}
