/* ═══════════════════════════════════════════════════════════════
   THE VAULT MARKET — fichier central des produits numérotés
   ───────────────────────────────────────────────────────────────
   Pour ajouter un produit : ajouter un objet dans PIXEL_MARKET.
   Le ticker de la home se met à jour automatiquement.

   Champs obligatoires :
     id          → identifiant unique (slug)
     name        → nom affiché dans le ticker
     collection  → nom de la collection capsule
     retailPrice → prix de vente original (€)
     seriesSize  → nombre total de pièces numérotées
     releaseDate → date de sortie (YYYY-MM-DD)
   ═══════════════════════════════════════════════════════════════ */

const PIXEL_MARKET = [
  {
    id: 'tshirt-origin-noir',
    name: 'ORIGIN NOIR',
    collection: 'ORIGIN',
    retailPrice: 35,
    seriesSize: 100,
    releaseDate: '2026-01-15',
  },
  {
    id: 'tshirt-origin-blanc',
    name: 'ORIGIN BLANC',
    collection: 'ORIGIN',
    retailPrice: 35,
    seriesSize: 100,
    releaseDate: '2026-01-15',
  },
  {
    id: 'pull-origin-ghost',
    name: 'ORIGIN GHOST',
    collection: 'ORIGIN',
    retailPrice: 70,
    seriesSize: 50,
    releaseDate: '2026-02-01',
  },
  {
    id: 'tshirt-rgb-arcade',
    name: 'RGB ARCADE',
    collection: 'RGB',
    retailPrice: 35,
    seriesSize: 150,
    releaseDate: '2026-02-15',
  },
  {
    id: 'tshirt-override-anomalie',
    name: 'OVERRIDE ANOMALIE',
    collection: 'OVERRIDE',
    retailPrice: 35,
    seriesSize: 23,
    releaseDate: '2026-03-01',
  },
  {
    id: 'tshirt-cheat-code',
    name: 'CHEAT CODE',
    collection: 'CHEAT CODE',
    retailPrice: 35,
    seriesSize: 42,
    releaseDate: '2026-04-01',
  },
];

/* ───────────────────────────────────────────────────────────────
   ALGORITHME DE SIMULATION DES PRIX
   Modèle à 4 couches — tout est déterministe par la date :
   le même jour affiche toujours les mêmes prix.

   1. Tendance long terme  → appréciation lente (+30% sur 1 an)
   2. Cycle marché 30j     → oscillation sinusoïdale (±18%)
                             phase différente par collection
   3. Bruit quotidien      → micro-mouvement jour-à-jour (±6%)
   4. Primes fixes         → rareté de série + numéro de série
   ─────────────────────────────────────────────────────────────── */
/* atTimestamp : optionnel. Si fourni, calcule le prix à cette date passée.
   Permet de générer l'historique pour les graphiques. */
function pixelMarketPrice(product, serialNum, atTimestamp) {
  const { retailPrice, seriesSize, releaseDate, id, collection } = product;

  const refTime   = atTimestamp != null ? atTimestamp : Date.now();
  const dayKey    = Math.floor(refTime / 86400000);
  const daysSince = Math.max(0, (refTime - new Date(releaseDate)) / 86400000);

  // 1. Tendance long terme : +30% sur 365 jours, plafond à +50%
  const trend = 1 + Math.min(daysSince / 365 * 0.30, 0.50);

  // 2. Cycle marché : onde sinusoïdale de 30 jours
  //    Phase décalée par collection → chaque collection a son propre rythme
  const phaseOffset = (collection.charCodeAt(0) * 7 + collection.length * 13) % 30;
  const cycle       = Math.sin(((daysSince + phaseOffset) / 30) * 2 * Math.PI);
  const cycleAmp    = 0.18 * (1 - Math.min(seriesSize / 200, 1)); // séries rares oscillent plus fort
  const cycleMult   = 1 + cycle * cycleAmp; // entre ~0.82 et ~1.18

  // 3. Bruit quotidien (déterministe : identique toute la journée)
  const seed      = ((dayKey * 9301) + (id.charCodeAt(0) * 49297) + (serialNum * 233)) % 233280;
  const noise     = (seed / 233280 - 0.5) * 0.12; // ±6%

  // 4. Primes fixes
  //    Rareté de série : séries < 50 pièces ont un plancher plus haut
  const rarityFloor = 1 + (1 - Math.min(seriesSize / 200, 1)) * 0.25;

  //    Numéro de série
  const serialPct  = serialNum / seriesSize;
  const serialMult = serialPct < 0.10 ? 1.35   // #001–#010 → +35%
                   : serialPct < 0.25 ? 1.18   // #011–#025 → +18%
                   : 1.0;

  const price = retailPrice * trend * cycleMult * (1 + noise) * rarityFloor * serialMult;

  // Plancher absolu : jamais en dessous de 90% du prix retail
  return Math.max(Math.round(price), Math.round(retailPrice * 0.90));
}

