/* ============================================================
   Enterprise AI Studio — shared site JS
   Mobile nav, contact forms, readiness checklist, GA4 events.
   ============================================================ */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     STUDIO CONSTANTS — the single place to update contact wiring.
     Forms post to the self-hosted same-origin endpoint below.
  ------------------------------------------------------------------ */
  var CONTACT_ENDPOINT = '/api/inquiry';
  /* Booking link — set BOOKING_URL to the Cal.com URL when the calendar
     exists; an empty string keeps the /contact#form fallback. */
  var BOOKING_URL = '';

  function track(eventName, params) {
    if (typeof window.gtag === 'function') window.gtag('event', eventName, params);
  }

  /* ---------- Analytics consent (Consent Mode v2) ---------- */
  var CONSENT_KEY = 'eas_consent';
  function readConsent() { try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; } }
  function writeConsent(v) { try { localStorage.setItem(CONSENT_KEY, v); } catch (e) {} }
  var consentBar = document.getElementById('consent-bar');
  if (consentBar) {
    var storedConsent = readConsent();
    if (storedConsent !== 'granted' && storedConsent !== 'denied') consentBar.hidden = false;
    consentBar.addEventListener('click', function (e) {
      var cbtn = e.target.closest('[data-consent]');
      if (!cbtn) return;
      var choice = cbtn.getAttribute('data-consent');
      writeConsent(choice);
      if (choice === 'granted' && typeof window.gtag === 'function') {
        window.gtag('consent', 'update', { analytics_storage: 'granted' });
      }
      consentBar.hidden = true;
    });
  }

  /* ---------- Booking links ---------- */
  if (BOOKING_URL) {
    Array.prototype.forEach.call(document.querySelectorAll('a[data-booking-link]'), function (a) {
      a.setAttribute('href', BOOKING_URL);
      a.setAttribute('rel', 'noopener');
    });
  }

  /* ---------- UTM capture (hidden fields on contact forms) ---------- */
  (function () {
    var params = null;
    try { params = new URLSearchParams(window.location.search); } catch (e) { params = null; }
    Array.prototype.forEach.call(document.querySelectorAll('input[data-utm]'), function (input) {
      var key = input.getAttribute('data-utm');
      var val = params ? (params.get(key) || '') : '';
      input.value = val;
    });
  })();

  /* ---------- Mobile nav (hamburger) ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.getElementById('site-menu');
  if (toggle && menu) {
    var focusablesSelector = 'a[href], button:not([disabled])';
    var lastFocused = null;

    function openMenu() {
      lastFocused = document.activeElement;
      toggle.setAttribute('aria-expanded', 'true');
      menu.classList.add('open');
      document.body.classList.add('menu-open');
    }
    function closeMenu(returnFocus) {
      toggle.setAttribute('aria-expanded', 'false');
      menu.classList.remove('open');
      document.body.classList.remove('menu-open');
      if (returnFocus) (lastFocused || toggle).focus();
    }
    toggle.addEventListener('click', function () {
      if (menu.classList.contains('open')) closeMenu(false); else openMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (!menu.classList.contains('open')) return;
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); return; }
      if (e.key === 'Tab') {
        /* focus trap: cycle within toggle + menu links while open */
        var items = [toggle].concat(Array.prototype.slice.call(menu.querySelectorAll(focusablesSelector)));
        if (!items.length) return;
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeMenu(false); /* navigating away */
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 768 && menu.classList.contains('open')) closeMenu(false);
    });
  }

  /* ---------- Contact forms: client validation + async submit ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('form[data-contact-form]'), function (form) {
    var btn = form.querySelector('button[type="submit"]');
    var successEl = form.querySelector('.form-status.success');
    var errorEl = form.querySelector('.form-status.error');
    var btnLabel = btn ? btn.textContent : '';
    var formId = form.getAttribute('data-contact-form') || 'contact';

    function show(el) { if (el) el.classList.add('visible'); }
    function hide(el) { if (el) el.classList.remove('visible'); }

    form.addEventListener('submit', function (evt) {
      evt.preventDefault();
      hide(successEl); hide(errorEl);

      /* Client-side validation: native constraint API with visible messages */
      if (!form.checkValidity()) {
        form.reportValidity();
        track('form_validation_error', { form_id: formId });
        return;
      }

      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      var payload = {};
      var fd = new FormData(form);
      fd.forEach(function (value, key) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
          if (!Array.isArray(payload[key])) payload[key] = [payload[key]];
          payload[key].push(value);
        } else {
          payload[key] = value;
        }
      });
      fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
      }).then(function (res) {
        if (res.ok) {
          show(successEl);
          form.reset();
          track('form_submit', { form_id: formId, status: 'success' });
          if (!form.hasAttribute('data-no-redirect')) window.location.href = '/thank-you';
        } else {
          show(errorEl);
          track('form_submit', { form_id: formId, status: 'error' });
        }
      }).catch(function () {
        show(errorEl);
        track('form_submit', { form_id: formId, status: 'network_error' });
      }).finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = btnLabel; }
      });
    });
  });

  /* ---------- Readiness checklist (resources page) ---------- */
  var checklist = document.getElementById('readiness-checklist-form');
  if (checklist) {
    var boxes = Array.prototype.slice.call(checklist.querySelectorAll('input[type="checkbox"]'));
    var scoreEl = document.getElementById('checklist-score');
    var verdictEl = document.getElementById('checklist-verdict');
    var resetBtn = document.getElementById('checklist-reset');
    var pillarEls = {};
    Array.prototype.forEach.call(document.querySelectorAll('[data-pillar-score]'), function (el) {
      pillarEls[el.getAttribute('data-pillar-score')] = el;
    });

    function verdictFor(total) {
      if (total >= 20) return 'Ready to scope. You can answer most of the hard questions already — a scoping conversation should move fast and a sprint is realistic.';
      if (total >= 12) return 'Nearly there. Most teams land here: solid on two or three pillars with real gaps in the rest. Scoping should start by closing the weakest pillar.';
      return 'Early days. That is normal — it means the first engagement should be scoping or governance groundwork, not a build. Knowing this now saves a stalled project later.';
    }

    function update() {
      var total = 0;
      var perPillar = {};
      boxes.forEach(function (b) {
        var p = b.getAttribute('data-pillar');
        perPillar[p] = perPillar[p] || 0;
        if (b.checked) { total++; perPillar[p]++; }
      });
      if (scoreEl) scoreEl.innerHTML = total + '<span> / 25</span>';
      if (verdictEl) verdictEl.textContent = verdictFor(total);
      /* semantic state: green when ready to scope, amber when early days */
      var results = document.querySelector('.checklist-results');
      if (results) results.setAttribute('data-level', total >= 20 ? 'high' : (total >= 12 ? 'mid' : 'low'));
      Object.keys(pillarEls).forEach(function (p) {
        var n = perPillar[p] || 0;
        var strong = pillarEls[p].querySelector('strong');
        var bar = pillarEls[p].querySelector('.checklist-meter b');
        if (strong) { strong.textContent = n + '/5'; strong.classList.toggle('full', n === 5); }
        if (bar) { bar.style.width = (n * 20) + '%'; bar.classList.toggle('full', n === 5); }
      });
      var totalEl = document.querySelector('[data-score-total]');
      var pillarsEl = document.querySelector('[data-score-pillars]');
      if (totalEl) totalEl.value = String(total);
      if (pillarsEl) pillarsEl.value = JSON.stringify(perPillar);
    }

    checklist.addEventListener('change', function (e) {
      if (e.target && e.target.type === 'checkbox') {
        update();
        track('checklist_toggle', { checked_total: boxes.filter(function (b) { return b.checked; }).length });
      }
    });
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        boxes.forEach(function (b) { b.checked = false; });
        update();
        track('checklist_reset', {});
      });
    }
    update();
  }

  /* ---------- GA4 click tracking ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('a[href]');
    if (!el) return;
    var href = el.getAttribute('href') || '';
    var text = (el.textContent || '').trim();
    var classes = el.className || '';

    if (href.indexOf('mailto:') === 0) {
      track('contact_email_click', { link_text: text });
      return;
    }
    if (classes.indexOf('btn') !== -1) {
      track('cta_click', { cta_text: text, cta_destination: href });
      return;
    }
    if (href === '/contact') {
      var section = el.closest('section');
      track('service_section_click', { link_text: text, source_section: section ? (section.id || 'unknown') : 'unknown' });
    }
  });

  /* ---------- Section visibility (engagement) ---------- */
  if ('IntersectionObserver' in window) {
    var seen = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !seen[entry.target.id]) {
          seen[entry.target.id] = true;
          track('section_view', { section_id: entry.target.id });
        }
      });
    }, { threshold: 0.4 });
    Array.prototype.forEach.call(document.querySelectorAll('section[id]'), function (el) {
      observer.observe(el);
    });
  }
})();
