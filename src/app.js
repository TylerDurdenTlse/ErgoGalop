/**
 * ErgoGalop — Moteur de rendu dynamique depuis les données JSON
 */

// Cache pour stocker les JSON chargés (préchargement)
const SITE_DATA = {};

// Précharge tous les JSON connus en parallèle
async function prechargerToutesDonnees() {
  const fichiers = ['entreprise', 'prestations', 'formulaires', 'contenu-site', 'cas-pratiques', 'formations', 'horaires'];
  await Promise.all(fichiers.map(async (nom) => {
    try {
      const res = await fetch(`./data/${nom}.json`);
      SITE_DATA[nom] = res.ok ? await res.json() : null;
    } catch (e) {
      SITE_DATA[nom] = null;
    }
  }));
}

// Charge un fichier JSON depuis le dossier /src/data/ (utilise le cache si disponible)
async function chargerDonnees(nomFichier) {
  if (SITE_DATA.hasOwnProperty(nomFichier)) return SITE_DATA[nomFichier];
  try {
    const reponse = await fetch(`./data/${nomFichier}.json`);
    if (!reponse.ok) throw new Error(`Erreur lors du chargement de ${nomFichier}.json`);
    const json = await reponse.json();
    SITE_DATA[nomFichier] = json;
    return json;
  } catch (erreur) {
    console.error(`[ErgoGalop Data Error] :`, erreur);
    SITE_DATA[nomFichier] = null;
    return null;
  }
}

// 1. Ingestion des données d'entreprise (Header/Footer/Infos clés)
async function initialiserEntreprise() {
  const entreprise = await chargerDonnees('entreprise');
  if (!entreprise) return;

  // Injection du nom de marque et du slogan dans les emplacements prévus
  document.querySelectorAll('[data-info="nom_marque"]').forEach(el => el.textContent = entreprise.nom_marque);
  document.querySelectorAll('[data-info="telephone"]').forEach(el => {
    el.textContent = entreprise.contact.telephone;
    if (el.tagName === 'A') el.href = `tel:${entreprise.contact.telephone}`;
  });
  document.querySelectorAll('[data-info="email"]').forEach(el => {
    el.textContent = entreprise.contact.email;
    if (el.tagName === 'A') el.href = `mailto:${entreprise.contact.email}`;
  });

  // Pied de page / Ancrage local
  const elAncrage = document.getElementById('footer-ancrage');
  if (elAncrage) {
    elAncrage.textContent = `SASU ${entreprise.sasu} — Basée à ${entreprise.siege_social.adresse} (${entreprise.siege_social.code_postal}), intervention en ${entreprise.siege_social.region}.`;
  }
}