/* ───────────────────────────────────────────────────────────────
   HISTORIQUE DES PRIX — pour les graphiques
   Génère un tableau de {timestamp, price} sur une période donnée.
   ─────────────────────────────────────────────────────────────── */
function pixelPriceHistory(product, serialNum, periodKey) {
  const now        = Date.now();
  const releaseTs  = new Date(product.releaseDate).getTime();
  const DAY        = 86400000;

  let fromTs, numPoints, stepMs;

  switch (periodKey) {
    case '1J':
      fromTs    = Math.floor(now / DAY) * DAY; // début de journée
      numPoints = 48; stepMs = DAY / 48;       // toutes les 30 min
      break;
    case '1S':
      fromTs    = now - 7  * DAY; numPoints = 56; stepMs = 3 * 60 * 60 * 1000; break;
    case '1M':
      fromTs    = now - 30 * DAY; numPoints = 60; stepMs = 12 * 60 * 60 * 1000; break;
    case '6M':
      fromTs    = now - 182 * DAY; numPoints = 90; stepMs = 2 * DAY; break;
    case '1A':
      fromTs    = now - 365 * DAY; numPoints = 130; stepMs = 3 * DAY; break;
    case 'MAX':
    default:
      fromTs    = Math.max(releaseTs, now - 730 * DAY);
      numPoints = 120; stepMs = Math.max((now - fromTs) / 120, DAY);
  }

  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = fromTs + i * stepMs;
    if (t > now) break;
    if (t < releaseTs) { points.push(null); continue; }

    const basePrice = pixelMarketPrice(product, serialNum, t);

    // Micro-bruit intraday pour 1J/1S (demi-heure → variation ±1.5%)
    let price = basePrice;
    if (periodKey === '1J' || periodKey === '1S') {
      const hKey    = Math.floor(t / stepMs);
      const hSeed   = ((hKey * 3571) + (product.id.charCodeAt(0) * 6131)) % 10000;
      const hNoise  = (hSeed / 10000 - 0.5) * 0.03;
      price = Math.max(Math.round(basePrice * (1 + hNoise)), Math.round(product.retailPrice * 0.90));
    }

    points.push({ t, price });
  }
  return points.filter(Boolean);
}

/* ───────────────────────────────────────────────────────────────
   RENDU DU TICKER
   Appelé automatiquement si #market-ticker-track existe dans la page.
   ─────────────────────────────────────────────────────────────── */
(function renderPixelTicker() {
  const track = document.getElementById('market-ticker-track');
  if (!track) return;

  // Génère 2 entrées par produit (numéro bas + numéro médian)
  const items = [];
  PIXEL_MARKET.forEach(p => {
    const lowSerial = Math.floor(Math.random() * Math.max(1, Math.floor(p.seriesSize * 0.08))) + 1;
    const midSerial = Math.floor(p.seriesSize * 0.4) + Math.floor(Math.random() * p.seriesSize * 0.2);

    [lowSerial, midSerial].forEach(serial => {
      const mkt   = pixelMarketPrice(p, serial);
      const delta = mkt - p.retailPrice;
      const pct   = Math.round((delta / p.retailPrice) * 100);
      items.push({
        label:  `■ ${p.collection} #${String(serial).padStart(3, '0')}`,
        retail: p.retailPrice,
        market: mkt,
        pct,
        up:     delta >= 0,
        sign:   delta >= 0 ? '+' : '',
        arrow:  delta >= 0 ? '▲' : '▼',
      });
    });
  });

  // Dupliqué pour un défilement sans couture
  const allItems = [...items, ...items];

  track.innerHTML = allItems.map(item => `
    <span class="ticker-item">
      <span class="ticker-name">${item.label}</span>
      <span class="ticker-prices">${item.retail}€ <span class="ticker-arrow">→</span> <strong>${item.market}€</strong></span>
      <span class="ticker-delta ${item.up ? 'up' : 'down'}">${item.arrow} ${item.sign}${item.pct}%</span>
    </span>
    <span class="ticker-sep">//</span>
  `).join('');
})();
