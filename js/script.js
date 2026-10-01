/* ============================================================
   JYM CULTURE GYM & SPA — Shared interactions
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Sticky header ---------- */
  var header = document.querySelector('.header');
  function onScroll() {
    if (!header) return;
    if (window.scrollY > 30) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile nav ---------- */
  var toggle = document.querySelector('.nav__toggle');
  var links = document.querySelector('.nav__links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      toggle.classList.toggle('open');
      links.classList.toggle('open');
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        toggle.classList.remove('open');
        links.classList.remove('open');
      });
    });
  }

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }
  /* Safety net: never leave content hidden if the observer misses anything (republish) */
  window.addEventListener('load', function () {
    setTimeout(function () {
      revealEls.forEach(function (el) { el.classList.add('in'); });
    }, 1200);
  });

  /* ---------- Animated counters ---------- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-target'));
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var suffix = el.getAttribute('data-suffix') || '';
    var dur = 1600;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = target * eased;
      el.textContent = val.toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target.toFixed(decimals) + suffix;
    }
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll('[data-target]');
  if (counters.length) {
    if ('IntersectionObserver' in window) {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            animateCount(e.target);
            cio.unobserve(e.target);
          }
        });
      }, { threshold: 0.5 });
      counters.forEach(function (c) { cio.observe(c); });
    } else {
      counters.forEach(animateCount);
    }
  }

  /* ---------- Interactive class cards ---------- */
  document.querySelectorAll('.class-card').forEach(function (card) {
    card.addEventListener('click', function () {
      card.classList.toggle('open');
    });
  });

  /* ---------- Gallery lightbox ---------- */
  var galleryItems = Array.prototype.slice.call(document.querySelectorAll('.gallery__item'));
  var lightbox = document.querySelector('.lightbox');
  if (galleryItems.length && lightbox) {
    var lbImg = lightbox.querySelector('img');
    var current = 0;
    var srcs = galleryItems.map(function (it) {
      var im = it.querySelector('img');
      return im ? im.getAttribute('src') : '';
    });
    function show(i) {
      current = (i + srcs.length) % srcs.length;
      lbImg.setAttribute('src', srcs[current]);
    }
    galleryItems.forEach(function (it, i) {
      it.addEventListener('click', function () {
        show(i);
        lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
      });
    });
    function close() {
      lightbox.classList.remove('open');
      document.body.style.overflow = '';
    }
    var closeBtn = lightbox.querySelector('.lightbox__close');
    var prevBtn = lightbox.querySelector('.lightbox__nav.prev');
    var nextBtn = lightbox.querySelector('.lightbox__nav.next');
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (prevBtn) prevBtn.addEventListener('click', function (e) { e.stopPropagation(); show(current - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function (e) { e.stopPropagation(); show(current + 1); });
    /* Single-image gallery: no need for prev/next controls */
    if (srcs.length <= 1) {
      if (prevBtn) prevBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';
    }
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });
  }

  /* ---------- Testimonial slider ---------- */
  var slider = document.querySelector('.slider');
  if (slider) {
    var track = slider.querySelector('.slider__track');
    var slides = slider.querySelectorAll('.slide');
    var dotsWrap = slider.querySelector('.slider__dots');
    var idx = 0;
    var timer = null;
    function go(i) {
      idx = (i + slides.length) % slides.length;
      track.style.transform = 'translateX(' + (-idx * 100) + '%)';
      if (dotsWrap) {
        dotsWrap.querySelectorAll('button').forEach(function (b, bi) {
          b.classList.toggle('active', bi === idx);
        });
      }
    }
    if (dotsWrap) {
      slides.forEach(function (_, i) {
        var b = document.createElement('button');
        b.setAttribute('aria-label', 'Go to testimonial ' + (i + 1));
        b.addEventListener('click', function () { go(i); restart(); });
        dotsWrap.appendChild(b);
      });
    }
    var p = slider.querySelector('.slider__arrow.prev');
    var n = slider.querySelector('.slider__arrow.next');
    if (p) p.addEventListener('click', function () { go(idx - 1); restart(); });
    if (n) n.addEventListener('click', function () { go(idx + 1); restart(); });
    function start() { timer = setInterval(function () { go(idx + 1); }, 6000); }
    function restart() { clearInterval(timer); start(); }
    go(0);
    start();
    slider.addEventListener('mouseenter', function () { clearInterval(timer); });
    slider.addEventListener('mouseleave', start);
  }

  /* ---------- Enquiry / booking form ---------- */
  var form = document.querySelector('#enquiry-form');
  if (form) {
    var success = form.querySelector('.form__success');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = true;
      form.querySelectorAll('[required]').forEach(function (input) {
        var field = input.closest('.field');
        var ok = input.value.trim() !== '';
        if (ok && input.type === 'email') ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
        if (ok && input.type === 'tel') ok = input.value.replace(/\D/g, '').length >= 10;
        if (field) field.classList.toggle('error', !ok);
        if (!ok) valid = false;
      });
      if (!valid) {
        var firstErr = form.querySelector('.field.error input, .field.error select, .field.error textarea');
        if (firstErr) firstErr.focus();
        return;
      }
      sendEnquiry();
    });
    form.querySelectorAll('input,select,textarea').forEach(function (input) {
      input.addEventListener('input', function () {
        var field = input.closest('.field');
        if (field) field.classList.remove('error');
      });
    });

    /* ---------- Backend settings ---------- */
    /* window.JYM_API_BASE is set in the page <head>. "" = same origin. */
    function apiEndpoint() {
      var base = (window.JYM_API_BASE || '').replace(/\/$/, '');
      return base + '/api/enquiries';
    }

    function errorBox() {
      return form.querySelector('#form-error');
    }

    function showError(html, timeout) {
      var box = errorBox();
      if (!box) return;
      box.innerHTML = html;
      box.classList.add('show');
      if (timeout) setTimeout(function () { box.classList.remove('show'); }, timeout);
    }

    function hideError() {
      var box = errorBox();
      if (box) box.classList.remove('show');
    }

    /* Build the JSON payload from the form's own fields. */
    function payloadFromForm() {
      function val(sel) {
        var el = form.querySelector(sel);
        return el ? el.value.trim() : '';
      }

      var trialWanted = val('#program').toLowerCase().indexOf('free') !== -1;

      return {
        name: val('#name'),
        phone: val('#phone'),
        email: val('#email'),
        program: val('#program'),
        time: val('#time'),
        message: val('#message'),
        plan: val('#plan') || undefined,
        trial: trialWanted,
        zumba: val('#time') === 'Zumba class (6:00 PM)',
        source: 'website-contact-form'
      };
    }

    /* POST the enquiry to the backend and reflect the real result. */
    function sendEnquiry() {
      var submitBtn = form.querySelector('button[type="submit"]');
      var originalLabel = submitBtn ? submitBtn.innerHTML : '';

      hideError();
      if (success) success.classList.remove('show');

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('is-loading');
        submitBtn.innerHTML = 'Sending...';
      }

      fetch(apiEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payloadFromForm())
      })
        .then(function (res) {
          return res
            .json()
            .catch(function () { return {}; })
            .then(function (body) { return { ok: res.ok, status: res.status, body: body }; });
        })
        .then(function (result) {
          if (result.ok && result.body && result.body.success) {
            onSuccess(result.body);
          } else {
            onFailure(result.body, result.status);
          }
        })
        .catch(function () {
          onFailure(null, 0);
        })
        .then(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('is-loading');
            submitBtn.innerHTML = originalLabel;
          }
        });
    }

    function onSuccess(body) {
      var ref = body && body.data && body.data.id ? ' Reference: ' + body.data.id : '';
      if (success) {
        success.classList.add('show');
        success.textContent =
          '✓ ' + ((body && body.message) || 'Thanks! Your enquiry is in.') + ref;
      }
      form.reset();
      setTimeout(function () { if (success) success.classList.remove('show'); }, 12000);
    }

    function onFailure(body, status) {
      var message = 'We could not send your enquiry right now.';
      var details = body && body.error && body.error.details;

      /* Map the server's per-field errors onto the matching inputs. */
      if (details && details.length) {
        details.forEach(function (d) {
          var input = form.querySelector('[name="' + d.field + '"]');
          var field = input ? input.closest('.field') : null;
          if (field) {
            field.classList.add('error');
            var err = field.querySelector('.field__err');
            if (err) err.textContent = d.message;
          }
        });
        message = body.error.message || 'Please correct the highlighted fields.';
      } else if (status === 0) {
        message = 'Could not reach the server.';
      } else if (body && body.error && body.error.message) {
        message = body.error.message;
      }

      var fallback =
        ' Please call <a href="tel:9996224486">9996224486</a> and we will book you in directly.';
      showError('⚠ ' + message + fallback, 15000);
    }

    /* ---------- Deep links: contact.html?plan=12m or ?trial=1 or ?zumba=1 ---------- */
    (function applyDeepLink() {
      var params;
      try {
        params = new URLSearchParams(window.location.search);
      } catch (_) {
        return;
      }

      var programEl = form.querySelector('#program');
      var planEl = form.querySelector('#plan');
      var timeEl = form.querySelector('#time');

      var plan = params.get('plan');
      if (plan && planEl) {
        planEl.value = plan;
        if (programEl && !programEl.value) programEl.value = 'Summer Offer Package';
      }

      if (params.get('trial') && programEl && !programEl.value) {
        programEl.value = 'Free 1-Day Trial';
      }

      if (params.get('zumba') && timeEl) {
        timeEl.value = 'Zumba class (6:00 PM)';
      }
    })();
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
