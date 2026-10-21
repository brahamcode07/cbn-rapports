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
    retour: svg('<path d="M15 18l-6-6 6-6"/>'),
    suivant: svg('<path d="M9 18l6-6-6-6"/>'),
    sortir: svg('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>', 20, 1.8),
    crayon: svg('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    envoyer: svg('<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>'),
    coche: svg('<path d="M20 6L9 17l-5-5"/>', 20, 2.2),
    plus: svg('<path d="M12 5v14M5 12h14"/>', 20, 2.2),
    photo: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2A1240" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h3l2-3h8l2 3h3v12H3z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    personne: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#7A63A0" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    info: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4B2672" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" style="flex:none"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>',
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

  // En-tête violet simple : titre, sous-titre, lien retour, bouton à droite
  function hero(titre, { retour, sousTitre, droite, haut } = {}) {
    return `<div class="hero${haut ? ' haut' : ''}">
      ${retour || droite ? `<div class="hero-ligne">${retour ? `<a class="bouton-rond" href="${retour}" aria-label="Retour">${ICONES.retour}</a>` : '<span></span>'}${droite || ''}</div>` : ''}
      <div><h1>${esc(titre)}</h1>${sousTitre ? `<p>${sousTitre}</p>` : ''}</div>
    </div>`;
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

  function afficher(html, onglet) {
    const avecOnglets = Boolean(onglet && etat.profil);
    app.innerHTML = html + (avecOnglets ? barreOnglets(onglet) : '');
    document.body.classList.toggle('avec-onglets', avecOnglets);
    window.scrollTo(0, 0);
  }

  // ----- Barre de navigation en bas -----
  function estApotre() { return Boolean(etat.profil && ['apotre', 'admin'].includes(etat.profil.role)); }
  function barreOnglets(actif) {
    const onglets = estApotre()
      ? [['rapports', '#/', 'Rapports', ICONES.rapports], ['stats', '#/stats', 'Statistiques', ICONES.stats],
         ['eglises', '#/eglises', 'Églises', ICONES.eglise], ['agenda', '#/agenda', 'Programmes', ICONES.agenda], ['plus', '#/plus', 'Plus', ICONES.menu]]
      : [['rapports', '#/', 'Rapports', ICONES.rapports], ['membres', '#/membres', 'Membres', ICONES.membres],
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

  function route(motif, ecran, options = {}) { routes.push({ motif, ecran, public: Boolean(options.public) }); }
  function aller(chemin) { if (location.hash === '#' + chemin) router(); else location.hash = chemin; }

  async function router() {
    const chemin = location.hash.replace(/^#/, '') || '/';
    for (const r of routes.filter((x) => x.public)) {
      const m = chemin.match(r.motif);
      if (m) return r.ecran(m.groups || {});
    }
    const { data } = await sb.auth.getSession();
    const session = data.session;
    if (!session) { etat.profil = null; return ecranConnexion(); }
    if (!etat.profil || etat.profil.id !== session.user.id) {
      const ok = await chargerProfil(session.user.id);
      if (!ok) return;
    }
    if (etat.profil.doit_changer_mdp) return ecranPremiereConnexion();
    await chargerEglisesEtPasteurs();
    for (const r of routes.filter((x) => !x.public)) {
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
          <a class="lien-public" href="#/programmes">${ICONES.agenda} Voir les programmes de la CBN</a>
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
      aller('/');
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

  function ecranPlus() {
    const p = etat.profil;
    const apotre = estApotre();
    const ligne = (lien, icone, titre, texte) => `<a class="ligne" href="${lien}"><span class="icone-ligne">${icone}</span><span class="corps"><strong>${titre}</strong><span>${texte}</span></span>${ICONES.suivant}</a>`;
    const elements = apotre ? [
      ligne('#/rapports', ICONES.rapports, 'Tous les rapports', 'Dimanche, mercredi, vendredi, programmes, conventions'),
      ligne('#/finances-cbn', ICONES.finances, 'Rapport de gestion', 'Entrées, dépenses et solde de chaque église'),
      ligne('#/documents', ICONES.document, 'Documents et archives', 'Procès-verbaux, correspondances, archives'),
      ligne('#/programmes', ICONES.globe, 'Page publique des fidèles', 'Ce que voient les fidèles, sans compte')
    ] : [
      ligne('#/suivi', ICONES.suivi, 'Suivi des âmes', 'Nouveaux convertis et visiteurs à appeler ou visiter'),
      ligne('#/stats', ICONES.stats, 'Statistiques', 'Évolution de la fréquentation et des entrées'),
      ligne('#/rapports', ICONES.rapports, 'Tous mes rapports', 'Tous les cultes envoyés'),
      ligne('#/departements', ICONES.groupe, 'Départements', 'Responsables et membres de chaque département'),
      ligne('#/documents', ICONES.document, 'Documents et archives', 'Procès-verbaux, correspondances, archives'),
      ligne('#/programmes', ICONES.globe, 'Page publique des fidèles', 'Ce que voient les fidèles, sans compte')
    ];
    afficher(`
      <div class="hero">
        <div class="hero-ligne">
          <div class="hero-identite">${lienProfil(p)}<a href="#/profil" class="lien-profil"><div class="hero-nom">${esc(p.nom)}</div><div class="hero-petit souligne">Mon profil</div></a></div>
          <button class="bouton-rond" id="sortir" aria-label="Se déconnecter">${ICONES.sortir}</button>
        </div>
        <h1>Plus</h1>
      </div>
      <div class="contenu"><div class="liste">${elements.join('')}
        ${ligne('#/profil', ICONES.profil, 'Mon profil', 'Photo et mot de passe')}</div>
      </div>`, 'plus');
    document.getElementById('sortir').onclick = deconnexion;
  }

  route(/^\/profil$/, ecranProfil);
  route(/^\/plus$/, ecranPlus);

  // ================= Démarrage =================

  function demarrer() {
    window.addEventListener('hashchange', router);
    sb.auth.onAuthStateChange((evenement) => { if (evenement === 'SIGNED_OUT') { etat.profil = null; } });
    if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
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
    avatarHTML, lienProfil, logoRond, hero, boutonConfirme, afficher, estApotre, chargerEglisesEtPasteurs, nomEglise,
    egliseDe, peutEcrire, peutPublier, prefixe, entetePDF, route, aller, router, deconnexion, demarrer
  };
})();
