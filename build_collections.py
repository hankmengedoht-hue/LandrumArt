import json, os, shutil
from datetime import date

SITE   = 'https://landrumcauthen.com'
TODAY  = date.today().isoformat()
ARTIST = 'Capers Landrum Cauthen'

def esc(s):
    if not s: return ''
    return (str(s).replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;'))

def fmt_price(price):
    if price is None: return ''
    try:
        n = float(str(price).replace('$','').replace(',',''))
        return ('$' + f'{n:,.0f}') if n == int(n) else ('$' + f'{n:,.2f}')
    except: return str(price)

def load_dir(d):
    items = []
    if not os.path.isdir(d): return items
    for f in sorted(os.listdir(d)):
        if f.endswith('.json') and f != 'manifest.json':
            with open(os.path.join(d, f), encoding='utf-8') as fh:
                try:
                    item = json.load(fh); item['_slug'] = f.replace('.json',''); items.append(item)
                except: pass
    return items

artworks    = load_dir('_data/artworks')
collections = load_dir('_data/collections')
published_artworks = [a for a in artworks if a.get('published') is not False]

HOME_SVG = '<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>'

def nav_html():
    home  = f'<a href="/index.html" class="nav-link nav-home" aria-label="Home">{HOME_SVG}</a>'
    links = '<a href="/gallery.html" class="nav-link">Gallery</a><a href="/collections.html" class="nav-link">Collections</a><a href="/shop.html" class="nav-link">Shop</a><a href="/about.html" class="nav-link">About</a>'
    cta   = '<a href="/contact.html" class="nav-link nav-link-cta">Contact</a>'
    return f"""
<header class="site-header scrolled" id="site-header">
  <div class="container nav-inner">
    <a href="/index.html" class="logo">
      <span class="logo-name">{ARTIST}</span>
      <span class="logo-sub">Fine Art</span>
    </a>
    <nav class="main-nav" id="main-nav" aria-label="Main navigation">
      {home}{links}{cta}
    </nav>
    <button class="hamburger" id="hamburger" aria-label="Open menu">
      <span></span><span></span><span></span>
    </button>
  </div>
</header>"""

def footer_html():
    return f"""
<footer class="site-footer">
  <div class="container footer-inner">
    <div class="footer-brand">
      <a href="/index.html" class="logo">
        <span class="logo-name">{ARTIST}</span>
        <span class="logo-sub">Fine Art</span>
      </a>
      <p class="footer-tagline" data-cms="tagline">Original paintings and fine art prints from the American Lowcountry.</p>
    </div>
    <div class="footer-col"><h5>Gallery</h5>
      <a href="/gallery.html">All Artworks</a>
      <a href="/collections.html">Collections</a>
    </div>
    <div class="footer-col"><h5>Artist</h5>
      <a href="/about.html">About</a>
      <a href="/contact.html">Contact</a>
    </div>
    <div class="footer-col"><h5>Connect</h5>
      <a href="#" data-cms="instagram">Instagram</a>
      <a href="#" data-cms="facebook">Facebook</a>
    </div>
  </div>
  <div class="footer-bottom container">
    <p>&copy; {date.today().year} {ARTIST}. All rights reserved.</p>
  </div>
</footer>"""

LIGHTBOX = """
<div id="lightbox" class="lightbox" role="dialog" aria-modal="true" aria-label="Image lightbox">
  <button class="lightbox-close" onclick="closeLightbox()" aria-label="Close">&times;</button>
  <button class="lightbox-nav lightbox-prev" onclick="lightboxNav(-1)" aria-label="Previous">&#8249;</button>
  <img class="lightbox-img" id="lightbox-img" src="" alt="" />
  <button class="lightbox-nav lightbox-next" onclick="lightboxNav(1)" aria-label="Next">&#8250;</button>
</div>"""

os.makedirs('collection', exist_ok=True)

pub_cols = sorted([c for c in collections if c.get('published') is not False],
                  key=lambda c: (c.get('order', 99), c.get('title', '')))

for c in pub_cols:
    cslug  = c['_slug']
    ctitle = c.get('title', '')
    cdesc  = c.get('description', '')
    cimg   = c.get('banner_image', '')

    col_art = sorted([a for a in published_artworks if a.get('collection') == cslug],
                     key=lambda a: (a.get('order', 99), a.get('title', '')))
    count_s = str(len(col_art)) + (' work' if len(col_art) == 1 else ' works')

    cards = []
    for a in col_art:
        img = a.get('image', '') or ''
        if not img and a.get('gallery_images'):
            gi = a['gallery_images'][0]
            img = gi if isinstance(gi, str) else gi.get('image', '')
        opts    = a.get('purchase_options') or []
        sold    = bool(opts) and all(o.get('available') is False for o in opts)
        prices  = [float(str(o.get('price', 0)).replace('$', '').replace(',', ''))
                   for o in opts if o.get('available') is not False and o.get('price')]
        price_s = fmt_price(min(prices)) if prices else ''
        if sold:
            badge = '<span class="card-badge badge-sold">Sold</span>'
        elif a.get('featured'):
            badge = '<span class="card-badge badge-featured">Featured</span>'
        else:
            badge = ''
        img_html   = (f'<img src="{esc(img)}" alt="{esc(a.get("title", ""))}" loading="lazy" />'
                      if img else '<div class="card-image-placeholder">&#x1F5BC;</div>')
        price_html = (f'<div class="card-price">{"Sold" if sold else price_s}</div>'
                      if (price_s or sold) else '')
        med_year   = ' · '.join(filter(None, [a.get('medium', ''), str(a.get('year', '')) if a.get('year') else '']))
        aslug      = esc(a['_slug'])
        feat_cls   = ' featured' if a.get('featured') else ''
        cards.append(
            f'<article class="artwork-card{feat_cls}" role="link" tabindex="0" '
            f'onclick="openArtworkPanel(\'{aslug}\')" '
            f'onkeydown="if(event.key===\'Enter\')openArtworkPanel(\'{aslug}\')">'
            f'<div class="card-image-wrap">{img_html}{badge}</div>'
            f'<div class="card-info">'
            f'<div class="card-title">{esc(a.get("title", ""))}</div>'
            f'<div class="card-meta">{esc(med_year)}</div>'
            f'{price_html}</div></article>'
        )

    cards_html = '\n'.join(cards) if cards else (
        '<p style="color:var(--muted);text-align:center;padding:4rem 0;grid-column:1/-1;">'
        'No artworks in this collection yet.</p>')
    img_tag   = (f'<img src="{esc(cimg)}" alt="{esc(ctitle)}" id="collection-hero-img" />' if cimg else '')
    desc_html = (f'<p class="detail-description" style="margin-bottom:2.5rem;max-width:65ch">{esc(cdesc)}</p>'
                 if cdesc else '')
    page_url  = f'{SITE}/collection/{cslug}.html'
    og_img    = (SITE + cimg) if cimg else ''
    og_img_tag = f'  <meta property="og:image" content="{esc(og_img)}" />' if og_img else ''

    out = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{esc(ctitle)} &mdash; {esc(ARTIST)}</title>
  <meta name="description" content="{esc(cdesc or 'A collection of paintings by ' + ARTIST + '.')}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="{esc(ctitle)} &mdash; {esc(ARTIST)}" />
  <meta property="og:url" content="{esc(page_url)}" />
{og_img_tag}
  <link rel="canonical" href="{esc(page_url)}" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/style.css" />
</head>
<body data-page="collection" data-slug="{esc(cslug)}">
<a class="skip-to-content" href="#main-content">Skip to main content</a>
{nav_html()}
<main id="main-content">

<div class="collection-hero{' no-image' if not cimg else ''}">
  {img_tag}
  <div class="collection-hero-content">
    <nav aria-label="Breadcrumb" style="margin-bottom:.75rem">
      <a href="/collections.html" style="font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(240,235,227,.5);font-weight:600;transition:color .2s"
         onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='rgba(240,235,227,.5)'">
        &larr; Collections
      </a>
    </nav>
    <h1>{esc(ctitle)}</h1>
    <div class="collection-hero-meta">{esc(count_s)}</div>
  </div>
</div>

<section class="section" style="padding-top:2.5rem">
  <div class="container">
    {desc_html}
    <div class="artwork-grid artwork-grid-md" id="collection-artworks">
      {cards_html}
    </div>
  </div>
</section>

<section class="cta-banner fade-in">
  <div class="container">
    <h2>Explore More Collections</h2>
    <div class="cta-actions">
      <a href="/collections.html" class="btn btn-accent">All Collections</a>
      <a href="/gallery.html" class="btn btn-ghost">Full Gallery</a>
    </div>
  </div>
</section>

</main>
{footer_html()}
{LIGHTBOX}
<script src="/main.js"></script>
</body>
</html>
"""
    with open(f'collection/{cslug}.html', 'w', encoding='utf-8') as fh:
        fh.write(out)
    print(f'Generated: collection/{cslug}.html  ({len(col_art)} artworks)')

print('Done.')
