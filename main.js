/* =====================================================
   CAPERS LANDRUM CAUTHEN — main.js
   Loads content from _data JSON and renders pages.
   ===================================================== */

const SITE_NAME = 'Capers Landrum Cauthen';

// ── STICKY HEADER ──
const header = document.getElementById('site-header');
if (header) {
  const checkScroll = () => header.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', checkScroll, { passive: true });
  checkScroll();
}

// ── HAMBURGER ──
const hamburger = document.getElementById('hamburger');
const mainNav   = document.getElementById('main-nav');
if (hamburger && mainNav) {
  hamburger.addEventListener('click', () => {
    const open = hamburger.classList.toggle('open');
    mainNav.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  mainNav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('click', e => {
    if (!hamburger.contains(e.target) && !mainNav.contains(e.target)) closeMenu();
  });
}
function closeMenu() {
  hamburger?.classList.remove('open');
  mainNav?.classList.remove('open');
  document.body.style.overflow = '';
}

// ── FADE-IN OBSERVER ──
const fadeObserver = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); fadeObserver.unobserve(e.target); } });
}, { threshold: 0.08 });
document.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));

// ── DATA HELPERS ──
async function fetchJSON(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

async function loadAll(dir) {
  const manifest = await fetchJSON(`/_data/${dir}/manifest.json`);
  if (!Array.isArray(manifest) || !manifest.length) return [];
  const items = await Promise.all(manifest.map(f => fetchJSON(`/_data/${dir}/${f}`)));
  return items
    .map((item, i) => item ? { ...item, _slug: manifest[i].replace('.json', '') } : null)
    .filter(Boolean);
}

async function loadSettings() {
  return (await fetchJSON('/_data/pages/settings.json')) || {};
}

// ── FORMATTERS ──
function safeUrl(url) {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : 'https://' + url;
}
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(price) {
  if (price === null || price === undefined || price === '') return '';
  if (typeof price === 'number') {
    return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  const s = String(price).trim();
  return s.startsWith('$') ? s : '$' + s;
}

function minPrice(purchaseOptions) {
  const prices = (purchaseOptions || [])
    .filter(o => o.available !== false && (o.price || o.price === 0))
    .map(o => parseFloat(String(o.price).replace(/[^0-9.]/g, '')))
    .filter(n => !isNaN(n));
  return prices.length ? Math.min(...prices) : null;
}

function isAllSold(purchaseOptions) {
  const opts = purchaseOptions || [];
  return opts.length > 0 && opts.every(o => o.available === false);
}

// ── PANEL DATA STORES ──
const _panelData     = new Map(); // slug → artwork + _colName
const _shopPanelData = new Map(); // slug → shop item

// ── ACTIVE NAV LINK ──
function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(a => {
    const href = a.getAttribute('href') || '';
    a.classList.toggle('active',
      href !== '/' && href !== '/index.html' && path.startsWith(href.replace(/\.html$/, '')) ||
      (path === '/' || path === '/index.html') && (href === '/' || href === '/index.html')
    );
  });
}
setActiveNav();

// ── APPLY SETTINGS (global) ──
async function applySettings() {
  const s = await loadSettings();
  document.querySelectorAll('[data-cms="email"]').forEach(el => {
    if (el.tagName === 'A') el.href = `mailto:${s.email || ''}`;
    el.textContent = s.email || '';
  });
  document.querySelectorAll('[data-cms="tagline"]').forEach(el => {
    el.textContent = s.tagline || '';
  });
  const ig = s.instagram_url;
  const fb = s.facebook_url;
  document.querySelectorAll('[data-cms="instagram"]').forEach(el => {
    el.href = ig || '#';
    el.style.display = ig ? '' : 'none';
  });
  document.querySelectorAll('[data-cms="facebook"]').forEach(el => {
    el.href = fb || '#';
    el.style.display = fb ? '' : 'none';
  });
}

// ── ARTWORK CARD ──
function artworkCard(a, collectionName) {
  const img = a.image || (Array.isArray(a.gallery_images) && a.gallery_images[0]) || '';
  const sold = isAllSold(a.purchase_options);
  const mp   = minPrice(a.purchase_options);

  _panelData.set(a._slug, { ...a, _colName: collectionName || '' });

  const badges = [];
  if (a.featured) badges.push(`<span class="card-badge badge-featured">Featured</span>`);
  if (sold)       badges.push(`<span class="card-badge badge-sold">Sold</span>`);

  return `
    <article class="artwork-card${a.featured ? ' featured' : ''}" role="link" tabindex="0"
      onclick="openArtworkPanel('${esc(a._slug)}')"
      onkeydown="if(event.key==='Enter')openArtworkPanel('${esc(a._slug)}')">
      <div class="card-image-wrap">
        ${img
          ? `<img src="${esc(img)}" alt="${esc(a.title)}" loading="lazy" />`
          : `<div class="card-image-placeholder">🖼</div>`}
        ${badges.join('')}
      </div>
      <div class="card-info">
        ${collectionName ? `<div class="card-collection">${esc(collectionName)}</div>` : ''}
        <div class="card-title">${esc(a.title)}</div>
        <div class="card-meta">${[a.medium, a.year].filter(Boolean).map(esc).join(' · ')}</div>
        ${mp !== null ? `<div class="card-price">${sold ? 'Sold' : fmt(mp)}</div>` : ''}
      </div>
    </article>`;
}

// ── COLLECTION CARD ──
function collectionCard(c, allArtworks) {
  const count = (allArtworks || []).filter(a => a.collection === c._slug && a.published !== false).length;
  return `
    <a class="collection-card" href="/collection/${esc(c._slug)}.html">
      ${c.banner_image
        ? `<img src="${esc(c.banner_image)}" alt="${esc(c.title)}" loading="lazy" />`
        : `<div class="collection-card-placeholder">🎨</div>`}
      <div class="collection-card-overlay">
        <div class="collection-card-title">${esc(c.title)}</div>
        <div class="collection-card-count">${count} work${count !== 1 ? 's' : ''}</div>
      </div>
    </a>`;
}

// ── HOMEPAGE ──
async function initHomepage() {
  const [home, artworks, shopItems] = await Promise.all([
    fetchJSON('/_data/pages/home.json'),
    loadAll('artworks'),
    loadAll('shop-items')
  ]);

  const published = artworks.filter(a => a.published !== false);

  // Hero
  if (home) {
    const h1  = document.getElementById('hero-headline');
    const sub = document.getElementById('hero-sub');
    const bg  = document.getElementById('hero-bg-img');
    if (h1 && home.hero_headline) h1.textContent = home.hero_headline;
    if (sub && home.hero_sub)     sub.textContent = home.hero_sub;
    if (bg && home.hero_image)  { bg.src = home.hero_image; bg.style.display = 'block'; }
  }

  // Stats
  const statA = document.getElementById('stat-artworks');
  if (statA) statA.textContent = published.length || '—';

  // Featured artworks
  const featEl = document.getElementById('featured-artworks');
  if (featEl) {
    const featured = published.filter(a => a.featured).sort((a,b) => (a.title||'').localeCompare(b.title||''));
    const show     = (featured.length ? featured : published.sort((a,b)=>(a.title||'').localeCompare(b.title||''))).slice(0, 6);
    featEl.innerHTML = show.length
      ? show.map(a => artworkCard(a)).join('')
      : '<p style="color:var(--muted);grid-column:1/-1;text-align:center;">No artworks yet.</p>';
  }

  // Shop preview
  const previewSection = document.getElementById('shop-preview-section');
  const previewGrid    = document.getElementById('home-shop-preview');
  if (previewGrid) {
    const shopPub = shopItems
      .filter(i => i.published !== false)
      .sort((a, b) => (a.order || 99) - (b.order || 99))
      .slice(0, 4);
    if (shopPub.length) {
      previewGrid.innerHTML = shopPub.map(shopItemCard).join('');
    } else {
      previewSection?.style.setProperty('display', 'none');
    }
  }

  applySettings();
}

// ── GALLERY PAGE ──
async function initGallery() {
  const [artworks, collections] = await Promise.all([loadAll('artworks'), loadAll('collections')]);
  const published    = artworks.filter(a => a.published !== false);
  const colPublished = collections.filter(c => c.published !== false);
  const colMap       = Object.fromEntries(colPublished.map(c => [c._slug, c.title]));

  // Support ?collection=slug deep-link (e.g. from artwork detail panel)
  const urlCol = new URLSearchParams(window.location.search).get('collection') || 'all';

  let searchVal   = '';
  let activeCol   = urlCol;
  let activeAvail = 'all';
  let sortBy      = 'featured';

  // Collection filter buttons
  const colWrap = document.getElementById('filter-collections');
  if (colWrap) {
    if (!colPublished.length) {
      colWrap.style.display = 'none';
    } else {
      colWrap.innerHTML = colPublished.map(c =>
        `<button class="filter-btn${activeCol === c._slug ? ' active' : ''}" data-col="${esc(c._slug)}">${esc(c.title)}</button>`
      ).join('');
      colWrap.addEventListener('click', e => {
        const btn = e.target.closest('.filter-btn[data-col]');
        if (!btn) return;
        const wasActive = btn.classList.contains('active');
        colWrap.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        if (!wasActive) { btn.classList.add('active'); activeCol = btn.dataset.col; }
        else { activeCol = 'all'; }
        render();
      });
    }
  }

  // Availability buttons — exclusive three-way toggle
  document.querySelectorAll('[data-avail]').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('[data-avail]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeAvail = btn.dataset.avail;
    render();
  }));

  // Search
  document.getElementById('gallery-search')?.addEventListener('input', e => {
    searchVal = e.target.value.toLowerCase();
    render();
  });

  // Sort
  document.getElementById('sort-select')?.addEventListener('change', e => {
    sortBy = e.target.value;
    render();
  });

  function applySort(arr) {
    return [...arr].sort((a, b) => {
      switch (sortBy) {
        case 'featured': {
          if (a.featured !== b.featured) return a.featured ? -1 : 1;
          return (a.title||'').localeCompare(b.title||'');
        }
        case 'newest':  return (b.year||0) - (a.year||0);
        case 'oldest':  return (a.year||0) - (b.year||0);
        case 'title-a': return (a.title||'').localeCompare(b.title||'');
        case 'title-z': return (b.title||'').localeCompare(a.title||'');
        default: return 0;
      }
    });
  }

  function render() {
    const filtered = published.filter(a => {
      if (searchVal) {
        const hay = [a.title, a.medium, a.description, colMap[a.collection]].map(s => (s||'').toLowerCase()).join(' ');
        if (!hay.includes(searchVal)) return false;
      }
      if (activeCol !== 'all' && a.collection !== activeCol) return false;
      if (activeAvail === 'available' && isAllSold(a.purchase_options)) return false;
      if (activeAvail === 'sold' && !isAllSold(a.purchase_options)) return false;
      return true;
    });

    const sorted = applySort(filtered);
    const grid   = document.getElementById('gallery-grid');
    const count  = document.getElementById('gallery-count');

    if (count) count.textContent = `${sorted.length} work${sorted.length !== 1 ? 's' : ''}`;
    if (grid) {
      grid.innerHTML = sorted.length
        ? sorted.map(a => artworkCard(a, colMap[a.collection])).join('')
        : `<div class="gallery-empty">
             <h3>No artworks found</h3>
             <p>Try adjusting your filters or search term.</p>
           </div>`;
    }
  }

  render();
  loadShopSection();
  applySettings();
}

