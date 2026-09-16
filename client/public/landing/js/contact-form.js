(function () {
  'use strict';

  var API_URL = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
    ? '/api/metrics/inquiry'
    : 'https://api.lmsgen.in/api/metrics/inquiry';

  function value(form, name) {
    var field = form.elements[name];
    return field ? String(field.value || '').trim() : '';
  }

  function consentField(form) {
    return form.querySelector('input[type="checkbox"]');
  }

  function setBusy(form, busy) {
    var submit = form.querySelector('input[type="submit"]');
    if (!submit) return;
    if (!submit.dataset.defaultValue) submit.dataset.defaultValue = submit.value;
    submit.disabled = busy;
    submit.value = busy ? 'Sending...' : submit.dataset.defaultValue;
  }

  function showResult(form, ok, message) {
    var wrapper = form.closest('.w-form');
    if (!wrapper) return;
    var done = wrapper.querySelector('.w-form-done');
    var fail = wrapper.querySelector('.w-form-fail');

    if (done) done.style.display = ok ? 'block' : 'none';
    if (fail) {
      fail.style.display = ok ? 'none' : 'block';
      var failText = fail.querySelector('div');
      if (!ok && failText) failText.textContent = message || 'Something went wrong while submitting the form.';
    }
    if (ok) form.style.display = 'none';
  }

  async function submitContact(form) {
    var consent = consentField(form);
    var payload = {
      name: value(form, 'name'),
      email: value(form, 'email'),
      phone: value(form, 'Phone'),
      company: value(form, 'Company'),
      message: value(form, 'Message'),
      website: value(form, 'website'),
      consent: Boolean(consent && consent.checked),
      source: 'LMSGEN Contact page'
    };

    if (!payload.name || !payload.email || !payload.phone) {
      showResult(form, false, 'Please complete your name, email and phone number.');
      return;
    }

    if (!payload.consent) {
      showResult(form, false, 'Please agree to the privacy policy and marketing communications before submitting.');
      if (consent) consent.focus();
      return;
    }

    setBusy(form, true);
    try {
      var response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || data.ok === false) {
        throw new Error(data.message || 'We could not send your message right now.');
      }

      form.reset();
      showResult(form, true);
    } catch (error) {
      showResult(form, false, error && error.message ? error.message : 'We could not send your message right now.');
    } finally {
      setBusy(form, false);
    }
  }

  function initialise() {
    var form = document.getElementById('wf-form-Contact-Form');
    if (!form || form.dataset.smtpWired === 'true') return;
    form.dataset.smtpWired = 'true';
    form.setAttribute('method', 'post');
    form.removeAttribute('action');

    var consent = consentField(form);
    if (consent) {
      var customCheckbox = consent.parentElement && consent.parentElement.querySelector('.ct-form-checkbox');
      var syncConsent = function () {
        if (customCheckbox) customCheckbox.classList.toggle('w--redirected-checked', consent.checked);
        consent.setAttribute('aria-checked', consent.checked ? 'true' : 'false');
      };
      consent.required = true;
      consent.addEventListener('change', syncConsent);
      consent.addEventListener('input', syncConsent);
      syncConsent();
    }

    if (!form.elements.website) {
      var honeypot = document.createElement('input');
      honeypot.type = 'text';
      honeypot.name = 'website';
      honeypot.tabIndex = -1;
      honeypot.autocomplete = 'off';
      honeypot.setAttribute('aria-hidden', 'true');
      honeypot.style.position = 'absolute';
      honeypot.style.left = '-10000px';
      honeypot.style.width = '1px';
      honeypot.style.height = '1px';
      honeypot.style.opacity = '0';
      form.appendChild(honeypot);
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      submitContact(form);
    }, true);

    var arrow = form.querySelector('.ct-form-button-c a.btn-primary.submit.arrow');
    if (arrow) {
      arrow.addEventListener('click', function (event) {
        event.preventDefault();
        if (typeof form.requestSubmit === 'function') form.requestSubmit();
        else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialise, { once: true });
  } else {
    initialise();
  }
})();
