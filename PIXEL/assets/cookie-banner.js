/* ═══════════════════════════════════════════════════════════════
   PIXEL — Bannière de consentement cookies (CNIL-compliant)
   ───────────────────────────────────────────────────────────────
   Principes :
   - Opt-in strict : aucun cookie tiers n'est déposé sans consentement
   - "Refuser" aussi visible que "Accepter" (exigence CNIL 2020)
   - Choix granulaire par finalité
   - Consentement stocké 6 mois
   - API globale : window.PixelCookies

   Usage dans ton HTML :
     <script src="/assets/cookie-banner.js" defer></script>

   Pour brancher les scripts analytics/marketing :
     window.PixelCookies.onConsent('analytics', () => { ... GA4 ... });
     window.PixelCookies.onConsent('marketing', () => { ... Pixel Meta ... });
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const STORAGE_KEY = 'pixel_consent';
  const CONSENT_VERSION = '1.0';
  const CONSENT_DURATION_DAYS = 180; // 6 mois (reco CNIL)

  const CATEGORIES = {
    necessary: {
      label: 'Strictement nécessaires',
      desc: 'Indispensables au fonctionnement du site (panier, session, préférences). Toujours actifs.',
      required: true,
    },
    analytics: {
      label: 'Mesure d\'audience',
      desc: 'Nous aide à comprendre comment le site est utilisé (Google Analytics). Données agrégées.',
      required: false,
    },
    marketing: {
      label: 'Publicité & réseaux sociaux',
      desc: 'Permet d\'afficher des publicités pertinentes et de mesurer nos campagnes (Meta, TikTok, Google Ads).',
      required: false,
    },
  };

  // ─── Stockage du consentement ──────────────────────────────────
  function getConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      // Expiration
      if (data.expiresAt && Date.now() > data.expiresAt) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      // Version obsolète
      if (data.version !== CONSENT_VERSION) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function saveConsent(choices) {
    const data = {
      version: CONSENT_VERSION,
      choices: { necessary: true, ...choices },
      timestamp: Date.now(),
      expiresAt: Date.now() + CONSENT_DURATION_DAYS * 24 * 60 * 60 * 1000,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    dispatchConsent(data.choices);
  }

  // ─── Event dispatch pour les scripts abonnés ──────────────────
  const listeners = { necessary: [], analytics: [], marketing: [] };

  function onConsent(category, callback) {
    if (!listeners[category]) return;
    listeners[category].push(callback);
    // Si déjà consenti, exécuter immédiatement
    const consent = getConsent();
    if (consent && consent.choices[category]) {
      try { callback(); } catch (e) { console.error('[PixelCookies] listener error:', e); }
    }
  }

  function dispatchConsent(choices) {
    Object.keys(choices).forEach(cat => {
      if (choices[cat] && listeners[cat]) {
        listeners[cat].forEach(cb => {
          try { cb(); } catch (e) { console.error('[PixelCookies] listener error:', e); }
        });
      }
    });
    // Event custom pour d'autres scripts
    window.dispatchEvent(new CustomEvent('pixel-consent-updated', { detail: choices }));
  }

  // ─── Styles (injectés dynamiquement) ──────────────────────────
  function injectStyles() {
    if (document.getElementById('pixel-cookie-styles')) return;
    const css = `
#pixel-cookie-banner, #pixel-cookie-modal-overlay {
  font-family: 'Inter', -apple-system, Segoe UI, sans-serif;
  box-sizing: border-box;
}
#pixel-cookie-banner *, #pixel-cookie-modal-overlay * { box-sizing: border-box; }

/* ─── BANNIÈRE ─── */
#pixel-cookie-banner {
  position: fixed; left: 0; right: 0; bottom: 0;
  background: #0A0A0A;
  color: #F5F5F5;
  border-top: 1px solid #1E1E1E;
  z-index: 99998;
  padding: 1.5rem 2rem;
  transform: translateY(100%);
  transition: transform .35s cubic-bezier(.2,.8,.2,1);
  box-shadow: 0 -20px 50px rgba(0,0,0,.4);
}
#pixel-cookie-banner.show { transform: translateY(0); }
#pixel-cookie-banner .inner {
  max-width: 1200px; margin: 0 auto;
  display: grid; grid-template-columns: 1fr auto; gap: 2rem;
  align-items: center;
}
#pixel-cookie-banner .title {
  font-family: 'Space Mono', monospace;
  font-size: .7rem; letter-spacing: .2em;
  color: #FF2D55; text-transform: uppercase; margin-bottom: .4rem;
}
#pixel-cookie-banner .text {
  font-size: .88rem; line-height: 1.55; color: #aaa;
}
#pixel-cookie-banner .text a { color: #F5F5F5; text-decoration: underline; }
#pixel-cookie-banner .text a:hover { color: #FF2D55; }
#pixel-cookie-banner .actions {
  display: flex; gap: .6rem; flex-wrap: wrap; align-items: center;
}
.pc-btn {
  font-family: 'Space Mono', monospace;
  font-size: .65rem; letter-spacing: .15em;
  text-transform: uppercase; padding: .85rem 1.2rem;
  cursor: pointer; border: none;
  transition: opacity .15s, background .15s, color .15s;
  white-space: nowrap;
}
.pc-btn:hover { opacity: .85; }
.pc-btn-primary { background: #F5F5F5; color: #0A0A0A; }
.pc-btn-primary:hover { background: #FF2D55; color: #F5F5F5; opacity: 1; }
.pc-btn-ghost { background: transparent; color: #F5F5F5; border: 1px solid #1E1E1E; }
.pc-btn-ghost:hover { border-color: #F5F5F5; opacity: 1; }
.pc-btn-link { background: transparent; color: #888; padding: .85rem .8rem; }
.pc-btn-link:hover { color: #F5F5F5; opacity: 1; }

/* ─── MODALE DE PRÉFÉRENCES ─── */
#pixel-cookie-modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.7); backdrop-filter: blur(4px);
  z-index: 99999;
  display: none;
  align-items: center; justify-content: center;
  padding: 2rem;
}
#pixel-cookie-modal-overlay.show { display: flex; }
#pixel-cookie-modal {
  background: #0A0A0A; color: #F5F5F5;
  border: 1px solid #1E1E1E;
  width: 100%; max-width: 640px;
  max-height: 85vh; overflow-y: auto;
  padding: 2rem;
}
#pixel-cookie-modal h2 {
  font-family: 'Press Start 2P', 'Space Mono', monospace;
  font-size: 1.1rem; margin-bottom: .5rem;
}
#pixel-cookie-modal .modal-meta {
  font-family: 'Space Mono', monospace;
  font-size: .6rem; letter-spacing: .15em;
  color: #FF2D55; text-transform: uppercase; margin-bottom: 1.5rem;
}
#pixel-cookie-modal .modal-intro {
  font-size: .9rem; line-height: 1.65; color: #aaa; margin-bottom: 1.5rem;
}
.pc-category {
  padding: 1.2rem 0;
  border-top: 1px solid #1E1E1E;
}
.pc-category-head {
  display: flex; justify-content: space-between; align-items: center;
  gap: 1rem; margin-bottom: .5rem;
}
.pc-category-title {
  font-family: 'Space Mono', monospace;
  font-size: .75rem; letter-spacing: .1em;
  text-transform: uppercase; font-weight: 700;
}
.pc-category-desc {
  font-size: .85rem; line-height: 1.55; color: #888;
}
.pc-switch {
  position: relative; width: 44px; height: 22px;
  flex-shrink: 0;
}
.pc-switch input {
  opacity: 0; width: 0; height: 0;
}
.pc-switch-slider {
  position: absolute; inset: 0;
  background: #1E1E1E; border: 1px solid #2a2a2a;
  cursor: pointer; transition: .2s;
}
.pc-switch-slider::before {
  content: ''; position: absolute;
  left: 2px; top: 2px;
  width: 16px; height: 16px;
  background: #888; transition: .2s;
}
.pc-switch input:checked + .pc-switch-slider {
  background: #FF2D55; border-color: #FF2D55;
}
.pc-switch input:checked + .pc-switch-slider::before {
  left: 22px; background: #fff;
}
.pc-switch input:disabled + .pc-switch-slider {
  opacity: .5; cursor: not-allowed;
}
.pc-required-badge {
  font-family: 'Space Mono', monospace;
  font-size: .55rem; letter-spacing: .15em;
  color: #FF2D55; text-transform: uppercase;
  padding: .1rem .5rem;
  border: 1px solid rgba(255,45,85,.3);
  margin-right: .6rem;
}
.pc-modal-actions {
  display: flex; gap: .6rem; flex-wrap: wrap;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #1E1E1E;
}

/* ─── RESPONSIVE ─── */
@media (max-width: 800px) {
  #pixel-cookie-banner { padding: 1.2rem; }
  #pixel-cookie-banner .inner { grid-template-columns: 1fr; gap: 1rem; }
  #pixel-cookie-banner .actions { justify-content: stretch; }
  .pc-btn { flex: 1 1 auto; }
  #pixel-cookie-modal { padding: 1.5rem; }
  #pixel-cookie-modal h2 { font-size: .9rem; }
}
    `;
    const style = document.createElement('style');
    style.id = 'pixel-cookie-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── BANNIÈRE ──────────────────────────────────────────────────
  let bannerEl = null;
  let modalEl = null;

  function buildBanner() {
    if (bannerEl) return bannerEl;
    bannerEl = document.createElement('div');
    bannerEl.id = 'pixel-cookie-banner';
    bannerEl.setAttribute('role', 'dialog');
    bannerEl.setAttribute('aria-label', 'Consentement cookies');
    bannerEl.innerHTML = `
      <div class="inner">
        <div>
          <div class="title">▓ Cookies &amp; vie privée</div>
          <div class="text">
            On utilise des cookies pour faire tourner le site, comprendre comment tu l'utilises,
            et (si tu acceptes) te proposer du contenu pertinent. Tu peux tout accepter, tout refuser,
            ou choisir finalité par finalité. <a href="/legal/politique-cookies.html">En savoir plus</a>.
          </div>
        </div>
        <div class="actions">
          <button class="pc-btn pc-btn-link" data-action="customize">Personnaliser</button>
          <button class="pc-btn pc-btn-ghost" data-action="reject">Tout refuser</button>
          <button class="pc-btn pc-btn-primary" data-action="accept">Tout accepter</button>
        </div>
      </div>
    `;
    document.body.appendChild(bannerEl);

    bannerEl.querySelector('[data-action="accept"]').addEventListener('click', () => acceptAll());
    bannerEl.querySelector('[data-action="reject"]').addEventListener('click', () => rejectAll());
    bannerEl.querySelector('[data-action="customize"]').addEventListener('click', () => openPreferences());
    return bannerEl;
  }

  function showBanner() {
    buildBanner();
    requestAnimationFrame(() => bannerEl.classList.add('show'));
  }

  function hideBanner() {
    if (bannerEl) bannerEl.classList.remove('show');
  }

  // ─── MODALE DE PRÉFÉRENCES ────────────────────────────────────
  function buildModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.id = 'pixel-cookie-modal-overlay';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');

    const consent = getConsent();
    const current = consent ? consent.choices : { necessary: true, analytics: false, marketing: false };

    const categoriesHTML = Object.keys(CATEGORIES).map(key => {
      const cat = CATEGORIES[key];
      const checked = current[key] ? 'checked' : '';
      const disabled = cat.required ? 'disabled' : '';
      return `
        <div class="pc-category">
          <div class="pc-category-head">
            <div class="pc-category-title">
              ${cat.required ? '<span class="pc-required-badge">Requis</span>' : ''}${cat.label}
            </div>
            <label class="pc-switch">
              <input type="checkbox" data-category="${key}" ${checked} ${disabled}>
              <span class="pc-switch-slider"></span>
            </label>
          </div>
          <div class="pc-category-desc">${cat.desc}</div>
        </div>
      `;
    }).join('');

    modalEl.innerHTML = `
      <div id="pixel-cookie-modal">
        <div class="modal-meta">▓ Préférences cookies</div>
        <h2>Tes choix, tes règles</h2>
        <p class="modal-intro">
          Active ou désactive les catégories que tu veux. Les cookies strictement nécessaires
          restent toujours actifs — sans eux, le site ne fonctionne pas. Plus d'infos dans notre
          <a href="/legal/politique-cookies.html" style="color:#FF2D55;">politique cookies</a>.
        </p>
        ${categoriesHTML}
        <div class="pc-modal-actions">
          <button class="pc-btn pc-btn-link" data-action="close">Annuler</button>
          <button class="pc-btn pc-btn-ghost" data-action="reject-all-modal">Tout refuser</button>
          <button class="pc-btn pc-btn-primary" data-action="save">Enregistrer mes choix</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);

    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closePreferences();
    });
    modalEl.querySelector('[data-action="close"]').addEventListener('click', closePreferences);
    modalEl.querySelector('[data-action="reject-all-modal"]').addEventListener('click', () => {
      rejectAll();
      closePreferences();
    });
    modalEl.querySelector('[data-action="save"]').addEventListener('click', () => {
      const choices = {};
      modalEl.querySelectorAll('input[data-category]').forEach(input => {
        choices[input.dataset.category] = input.checked;
      });
      saveConsent(choices);
      hideBanner();
      closePreferences();
    });

    return modalEl;
  }

  function openPreferences() {
    buildModal();
    modalEl.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closePreferences() {
    if (modalEl) modalEl.classList.remove('show');
    document.body.style.overflow = '';
  }

  // ─── Actions rapides ──────────────────────────────────────────
  function acceptAll() {
    saveConsent({ necessary: true, analytics: true, marketing: true });
    hideBanner();
  }
  function rejectAll() {
    saveConsent({ necessary: true, analytics: false, marketing: false });
    hideBanner();
  }

  // ─── API publique ─────────────────────────────────────────────
  window.PixelCookies = {
    openPreferences,
    closePreferences,
    acceptAll,
    rejectAll,
    getConsent,
    onConsent,
    hasConsented: (cat) => {
      const c = getConsent();
      return c && c.choices[cat] === true;
    },
    reset: () => {
      localStorage.removeItem(STORAGE_KEY);
      showBanner();
    },
  };

  // ─── Initialisation ───────────────────────────────────────────
  function init() {
    injectStyles();
    const consent = getConsent();
    if (!consent) {
      showBanner();
    } else {
      // Déclencher les listeners pour les catégories déjà consenties
      dispatchConsent(consent.choices);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