// ── ARTWORK DETAIL PAGE (JS template — fallback for non-generated pages) ──
async function initArtworkPage() {
  let slug = document.body.dataset.slug;
  if (!slug) {
    const p = new URLSearchParams(window.location.search);
    slug = p.get('id') || p.get('slug');
  }
  if (!slug) { showArtworkError(); return; }

  const [artwork, collections] = await Promise.all([
    fetchJSON(`/_data/artworks/${slug}.json`),
    loadAll('collections')
  ]);

  document.getElementById('artwork-loading')?.remove();

  if (!artwork) { showArtworkError(); return; }

  artwork._slug = slug;
  const colMap  = Object.fromEntries(collections.map(c => [c._slug, c.title]));
  renderArtworkDetail(artwork, colMap);
  applySettings();
}

function showArtworkError() {
  const el = document.getElementById('artwork-content');
  if (el) {
    el.style.display = '';
    el.innerHTML = `<div class="container"><div class="gallery-empty" style="padding:6rem 1rem">
      <h3>Artwork Not Found</h3>
      <p>This artwork may have been removed.</p>
      <br><a href="/gallery.html" class="btn btn-ghost">Back to Gallery</a>
    </div></div>`;
  }
}

function renderArtworkDetail(artwork, colMap) {
  const contentEl = document.getElementById('artwork-content');
  if (contentEl) contentEl.style.display = '';

  // Title
  document.title = `${artwork.title} — ${SITE_NAME}`;
  document.getElementById('detail-breadcrumb-title')?.replaceWith(
    Object.assign(document.createElement('span'), { textContent: artwork.title })
  );

  // Collection
  const colTitle = colMap[artwork.collection] || '';
  const colEl    = document.getElementById('detail-collection');
  if (colEl) {
    colEl.innerHTML = colTitle
      ? `<a href="/collection/${esc(artwork.collection)}.html">${esc(colTitle)}</a>`
      : '';
    colEl.style.display = colTitle ? '' : 'none';
  }

  // Title heading
  const titleEl = document.getElementById('detail-title');
  if (titleEl) titleEl.textContent = artwork.title;

  // Specs
  const specsEl = document.getElementById('detail-specs');
  if (specsEl) {
    const specs = [
      ['Medium', artwork.medium],
      ['Dimensions', artwork.dimensions],
      ['Year', artwork.year],
      ['Collection', colTitle]
    ];
    specsEl.innerHTML = specs.filter(([,v]) => v).map(([l,v]) => `
      <div class="detail-spec">
        <div class="detail-spec-label">${esc(l)}</div>
        <div class="detail-spec-value">${esc(String(v))}</div>
      </div>`).join('');
  }

  // Description
  const descEl = document.getElementById('detail-description');
  if (descEl) {
    descEl.textContent = artwork.description || '';
    descEl.style.display = artwork.description ? '' : 'none';
  }

  // Images
  const allImages = [artwork.image, ...(artwork.gallery_images || [])].filter(Boolean);
  const unique    = [...new Set(allImages)];

  const mainWrap  = document.getElementById('detail-main-image');
  const mainImg   = document.getElementById('detail-main-img');
  const thumbsEl  = document.getElementById('detail-thumbs');
  let currentIdx  = 0;

  function setImage(i) {
    currentIdx = i;
    if (mainImg) { mainImg.src = unique[i]; mainImg.alt = artwork.title; }
    thumbsEl?.querySelectorAll('.detail-thumb').forEach((t, idx) =>
      t.classList.toggle('active', idx === i)
    );
  }

  if (unique.length) setImage(0);

  if (thumbsEl && unique.length > 1) {
    thumbsEl.innerHTML = unique.map((img, i) => `
      <div class="detail-thumb${i===0?' active':''}" tabindex="0"
        onclick="setThumb(${i})"
        onkeydown="if(event.key==='Enter')setThumb(${i})">
        <img src="${esc(img)}" alt="${esc(artwork.title)} view ${i+1}" loading="lazy" />
      </div>`).join('');
  } else if (thumbsEl) {
    thumbsEl.style.display = 'none';
  }

  window.setThumb = setImage;

  if (mainWrap) {
    mainWrap.addEventListener('click', () => openLightbox(unique, currentIdx));
  }

  // Purchase options
  const optsEl = document.getElementById('purchase-options');
  if (optsEl) {
    const opts = artwork.purchase_options || [];
    if (opts.length) {
      optsEl.innerHTML = `<div class="purchase-options-title">Available As</div>` +
        opts.map(o => {
          const avail = o.available !== false;
          return `
            <div class="purchase-option">
              <div class="purchase-option-header">
                <div class="purchase-option-type">${esc(o.type)}</div>
                ${o.price ? `<div class="purchase-option-price">${fmt(o.price)}</div>` : ''}
              </div>
              ${o.description ? `<p class="purchase-option-desc">${esc(o.description)}</p>` : ''}
              <div class="availability-badge ${avail ? 'availability-available' : 'availability-sold'}">
                ${avail ? 'Available' : 'Sold'}
              </div>
              ${avail && o.shopify_url
                ? `<a href="${esc(safeUrl(o.shopify_url))}" target="_blank" rel="noopener noreferrer" class="btn-shopify">Purchase${o.price ? ' — ' + fmt(o.price) : ''}</a>`
                : !avail
                  ? `<button class="btn-sold" disabled>Sold</button>`
                  : '<p style="font-size:.8rem;color:var(--muted)">Contact for purchasing information.</p>'
              }
            </div>`;
        }).join('');
    } else {
      optsEl.innerHTML = `<p class="detail-contact-note">
        Contact for pricing and availability —
        <a href="/contact.html">get in touch</a>.
      </p>`;
    }
  }
}

