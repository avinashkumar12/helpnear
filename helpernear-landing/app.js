/* ═══════════════════════════════════════════
   HelperNear Landing Page – app.js
   ═══════════════════════════════════════════ */

const API = 'https://helpnear-production.up.railway.app/api/v1';

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

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

// ── Hamburger menu ──
document.getElementById('hamburger')?.addEventListener('click', () => {
  document.querySelector('.nav-links')?.classList.toggle('open');
});

// ── Sticky nav shadow ──
window.addEventListener('scroll', () => {
  const nav = document.getElementById('main-nav');
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 40);
});

// ── Scroll-reveal animation ──
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.08 });

document.addEventListener('DOMContentLoaded', () => {
  if (typeof lucide !== 'undefined') lucide.createIcons();
  document.querySelectorAll('.cat-card, .step, .feature-card, .testimonial-card, .faq-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    revealObserver.observe(el);
  });

  loadAnnouncements();
  loadStats();
  loadCategories();
  loadFaqs();
  loadTestimonials();
  loadFooterPages();
});

// ── FAQs ──
async function loadFaqs() {
  try {
    const res = await fetch(API + '/public/faqs');
    if (!res.ok) return;
    const json = await res.json();
    const items = (json.data || []).filter(f => f.isActive !== false);
    const list = document.getElementById('faq-list');
    if (!list || !items.length) return;
    list.innerHTML = items.map(f => `
      <div class="faq-item">
        <div class="faq-q" onclick="toggleFaq(this)">
          <span>${escHtml(f.question)}</span>
          <span class="faq-icon">+</span>
        </div>
        <div class="faq-a">${escHtml(f.answer)}</div>
      </div>`).join('');
    // wire scroll-reveal for faq items
    list.querySelectorAll('.faq-item').forEach(el => {
      el.style.opacity = '0'; el.style.transform = 'translateY(16px)';
      el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      revealObserver.observe(el);
    });
  } catch (_) {}
}

function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  const isOpen = item.classList.contains('open');
  // close all others
  document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

// ── Announcement popup ──
async function loadAnnouncements() {
  try {
    const res = await fetch(API + '/public/announcements');
    if (!res.ok) return;
    const json = await res.json();
    const items = (json.data || []).filter(a => a.isActive !== false);
    if (!items.length) return;

    // Only show announcements not yet dismissed (stored in localStorage)
    const dismissed = JSON.parse(localStorage.getItem('hn_dismissed_announcements') || '[]');
    const unseen = items.filter(a => !dismissed.includes(a.id)).slice(0, 3);
    if (!unseen.length) return;

    const typeColors = {
      INFO:    { color: '#3b82f6', border: 'rgba(59,130,246,.35)' },
      WARNING: { color: '#f59e0b', border: 'rgba(245,158,11,.35)' },
      SUCCESS: { color: '#22c55e', border: 'rgba(34,197,94,.35)'  },
      PROMO:   { color: '#FF6B35', border: 'rgba(255,107,53,.35)' },
      URGENT:  { color: '#ef4444', border: 'rgba(239,68,68,.35)'  },
    };

    const container = document.getElementById('announcement-bar');
    container.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;display:flex;flex-direction:column;gap:.6rem;align-items:flex-end;pointer-events:none;';

    unseen.forEach((a, idx) => {
      const cfg = typeColors[a.type] || typeColors.INFO;
      const popup = document.createElement('div');
      popup.dataset.id = a.id;
      popup.style.cssText = `pointer-events:all;background:#1e1e1e;border:1px solid ${cfg.border};border-left:3px solid ${cfg.color};border-radius:12px;padding:.9rem 1rem;max-width:320px;min-width:240px;box-shadow:0 8px 32px rgba(0,0,0,.55);display:flex;gap:.75rem;align-items:flex-start;opacity:0;transform:translateX(20px);transition:opacity .3s ease,transform .3s ease;`;
      popup.innerHTML = `
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.85rem;color:#f0f0f0;margin-bottom:.2rem">${escHtml(a.title)}</div>
          <div style="font-size:.78rem;color:rgba(255,255,255,.55);line-height:1.5">${escHtml(a.message)}</div>
        </div>
        <button onclick="dismissAnnouncement(this)" title="Dismiss" style="background:none;border:none;color:rgba(255,255,255,.3);cursor:pointer;font-size:1rem;line-height:1;padding:0 0 0 .25rem;flex-shrink:0;transition:color .15s" onmouseover="this.style.color='rgba(255,255,255,.75)'" onmouseout="this.style.color='rgba(255,255,255,.3)'">✕</button>`;
      container.appendChild(popup);

      setTimeout(() => { popup.style.opacity = '1'; popup.style.transform = 'translateX(0)'; }, 800 + idx * 250);
    });
  } catch (_) {}
}

function dismissAnnouncement(btn) {
  const popup = btn.closest('[data-id]');
  if (!popup) return;
  // Persist dismissal so it never shows again
  const dismissed = JSON.parse(localStorage.getItem('hn_dismissed_announcements') || '[]');
  if (!dismissed.includes(popup.dataset.id)) {
    dismissed.push(popup.dataset.id);
    localStorage.setItem('hn_dismissed_announcements', JSON.stringify(dismissed));
  }
  popup.style.opacity = '0';
  popup.style.transform = 'translateX(20px)';
  setTimeout(() => popup.remove(), 300);
}