// 2. Génération des Cartes de Prestations
async function afficherPrestations() {
  const conteneur = document.getElementById('grid-prestations');
  if (!conteneur) return; // Sécurité si la page actuelle n'a pas cet élément
  const donneesPrestations = await chargerDonnees('prestations');
  if (!donneesPrestations) {
    conteneur.innerHTML = '<p class="text-sm text-slate-600">Aucune prestation trouvée.</p>';
    return;
  }

  conteneur.innerHTML = ''; // Nettoyage du conteneur

  // Cas 1: format ancien (tableau de services)
  if (Array.isArray(donneesPrestations)) {
    donneesPrestations.forEach(service => {
      const carteHTML = `
        <article class="bg-white rounded-xl shadow-md overflow-hidden border border-slate-100 flex flex-col justify-between p-6">
          <div>
            <h3 class="text-xl font-bold text-[#1a365d] mb-2">${service.titre}</h3>
            <p class="text-sm text-slate-500 mb-4">${service.description || ''}</p>
            <p class="text-sm text-slate-500 mb-4">⏱️ Durée : ${service.duree_minutes || service.duree || '—'}</p>
            ${service.etapes ? `<ul class="space-y-2 mb-6 text-sm text-slate-700">${service.etapes.map(item => `<li class="flex items-center gap-2">✓ ${item}</li>`).join('')}</ul>` : ''}
          </div>
          <div class="pt-4 border-t border-slate-100 flex items-center justify-between mt-auto">
            <div>
              <span class="text-2xl font-bold text-[#1a365d]">${service.prix_eure_ttc ?? service.prix ?? ''} ${donneesPrestations.devise || ''}</span>
            </div>
            <a href="reservation.html?service=${service.id}" class="bg-[#2b6cb0] hover:bg-blue-800 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors">Réserver</a>
          </div>
        </article>
      `;
      conteneur.insertAdjacentHTML('beforeend', carteHTML);
    });
    return;
  }

  // Cas 2: format catégorisé { categories: [ { nom, services: [...] } ] }
  if (donneesPrestations.categories && Array.isArray(donneesPrestations.categories)) {
    donneesPrestations.categories.forEach(categorie => {
      (categorie.services || []).forEach(service => {
        const carteHTML = `
          <article class="bg-white rounded-xl shadow-md overflow-hidden border border-slate-100 flex flex-col justify-between p-6">
            <div>
              <div class="flex justify-between items-start mb-4">
                <span class="text-xs font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-full">${categorie.nom}</span>
                ${service.badge ? `<span class="text-xs font-bold text-amber-900 bg-amber-100 px-2,5 py-1 rounded-md">${service.badge}</span>` : ''}
              </div>
              <h3 class="text-xl font-bold text-[#1a365d] mb-2">${service.titre}</h3>
              <p class="text-sm text-slate-500 mb-4">⏱️ Durée : ${service.duree || service.duree_minutes || '—'}</p>
              ${service.inclus ? `<ul class="space-y-2 mb-6 text-sm text-slate-700">${service.inclus.map(item => `<li class="flex items-center gap-2">✓ ${item}</li>`).join('')}</ul>` : ''}
            </div>
            <div class="pt-4 border-t border-slate-100 flex items-center justify-between mt-auto">
              <div>
                <span class="text-2xl font-bold text-[#1a365d]">${service.prix ?? ''} ${donneesPrestations.devise || ''}</span>
              </div>
              <a href="reservation.html?service=${service.id}" class="bg-[#2b6cb0] hover:bg-blue-800 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors">Réserver</a>
            </div>
          </article>
        `;
        conteneur.insertAdjacentHTML('beforeend', carteHTML);
      });
    });
    return;
  }

  // Format non reconnu
  conteneur.innerHTML = '<p class="text-sm text-slate-600">Format de données de prestations non reconnu.</p>';
}