// ── COLLECTIONS PAGE ──
async function initCollections() {
  const [collections, artworks] = await Promise.all([loadAll('collections'), loadAll('artworks')]);
  const published = collections.filter(c => c.published !== false).sort((a,b)=>(a.order||99)-(b.order||99));
  const artPub    = artworks.filter(a => a.published !== false);
  const grid      = document.getElementById('collections-grid');
  if (grid) {
    grid.innerHTML = published.length
      ? published.map(c => collectionCard(c, artPub)).join('')
      : '<p style="color:var(--muted);grid-column:1/-1;text-align:center;padding:4rem 0;">No collections yet.</p>';
  }
  applySettings();
}

// ── COLLECTION DETAIL (JS template fallback) ──
async function initCollectionPage() {
  let slug = document.body.dataset.slug;
  if (!slug) {
    const p = new URLSearchParams(window.location.search);
    slug = p.get('id') || p.get('slug');
  }
  if (!slug) return;

  const [collection, artworks] = await Promise.all([
    fetchJSON(`/_data/collections/${slug}.json`),
    loadAll('artworks')
  ]);

  if (!collection) return;
  collection._slug = slug;

  // Hero image
  const heroImg = document.getElementById('collection-hero-img');
  if (heroImg) {
    if (collection.banner_image) { heroImg.src = collection.banner_image; heroImg.style.display = ''; }
    else heroImg.closest('.collection-hero')?.classList.add('no-image');
  }

  // Title
  const titleEl = document.getElementById('collection-title');
  if (titleEl) titleEl.textContent = collection.title;

  document.title = `${collection.title} — ${SITE_NAME}`;

  // Description
  const descEl = document.getElementById('collection-description');
  if (descEl) {
    descEl.textContent = collection.description || '';
    descEl.style.display = collection.description ? '' : 'none';
  }

  // Artworks
  const grid  = document.getElementById('collection-artworks');
  const count = document.getElementById('collection-count');
  if (grid) {
    const works = artworks
      .filter(a => a.collection === slug && a.published !== false)
      .sort((a,b) => (a.order||99)-(b.order||99));
    if (count) count.textContent = `${works.length} work${works.length!==1?'s':''}`;
    grid.innerHTML = works.length
      ? works.map(a => artworkCard(a, '')).join('')
      : '<p style="color:var(--muted);text-align:center;padding:4rem 0;grid-column:1/-1;">No artworks in this collection yet.</p>';
  }

  applySettings();
}

