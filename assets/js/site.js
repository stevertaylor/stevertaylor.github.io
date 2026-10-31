// Site behavior: header state, mobile menu, scroll reveals, TOC highlighting, copy-email.
(() => {
  const html = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Failsafe for the hero title sequence, normally started by the font check in head.html.
  setTimeout(() => html.classList.add('fonts-ready'), 2000);

  // Header gains a solid background once the page has scrolled.
  const header = document.querySelector('[data-header]');
  if (header) {
    const update = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  // Mobile menu.
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-mobile-menu]');
  if (toggle && menu) {
    const label = toggle.querySelector('.menu-toggle-label');
    const isOpen = () => html.classList.contains('menu-open');
    const open = () => {
      menu.hidden = false;
      void menu.offsetHeight; // apply display before the transition starts
      html.classList.add('menu-open');
      toggle.setAttribute('aria-expanded', 'true');
      if (label) label.textContent = 'Close';
      const first = menu.querySelector('a');
      if (first) first.focus({ preventScroll: true });
    };
    const close = (returnFocus = true) => {
      html.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      if (label) label.textContent = 'Menu';
      const hide = () => { if (!isOpen()) menu.hidden = true; };
      if (reduceMotion.matches) hide(); else setTimeout(hide, 350);
      if (returnFocus) toggle.focus({ preventScroll: true });
    };
    toggle.addEventListener('click', () => (isOpen() ? close() : open()));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) close(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
    window.matchMedia('(min-width: 881px)').addEventListener('change', (e) => { if (e.matches && isOpen()) close(false); });
  }

  // Reveal sections as they scroll into view. The hidden state is only applied
  // once this script runs, so content never stays invisible if JS fails.
  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length && 'IntersectionObserver' in window && !reduceMotion.matches) {
    html.classList.add('reveal-on');
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealEls.forEach((el) => io.observe(el));
  }

  // Table of contents: mark the section currently being read.
  const tocLinks = [...document.querySelectorAll('.toc a[href^="#"]')];
  if (tocLinks.length) {
    const targets = tocLinks
      .map((a) => [a, document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)))])
      .filter(([, el]) => el);
    let ticking = false;
    const spy = () => {
      ticking = false;
      const line = window.innerHeight * 0.3;
      let current = targets[0];
      for (const t of targets) if (t[1].getBoundingClientRect().top <= line) current = t;
      for (const [a] of targets) a.classList.toggle('is-active', current && a === current[0]);
    };
    spy();
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
  }

  // Copy the email address.
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    const labelEl = btn.querySelector('[data-copy-label]');
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-copy');
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      if (labelEl) {
        labelEl.textContent = 'Copied';
        btn.classList.add('is-copied');
        setTimeout(() => { labelEl.textContent = 'Copy'; btn.classList.remove('is-copied'); }, 1800);
      }
    });
  });
})();