// 3. Génération du Formulaire de Pré-Diagnostic
async function afficherFormulairePrediagnostic() {
  const conteneurForm = document.getElementById('form-prediagnostic');
  if (!conteneurForm) return;

  const configForm = await chargerDonnees('formulaires');
  if (!configForm || !configForm.formulaire_prediagnostic) return;

  const etapes = configForm.formulaire_prediagnostic.etapes;
  conteneurForm.innerHTML = '';

  etapes.forEach(etape => {
    let etapeHTML = `
      <div class="mb-8 p-6 bg-white rounded-xl shadow-sm border border-slate-100">
        <h3 class="text-lg font-bold text-[#1a365d] mb-4 pb-2 border-b border-slate-100">${etape.titre}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    `;

    etape.champs.forEach(champ => {
      const colSpan = champ.type === 'textarea' ? 'md:col-span-2' : '';
      const champObligatoire = champ.requis ? '<span class="text-red-500">*</span>' : '';
      
      etapeHTML += `<div class="${colSpan} flex flex-col gap-1.5">
        <label for="${champ.id}" class="text-sm font-medium text-slate-700">${champ.label} ${champObligatoire}</label>`;

      if (champ.type === 'select') {
        etapeHTML += `
          <select id="${champ.id}" name="${champ.id}" ${champ.requis ? 'required' : ''} class="w-full p-2,5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#2b6cb0] outline-none text-sm">
            <option value="">-- Sélectionnez une option --</option>
            ${champ.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
          </select>`;
      } else if (champ.type === 'textarea') {
        etapeHTML += `
          <textarea id="${champ.id}" name="${champ.id}" rows="3" placeholder="${champ.placeholder || ''}" ${champ.requis ? 'required' : ''} class="w-full p-2,5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#2b6cb0] outline-none text-sm"></textarea>`;
      } else {
        etapeHTML += `
          <input type="${champ.type}" id="${champ.id}" name="${champ.id}" placeholder="${champ.placeholder || ''}" ${champ.requis ? 'required' : ''} class="w-full p-2,5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#2b6cb0] outline-none text-sm">`;
      }

      if (champ.aide) {
        etapeHTML += `<span class="text-xs text-slate-500">${champ.aide}</span>`;
      }

      etapeHTML += `</div>`;
    });

    etapeHTML += `</div></div>`;
    conteneurForm.insertAdjacentHTML('beforeend', etapeHTML);
  });

  // Bouton de soumission
  // Zone sélection date / vérification disponibilités
  conteneurForm.insertAdjacentHTML('beforeend', `
    <div class="mt-6 bg-white p-4 rounded-lg border border-slate-100">
      <label for="rdv-date" class="text-sm font-medium text-slate-700">Date souhaitée pour le rendez-vous</label>
      <div class="mt-2 flex gap-3">
        <input id="rdv-date" type="date" class="p-2 rounded-lg border border-slate-300" />
        <button id="verif-disponibilites" type="button" class="bg-[#2b6cb0] hover:bg-blue-800 text-white font-medium px-4 py-2 rounded-lg">Vérifier disponibilités</button>
      </div>
      <div id="disponibilites-result" class="mt-3 text-sm text-slate-700"></div>
    </div>

    <button type="submit" class="w-full mt-6 bg-[#2b6cb0] hover:bg-blue-800 text-white font-bold py-3.5 px-6 rounded-xl shadow-md transition-all text-center">
      Valider et passer à la prise de rendez-vous
    </button>
  `);

  // Hook pour vérifier disponibilités
  setTimeout(() => {
    const btn = document.getElementById('verif-disponibilites');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const dateInput = document.getElementById('rdv-date');
      const resultEl = document.getElementById('disponibilites-result');
      if (!dateInput || !dateInput.value) {
        resultEl.textContent = 'Veuillez sélectionner une date.';
        return;
      }
      resultEl.textContent = 'Recherche des disponibilités…';
      try {
        const slots = await checkDisponibilitesPourDate(dateInput.value);
        if (!slots || slots.length === 0) {
          resultEl.textContent = 'Aucun créneau disponible sur cette journée.';
        } else {
          // Render as selectable radio buttons
          resultEl.innerHTML = `<div class="text-sm">Sélectionnez un créneau :</div><div class="mt-2 space-y-2">` +
            slots.map((s, i) => `
              <label class="flex items-center gap-3">
                <input type="radio" name="rdv_slot" value="${s}" ${i===0? 'checked' : ''} />
                <span>${s}</span>
              </label>
            `).join('') + `</div>`;
        }
      } catch (e) {
        console.error(e);
        resultEl.textContent = 'Erreur lors de la vérification des disponibilités.';
      }
    });
  }, 300);

  // Submit handler: collect form fields and post to server
  conteneurForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const resultEl = document.getElementById('disponibilites-result');
    const formValues = {};
    // gather fields from config
    etapes.forEach(et => {
      et.champs.forEach(champ => {
        const el = document.getElementById(champ.id);
        if (!el) return;
        if (el.type === 'checkbox') formValues[champ.id] = el.checked;
        else formValues[champ.id] = el.value;
      });
    });

    // date and chosen slot
    const dateInput = document.getElementById('rdv-date');
    const chosen = document.querySelector('input[name="rdv_slot"]:checked');
    if (!dateInput || !dateInput.value) {
      resultEl.textContent = 'Veuillez sélectionner une date avant de soumettre.';
      return;
    }
    const time_range = chosen ? chosen.value : (document.getElementById('disponibilites-result')?.textContent || '');

    // Build payload
    const payload = {
      nom: formValues['nom'] || '',
      prenom: formValues['prenom'] || '',
      email: formValues['email'] || '',
      telephone: formValues['telephone'] || '',
      cheval_nom: formValues['cheval_nom'] || '',
      prestation_souhaitee: formValues['prestation_souhaitee'] || '',
      date: dateInput.value,
      time_range,
      notes: formValues['symptomes_observes'] || ''
    };

    resultEl.textContent = 'Envoi de la réservation…';
    try {
      const resp = await fetch('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await resp.json();
      if (!resp.ok) {
        resultEl.textContent = `Erreur: ${json.error || 'invalide'}`;
        if (json.available) {
          resultEl.innerHTML += `<div class=\"mt-2 text-sm\">Créneaux disponibles: <ul>${json.available.map(a => `<li>${a}</li>`).join('')}</ul></div>`;
        }
        return;
      }
      resultEl.textContent = 'Réservation enregistrée. Un email de confirmation a été envoyé.';
    } catch (e) {
      console.error(e);
      resultEl.textContent = 'Erreur lors de l\'envoi de la réservation.';
    }
  });
}