// ── Live stats with count-up animation ──
async function loadStats() {
  try {
    const res = await fetch(API + '/public/stats');
    if (!res.ok) return;
    const json = await res.json();
    const s = json.data || {};
    if (s.verifiedWorkers) animateCount(document.getElementById('stat-workers'), s.verifiedWorkers);
    if (s.totalUsers)     animateCount(document.getElementById('stat-users'),   s.totalUsers);
    if (s.totalCategories && document.getElementById('stat-cats'))
      document.getElementById('stat-cats').textContent = s.totalCategories + '+';
  } catch (e) {}
}

function animateCount(el, target) {
  if (!el || !target) return;
  const fmt = n => n >= 1000 ? (n / 1000).toFixed(1) + 'K+' : n + '+';
  let cur = 0;
  const step = Math.max(1, Math.ceil(target / 50));
  const t = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = fmt(cur);
    if (cur >= target) clearInterval(t);
  }, 30);
}

// ── Dynamic categories from API ──
async function loadCategories() {
  try {
    const res = await fetch(API + '/categories');
    if (!res.ok) return;
    const json = await res.json();
    const cats = json.data || [];
    if (!cats.length) return;
    const grid = document.getElementById('cat-grid');
    if (!grid) return;
    grid.innerHTML = cats.map(c => `
      <a class="cat-card" href="/app" style="text-decoration:none;opacity:0;transform:translateY(20px);transition:opacity .5s ease,transform .5s ease">
        <div class="cat-icon">${c.icon || '<i data-lucide="briefcase"></i>'}</div>
        <span>${escHtml(c.name)}</span>
      </a>`).join('');
    // Re-observe newly added cards
    grid.querySelectorAll('.cat-card').forEach(el => revealObserver.observe(el));
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (e) {}
}

// ── Dynamic testimonials from API ──
async function loadTestimonials() {
  try {
    const res = await fetch(API + '/public/testimonials');
    if (!res.ok) return;
    const json = await res.json();
    const items = json.data || [];
    if (!items.length) return;
    const grid = document.getElementById('testimonials-grid');
    if (!grid) return;
    grid.innerHTML = items.map(t => {
      const rating = Math.min(5, Math.max(1, Math.round(t.rating || 5)));
      const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
      const initials = (t.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      return `<div class="testimonial-card" style="opacity:0;transform:translateY(20px);transition:opacity .5s ease,transform .5s ease">
        <div class="t-stars">${stars}</div>
        <p class="t-quote">"${escHtml(t.quote)}"</p>
        <div class="t-author">
          ${t.photoUrl
            ? `<img src="${escHtml(t.photoUrl)}" class="t-avatar-img" alt="${escHtml(t.name)}"/>`
            : `<div class="t-avatar">${initials}</div>`}
          <div><strong>${escHtml(t.name)}</strong><span>${escHtml(t.role || '')}</span></div>
        </div>
      </div>`;
    }).join('');
    grid.querySelectorAll('.testimonial-card').forEach(el => revealObserver.observe(el));
  } catch (e) {}
}

// ── Dynamic footer pages ──
async function loadFooterPages() {
  try {
    const res = await fetch(API + '/public/pages');
    if (!res.ok) return;
    const json = await res.json();
    const pages = json.data || [];
    if (!pages.length) return;

    const SLUG_COMPANY = ['about-us', 'blog', 'careers', 'press'];
    const SLUG_LEGAL   = ['privacy-policy', 'terms-of-service', 'terms', 'cookie-policy'];

    const companyEl = document.getElementById('footer-company-links');
    const legalEl   = document.getElementById('footer-legal-links');

    pages.forEach(p => {
      const link = `<li><a href="/page.html?slug=${encodeURIComponent(p.slug)}">${escHtml(p.title)}</a></li>`;
      const slug = p.slug.toLowerCase();
      if (SLUG_LEGAL.some(s => slug.includes(s))) {
        legalEl && legalEl.insertAdjacentHTML('beforeend', link);
      } else {
        companyEl && companyEl.insertAdjacentHTML('beforeend', link);
      }
    });
  } catch (e) {}
}

// ── Contact Form ──
async function submitContactForm(e) {
  e.preventDefault();
  const btn = document.getElementById('cf-btn');
  const result = document.getElementById('cf-result');
  const body = {
    name:    document.getElementById('cf-name').value.trim(),
    email:   document.getElementById('cf-email').value.trim(),
    phone:   document.getElementById('cf-phone').value.trim() || undefined,
    subject: document.getElementById('cf-subject').value.trim(),
    message: document.getElementById('cf-message').value.trim(),
  };
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const res = await fetch(`${API}/public/contact`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    result.style.display = 'block';
    if (res.ok) {
      result.style.color = '#22c55e';
      result.textContent = '✓ Message sent! We will get back to you within 24 hours.';
      document.getElementById('contact-form').reset();
    } else {
      result.style.color = '#ef4444';
      result.textContent = json.message || 'Something went wrong. Please try again.';
    }
  } catch (_) {
    result.style.display = 'block';
    result.style.color = '#ef4444';
    result.textContent = 'Network error. Please try again.';
  } finally {
    btn.disabled = false; btn.textContent = 'Send Message';
  }
}
