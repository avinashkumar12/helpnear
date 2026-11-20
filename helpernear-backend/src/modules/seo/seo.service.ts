import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { staleCutoff } from '../workers/ranking';

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface Combo {
  categoryName: string;
  categorySlug: string;
  cityName: string;
  citySlug: string;
  count: number;
}

@Injectable()
export class SeoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every (category, city) pair that has at least one verified, recently active worker. */
  async getCombos(): Promise<Combo[]> {
    const workers = await this.prisma.workerProfile.findMany({
      where: {
        isVerified: true,
        city: { not: null },
        lastActiveAt: { gte: staleCutoff() },
        user: { isActive: true },
      },
      select: { city: true, categories: { select: { category: { select: { name: true } } } } },
    });

    const map = new Map<string, Combo>();
    for (const w of workers) {
      const cityName = (w.city ?? '').trim();
      const citySlug = slugify(cityName);
      if (!citySlug) continue;
      for (const wc of w.categories) {
        const categoryName = wc.category.name;
        const categorySlug = slugify(categoryName);
        if (!categorySlug) continue;
        const key = categorySlug + '|' + citySlug;
        const existing = map.get(key);
        if (existing) existing.count += 1;
        else map.set(key, { categoryName, categorySlug, cityName, citySlug, count: 1 });
      }
    }
    return [...map.values()].sort(
      (a, b) => a.categoryName.localeCompare(b.categoryName) || b.count - a.count,
    );
  }

  async getListing(categorySlug: string, citySlug: string) {
    const combos = await this.getCombos();
    const combo = combos.find((c) => c.categorySlug === categorySlug && c.citySlug === citySlug);
    if (!combo) throw new NotFoundException('No workers found');

    const workers = await this.prisma.workerProfile.findMany({
      where: {
        isVerified: true,
        lastActiveAt: { gte: staleCutoff() },
        user: { isActive: true },
        city: { equals: combo.cityName, mode: 'insensitive' },
        categories: { some: { category: { name: { equals: combo.categoryName, mode: 'insensitive' } } } },
      },
      select: {
        id: true,
        bio: true,
        experienceYears: true,
        priceRange: true,
        status: true,
        photoUrl: true,
        user: { select: { name: true } },
        reviews: { select: { rating: true } },
      },
      take: 50,
    });

    const rows = workers
      .map((w) => {
        const ratings = w.reviews.map((r) => r.rating);
        const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
        return {
          id: w.id,
          name: w.user?.name || 'HelperNear Pro',
          bio: w.bio,
          experienceYears: w.experienceYears,
          priceRange: w.priceRange,
          status: w.status,
          rating: Math.round(avg * 10) / 10,
          reviewCount: ratings.length,
        };
      })
      .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);

    return { combo, rows, relatedCities: combos.filter((c) => c.categorySlug === categorySlug && c.citySlug !== citySlug) };
  }

  // ───────────── HTML ─────────────

  private layout(opts: { title: string; description: string; canonical: string; body: string; jsonLd?: object[] }): string {
    const ld = (opts.jsonLd ?? [])
      .map((o) => '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>')
      .join('\n');
    return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(opts.title) + '</title>' +
      '<meta name="description" content="' + esc(opts.description) + '">' +
      '<link rel="canonical" href="' + esc(opts.canonical) + '">' +
      '<meta property="og:type" content="website"><meta property="og:site_name" content="HelperNear">' +
      '<meta property="og:title" content="' + esc(opts.title) + '">' +
      '<meta property="og:description" content="' + esc(opts.description) + '">' +
      '<meta property="og:url" content="' + esc(opts.canonical) + '">' +
      '<style>' + CSS + '</style>' + ld + '</head><body>' +
      '<header><a class="brand" href="/">HelperNear</a><nav><a href="/services">Services</a><a href="/app/" class="cta">Open app</a></nav></header>' +
      '<main>' + opts.body + '</main>' +
      '<footer>&copy; HelperNear &middot; Verified local workers near you</footer></body></html>';
  }

  renderListing(base: string, data: Awaited<ReturnType<SeoService['getListing']>>): string {
    const { combo, rows, relatedCities } = data;
    const label = combo.categoryName;
    const city = combo.cityName;
    const canonical = base + '/services/' + combo.categorySlug + '/' + combo.citySlug;
    const title = 'Best ' + label + ' in ' + city + ' – Verified & Rated | HelperNear';
    const description = 'Find ' + rows.length + ' verified ' + label.toLowerCase() + ' in ' + city +
      '. See ratings, experience and prices, then call or WhatsApp directly on HelperNear.';

    const cards = rows.map((w) => {
      const stars = w.reviewCount ? '&#9733; ' + w.rating.toFixed(1) + ' (' + w.reviewCount + ')' : 'New';
      return '<a class="card" href="/worker.html?id=' + esc(w.id) + '">' +
        '<div class="avatar">' + esc(w.name.charAt(0).toUpperCase()) + '</div>' +
        '<div class="info"><h3>' + esc(w.name) + ' <span class="ok">Verified</span></h3>' +
        '<p class="meta">' + stars + ' &middot; ' + w.experienceYears + ' yrs experience' +
        (w.priceRange ? ' &middot; ' + esc(w.priceRange) : '') + '</p>' +
        (w.bio ? '<p class="bio">' + esc(w.bio.length > 140 ? w.bio.slice(0, 137) + '...' : w.bio) + '</p>' : '') +
        '</div></a>';
    }).join('');

    const related = relatedCities.length
      ? '<h2>' + esc(label) + ' in other cities</h2><p class="links">' +
        relatedCities.map((c) => '<a href="/services/' + c.categorySlug + '/' + c.citySlug + '">' + esc(c.cityName) + '</a>').join('') + '</p>'
      : '';

    const body = '<nav class="crumbs"><a href="/">Home</a> / <a href="/services">Services</a> / ' + esc(label) + ' in ' + esc(city) + '</nav>' +
      '<h1>' + esc(label) + ' in ' + esc(city) + '</h1>' +
      '<p class="lead">' + rows.length + ' verified ' + esc(label.toLowerCase()) + ' available in ' + esc(city) +
      '. Compare ratings and contact them directly &mdash; no middleman.</p>' +
      '<div class="grid">' + cards + '</div>' + related +
      '<section class="how"><h2>How it works</h2><ol><li>Pick a verified professional.</li><li>Check ratings and prices.</li>' +
      '<li>Call or WhatsApp them, then rate your experience.</li></ol><a class="cta big" href="/app/">Find ' + esc(label.toLowerCase()) + ' near me</a></section>';

    const jsonLd: object[] = [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: base + '/' },
          { '@type': 'ListItem', position: 2, name: 'Services', item: base + '/services' },
          { '@type': 'ListItem', position: 3, name: label + ' in ' + city, item: canonical },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: label + ' in ' + city,
        itemListElement: rows.map((w, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: base + '/worker.html?id=' + w.id,
          name: w.name,
        })),
      },
    ];
    return this.layout({ title, description, canonical, body, jsonLd });
  }

  async renderCategory(base: string, categorySlug: string): Promise<string> {
    const combos = (await this.getCombos()).filter((c) => c.categorySlug === categorySlug);
    if (!combos.length) throw new NotFoundException('No workers found');
    const label = combos[0].categoryName;
    const canonical = base + '/services/' + categorySlug;
    const body = '<nav class="crumbs"><a href="/">Home</a> / <a href="/services">Services</a> / ' + esc(label) + '</nav>' +
      '<h1>' + esc(label) + ' near you</h1><p class="lead">Choose your city to see verified ' + esc(label.toLowerCase()) + '.</p>' +
      '<p class="links">' + combos.map((c) =>
        '<a href="/services/' + c.categorySlug + '/' + c.citySlug + '">' + esc(c.cityName) + ' (' + c.count + ')</a>').join('') + '</p>';
    return this.layout({
      title: label + ' – Verified Professionals by City | HelperNear',
      description: 'Find verified ' + label.toLowerCase() + ' in ' + combos.map((c) => c.cityName).slice(0, 5).join(', ') + ' and more on HelperNear.',
      canonical,
      body,
    });
  }

  async renderIndex(base: string): Promise<string> {
    const combos = await this.getCombos();
    const byCat = new Map<string, Combo[]>();
    combos.forEach((c) => byCat.set(c.categorySlug, [...(byCat.get(c.categorySlug) ?? []), c]));
    const sections = [...byCat.values()].map((list) =>
      '<h2><a href="/services/' + list[0].categorySlug + '">' + esc(list[0].categoryName) + '</a></h2><p class="links">' +
      list.map((c) => '<a href="/services/' + c.categorySlug + '/' + c.citySlug + '">' + esc(c.cityName) + ' (' + c.count + ')</a>').join('') + '</p>').join('');
    const body = '<h1>Verified local services</h1><p class="lead">Browse trusted professionals by category and city.</p>' +
      (sections || '<p>No listings yet &mdash; check back soon.</p>');
    return this.layout({
      title: 'Verified Local Services by City | HelperNear',
      description: 'Plumbers, electricians, maids, AC repair and more. Browse verified local workers by category and city on HelperNear.',
      canonical: base + '/services',
      body,
    });
  }

  async renderSitemap(base: string): Promise<string> {
    const combos = await this.getCombos();
    const urls = new Set<string>([base + '/', base + '/services']);
    combos.forEach((c) => {
      urls.add(base + '/services/' + c.categorySlug);
      urls.add(base + '/services/' + c.categorySlug + '/' + c.citySlug);
    });
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      [...urls].map((u) => '  <url><loc>' + esc(u) + '</loc></url>').join('\n') + '\n</urlset>\n';
  }
}

