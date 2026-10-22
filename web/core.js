/* CBN Rapports — cœur de l'application : connexion, navigation, profil, outils communs */
(function () {
  'use strict';

  const CFG = window.CBN_CONFIG;
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  const app = document.getElementById('app');
  const etat = { profil: null, eglises: [], pasteurs: [] };
  const routes = [];

  // ================= Outils =================

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nombre = (n) => new Intl.NumberFormat('fr-FR').format(Number(n) || 0);
  const fcfa = (n) => nombre(n) + ' FCFA';
  const initiales = (nom) => String(nom || '')
    .replace(/^(Apôtre|Pasteur)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2)
    .map((m) => m[0].toUpperCase()).join('');

  const svg = (d, taille = 20, ep = 2) => `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${ep}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONES = {
    lieu: svg('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
    retour: svg('<path d="M15 18l-6-6 6-6"/>'),
    suivant: svg('<path d="M9 18l6-6-6-6"/>'),
    sortir: svg('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>', 20, 1.8),
    crayon: svg('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    envoyer: svg('<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>'),
    coche: svg('<path d="M20 6L9 17l-5-5"/>', 20, 2.2),
    plus: svg('<path d="M12 5v14M5 12h14"/>', 20, 2.2),
    photo: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2A1240" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h3l2-3h8l2 3h3v12H3z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    personne: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    info: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" style="flex:none;color:var(--accent)"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>',
    rapports: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>', 22, 1.8),
    membres: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.6-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.9 2.6 2.6 3 5.2"/>', 22, 1.8),
    finances: svg('<rect x="2.5" y="6" width="19" height="13" rx="2.5"/><path d="M2.5 10h19M16.5 15h2"/>', 22, 1.8),
    agenda: svg('<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>', 22, 1.8),
    menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>', 22, 1.8),
    stats: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', 22, 1.8),
    eglise: svg('<path d="M12 2v5M9.5 4.5h5M5 21V11l7-4 7 4v10M3 21h18M10 21v-4h4v4"/>', 22, 1.8),
    document: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>', 20, 1.8),
    suivi: svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>', 20, 1.8),
    groupe: svg('<circle cx="12" cy="7" r="3"/><circle cx="5" cy="10" r="2.5"/><circle cx="19" cy="10" r="2.5"/><path d="M7 20c.6-3 2.6-5 5-5s4.4 2 5 5M1.5 19c.3-2 1.6-3.5 3.5-3.5M22.5 19c-.3-2-1.6-3.5-3.5-3.5"/>', 20, 1.8),
    profil: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>', 20, 1.8),
    globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>', 20, 1.8),
    cloche: svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>', 20, 1.8),
    lune: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', 20, 1.8),
    soleil: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', 20, 1.8),
    accueil: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>', 22, 1.8),
    ecouter: svg('<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><path d="M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z"/>', 22, 1.8),
    video: svg('<rect x="2.5" y="5.5" width="14" height="13" rx="2.5"/><path d="M16.5 10l5-3v10l-5-3"/>', 20, 1.8),
    lecture: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>',
    pause: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>',
    fermer: svg('<path d="M6 6l12 12M18 6L6 18"/>', 20, 2),
    livre: svg('<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5"/><path d="M12 6v6M9 9h6"/>', 22, 1.8),
    priere: svg('<path d="M12 21s-7.5-4.6-9.4-9.3C1.2 8.3 3.4 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.6 0 5.8 3.8 4.4 7.2C19.5 16.4 12 21 12 21z"/>', 22, 1.8),
    gateau: svg('<path d="M4 21V12a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9M2 21h20M4 15c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 4 0M12 10V7"/><path d="M12 3c.8 1 1 1.8 0 3-1-1.2-.8-2 0-3z"/>', 20, 1.8),
    nuage: svg('<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 1 0 6 16.9"/><path d="M12 12v8M9 17l3 3 3-3"/>', 20, 1.8),
    hors: svg('<path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.2-1.6M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8A15 15 0 0 0 10.7 5M12 20h.01"/>', 18, 1.8),
    oeil: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', 20, 1.8),
    oeilBarre: svg('<path d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.9 0 3.6-.6 5-1.5M9.9 9.9a3 3 0 0 0 4.2 4.2"/>', 20, 1.8),
    image: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>', 22, 1.8),
    whatsapp: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.2-.2-.5-.3z"/></svg>'
  };

  function toast(message) {
    const t = document.getElementById('toast');
    t.textContent = message;
    t.hidden = false;
    clearTimeout(toast.minuteur);
    toast.minuteur = setTimeout(() => { t.hidden = true; }, 3200);
  }

  function messageErreur(err) {
    const m = String((err && (err.message || err.error_description)) || err || '');
    if (/Invalid login credentials/i.test(m)) return 'Numéro ou mot de passe incorrect.';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Pas de connexion Internet. Vérifiez votre réseau puis réessayez.';
    if (/rapports_culte.*unique|duplicate key.*rapports/i.test(m)) return 'Un rapport existe déjà pour ce culte à cette date.';
    if (/duplicate key|unique/i.test(m)) return 'Cet élément existe déjà.';
    if (/row-level security|permission denied/i.test(m)) return 'Vous n’avez pas le droit de faire cette action.';
    if (/Password should be|at least 6/i.test(m)) return 'Le mot de passe doit contenir au moins 6 caractères.';
    if (/same_password|different from the old/i.test(m)) return 'Choisissez un mot de passe différent de l’ancien.';
    return 'Une erreur est survenue : ' + m;
  }

  // Le numéro de téléphone sert d'identifiant : 6XX XX XX XX → 2376XXXXXXXX@domaine
  function emailDepuisTelephone(saisie) {
    let chiffres = String(saisie || '').replace(/\D/g, '');
    if (chiffres.startsWith('00')) chiffres = chiffres.slice(2);
    if (!chiffres.startsWith('237')) chiffres = '237' + chiffres;
    return chiffres + '@' + CFG.DOMAINE_EMAIL;
  }
  function telephoneLisible(t) {
    const c = String(t || '').replace(/\D/g, '');
    if (!c) return '';
    const local = c.startsWith('237') ? c.slice(3) : c;
    return '+237 ' + local.replace(/^(\d{3})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4');
  }
  function telephoneInternational(t) {
    const c = String(t || '').replace(/\D/g, '');
    if (!c) return '';
    return c.startsWith('237') ? c : '237' + c;
  }

  // ----- Dates (heure du Cameroun) -----
  function aujourdhuiISO() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: CFG.FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function versDate(iso) { const [a, m, j] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, j || 1)); }
  function versISO(d) { return d.toISOString().slice(0, 10); }
  function ajouterJours(iso, n) { const d = versDate(iso); d.setUTCDate(d.getUTCDate() + n); return versISO(d); }
  function ecartJours(a, b) { return Math.round((versDate(b) - versDate(a)) / 86400000); }
  function dimancheDeReference() { const iso = aujourdhuiISO(); return ajouterJours(iso, -versDate(iso).getUTCDay()); }
  const fmt = (opts) => new Intl.DateTimeFormat('fr-FR', { ...opts, timeZone: 'UTC' });
  function dateLongue(iso) { return fmt({ day: 'numeric', month: 'long', year: 'numeric' }).format(versDate(iso)); }
  function dateCourte(iso) { return fmt({ day: 'numeric', month: 'long' }).format(versDate(iso)); }
  function dateJour(iso) { return fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(versDate(iso)); }
  function heure(ts) { return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: CFG.FUSEAU }).format(new Date(ts)).replace(':', ' h '); }
  const moisCourant = () => aujourdhuiISO().slice(0, 7);
  function ajouterMois(mois, n) { const d = versDate(mois + '-01'); d.setUTCMonth(d.getUTCMonth() + n); return versISO(d).slice(0, 7); }
  function moisLibelle(mois) { return fmt({ month: 'long', year: 'numeric' }).format(versDate(mois + '-01')); }
  function moisCourt(mois) { return fmt({ month: 'short' }).format(versDate(mois + '-01')).replace('.', ''); }
  function finDeMois(mois) { return ajouterJours(ajouterMois(mois, 1) + '-01', -1); }

  // ----- Petits éléments d'interface -----
  function avatarHTML(profil, classe) {
    const contenu = profil && profil.photo_url ? `<img src="${esc(profil.photo_url)}" alt="">` : esc(initiales(profil && profil.nom));
    return `<span class="avatar ${classe || ''}">${contenu}</span>`;
  }
  function lienProfil(p) {
    return `<a class="avatar" href="#/profil" aria-label="Mon profil">${p.photo_url ? `<img src="${esc(p.photo_url)}" alt="">` : esc(initiales(p.nom))}<span class="badge">${ICONES.photo}</span></a>`;
  }
  function logoRond() { return '<span class="logo-rond"><img src="icon-192.png" alt="Logo CBN"></span>'; }

  // Cloche des notifications (le nombre de non lues s'affiche après chargement)
  function cloche() {
    return `<a class="bouton-rond cloche" href="#/notifications" aria-label="Notifications">${ICONES.cloche}<span class="compte" hidden></span></a>`;
  }
  async function majCloche() {
    if (!etat.profil) return;
    const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).eq('lu', false);
    etat.nonLues = count || 0;
    document.querySelectorAll('.cloche .compte').forEach((s) => {
      s.textContent = etat.nonLues > 9 ? '9+' : String(etat.nonLues);
      s.hidden = !etat.nonLues;
    });
    document.querySelectorAll('.cloche').forEach((a) => a.setAttribute('aria-label', etat.nonLues ? `Notifications, ${etat.nonLues} non lues` : 'Notifications'));
  }

  // En-tête violet simple : titre, sous-titre, lien retour, bouton à droite
  function hero(titre, { retour, sousTitre, droite, haut } = {}) {
    const aDroite = droite || (etat.profil ? cloche() : '');
    return `<div class="hero${haut ? ' haut' : ''}">
      ${retour || aDroite ? `<div class="hero-ligne">${retour ? `<a class="bouton-rond" href="${retour}" aria-label="Retour">${ICONES.retour}</a>` : '<span></span>'}${aDroite}</div>` : ''}
      <div><h1>${esc(titre)}</h1>${sousTitre ? `<p>${sousTitre}</p>` : ''}</div>
    </div>`;
  }

  // ================= Apparence (clair / sombre / automatique) =================
  function themeChoisi() { try { return localStorage.getItem('cbn_theme') || 'auto'; } catch (e) { return 'auto'; } }
  function appliquerTheme(choix) {
    try { localStorage.setItem('cbn_theme', choix); } catch (e) { /* stockage indisponible */ }
    if (choix === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', choix === 'sombre' ? 'dark' : 'light');
    majCouleurNavigateur();
  }
  function estSombre() {
    const t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function majCouleurNavigateur() {
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', estSombre() ? '#170B24' : '#2A1240');
  }
  function basculerTheme() { appliquerTheme(estSombre() ? 'clair' : 'sombre'); }
  function boutonTheme() {
    return `<button class="bouton-rond" type="button" data-theme-bascule aria-label="${estSombre() ? 'Passer en mode clair' : 'Passer en mode sombre'}">${estSombre() ? ICONES.soleil : ICONES.lune}</button>`;
  }
  function choixApparence() {
    const c = themeChoisi();
    return `<div class="segments" role="radiogroup" aria-label="Apparence">
      ${[['auto', 'Automatique'], ['clair', 'Clair'], ['sombre', 'Sombre']].map(([v, n]) =>
        `<button type="button" role="radio" aria-checked="${c === v}" class="${c === v ? 'actif' : ''}" data-apparence="${v}">${n}</button>`).join('')}
    </div>`;
  }

  // ================= Rapports en attente (hors connexion) =================
  const CLE_FILE = 'cbn_file_attente';
  function fileAttente() { try { return JSON.parse(localStorage.getItem(CLE_FILE) || '[]'); } catch (e) { return []; } }
  function ecrireFile(f) { try { localStorage.setItem(CLE_FILE, JSON.stringify(f)); } catch (e) { /* plein */ } }
  function mettreEnAttente(element) {
    const f = fileAttente().filter((x) => !(element.cle && x.cle === element.cle));
    f.push({ ...element, quand: new Date().toISOString() });
    ecrireFile(f);
  }
  const estErreurReseau = (err) => /Failed to fetch|NetworkError|network|Load failed|fetch/i.test(String((err && err.message) || err || ''));
  let envoiEnCours = false;
  async function envoyerFileAttente() {
    if (envoiEnCours || !navigator.onLine || !etat.profil) return;
    const f = fileAttente();
    if (!f.length) return;
    envoiEnCours = true;
    let envoyes = 0;
    const reste = [];
    for (const el of f) {
      const r = el.op === 'update'
        ? await sb.from(el.table).update(el.donnees).eq('id', el.id)
        : await sb.from(el.table).insert(el.donnees);
      if (!r.error) envoyes++;
      else if (estErreurReseau(r.error)) reste.push(el);
      else toast('Non envoyé (' + el.libelle + ') : ' + messageErreur(r.error));
    }
    ecrireFile(reste);
    envoiEnCours = false;
    if (envoyes) {
      toast(envoyes > 1 ? `${envoyes} rapports en attente ont été envoyés` : 'Le rapport en attente a été envoyé');
      if (/^#?\/?$/.test(location.hash.replace('#', ''))) router();
    }
  }
  function majHorsLigne() {
    const bandeau = document.getElementById('hors-ligne');
    if (bandeau) bandeau.hidden = navigator.onLine;
    if (navigator.onLine) envoyerFileAttente();
  }

  // ================= Anniversaires =================
  // Renvoie les membres dont l'anniversaire tombe dans les « jours » prochains (0 = aujourd'hui)
  function anniversairesProches(membres, jours = 7) {
    const auj = aujourdhuiISO();
    const an = Number(auj.slice(0, 4));
    return (membres || []).filter((m) => m.date_naissance).map((m) => {
      const md = m.date_naissance.slice(5);
      let prochaine = an + '-' + md;
      if (md === '02-29' && !(an % 4 === 0 && (an % 100 !== 0 || an % 400 === 0))) prochaine = an + '-03-01';
      if (prochaine < auj) prochaine = (an + 1) + '-' + md;
      return { ...m, prochaine, dans: ecartJours(auj, prochaine), age: Number(prochaine.slice(0, 4)) - Number(m.date_naissance.slice(0, 4)) };
    }).filter((m) => m.dans <= jours).sort((a, b) => a.dans - b.dans || a.nom.localeCompare(b.nom));
  }
  function lienWhatsApp(telephone, texte) {
    const t = telephoneInternational(telephone);
    return (t ? 'https://wa.me/' + t : 'https://wa.me/') + '?text=' + encodeURIComponent(texte);
  }

  // Un bouton « Supprimer » demande une confirmation sur la page (2e appui)
  function boutonConfirme(btn, action, texte = 'Appuyez encore pour confirmer') {
    if (!btn) return;
    const original = btn.innerHTML;
    btn.onclick = async () => {
      if (!btn.dataset.arme) {
        btn.dataset.arme = '1'; btn.innerHTML = texte; btn.classList.add('danger');
        setTimeout(() => { delete btn.dataset.arme; btn.innerHTML = original; btn.classList.remove('danger'); }, 4000);
        return;
      }
      btn.disabled = true;
      await action();
    };
  }

  function afficher(html, onglet, espace) {
    const fideles = espace === 'fideles';
    const avecOnglets = Boolean(onglet && (fideles || etat.profil));
    app.innerHTML = html + (avecOnglets ? (fideles ? barreFideles(onglet) : barreOnglets(onglet)) : '');
    document.body.classList.toggle('avec-onglets', avecOnglets);
    window.scrollTo(0, 0);
    ajouterYeux(app);
    if (etat.profil && !fideles) majCloche();
  }

  // Bouton « œil » pour afficher ou cacher le mot de passe
  function ajouterYeux(racine) {
    racine.querySelectorAll('input[type="password"]').forEach((champ) => {
      if (champ.parentElement.classList.contains('champ-mdp')) return;
      const enveloppe = document.createElement('span');
      enveloppe.className = 'champ-mdp';
      champ.parentNode.insertBefore(enveloppe, champ);
      enveloppe.appendChild(champ);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'oeil';
      b.setAttribute('aria-label', 'Afficher le mot de passe');
      b.innerHTML = ICONES.oeil;
      b.onclick = () => {
        const visible = champ.type === 'text';
        champ.type = visible ? 'password' : 'text';
        b.innerHTML = visible ? ICONES.oeil : ICONES.oeilBarre;
        b.setAttribute('aria-label', visible ? 'Afficher le mot de passe' : 'Cacher le mot de passe');
        champ.focus();
      };
      enveloppe.appendChild(b);
    });
  }

  // ----- Barre de navigation de l'espace fidèles -----
  function barreFideles(actif) {
    const onglets = [['accueil', '#/', 'Accueil', ICONES.accueil], ['predications', '#/predications', 'Prédications', ICONES.ecouter],
      ['parole', '#/parole', 'Parole', ICONES.livre], ['programmes', '#/programmes', 'Programmes', ICONES.agenda],
      ['priere', '#/priere', 'Prière', ICONES.priere]];
    return `<nav class="onglets" aria-label="Navigation de l’espace fidèles">${onglets.map(([cle, lien, nom, icone]) =>
      `<a href="${lien}" class="${cle === actif ? 'actif' : ''}" ${cle === actif ? 'aria-current="page"' : ''}>${icone}<span>${nom}</span></a>`).join('')}</nav>`;
  }

  // ----- Barre de navigation en bas -----
  function estApotre() { return Boolean(etat.profil && ['apotre', 'admin'].includes(etat.profil.role)); }
  function barreOnglets(actif) {
    const onglets = estApotre()
      ? [['rapports', '#/', 'Accueil', ICONES.accueil], ['stats', '#/stats', 'Statistiques', ICONES.stats],
         ['eglises', '#/eglises', 'Églises', ICONES.eglise], ['agenda', '#/agenda', 'Programmes', ICONES.agenda], ['plus', '#/plus', 'Plus', ICONES.menu]]
      : [['rapports', '#/', 'Accueil', ICONES.accueil], ['membres', '#/membres', 'Membres', ICONES.membres],
         ['finances', '#/finances', 'Finances', ICONES.finances], ['agenda', '#/agenda', 'Programmes', ICONES.agenda], ['plus', '#/plus', 'Plus', ICONES.menu]];
    return `<nav class="onglets" aria-label="Navigation principale">${onglets.map(([cle, lien, nom, icone]) =>
      `<a href="${lien}" class="${cle === actif ? 'actif' : ''}" ${cle === actif ? 'aria-current="page"' : ''}>${icone}<span>${nom}</span></a>`).join('')}</nav>`;
  }

  // ================= Données partagées =================

  async function chargerEglisesEtPasteurs(forcer) {
    if (etat.eglises.length && !forcer) return;
    const [e, p] = await Promise.all([
      sb.from('eglises').select('id, nom, ordre').order('ordre'),
      estApotre() ? sb.from('profils').select('id, nom, eglise_id, photo_url').eq('role', 'pasteur') : Promise.resolve({ data: [] })
    ]);
    etat.eglises = e.data || [];
    etat.pasteurs = p.data || [];
  }
  const nomEglise = (id) => (etat.eglises.find((e) => e.id === id) || {}).nom || 'Toute la CBN';

  // Église concernée par un écran : le pasteur voit la sienne, l'apôtre celle qu'il a choisie
  function egliseDe(params) { return estApotre() ? params.eglise : etat.profil.eglise_id; }
  function peutEcrire(egliseId) { return etat.profil && (etat.profil.role === 'admin' || (etat.profil.role === 'pasteur' && etat.profil.eglise_id === egliseId)); }
  function peutPublier(egliseId) { return estApotre() || (etat.profil && etat.profil.role === 'pasteur' && egliseId && etat.profil.eglise_id === egliseId); }
  // Préfixe des liens pour rester dans la même église (l'apôtre navigue dans /eglise/<id>/…)
  function prefixe(egliseId) { return estApotre() ? '#/eglise/' + egliseId : '#'; }

  // ================= Photo =================

  async function changerPhoto(fichier, cible) {
    if (!fichier) return;
    try {
      toast('Envoi de la photo…');
      const blob = await reduireImage(fichier, 400);
      const chemin = etat.profil.id + '/photo.jpg';
      const up = await sb.storage.from('photos').upload(chemin, blob, { upsert: true, contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      const url = sb.storage.from('photos').getPublicUrl(chemin).data.publicUrl + '?v=' + Date.now();
      const maj = await sb.from('profils').update({ photo_url: url }).eq('id', etat.profil.id);
      if (maj.error) throw maj.error;
      etat.profil.photo_url = url;
      if (cible) cible.innerHTML = `<img src="${esc(url)}" alt="">`;
      toast('Photo enregistrée');
    } catch (err) {
      toast(messageErreur(err));
    }
  }
  function reduireImage(fichier, taille) {
    return new Promise((resoudre, rejeter) => {
      const img = new Image();
      const url = URL.createObjectURL(fichier);
      img.onload = () => {
        const cote = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = taille;
        canvas.getContext('2d').drawImage(img, (img.width - cote) / 2, (img.height - cote) / 2, cote, cote, 0, 0, taille, taille);
        URL.revokeObjectURL(url);
        canvas.toBlob((b) => (b ? resoudre(b) : rejeter(new Error('Image illisible'))), 'image/jpeg', 0.85);
      };
      img.onerror = () => rejeter(new Error('Image illisible'));
      img.src = url;
    });
  }

  // ================= En-tête des PDF =================
  function entetePDF(doc, titre, sousTitre) {
    doc.setFillColor(42, 18, 64);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text('Cité de la Bonne Nouvelle', 14, 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(titre + ' · ' + sousTitre, 14, 20);
    doc.setTextColor(30, 21, 40);
  }

  // ================= Navigation =================

  // public : visible par tous ; invite : page montrée seulement à qui n'est pas connecté
  function route(motif, ecran, options = {}) { routes.push({ motif, ecran, public: Boolean(options.public), invite: Boolean(options.invite) }); }
  function aller(chemin) { if (location.hash === '#' + chemin || (chemin === '/' && !location.hash)) router(); else location.hash = chemin; }

  async function router() {
    const chemin = location.hash.replace(/^#/, '') || '/';
    for (const r of routes.filter((x) => x.public)) {
      const m = chemin.match(r.motif);
      if (m) {
        try { return await r.ecran(m.groups || {}); }
        catch (err) { console.error(err); toast(messageErreur(err)); return; }
      }
    }
    const { data } = await sb.auth.getSession();
    const session = data.session;
    if (!session) {
      etat.profil = null;
      for (const r of routes.filter((x) => x.invite)) {
        const m = chemin.match(r.motif);
        if (m) return r.ecran(m.groups || {});
      }
      return ecranConnexion();
    }
    if (!etat.profil || etat.profil.id !== session.user.id) {
      const ok = await chargerProfil(session.user.id);
      if (!ok) return;
    }
    if (etat.profil.doit_changer_mdp) return ecranPremiereConnexion();
    await chargerEglisesEtPasteurs();
    envoyerFileAttente();
    for (const r of routes.filter((x) => !x.public && !x.invite)) {
      const m = chemin.match(r.motif);
      if (m) {
        try { return await r.ecran(m.groups || {}); }
        catch (err) { console.error(err); toast(messageErreur(err)); return; }
      }
    }
    aller('/');
  }

  async function chargerProfil(uid) {
    const { data, error } = await sb.from('profils').select('*, eglises(nom)').eq('id', uid).maybeSingle();
    if (error || !data) {
      afficher(`<div class="connexion"><div class="connexion-tete">
          <div class="logo"><img src="icon-192.png" alt="Logo de la Cité de la Bonne Nouvelle"></div>
          <h1>Compte pas encore prêt</h1>
          <p>${error ? esc(messageErreur(error)) : 'Votre compte existe mais n’est pas encore rattaché à une église. Contactez l’administrateur de la CBN.'}</p>
        </div>
        <div class="feuille"><button class="btn" id="sortir">Revenir à la connexion</button></div></div>`);
      document.getElementById('sortir').onclick = deconnexion;
      return false;
    }
    etat.profil = data;
    etat.eglises = [];
    return true;
  }

  async function deconnexion() {
    await sb.auth.signOut();
    etat.profil = null; etat.eglises = []; etat.pasteurs = [];
    aller('/');
  }

  // ================= Connexion =================

  function ecranConnexion() {
    afficher(`
      <div class="connexion">
        <div class="connexion-tete">
          <div class="logo"><img src="icon-192.png" alt="Logo de la Cité de la Bonne Nouvelle"></div>
          <h1>Cité de la Bonne Nouvelle</h1>
          <p>Rapports et vie des églises</p>
          <a class="lien-public" href="#/">${ICONES.accueil} Espace fidèles</a>
        </div>
        <form class="feuille" id="form-connexion" novalidate>
          <h2>Espace pasteurs</h2>
          <div class="champ">
            <label for="tel">Numéro de téléphone</label>
            <div class="groupe"><span class="prefixe">+237</span>
              <input id="tel" type="tel" inputmode="tel" autocomplete="username" placeholder="6XX XX XX XX" required></div>
          </div>
          <div class="champ">
            <label for="mdp">Mot de passe</label>
            <input class="saisie" id="mdp" type="password" autocomplete="current-password" placeholder="Votre mot de passe" required>
          </div>
          <p class="erreur" id="erreur" hidden></p>
          <button class="btn" type="submit" id="btn-connexion">Se connecter</button>
          <p class="discret" style="text-align:center">Mot de passe oublié ? Contactez l’administrateur de la CBN, il vous en donnera un nouveau.</p>
        </form>
      </div>`);

    document.getElementById('form-connexion').onsubmit = async (e) => {
      e.preventDefault();
      const tel = document.getElementById('tel').value;
      const mdp = document.getElementById('mdp').value;
      const erreur = document.getElementById('erreur');
      const btn = document.getElementById('btn-connexion');
      erreur.hidden = true;
      if (String(tel).replace(/\D/g, '').length < 9 || !mdp) {
        erreur.textContent = 'Entrez votre numéro (9 chiffres) et votre mot de passe.';
        erreur.hidden = false; return;
      }
      btn.disabled = true; btn.textContent = 'Connexion…';
      const { error } = await sb.auth.signInWithPassword({ email: emailDepuisTelephone(tel), password: mdp });
      if (error) {
        erreur.textContent = messageErreur(error); erreur.hidden = false;
        btn.disabled = false; btn.textContent = 'Se connecter'; return;
      }
      const ici = location.hash.replace(/^#/, '');
      aller(ici && ici !== '/connexion' ? ici : '/');
    };
  }

  // ================= Première connexion =================

  function ecranPremiereConnexion() {
    const p = etat.profil;
    const eglise = p.eglises ? p.eglises.nom : 'Cité de la Bonne Nouvelle';
    afficher(`
      <div class="hero">
        ${logoRond()}
        <span class="etiquette-or">Première connexion</span>
        <h1>Bienvenue, ${esc(p.nom)}</h1>
        <p>${esc(eglise)} · Choisissez votre mot de passe personnel. Il remplace celui que l’administrateur vous a donné.</p>
      </div>
      <form class="contenu" id="form-mdp" novalidate>
        <div class="carte">
          <div class="choix-photo">
            <span class="apercu" id="apercu">${p.photo_url ? `<img src="${esc(p.photo_url)}" alt="">` : ICONES.personne}</span>
            <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
              <strong>Votre photo</strong>
              <span class="discret">Facultatif · prenez une photo ou choisissez-en une dans la galerie</span>
              <label class="btn secondaire" style="min-height:40px;width:auto;align-self:flex-start" for="fichier-photo">Ajouter une photo</label>
              <input class="visuellement-cache" id="fichier-photo" type="file" accept="image/*">
            </div>
          </div>
        </div>
        <div class="champ"><label for="nouveau">Nouveau mot de passe</label>
          <input class="saisie" id="nouveau" type="password" autocomplete="new-password" placeholder="Au moins 6 caractères" required></div>
        <div class="champ"><label for="confirmer">Confirmer le mot de passe</label>
          <input class="saisie" id="confirmer" type="password" autocomplete="new-password" placeholder="Retapez le même mot de passe" required></div>
        <div class="info">${ICONES.info}<span>Notez-le dans un endroit sûr. En cas d’oubli, l’administrateur pourra vous en donner un nouveau.</span></div>
        <p class="erreur" id="erreur" hidden></p>
        <button class="btn" type="submit" id="btn-mdp">Enregistrer et continuer</button>
      </form>`);

    document.getElementById('fichier-photo').onchange = (e) => changerPhoto(e.target.files[0], document.getElementById('apercu'));
    document.getElementById('form-mdp').onsubmit = async (e) => {
      e.preventDefault();
      const n = document.getElementById('nouveau').value;
      const c = document.getElementById('confirmer').value;
      const erreur = document.getElementById('erreur');
      const btn = document.getElementById('btn-mdp');
      const montrer = (m) => { erreur.textContent = m; erreur.hidden = false; };
      erreur.hidden = true;
      if (n.length < 6) return montrer('Le mot de passe doit contenir au moins 6 caractères.');
      if (n !== c) return montrer('Les deux mots de passe ne sont pas identiques.');
      btn.disabled = true; btn.textContent = 'Enregistrement…';
      const r1 = await sb.auth.updateUser({ password: n });
      if (r1.error) { btn.disabled = false; btn.textContent = 'Enregistrer et continuer'; return montrer(messageErreur(r1.error)); }
      const r2 = await sb.from('profils').update({ doit_changer_mdp: false }).eq('id', etat.profil.id);
      if (r2.error) { btn.disabled = false; btn.textContent = 'Enregistrer et continuer'; return montrer(messageErreur(r2.error)); }
      etat.profil.doit_changer_mdp = false;
      toast('Mot de passe enregistré');
      aller('/');
    };
  }

  // ================= Mon profil =================

  function ecranProfil() {
    const p = etat.profil;
    const apotre = estApotre();
    const fonction = apotre ? 'Apôtre · Superviseur général' : 'Pasteur · ' + (p.eglises ? p.eglises.nom : '');
    afficher(`
      ${hero('Mon profil', { retour: '#/plus', droite: `<button class="bouton-rond" id="sortir" aria-label="Se déconnecter">${ICONES.sortir}</button>` })}
      <div class="contenu">
        <section class="carte profil-tete">
          <span class="apercu-grand" id="apercu">${p.photo_url ? `<img src="${esc(p.photo_url)}" alt="">` : esc(initiales(p.nom))}</span>
          <div class="profil-nom">${esc(p.nom)}</div>
          <div class="discret">${esc(fonction)}</div>
          <div class="deux-colonnes boutons-photo" style="width:100%">
            <label class="btn secondaire" for="fichier-photo">Changer la photo</label>
            <button class="btn secondaire" id="retirer-photo" ${p.photo_url ? '' : 'disabled'}>Retirer la photo</button>
          </div>
          <input class="visuellement-cache" id="fichier-photo" type="file" accept="image/*">
        </section>
        <section class="carte paires">
          <div class="paire"><span>Téléphone</span><strong style="white-space:nowrap">${esc(telephoneLisible(p.telephone))}</strong></div>
          <div class="paire"><span>${apotre ? 'Rôle' : 'Église'}</span><strong>${esc(apotre ? 'Apôtre' : (p.eglises ? p.eglises.nom : ''))}</strong></div>
        </section>
        <p class="discret" style="margin:0 4px">Pour changer votre nom ou votre numéro, contactez l’administrateur de la CBN.</p>
        <section class="carte">
          <h2>Apparence</h2>
          <p class="discret">« Automatique » suit le réglage du téléphone (sombre la nuit si le téléphone le fait).</p>
          ${choixApparence()}
        </section>
        <section class="carte">
          <h2>Notifications sur ce téléphone</h2>
          <p class="discret" id="etat-push">Recevez une alerte même quand l’application est fermée.</p>
          <button class="btn secondaire" type="button" id="activer-push">${ICONES.cloche} Activer les notifications</button>
        </section>
        <form class="carte" id="form-mdp" novalidate>
          <h2>Changer le mot de passe</h2>
          <div class="champ"><label for="actuel">Mot de passe actuel</label>
            <input class="saisie" id="actuel" type="password" autocomplete="current-password"></div>
          <div class="champ"><label for="nouveau">Nouveau mot de passe</label>
            <input class="saisie" id="nouveau" type="password" autocomplete="new-password" placeholder="Au moins 6 caractères"></div>
          <div class="champ"><label for="confirmer">Confirmer le nouveau mot de passe</label>
            <input class="saisie" id="confirmer" type="password" autocomplete="new-password"></div>
          <p class="erreur" id="erreur" hidden></p>
          <button class="btn" type="submit" id="btn-mdp">Enregistrer le mot de passe</button>
        </form>
        <button class="btn secondaire" id="sortir-bas">Se déconnecter</button>
      </div>`, 'plus');

    document.getElementById('sortir').onclick = deconnexion;
    document.getElementById('sortir-bas').onclick = deconnexion;
    preparerBoutonPush(document.getElementById('activer-push'), document.getElementById('etat-push'));
    document.getElementById('fichier-photo').onchange = (e) =>
      changerPhoto(e.target.files[0], document.getElementById('apercu')).then(() => { if (etat.profil.photo_url) document.getElementById('retirer-photo').disabled = false; });
    document.getElementById('retirer-photo').onclick = async () => {
      const r = await sb.from('profils').update({ photo_url: null }).eq('id', p.id);
      if (r.error) return toast(messageErreur(r.error));
      etat.profil.photo_url = null;
      toast('Photo retirée');
      ecranProfil();
    };
    document.getElementById('form-mdp').onsubmit = async (e) => {
      e.preventDefault();
      const actuel = document.getElementById('actuel').value;
      const n = document.getElementById('nouveau').value;
      const c = document.getElementById('confirmer').value;
      const erreur = document.getElementById('erreur');
      const btn = document.getElementById('btn-mdp');
      const montrer = (m) => { erreur.textContent = m; erreur.hidden = false; };
      erreur.hidden = true;
      if (!actuel) return montrer('Entrez votre mot de passe actuel.');
      if (n.length < 6) return montrer('Le nouveau mot de passe doit contenir au moins 6 caractères.');
      if (n !== c) return montrer('Les deux nouveaux mots de passe ne sont pas identiques.');
      btn.disabled = true; btn.textContent = 'Vérification…';
      const verif = await sb.auth.signInWithPassword({ email: emailDepuisTelephone(p.telephone), password: actuel });
      if (verif.error) { btn.disabled = false; btn.textContent = 'Enregistrer le mot de passe'; return montrer(/Invalid login/i.test(verif.error.message) ? 'Le mot de passe actuel est incorrect.' : messageErreur(verif.error)); }
      const r = await sb.auth.updateUser({ password: n });
      btn.disabled = false; btn.textContent = 'Enregistrer le mot de passe';
      if (r.error) return montrer(messageErreur(r.error));
      e.target.reset();
      toast('Mot de passe changé');
    };
  }

  // ================= Menu « Plus » =================

  async function ecranPlus() {
    const p = etat.profil;
    const apotre = estApotre();
    const ligne = (lien, icone, titre, texte, compte) => `<a class="ligne" href="${lien}"><span class="icone-ligne">${icone}</span><span class="corps"><strong>${titre}</strong><span>${texte}</span></span>${compte ? `<span class="pastille envoye">${compte}</span>` : ''}${ICONES.suivant}</a>`;
    const { count: demandes } = await sb.from('demandes').select('id', { count: 'exact', head: true }).eq('statut', 'nouvelle');
    const gestion = apotre ? [
      ligne('#/rapports', ICONES.rapports, 'Tous les rapports', 'Dimanche, mercredi, vendredi, programmes, conventions'),
      ligne('#/finances-cbn', ICONES.finances, 'Rapport de gestion', 'Entrées, dépenses et solde de chaque église'),
      ligne('#/anniversaires', ICONES.gateau, 'Anniversaires', 'Membres de toutes les églises, cette semaine et ce mois'),
      ligne('#/documents', ICONES.document, 'Documents et archives', 'Procès-verbaux, correspondances, archives')
    ] : [
      ligne('#/suivi', ICONES.suivi, 'Suivi des âmes', 'Nouveaux convertis et visiteurs à appeler ou visiter'),
      ligne('#/anniversaires', ICONES.gateau, 'Anniversaires', 'Souhaitez-les par WhatsApp en un clic'),
      ligne('#/stats', ICONES.stats, 'Statistiques', 'Évolution de la fréquentation et des entrées'),
      ligne('#/rapports', ICONES.rapports, 'Tous mes rapports', 'Tous les cultes envoyés'),
      ligne('#/departements', ICONES.groupe, 'Départements', 'Responsables et membres de chaque département'),
      ligne('#/documents', ICONES.document, 'Documents et archives', 'Procès-verbaux, correspondances, archives')
    ];
    const fideles = [
      ligne('#/demandes', ICONES.priere, apotre ? 'Prières et questions' : 'Demandes de prière', apotre ? 'Envoyées par les fidèles' : 'Envoyées par les fidèles de votre église', demandes),
      ligne('#/gerer/predications', ICONES.ecouter, 'Prédications', 'Ajouter des messages audio ou vidéo'),
      apotre ? ligne('#/gerer/meditations', ICONES.livre, 'Méditations du jour', 'Écrire et programmer les méditations') : '',
      ligne('#/fideles', ICONES.globe, 'Voir l’espace fidèles', 'Ce que voient les fidèles, sans compte')
    ];
    afficher(`
      <div class="hero">
        <div class="hero-ligne">
          <div class="hero-identite">${lienProfil(p)}<a href="#/profil" class="lien-profil"><div class="hero-nom">${esc(p.nom)}</div><div class="hero-petit souligne">Mon profil</div></a></div>
          ${cloche()}
        </div>
        <h1>Plus</h1>
      </div>
      <div class="contenu">
        <h2 class="titre-section" style="margin-top:0">Gestion</h2>
        <div class="liste">${gestion.join('')}</div>
        <h2 class="titre-section">Espace fidèles</h2>
        <div class="liste">${fideles.join('')}</div>
        <h2 class="titre-section">Mon compte</h2>
        <div class="liste">
          ${ligne('#/notifications', ICONES.cloche, 'Notifications', 'Rapports, demandes, inscriptions', etat.nonLues || '')}
          ${ligne('#/profil', ICONES.profil, 'Mon profil', 'Photo, mot de passe, apparence')}
        </div>
        <button class="btn secondaire" id="sortir">${ICONES.sortir} Se déconnecter</button>
      </div>`, 'plus');
    document.getElementById('sortir').onclick = deconnexion;
  }

  // ================= Notifications =================

  async function ecranNotifications() {
    const { data, error } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(60);
    const liste = data || [];
    const nonLues = liste.filter((n) => !n.lu).length;
    const quand = (ts) => {
      const jour = new Intl.DateTimeFormat('en-CA', { timeZone: CFG.FUSEAU }).format(new Date(ts));
      const ecart = ecartJours(jour, aujourdhuiISO());
      return (ecart === 0 ? 'Aujourd’hui' : ecart === 1 ? 'Hier' : dateCourte(jour)) + ' à ' + heure(ts);
    };
    afficher(`
      ${hero('Notifications', { retour: '#/plus', droite: '<span></span>', sousTitre: nonLues ? `${nonLues} non lue${nonLues > 1 ? 's' : ''}` : 'Tout est lu' })}
      <div class="contenu">
        <section class="carte" id="carte-push" hidden>
          <div class="entete-carte"><h2 class="petit-titre">Sur ce téléphone</h2></div>
          <p class="discret" id="etat-push">Recevez ces alertes même quand l’application est fermée.</p>
          <button class="btn" type="button" id="activer-push">${ICONES.cloche} Activer les notifications</button>
        </section>
        ${error ? `<p class="erreur">${esc(messageErreur(error))}</p>` : ''}
        ${nonLues ? '<button class="btn secondaire" id="tout-lu">Tout marquer comme lu</button>' : ''}
        <div class="liste">
          ${liste.length ? liste.map((n) => `
            <a class="ligne notif ${n.lu ? '' : 'non-lue'}" href="${esc(n.lien || '#/notifications')}" data-notif="${n.id}">
              <span class="point-notif" aria-hidden="true"></span>
              <span class="corps"><strong>${esc(n.titre)}</strong>${n.texte ? `<span>${esc(n.texte)}</span>` : ''}<span class="quand">${esc(quand(n.created_at))}${n.lu ? '' : ' · non lue'}</span></span>
            </a>`).join('') : '<p class="vide">Aucune notification pour le moment. Vous serez prévenu ici des nouveaux rapports, des demandes de prière et des inscriptions.</p>'}
        </div>
      </div>`, 'plus');
    document.querySelectorAll('[data-notif]').forEach((a) => {
      a.onclick = () => { sb.from('notifications').update({ lu: true }).eq('id', a.dataset.notif).then(majCloche); };
    });
    const toutLu = document.getElementById('tout-lu');
    if (toutLu) toutLu.onclick = async () => {
      const r = await sb.from('notifications').update({ lu: true }).eq('lu', false);
      if (r.error) return toast(messageErreur(r.error));
      ecranNotifications();
    };
    if (pushPossible() && Notification.permission !== 'granted') {
      document.getElementById('carte-push').hidden = false;
      preparerBoutonPush(document.getElementById('activer-push'), document.getElementById('etat-push'));
    }
  }

  // ----- Notifications sur le téléphone (Web Push) -----
  function pushPossible() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && Boolean(CFG.VAPID_PUBLIC); }
  function cleVersOctets(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const brut = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(brut, (c) => c.charCodeAt(0));
  }
  async function activerPush() {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('refus');
    const reg = await navigator.serviceWorker.ready;
    let abo = await reg.pushManager.getSubscription();
    if (!abo) abo = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleVersOctets(CFG.VAPID_PUBLIC) });
    const j = abo.toJSON();
    const r = await sb.from('abonnements_push').upsert({ profil_id: etat.profil.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' });
    if (r.error) throw r.error;
  }
  function preparerBoutonPush(btn, texte) {
    if (!btn) return;
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const installee = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (!pushPossible()) {
      btn.hidden = true;
      texte.textContent = ios && !installee
        ? 'Sur iPhone : ajoutez d’abord l’application à l’écran d’accueil (bouton Partager › « Sur l’écran d’accueil »), puis revenez ici.'
        : 'Ce téléphone ou ce navigateur ne permet pas les notifications. Elles restent visibles dans la cloche.';
      return;
    }
    if (Notification.permission === 'granted') {
      btn.innerHTML = ICONES.coche + ' Notifications activées';
      btn.disabled = true; btn.classList.add('pas-attente');
      activerPush().catch(() => {});
      return;
    }
    if (Notification.permission === 'denied') {
      btn.hidden = true;
      texte.textContent = 'Les notifications sont bloquées. Autorisez-les dans les réglages du navigateur pour ce site.';
      return;
    }
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        await activerPush();
        btn.innerHTML = ICONES.coche + ' Notifications activées';
        btn.classList.add('pas-attente');
        toast('Notifications activées sur ce téléphone');
      } catch (err) {
        btn.disabled = false;
        toast(err && err.message === 'refus' ? 'Notifications refusées' : messageErreur(err));
      }
    };
  }

  route(/^\/profil$/, ecranProfil);
  route(/^\/plus$/, ecranPlus);
  route(/^\/notifications$/, ecranNotifications);
  route(/^\/connexion$/, async () => {
    const { data } = await sb.auth.getSession();
    if (data.session) return aller('/');
    etat.profil = null;
    ecranConnexion();
  }, { public: true });

  // ================= Démarrage =================

  function demarrer() {
    appliquerTheme(themeChoisi());
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      majCouleurNavigateur();
      document.querySelectorAll('[data-theme-bascule]').forEach((b) => { b.innerHTML = estSombre() ? ICONES.soleil : ICONES.lune; });
    });
    // Boutons d'apparence présents sur plusieurs écrans
    document.addEventListener('click', (e) => {
      const bascule = e.target.closest('[data-theme-bascule]');
      if (bascule) {
        basculerTheme();
        bascule.innerHTML = estSombre() ? ICONES.soleil : ICONES.lune;
        bascule.setAttribute('aria-label', estSombre() ? 'Passer en mode clair' : 'Passer en mode sombre');
      }
      const choix = e.target.closest('[data-apparence]');
      if (choix) {
        appliquerTheme(choix.dataset.apparence);
        choix.parentElement.querySelectorAll('[data-apparence]').forEach((b) => {
          const actif = b === choix; b.classList.toggle('actif', actif); b.setAttribute('aria-checked', String(actif));
        });
      }
    });
    window.addEventListener('hashchange', router);
    window.addEventListener('online', majHorsLigne);
    window.addEventListener('offline', majHorsLigne);
    majHorsLigne();
    sb.auth.onAuthStateChange((evenement) => { if (evenement === 'SIGNED_OUT') { etat.profil = null; } });
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'ouvrir' && e.data.lien) location.hash = e.data.lien.replace(/^#/, '');
        if (e.data && e.data.type === 'notification') majCloche();
      });
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) majCloche(); });
    if (CFG.SUPABASE_URL.includes('VOTRE-PROJET')) {
      afficher('<div class="chargement"><img src="icon-192.png" alt="" width="96" height="96"><p>Application pas encore reliée à la base de données (fichier config.js).</p></div>');
    } else {
      router();
    }
  }

  window.CBN = {
    sb, etat, CFG, ICONES, esc, nombre, fcfa, initiales, toast, messageErreur,
    telephoneLisible, telephoneInternational, aujourdhuiISO, versDate, versISO, ajouterJours, ecartJours,
    dimancheDeReference, dateLongue, dateCourte, dateJour, heure, moisCourant, ajouterMois, moisLibelle, moisCourt, finDeMois,
    avatarHTML, lienProfil, logoRond, hero, cloche, majCloche, boutonConfirme, afficher, estApotre, chargerEglisesEtPasteurs, nomEglise,
    egliseDe, peutEcrire, peutPublier, prefixe, entetePDF, route, aller, router, deconnexion, demarrer,
    boutonTheme, estSombre, fileAttente, mettreEnAttente, envoyerFileAttente, estErreurReseau,
    anniversairesProches, lienWhatsApp
  };
})();
