// ===========================
// UI strings (English / Bangla)
// ===========================
const IS_BN = document.documentElement.lang === 'bn';
const T = IS_BN ? {
  openMenu: 'মেনু খুলুন', closeMenu: 'মেনু বন্ধ করুন',
  pause: 'অটোপ্লে থামান', play: 'অটোপ্লে চালু করুন',
  required: 'অনুগ্রহ করে নাম, যোগাযোগের মাধ্যম ও প্রজেক্টের বিবরণ দিন।',
  copied: 'ব্রিফ কপি হয়েছে। মেসেঞ্জারে পেস্ট করে পাঠিয়ে দিন।',
  notCopied: 'মেসেঞ্জার খুলছে। ফর্মের তথ্য চ্যাটে কপি করে পাঠান।',
  openMessenger: 'মেসেঞ্জার খুলুন ↗',
  brief: ['আসসালামু আলাইকুম, আমি একটি সার্ভিস বুক করতে চাই।', 'সার্ভিস', 'নাম', 'যোগাযোগ', 'বাজেট', 'সময়সীমা', 'বিবরণ', 'এখনো নিশ্চিত নই', '(mjony3.com/bn থেকে পাঠানো)']
} : {
  openMenu: 'Open menu', closeMenu: 'Close menu',
  pause: 'Pause autoplay', play: 'Play autoplay',
  required: 'Please fill in your name, how to reach you, and the project details.',
  copied: 'Brief copied. Paste it into Messenger and press send.',
  notCopied: 'Messenger is opening. Copy your details from the form into the chat.',
  openMessenger: 'Open Messenger ↗',
  brief: ['Hi Miftahul, I would like to book a service.', 'Service', 'Name', 'Contact', 'Budget', 'Timeline', 'Details', 'Not sure yet', '(sent from mjony3.com)']
};

// ===========================
// Theme toggle
// ===========================
const root = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');

function currentTheme() {
  const explicit = root.getAttribute('data-theme');
  if (explicit) return explicit;
  // Site is dark-first: only an explicit light OS preference yields light
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  });
}

// ===========================
// Mobile navigation
// ===========================
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');

function setMenu(open) {
  navMenu.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? T.closeMenu : T.openMenu);
}

if (navToggle && navMenu) {
  navToggle.addEventListener('click', () => setMenu(!navMenu.classList.contains('open')));
  navMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && navMenu.classList.contains('open')) { setMenu(false); navToggle.focus(); }
  });
  document.addEventListener('click', e => {
    if (navMenu.classList.contains('open') && !navMenu.contains(e.target) && !navToggle.contains(e.target)) setMenu(false);
  });
}

// ===========================
// Navbar border on scroll
// ===========================
const navbar = document.getElementById('navbar');
const onScroll = () => navbar && navbar.classList.toggle('scrolled', window.scrollY > 16);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ===========================
// Active nav link
// ===========================
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('main section[id]');

if ('IntersectionObserver' in window && navLinks.length) {
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id);
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => sectionObserver.observe(s));
}

// ===========================
// Reveal on scroll
// ===========================
const revealEls = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealEls.forEach(el => revealObserver.observe(el));
} else {
  revealEls.forEach(el => el.classList.add('visible'));
}

// ===========================
// Footer year
// ===========================
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

// ===========================
// Pointer effects (skipped for touch & reduced motion)
// ===========================
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (finePointer && !reducedMotion) {
  // Cursor-following spotlight on cards
  document.addEventListener('pointermove', e => {
    const card = e.target.closest && e.target.closest('.spot');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  // Hero parallax on floating frames
  const layers = document.querySelectorAll('.hero [data-depth]');
  let raf = 0;
  if (layers.length) {
    document.querySelector('.hero').addEventListener('pointermove', e => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        layers.forEach(el => {
          const d = Number(el.dataset.depth) || 0;
          el.style.setProperty('--px', (-x * d).toFixed(1) + 'px');
          el.style.setProperty('--py', (-y * d).toFixed(1) + 'px');
        });
      });
    }, { passive: true });
  }
}