// Initialisation déplacée vers le handler consolidé en bas du fichier
// (préchargement des JSON puis initialisation des composants)

// Chargement du contenu général (hero, textes) depuis contenu-site.json
async function chargerContenuSite() {
  const json = await chargerDonnees('contenu-site');
  if (!json) return;
  const hero = json.page_accueil?.hero;
  const apropos = json.page_accueil?.a_propos_court;

  if (hero) {
    const titreEl = document.getElementById('hero-titre');
    if (titreEl) titreEl.textContent = hero.titre || titreEl.textContent;
    const sousEl = document.getElementById('hero-sous-titre');
    if (sousEl) sousEl.textContent = hero.sous_titre || '';
    const ctaRes = document.getElementById('cta-reserver');
    if (ctaRes) ctaRes.textContent = hero.cta_reservation || ctaRes.textContent;
    const ctaPres = document.getElementById('cta-prestations');
    if (ctaPres) ctaPres.textContent = hero.cta_prestations || ctaPres.textContent;
    if (hero.titre) document.title = hero.titre + ' — ' + (json.site?.nom || document.title);
  }

  if (apropos) {
    const aproposEl = document.getElementById('a-propos-court');
    if (aproposEl) aproposEl.textContent = apropos.texte || '';
  }
}

// Affiche les cas pratiques si la page contient un conteneur adapté
async function afficherCasPratiques() {
  const conteneur = document.getElementById('cas-pratiques');
  if (!conteneur) return;
  const data = await chargerDonnees('cas-pratiques');
  if (!data) return;

  const items = Array.isArray(data.items) ? data.items : data.cas || [];
  conteneur.innerHTML = '';

  if (!items.length) {
    conteneur.innerHTML = '<p class="text-sm text-slate-600">Aucun cas pratiques disponible pour l\'instant.</p>';
    return;
  }

  items.forEach(item => {
    const article = document.createElement('article');
    article.className = 'bg-white rounded-xl shadow-md p-6 border border-slate-100 mb-4';
    article.innerHTML = `
      <h3 class="text-lg font-bold text-[#1a365d] mb-2">${item.titre || item.nom}</h3>
      <p class="text-sm text-slate-700 mb-3">${item.extrait || item.description || ''}</p>
      ${item.url ? `<a href="${item.url}" class="text-sky-600">En savoir plus</a>` : ''}
    `;
    conteneur.appendChild(article);
  });
}

// Affiche les formations si la page contient un conteneur dédié
async function afficherFormationsPage() {
  const conteneur = document.getElementById('grid-formations');
  if (!conteneur) return;
  const data = await chargerDonnees('formations');
  if (!data) return;

  const formations = Array.isArray(data.formations) ? data.formations : data.items || [];
  conteneur.innerHTML = '';

  if (!formations.length) {
    conteneur.innerHTML = '<p class="text-sm text-slate-600">Aucune formation renseignée pour l\'instant.</p>';
    return;
  }

  formations.forEach(f => {
    const card = document.createElement('article');
    card.className = 'bg-white rounded-xl shadow-md p-6 border border-slate-100';
    card.innerHTML = `
      <h3 class="text-xl font-bold text-[#1a365d] mb-2">${f.titre}</h3>
      <p class="text-sm text-slate-700 mb-4">${f.description || ''}</p>
      <div class="flex items-center justify-between">
        <div class="text-lg font-bold text-[#1a365d]">${f.prix ? f.prix + ' ' + (data.devise || '') : ''}</div>
        <a href="reservation.html?formation=${encodeURIComponent(f.id || f.titre)}" class="bg-[#c5a059] text-[#121212] px-3 py-2 rounded-md">Réserver</a>
      </div>
    `;
    conteneur.appendChild(card);
  });
}

// Démarrage: précharge toutes les données puis initialise les composants visibles
document.addEventListener('DOMContentLoaded', async () => {
  await prechargerToutesDonnees();
  initialiserEntreprise();
  chargerContenuSite();
  afficherPrestations();
  afficherFormulairePrediagnostic();
  afficherCasPratiques();
  afficherFormationsPage();
});