// ── ABOUT PAGE ──
async function initAbout() {
  const about = await fetchJSON('/_data/pages/about.json');
  if (!about) { applySettings(); return; }

  // Portrait
  const portEl = document.getElementById('about-portrait');
  if (portEl && about.portrait) {
    portEl.innerHTML = `<img src="${esc(about.portrait)}" alt="${esc(about.portrait_alt || 'Artist portrait')}" />`;
  }

  // Text sections
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el && text) { el.textContent = text; }
  };
  setText('about-bio',       about.bio);
  setText('about-statement', about.statement);
  setText('about-process',   about.process);

  // Awards
  const awardsEl = document.getElementById('about-awards');
  if (awardsEl && about.awards?.length) {
    awardsEl.innerHTML = about.awards.map(a => `
      <div class="recognition-item">
        <div class="recognition-year">${esc(String(a.year||''))}</div>
        <div class="recognition-detail">${esc(a.description)}</div>
      </div>`).join('');
    document.getElementById('awards-section')?.style.setProperty('display','');
  }

  // Exhibitions
  const exhibEl = document.getElementById('about-exhibitions');
  if (exhibEl && about.exhibitions?.length) {
    exhibEl.innerHTML = about.exhibitions.map(e => `
      <div class="recognition-item">
        <div class="recognition-year">${esc(String(e.year||''))}</div>
        <div class="recognition-detail">${esc(e.description)}</div>
      </div>`).join('');
    document.getElementById('exhibitions-section')?.style.setProperty('display','');
  }

  applySettings();
}

