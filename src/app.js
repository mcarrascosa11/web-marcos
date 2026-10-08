(() => {
  // Old single-page links such as /#proyecto/fp-tudela
  const legacy = location.hash.match(/^#(proyecto\/[\w-]+|proyectos|estudio|contacto)$/);
  if (legacy) {
    const [route, slug] = legacy[1].split('/');
    location.replace(slug ? `/proyectos/${slug}/` : { proyectos: '/proyectos', estudio: '/sobre-mi', contacto: '/contacto' }[route]);
    return;
  }

  window.dataLayer = window.dataLayer || [];
  const track = (event, params = {}) => window.dataLayer.push({ event, ...params });

  // ---------- Cookie consent: Google Tag Manager only loads after "Aceptar" ----------
  const CONSENT_KEY = 'consentimiento-cookies';
  const CONSENT_DAYS = 365;
  const banner = document.querySelector('.cookie-banner');

  function readConsent() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONSENT_KEY));
      if (saved && Date.now() - saved.fecha < CONSENT_DAYS * 864e5) return saved.valor;
    } catch {}
    return null;
  }
  function saveConsent(valor) {
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ valor, fecha: Date.now() })); } catch {}
  }
  function deleteAnalyticsCookies() {
    const host = location.hostname;
    const domains = ['', host, `.${host.replace(/^www\./, '')}`];
    document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(name => name.startsWith('_ga')).forEach(name => {
      domains.forEach(domain => { document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`; });
    });
  }
  function loadTagManager() {
    const id = document.documentElement.dataset.gtm;
    if (!id || window.google_tag_manager) return;
    function gtag() { window.dataLayer.push(arguments); }
    gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
  }

  const consent = readConsent();
  if (consent === 'aceptar') loadTagManager();
  else {
    deleteAnalyticsCookies();
    if (!consent) banner.hidden = false;
  }
  banner.addEventListener('click', e => {
    const button = e.target.closest('[data-consent]');
    if (!button) return;
    const previous = readConsent();
    saveConsent(button.dataset.consent);
    banner.hidden = true;
    if (button.dataset.consent === 'aceptar') loadTagManager();
    else {
      deleteAnalyticsCookies();
      if (previous === 'aceptar') location.reload(); // stop the tags already running on this page
    }
  });
  document.querySelectorAll('[data-open-consent]').forEach(b => b.addEventListener('click', () => { banner.hidden = false; }));

  // ---------- Header over full-bleed images ----------
  const header = document.querySelector('header');
  const stage = document.querySelector('.home-stage');
  if (document.body.classList.contains('immersive')) {
    const update = () => {
      const limit = stage ? stage.offsetHeight - header.offsetHeight : 80;
      header.classList.toggle('scrolled', window.scrollY > limit);
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  // ---------- Home carousel ----------
  const dialog = document.querySelector('dialog.lightbox');
  if (stage) {
    const slides = [...stage.querySelectorAll('.original-slide')];
    const dots = [...stage.querySelectorAll('[data-slide]')];
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let current = 0;
    let timer;
    const show = i => {
      current = (i + slides.length) % slides.length;
      slides.forEach((slide, k) => {
        const active = k === current;
        slide.classList.toggle('active', active);
        // Only the visible slide and its neighbours are rendered, so each photo loads shortly before its turn
        slide.classList.toggle('near', !active && (k === (current + 1) % slides.length || k === (current - 1 + slides.length) % slides.length));
        slide.tabIndex = active ? 0 : -1;
        if (active) slide.removeAttribute('aria-hidden');
        else slide.setAttribute('aria-hidden', 'true');
      });
      dots.forEach((dot, k) => dot.setAttribute('aria-current', String(k === current)));
    };
    const restart = () => {
      clearInterval(timer);
      if (reduceMotion) return;
      timer = setInterval(() => { if (!document.hidden && !stage.contains(document.activeElement)) show(current + 1); }, 5000);
    };
    dots.forEach(dot => dot.addEventListener('click', () => { show(+dot.dataset.slide); restart(); }));
    stage.querySelectorAll('[data-direction]').forEach(b => b.addEventListener('click', () => { show(current + +b.dataset.direction); restart(); }));
    document.addEventListener('keydown', e => {
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.target.closest('input, textarea')) { show(current + (e.key === 'ArrowLeft' ? -1 : 1)); restart(); }
    });
    let touchX = 0;
    stage.addEventListener('touchstart', e => { touchX = e.changedTouches[0].screenX; }, { passive: true });
    stage.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].screenX - touchX;
      if (Math.abs(dx) > 60) { show(current + (dx < 0 ? 1 : -1)); restart(); }
    }, { passive: true });
    restart();
  }

  // ---------- Project filters ----------
  const grid = document.querySelector('.grid');
  if (grid) {
    const cards = [...grid.children];
    const buttons = [...document.querySelectorAll('[data-filter]')];
    const count = document.querySelector('.project-count');
    buttons.forEach(button => button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      buttons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      const visible = cards.filter(card => filter === 'Todos' || card.dataset.category === filter);
      grid.replaceChildren(...visible); // re-append so the grid borders (nth-child) stay right
      count.textContent = `${visible.length} ${visible.length === 1 ? 'proyecto' : 'proyectos'}`;
    }));
  }

  // ---------- Project gallery lightbox ----------
  const project = location.pathname.match(/^\/proyectos\/([^/]+)\/?$/)?.[1];
  if (project) track('project_view', { project_slug: project, project_name: document.querySelector('.detail-intro h1')?.textContent.trim() || project });
  if (dialog) {
    const items = [...document.querySelectorAll('.gallery [data-photo]')];
    const big = dialog.querySelector('img');
    let index = 0;
    const show = i => {
      index = (i + items.length) % items.length;
      const source = items[index].querySelector('img');
      big.srcset = source.srcset;
      big.sizes = '100vw';
      big.src = source.src;
      big.alt = source.alt;
    };
    items.forEach((item, i) => item.addEventListener('click', () => {
      show(i);
      dialog.showModal();
      track('project_image_open', { project_slug: project, image_alt: big.alt || undefined });
    }));
    dialog.querySelector('.lb-close').addEventListener('click', () => dialog.close());
    dialog.querySelector('.lb-prev').addEventListener('click', () => show(index - 1));
    dialog.querySelector('.lb-next').addEventListener('click', () => show(index + 1));
    document.addEventListener('keydown', e => {
      if (dialog.open && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) show(index + (e.key === 'ArrowLeft' ? -1 : 1));
    });
  }

  // ---------- Analytics events (only reach Google if Tag Manager was loaded) ----------
  document.addEventListener('click', e => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    const slug = href.match(/^\/proyectos\/([^/]+)\/?$/)?.[1];
    if (slug) track('project_select', { project_slug: slug, project_name: link.dataset.projectTitle || link.textContent.trim() });
    if (href === '/contacto' || href.startsWith('mailto:') || href.startsWith('tel:')) {
      track('contact_click', { link_type: href.startsWith('mailto:') ? 'email' : href.startsWith('tel:') ? 'phone' : 'contact_page' });
    }
  });
})();