// ===========================
// Scroll progress bar
// ===========================
const progress = document.getElementById('scroll-progress');
if (progress) {
  const setProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.setProperty('--p', max > 0 ? (window.scrollY / max).toFixed(4) : 0);
  };
  window.addEventListener('scroll', setProgress, { passive: true });
  window.addEventListener('resize', setProgress);
  setProgress();
}

// ===========================
// Solutions filter
// ===========================
const solFilters = document.querySelectorAll('.sol-filter');
const solItems = document.querySelectorAll('#sol-grid .sol');

solFilters.forEach(btn => {
  btn.addEventListener('click', () => {
    const cat = btn.dataset.filter;
    solFilters.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    solItems.forEach(item => {
      item.hidden = cat !== 'all' && item.dataset.cat !== cat;
      if (!item.hidden) item.classList.add('visible');
    });
  });
});

// ===========================
// Booking: preselect service from service cards
// ===========================
document.querySelectorAll('.svc-cta[data-service]').forEach(link => {
  link.addEventListener('click', () => {
    const radio = document.querySelector(`#book-form input[name="service"][value="${CSS.escape(link.dataset.service)}"]`);
    if (radio) radio.checked = true;
  });
});

// ===========================
// Booking: compose brief → clipboard → Messenger
// ===========================
const bookForm = document.getElementById('book-form');
const bookStatus = document.getElementById('book-status');
const MESSENGER_URL = 'https://m.me/miftahuljony2';

if (bookForm) {
  bookForm.addEventListener('submit', async e => {
    e.preventDefault();
    const data = new FormData(bookForm);
    const required = ['name', 'reach', 'details'];
    let firstInvalid = null;
    required.forEach(key => {
      const el = bookForm.elements[key];
      const bad = !String(data.get(key) || '').trim();
      el.classList.toggle('invalid', bad);
      if (bad && !firstInvalid) firstInvalid = el;
    });
    if (firstInvalid) {
      bookStatus.className = 'form-note err';
      bookStatus.textContent = T.required;
      firstInvalid.focus();
      return;
    }

    const [greet, lService, lName, lContact, lBudget, lTimeline, lDetails, notSure, footer] = T.brief;
    const checked = bookForm.querySelector('input[name="service"]:checked');
    const serviceLabel = checked ? checked.nextElementSibling.textContent : data.get('service');
    const brief = [
      greet,
      '',
      `${lService}: ${serviceLabel}`,
      `${lName}: ${data.get('name')}`,
      `${lContact}: ${data.get('reach')}`,
      `${lBudget}: ${data.get('budget') || notSure}`,
      `${lTimeline}: ${data.get('timeline')}`,
      '',
      `${lDetails}: ${data.get('details')}`,
      '',
      footer
    ].join('\n');

    // Open synchronously so popup blockers allow it. ('noopener' as a window feature makes
    // window.open() return null even on success, so sever the opener manually instead.)
    const win = window.open(MESSENGER_URL, '_blank');
    if (win) { try { win.opener = null; } catch (err) {} }
    let copied = false;
    try { await navigator.clipboard.writeText(brief); copied = true; } catch (err) {}

    bookStatus.className = 'form-note ok';
    bookStatus.textContent = copied
      ? T.copied
      : T.notCopied;
    if (!win) {
      bookStatus.innerHTML = `${bookStatus.textContent} <a href="${MESSENGER_URL}" target="_blank" rel="noopener noreferrer">${T.openMessenger}</a>`;
    }
  });
}