const CSS = [
  ':root{--o:#FF6B35;--t:#1f2937;--m:#6b7280;--b:#e5e7eb;--bg:#fafafa}',
  '*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--t);background:var(--bg);line-height:1.5}',
  'header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:#fff;border-bottom:1px solid var(--b)}',
  '.brand{font-weight:800;font-size:1.2rem;color:var(--o);text-decoration:none}nav a{margin-left:14px;color:var(--t);text-decoration:none;font-size:.9rem}',
  'a.cta{background:var(--o);color:#fff;padding:8px 14px;border-radius:8px;font-weight:600}a.cta.big{display:inline-block;margin-top:8px;padding:12px 20px}',
  'main{max-width:880px;margin:0 auto;padding:20px 16px 40px}h1{font-size:1.7rem;margin:.4rem 0}h2{font-size:1.2rem;margin:1.6rem 0 .6rem}',
  '.lead{color:var(--m);margin:.2rem 0 1.2rem}.crumbs{font-size:.8rem;color:var(--m)}.crumbs a{color:var(--m)}',
  '.grid{display:grid;gap:12px}.card{display:flex;gap:12px;background:#fff;border:1px solid var(--b);border-radius:12px;padding:14px;text-decoration:none;color:inherit}',
  '.card:hover{border-color:var(--o)}.avatar{width:48px;height:48px;border-radius:50%;background:var(--o);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0}',
  '.card h3{margin:0;font-size:1rem}.ok{font-size:.68rem;background:#dcfce7;color:#15803d;padding:2px 7px;border-radius:99px;margin-left:6px;vertical-align:middle}',
  '.meta{margin:.2rem 0;color:var(--m);font-size:.85rem}.bio{margin:.3rem 0 0;font-size:.88rem}',
  '.links{display:flex;flex-wrap:wrap;gap:8px}.links a{background:#fff;border:1px solid var(--b);border-radius:99px;padding:6px 14px;text-decoration:none;color:var(--t);font-size:.9rem}',
  '.how ol{padding-left:1.2rem;color:var(--m)}footer{text-align:center;color:var(--m);font-size:.8rem;padding:20px}',
].join('');