// ── CONTACT PAGE ──
async function initContact() {
  const s = await loadSettings();
  const emailLink = document.getElementById('contact-email-link');
  if (emailLink && s.email) {
    emailLink.href = `mailto:${s.email}`;
    emailLink.textContent = s.email;
  }
  applySettings();
}

// ── LIGHTBOX ──
let _lbImages = [];
let _lbIdx    = 0;

function openLightbox(images, idx) {
  _lbImages = Array.isArray(images) ? images : [images];
  _lbIdx    = idx ?? 0;
  _updateLightbox();
  const lb = document.getElementById('lightbox');
  if (lb) { lb.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeLightbox() {
  document.getElementById('lightbox')?.classList.remove('open');
  // Keep scroll locked if the detail panel is still open
  if (!document.getElementById('detail-panel')?.classList.contains('open')) {
    document.body.style.overflow = '';
  }
}
function lightboxNav(dir) {
  _lbIdx = (_lbIdx + dir + _lbImages.length) % _lbImages.length;
  _updateLightbox();
}
function _updateLightbox() {
  const img  = document.getElementById('lightbox-img');
  const prev = document.querySelector('.lightbox-prev');
  const next = document.querySelector('.lightbox-next');
  if (img) img.src = _lbImages[_lbIdx] || '';
  const multi = _lbImages.length > 1;
  prev?.classList.toggle('visible', multi);
  next?.classList.toggle('visible', multi);
}

window.openLightbox  = openLightbox;
window.closeLightbox = closeLightbox;
window.lightboxNav   = lightboxNav;

const lbEl = document.getElementById('lightbox');
if (lbEl) {
  lbEl.addEventListener('click', e => { if (e.target === lbEl) closeLightbox(); });
}
document.addEventListener('keydown', e => {
  const panelOpen = document.getElementById('detail-panel')?.classList.contains('open');
  const lbOpen    = lbEl?.classList.contains('open');
  if (e.key === 'Escape') {
    if (lbOpen)    { closeLightbox(); return; }
    if (panelOpen) { closeDetailPanel(); return; }
  }
  if (!lbOpen) return;
  if (e.key === 'ArrowRight') lightboxNav(1);
  if (e.key === 'ArrowLeft')  lightboxNav(-1);
});

// ── DETAIL PANEL ──
let _dpImgs = [];
let _dpIdx  = 0;

function openArtworkPanel(slug) {
  const panel = document.getElementById('detail-panel');
  if (!panel) { window.location = `/artwork/${slug}.html`; return; }

  const data = _panelData.get(slug);
  if (!data)  { window.location = `/artwork/${slug}.html`; return; }

  const allImgs = [data.image, ...(Array.isArray(data.gallery_images) ? data.gallery_images : [])]
    .map(x => (x && typeof x === 'object') ? x.image : x)
    .filter(Boolean);
  _dpImgs = [...new Set(allImgs)];
  _dpIdx  = 0;

  _dpSetMainImage(0);
  _dpBuildThumbs();
  document.getElementById('dp-info').innerHTML = _buildArtworkInfo(data);
  _openDetailPanel(panel);
}

function openShopPanel(slug) {
  const panel = document.getElementById('detail-panel');
  if (!panel) return;

  const data = _shopPanelData.get(slug);
  if (!data) return;

  _dpImgs = data.image ? [data.image] : [];
  _dpIdx  = 0;

  _dpSetMainImage(0);
  document.getElementById('dp-thumbs').innerHTML = '';
  document.getElementById('dp-info').innerHTML = _buildShopInfo(data);
  _openDetailPanel(panel);
}

function _openDetailPanel(panel) {
  panel.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('dp-close')?.focus();

  const mainWrap = document.getElementById('dp-main-image');
  if (mainWrap) {
    mainWrap.onclick = () => { if (_dpImgs.length) openLightbox(_dpImgs, _dpIdx); };
  }
}

function closeDetailPanel() {
  const panel = document.getElementById('detail-panel');
  if (!panel) return;
  panel.classList.remove('open');
  if (!document.getElementById('lightbox')?.classList.contains('open')) {
    document.body.style.overflow = '';
  }
  const mainWrap = document.getElementById('dp-main-image');
  if (mainWrap) mainWrap.onclick = null;
}

function dpSetThumb(i) {
  _dpIdx = i;
  _dpSetMainImage(i);
  document.querySelectorAll('.dp-thumb').forEach((t, idx) => t.classList.toggle('active', idx === i));
}

function _dpSetMainImage(i) {
  const img = document.getElementById('dp-main-img');
  if (img) { img.src = _dpImgs[i] || ''; img.alt = ''; }
}

function _dpBuildThumbs() {
  const el = document.getElementById('dp-thumbs');
  if (!el) return;
  if (_dpImgs.length < 2) { el.innerHTML = ''; return; }
  el.innerHTML = _dpImgs.map((src, i) => `
    <div class="dp-thumb${i === 0 ? ' active' : ''}" tabindex="0"
      onclick="dpSetThumb(${i})"
      onkeydown="if(event.key==='Enter')dpSetThumb(${i})">
      <img src="${esc(src)}" alt="View ${i + 1}" loading="lazy" />
    </div>`).join('');
}

function _buildArtworkInfo(data) {
  const colName = data._colName || '';
  const colSlug = data.collection || '';
  const opts    = data.purchase_options || [];
  const sold    = isAllSold(opts);
  const mp      = minPrice(opts);
  let h = '';

  if (colName) {
    h += `<div class="dp-eyebrow"><a href="/gallery.html?collection=${esc(colSlug)}">${esc(colName)}</a></div>`;
  }

  h += `<div>
    <h2 class="dp-title">${esc(data.title || '')}</h2>`;
  if (mp !== null) {
    h += `<div class="dp-price-summary">${sold ? 'Sold' : fmt(mp)}</div>`;
  }
  h += `</div>`;

  const specs = [
    ['Medium', data.medium],
    ['Dimensions', data.dimensions],
    ['Year', data.year ? String(data.year) : ''],
  ].filter(([, v]) => v);
  if (specs.length) {
    h += `<div class="dp-specs">${specs.map(([l, v]) =>
      `<div class="dp-spec">
        <div class="dp-spec-label">${esc(l)}</div>
        <div class="dp-spec-value">${esc(v)}</div>
      </div>`).join('')}</div>`;
  }

  if (data.description) {
    h += `<p class="dp-desc">${esc(data.description)}</p>`;
  }

  if (opts.length) {
    h += `<div class="dp-options-label">Available As</div><div>`;
    opts.forEach(o => {
      const avail = o.available !== false;
      h += `<div class="dp-option">
        <div class="dp-option-header">
          <div class="dp-option-type">${esc(o.type || '')}</div>
          ${o.price ? `<div class="dp-option-price">${fmt(o.price)}</div>` : ''}
        </div>
        ${o.description ? `<p class="dp-option-desc">${esc(o.description)}</p>` : ''}
        ${avail ? `<span class="dp-avail-badge">Available</span>` : `<span class="dp-sold-badge">Sold</span>`}
        ${avail && o.shopify_url
          ? `<a href="${esc(safeUrl(o.shopify_url))}" target="_blank" rel="noopener noreferrer" class="dp-shop-buy">Purchase${o.price ? ' — ' + fmt(o.price) : ''}</a>`
          : ''}
      </div>`;
    });
    h += `</div>`;
  } else {
    h += `<p class="dp-no-options">Contact for pricing and availability —
      <a href="/contact.html">get in touch</a>.</p>`;
  }

  h += `<div class="dp-footer-actions">
    <a href="/artwork/${esc(data._slug)}.html" class="dp-footer-link">View Full Page →</a>
    <a href="/contact.html" class="dp-footer-link">Contact the Artist</a>
  </div>`;

  return h;
}

function _buildShopInfo(data) {
  const avail = data.available !== false;
  let h = '';
  h += `<div class="dp-eyebrow">Prints &amp; Gifts</div>`;
  h += `<div>
    <h2 class="dp-title" style="font-style:normal;font-weight:400;font-size:clamp(1.3rem,2vw,1.75rem)">${esc(data.name || '')}</h2>
    ${data.price ? `<div class="dp-price-summary">${fmt(data.price)}</div>` : ''}
  </div>`;
  if (data.description) {
    h += `<p class="dp-desc">${esc(data.description)}</p>`;
  }
  if (!avail) {
    h += `<span class="dp-sold-badge">Sold Out</span>`;
  } else if (data.shopify_url) {
    h += `<a href="${esc(safeUrl(data.shopify_url))}" target="_blank" rel="noopener noreferrer" class="dp-buy-cta">
      Buy Now${data.price ? ' — ' + fmt(data.price) : ''}
    </a>`;
  } else {
    h += `<a href="/contact.html" class="dp-buy-cta dp-buy-cta-contact">Inquire to Purchase</a>`;
  }
  h += `<div class="dp-footer-actions">
    <a href="/contact.html" class="dp-footer-link">Questions? Contact the Artist</a>
  </div>`;
  return h;
}

window.openArtworkPanel = openArtworkPanel;
window.openShopPanel    = openShopPanel;
window.closeDetailPanel = closeDetailPanel;
window.dpSetThumb       = dpSetThumb;

document.getElementById('dp-backdrop')?.addEventListener('click', closeDetailPanel);
document.getElementById('dp-close')?.addEventListener('click', closeDetailPanel);

// ── SHOP PAGE ──
async function initShop() {
  const items = await loadAll('shop-items');
  const published = items
    .filter(i => i.published !== false)
    .sort((a, b) => (a.order || 99) - (b.order || 99));

  const grid = document.getElementById('shop-grid');
  if (!grid) return;

  grid.innerHTML = published.length
    ? published.map(shopItemCard).join('')
    : '<p style="color:var(--muted);grid-column:1/-1;text-align:center;padding:4rem 0">No items available yet.</p>';

  applySettings();
}

// ── PRINTS & GIFTS ──
function shopItemCard(item) {
  _shopPanelData.set(item._slug, item);
  const avail = item.available !== false;
  return `
    <div class="shop-card" role="button" tabindex="0"
      onclick="openShopPanel('${esc(item._slug)}')"
      onkeydown="if(event.key==='Enter')openShopPanel('${esc(item._slug)}')">
      <div class="shop-card-image">
        ${item.image
          ? `<img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy" />`
          : `<div class="shop-card-image-placeholder">🎁</div>`}
      </div>
      <div class="shop-card-body">
        <div class="shop-card-name">${esc(item.name)}</div>
        ${item.description ? `<p class="shop-card-desc">${esc(item.description)}</p>` : ''}
        <div class="shop-card-footer">
          ${item.price ? `<div class="shop-card-price">${fmt(item.price)}</div>` : '<div></div>'}
          ${avail
            ? `<span class="btn-shop-buy">View Details</span>`
            : `<span class="shop-card-sold-badge">Sold Out</span>`}
        </div>
      </div>
    </div>`;
}

async function loadShopSection() {
  const items = await loadAll('shop-items');
  const published = items
    .filter(i => i.published !== false)
    .sort((a, b) => (a.order || 99) - (b.order || 99));

  const section = document.getElementById('prints-gifts-section');
  const grid    = document.getElementById('shop-grid');
  if (!grid) return;

  if (!published.length) {
    section?.style.setProperty('display', 'none');
    return;
  }

  grid.innerHTML = published.map(shopItemCard).join('');
}

// ── ROUTE ──
const page = document.body.dataset.page;
switch (page) {
  case 'home':        initHomepage();       break;
  case 'gallery':     initGallery();        break;
  case 'shop':        initShop();           break;
  case 'artwork':     initArtworkPage();    break;
  case 'collections': initCollections();    break;
  case 'collection':  initCollectionPage(); break;
  case 'about':       initAbout();          break;
  case 'contact':     initContact();        break;
  default:            applySettings();      break;
}