// ===========================
// Hero slider
// ===========================
(function heroSlider() {
  const root = document.querySelector('.hero-slider');
  if (!root) return;
  const slides = [...root.querySelectorAll('.slide')];
  const tabs = [...root.querySelectorAll('.slider-tab')];
  const toggleBtn = root.querySelector('[data-toggle]');
  const DURATION = 7000;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let index = 0;
  let timer = 0;
  let startedAt = 0;
  let remaining = DURATION;
  let userPaused = reduce;   // reduced motion: no autoplay until the user presses play
  const holds = new Set();   // temporary pauses: 'hover' | 'focus' | 'hidden' | 'offscreen'

  root.style.setProperty('--dur', DURATION + 'ms');

  function show(next, { restart = true } = {}) {
    next = (next + slides.length) % slides.length;
    if (next === index && restart) { schedule(true); return; }
    const prev = slides[index];
    prev.classList.remove('is-active');
    prev.classList.add('is-leaving');
    setTimeout(() => prev.classList.remove('is-leaving'), 700);

    slides.forEach((slide, i) => {
      const active = i === next;
      slide.classList.toggle('is-active', active);
      slide.toggleAttribute('inert', !active);
      slide.setAttribute('aria-hidden', String(!active));
    });
    tabs.forEach((tab, i) => {
      tab.classList.toggle('is-active', i === next);
      tab.classList.toggle('is-done', i < next);
      tab.setAttribute('aria-selected', String(i === next));
      // restart the CSS progress animation
      const bar = tab.querySelector('.st-bar i');
      if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
    });
    index = next;
    if (restart) schedule(true);
  }

  function schedule(reset) {
    clearTimeout(timer);
    if (reset) remaining = DURATION;
    const held = holds.size > 0;
    const playing = !userPaused && !held;
    root.classList.toggle('is-playing', !userPaused);
    root.classList.toggle('is-paused', userPaused);
    root.classList.toggle('is-hold', held && !userPaused);
    if (!playing) return;
    startedAt = performance.now();
    timer = setTimeout(() => show(index + 1), remaining);
  }

  function setHold(reason, on) {
    if (on === holds.has(reason)) return;
    const wasHeld = holds.size > 0;
    if (on) holds.add(reason); else holds.delete(reason);
    // freeze the remaining time when the first pause reason arrives
    if (on && !wasHeld && !userPaused) remaining = Math.max(0, remaining - (performance.now() - startedAt));
    schedule(false);
  }

  tabs.forEach(tab => tab.addEventListener('click', () => show(Number(tab.dataset.go))));
  root.querySelector('[data-prev]').addEventListener('click', () => show(index - 1));
  root.querySelector('[data-next]').addEventListener('click', () => show(index + 1));
  toggleBtn.addEventListener('click', () => {
    userPaused = !userPaused;
    toggleBtn.setAttribute('aria-label', userPaused ? T.play : T.pause);
    schedule(true);
  });

  // Pause while the pointer or keyboard focus is inside, and when the tab is hidden
  const slidesEl = root.querySelector('.slides');
  slidesEl.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') setHold('hover', true); });
  slidesEl.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') setHold('hover', false); });
  // Pause for keyboard focus only; a mouse click on a control shouldn't stop autoplay forever
  root.addEventListener('focusin', e => { if (e.target.matches(':focus-visible')) setHold('focus', true); });
  root.addEventListener('focusout', e => { if (!root.contains(e.relatedTarget)) setHold('focus', false); });
  document.addEventListener('visibilitychange', () => setHold('hidden', document.hidden));
  // Don't advance (or animate) while the hero is scrolled out of view
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      root.classList.toggle('is-offscreen', !entry.isIntersecting);
      setHold('offscreen', !entry.isIntersecting);
    }).observe(root);
  }

  // Keyboard arrows when the slider has focus
  root.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowRight') show(index + 1);
    if (e.key === 'ArrowLeft') show(index - 1);
  });

  // Touch swipe
  let x0 = null, y0 = null;
  slidesEl.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  slidesEl.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) show(index + (dx < 0 ? 1 : -1));
    x0 = y0 = null;
  }, { passive: true });

  if (userPaused) toggleBtn.setAttribute('aria-label', T.play);
  schedule(true);
})();