// ---------------- Google Calendar / Disponibilités ----------------
let _gapiInitialized = false;
async function initGoogleClientIfNeeded() {
  if (_gapiInitialized) return;
  const entreprise = SITE_DATA['entreprise'] || await chargerDonnees('entreprise');
  const googleCfg = entreprise?.google;
  if (!googleCfg || !googleCfg.client_id || googleCfg.client_id.includes('YOUR')) {
    // No valid Google config provided — skip initialization
    return;
  }

  return new Promise((resolve, reject) => {
    try {
      gapi.load('client:auth2', async () => {
        try {
          await gapi.client.init({
            apiKey: googleCfg.api_key,
            clientId: googleCfg.client_id,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
            scope: 'https://www.googleapis.com/auth/calendar.readonly'
          });
          _gapiInitialized = true;
          resolve();
        } catch (e) { reject(e); }
      });
    } catch (e) { reject(e); }
  });
}

async function queryFreeBusy(calendarId, timeMinISO, timeMaxISO, timeZone) {
  // Initialize GAPI if possible
  await initGoogleClientIfNeeded();
  if (!_gapiInitialized) return { busy: [] };
  const request = {
    resource: {
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      timeZone: timeZone,
      items: [{ id: calendarId }]
    }
  };
  const resp = await gapi.client.calendar.freebusy.query(request);
  return resp.result.calendars[calendarId] || { busy: [] };
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return (aStart < bEnd) && (bStart < aEnd);
}

function formatTimeRange(startDate, durationMinutes) {
  const end = new Date(startDate.getTime() + durationMinutes * 60000);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(startDate.getHours())}:${pad(startDate.getMinutes())} - ${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

async function checkDisponibilitesPourDate(dateStr) {
  // dateStr: YYYY-MM-DD
  const horaires = SITE_DATA['horaires'] || await chargerDonnees('horaires');
  if (!horaires) return [];
  const entreprise = SITE_DATA['entreprise'] || await chargerDonnees('entreprise');
  const googleCfg = entreprise?.google || {};

  // Map Date.getDay() to french weekday keys
  const dayIndex = new Date(dateStr + 'T00:00').getDay(); // 0=Sun
  const weekdayKeys = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  const key = weekdayKeys[dayIndex];
  const jour = horaires.planning_hebdo?.[key];
  if (!jour || !jour.actif) return [];

  const ouverture = jour.ouverture; // e.g. '09:00'
  const fermeture = jour.fermeture; // e.g. '19:00'
  if (!ouverture || !fermeture) return [];

  const duree = horaires.duree_creneau_minutes || 90;
  const tampon = horaires.tampon_entre_rdv_minutes || 0;
  const step = duree + tampon;

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';

  // Build Date objects for start and end
  const startDay = new Date(`${dateStr}T${ouverture}:00`);
  const endDay = new Date(`${dateStr}T${fermeture}:00`);

  // Generate candidate start times
  const candidates = [];
  for (let t = new Date(startDay); (t.getTime() + duree*60000) <= endDay.getTime(); t = new Date(t.getTime() + step*60000)) {
    candidates.push(new Date(t));
  }

  // If Google calendar is not configured, return all candidates formatted
  // Prefer server-side proxy if available
  try {
    const resp = await fetch(`/api/freebusy?date=${encodeURIComponent(dateStr)}`);
    if (resp.ok) {
      const json = await resp.json();
      return json.available || [];
    }
  } catch (e) {
    // server not available — fallback to client approach
  }

  if (!googleCfg || !googleCfg.calendar_id || (googleCfg.client_id && googleCfg.client_id.includes('YOUR'))) {
    return candidates.map(c => formatTimeRange(c, duree));
  }

  // Query freebusy for the full day window
  const timeMinISO = startDay.toISOString();
  const timeMaxISO = endDay.toISOString();
  const calendarId = googleCfg.calendar_id;

  const fb = await queryFreeBusy(calendarId, timeMinISO, timeMaxISO, tz);
  const busy = fb.busy || [];

  // Filter candidates that overlap any busy period
  const available = candidates.filter(c => {
    const slotStart = c.getTime();
    const slotEnd = slotStart + duree*60000;
    for (const b of busy) {
      const bStart = new Date(b.start).getTime();
      const bEnd = new Date(b.end).getTime();
      if (overlaps(slotStart, slotEnd, bStart, bEnd)) return false;
    }
    return true;
  });

  return available.map(c => formatTimeRange(c, duree));
}