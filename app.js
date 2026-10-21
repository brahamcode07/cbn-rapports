/* CBN Rapports — application (version 1 : rapport du culte du dimanche) */
(function () {
  'use strict';

  const CFG = window.CBN_CONFIG;
  const app = document.getElementById('app');
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  // L'état de la session en cours
  const etat = { profil: null, eglises: [], pasteurs: [] };

  // ================= Outils =================

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nombre = (n) => new Intl.NumberFormat('fr-FR').format(Number(n) || 0);
  const fcfa = (n) => nombre(n) + ' FCFA';
  const initiales = (nom) => String(nom || '')
    .replace(/^(Apôtre|Pasteur)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2)
    .map((m) => m[0].toUpperCase()).join('');

  const ICONES = {
    retour: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    suivant: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
    sortir: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/></svg>',
    crayon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    envoyer: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>',
    coche: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>',
    photo: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2A1240" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h3l2-3h8l2 3h3v12H3z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    personne: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#7A63A0" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    info: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4B2672" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" style="flex:none"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>'
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
    if (/duplicate key|unique/i.test(m)) return 'Un rapport existe déjà pour ce culte.';
    if (/Password should be|at least 6/i.test(m)) return 'Le mot de passe doit contenir au moins 6 caractères.';
    if (/same_password|different from the old/i.test(m)) return 'Choisissez un mot de passe différent de celui donné par l’administrateur.';
    return 'Une erreur est survenue : ' + m;
  }

  // Le numéro de téléphone sert d'identifiant : 6XX XX XX XX → 2376XXXXXXXX@domaine
  function emailDepuisTelephone(saisie) {
    let chiffres = String(saisie || '').replace(/\D/g, '');
    if (chiffres.startsWith('00')) chiffres = chiffres.slice(2);
    if (!chiffres.startsWith('237')) chiffres = '237' + chiffres;
    return chiffres + '@' + CFG.DOMAINE_EMAIL;
  }

  // ----- Dates (heure du Cameroun) -----
  function aujourdhuiISO() {
    // en-CA donne le format AAAA-MM-JJ
    return new Intl.DateTimeFormat('en-CA', { timeZone: CFG.FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function versDate(iso) { const [a, m, j] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, j)); }
  function versISO(d) { return d.toISOString().slice(0, 10); }
  function ajouterJours(iso, n) { const d = versDate(iso); d.setUTCDate(d.getUTCDate() + n); return versISO(d); }
  // Le dimanche du jour, ou le dernier dimanche passé
  function dimancheDeReference() { const iso = aujourdhuiISO(); return ajouterJours(iso, -versDate(iso).getUTCDay()); }
  function dateLongue(iso) { return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(versDate(iso)); }
  function dateCourte(iso) { return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(versDate(iso)); }
  function heure(ts) { return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: CFG.FUSEAU }).format(new Date(ts)).replace(':', ' h '); }

  function avatarHTML(profil, classe) {
    const contenu = profil && profil.photo_url
      ? `<img src="${esc(profil.photo_url)}" alt="">`
      : esc(initiales(profil && profil.nom));
    return `<span class="avatar ${classe || ''}">${contenu}</span>`;
  }

  function pastille(statut) {
    if (statut === 'vu') return '<span class="pastille vu">Vu</span>';
    if (statut === 'envoye') return '<span class="pastille envoye">Envoyé</span>';
    return '<span class="pastille attente">En attente</span>';
  }

  function logoRond() { return '<span class="logo-rond"><img src="icon-192.png" alt="Logo CBN"></span>'; }

  function afficher(html) { app.innerHTML = html; window.scrollTo(0, 0); }

  // ================= Navigation =================

  function aller(route) { if (location.hash === '#' + route) router(); else location.hash = route; }

  async function router() {
    const { data } = await sb.auth.getSession();
    const session = data.session;
    const route = location.hash.replace(/^#/, '') || '/';

    if (!session) { etat.profil = null; return ecranConnexion(); }
    if (!etat.profil || etat.profil.id !== session.user.id) {
      const ok = await chargerProfil(session.user.id);
      if (!ok) return;
    }
    if (etat.profil.doit_changer_mdp) return ecranPremiereConnexion();

    const estApotre = ['apotre', 'admin'].includes(etat.profil.role);
    if (route === '/profil') return ecranProfil();
    const m = route.match(/^\/rapport\/([0-9a-f-]{36})$/);
    if (m) return ecranDetail(m[1]);
    if (route === '/nouveau' && !estApotre) return ecranFormulaire();
    const d = route.match(/^\/dimanche\/(\d{4}-\d{2}-\d{2})$/);
    if (estApotre) return ecranApotre(d ? d[1] : dimancheDeReference());
    return ecranPasteur();
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
    return true;
  }

  async function deconnexion() {
    await sb.auth.signOut();
    etat.profil = null;
    aller('/');
  }

  // ================= 1. Connexion =================

  function ecranConnexion() {
    afficher(`
      <div class="connexion">
        <div class="connexion-tete">
          <div class="logo"><img src="icon-192.png" alt="Logo de la Cité de la Bonne Nouvelle"></div>
          <h1>Cité de la Bonne Nouvelle</h1>
          <p>Rapports des cultes</p>
        </div>
        <form class="feuille" id="form-connexion" novalidate>
          <h2>Connexion</h2>
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

  // ================= 2. Première connexion =================

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
        <div class="champ">
          <label for="nouveau">Nouveau mot de passe</label>
          <input class="saisie" id="nouveau" type="password" autocomplete="new-password" placeholder="Au moins 6 caractères" required>
        </div>
        <div class="champ">
          <label for="confirmer">Confirmer le mot de passe</label>
          <input class="saisie" id="confirmer" type="password" autocomplete="new-password" placeholder="Retapez le même mot de passe" required>
        </div>
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
      erreur.hidden = true;
      if (n.length < 6) { erreur.textContent = 'Le mot de passe doit contenir au moins 6 caractères.'; erreur.hidden = false; return; }
      if (n !== c) { erreur.textContent = 'Les deux mots de passe ne sont pas identiques.'; erreur.hidden = false; return; }
      btn.disabled = true; btn.textContent = 'Enregistrement…';
      const r1 = await sb.auth.updateUser({ password: n });
      if (r1.error) { erreur.textContent = messageErreur(r1.error); erreur.hidden = false; btn.disabled = false; btn.textContent = 'Enregistrer et continuer'; return; }
      const r2 = await sb.from('profils').update({ doit_changer_mdp: false }).eq('id', etat.profil.id);
      if (r2.error) { erreur.textContent = messageErreur(r2.error); erreur.hidden = false; btn.disabled = false; btn.textContent = 'Enregistrer et continuer'; return; }
      etat.profil.doit_changer_mdp = false;
      toast('Mot de passe enregistré');
      aller('/');
    };
  }

  // Réduit la photo (400 px) puis l'envoie dans le stockage Supabase
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

  // ================= 3. Accueil du pasteur =================

  async function ecranPasteur() {
    const p = etat.profil;
    const dimanche = dimancheDeReference();
    const { data: rapports, error } = await sb.from('rapports_culte')
      .select('id, date_culte, statut, created_at, commentaire_apotre')
      .eq('eglise_id', p.eglise_id).order('date_culte', { ascending: false }).limit(12);

    const courant = (rapports || []).find((r) => r.date_culte === dimanche);
    const precedents = (rapports || []).filter((r) => r.date_culte !== dimanche);

    let carte;
    if (!courant) {
      carte = `<span class="surtitre">Rapport à envoyer</span>
        <div class="grand-titre">Culte du dimanche<br>${esc(dateLongue(dimanche))}</div>
        <a class="btn" href="#/nouveau">${ICONES.crayon} Remplir le rapport</a>`;
    } else if (courant.statut === 'envoye') {
      carte = `<span class="surtitre">Envoyé à ${esc(heure(courant.created_at))}</span>
        <div class="grand-titre">Culte du dimanche<br>${esc(dateLongue(dimanche))}</div>
        <p class="discret">L’apôtre ne l’a pas encore vu. Vous pouvez encore le corriger.</p>
        <div class="deux-colonnes"><a class="btn secondaire" href="#/rapport/${courant.id}">Voir</a><a class="btn secondaire" href="#/nouveau">Corriger</a></div>`;
    } else {
      carte = `<span class="surtitre vu">Vu par l’apôtre</span>
        <div class="grand-titre">Culte du dimanche<br>${esc(dateLongue(dimanche))}</div>
        ${courant.commentaire_apotre ? `<div class="mot-apotre"><span>Mot de l’apôtre</span>${esc(courant.commentaire_apotre)}</div>` : ''}
        <a class="btn secondaire" href="#/rapport/${courant.id}">Voir le rapport</a>`;
    }

    afficher(`
      <div class="hero haut">
        <div class="hero-ligne">
          <div class="hero-identite">
            ${lienProfil(p)}
            <a href="#/profil" class="lien-profil"><div class="hero-petit">Bonjour,</div><div class="hero-nom">${esc(p.nom)}</div><div class="hero-petit souligne">Mon profil</div></a>
          </div>
          <button class="bouton-rond" id="sortir" aria-label="Se déconnecter">${ICONES.sortir}</button>
        </div>
        <div class="hero-identite">${logoRond()}<h1>${esc(p.eglises ? p.eglises.nom : '')}</h1></div>
      </div>
      <div class="contenu remonte">
        <section class="carte flottante">${carte}</section>
        ${error ? `<p class="erreur">${esc(messageErreur(error))}</p>` : ''}
        <h2 class="titre-section">Rapports précédents</h2>
        <div class="liste">
          ${precedents.length ? precedents.map((r) => `
            <a class="ligne" href="#/rapport/${r.id}">
              <span class="corps"><strong>Dimanche ${esc(dateCourte(r.date_culte))}</strong>
              <span>${r.commentaire_apotre ? 'Commentaire de l’apôtre' : 'Envoyé à ' + esc(heure(r.created_at))}</span></span>
              ${pastille(r.statut)}
            </a>`).join('') : '<p class="vide">Vos rapports envoyés apparaîtront ici.</p>'}
        </div>
      </div>`);

    document.getElementById('sortir').onclick = deconnexion;
  }

  // Avatar cliquable qui mène à « Mon profil »
  function lienProfil(p) {
    return `<a class="avatar" href="#/profil" aria-label="Mon profil">${p.photo_url ? `<img src="${esc(p.photo_url)}" alt="">` : esc(initiales(p.nom))}<span class="badge">${ICONES.photo}</span></a>`;
  }

  function telephoneLisible(t) {
    const c = String(t || '').replace(/\D/g, '');
    const local = c.startsWith('237') ? c.slice(3) : c;
    return '+237 ' + local.replace(/^(\d{3})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4');
  }

  // ================= Mon profil =================

  function ecranProfil() {
    const p = etat.profil;
    const estApotre = ['apotre', 'admin'].includes(p.role);
    const fonction = estApotre ? 'Apôtre · Superviseur général' : 'Pasteur · ' + (p.eglises ? p.eglises.nom : '');
    afficher(`
      <div class="hero">
        <div class="hero-ligne">
          <a class="bouton-rond" href="#/" aria-label="Retour">${ICONES.retour}</a>
          <button class="bouton-rond" id="sortir" aria-label="Se déconnecter">${ICONES.sortir}</button>
        </div>
        <h1>Mon profil</h1>
      </div>
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
          <div class="paire"><span>${estApotre ? 'Rôle' : 'Église'}</span><strong>${esc(estApotre ? 'Apôtre' : (p.eglises ? p.eglises.nom : ''))}</strong></div>
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
      </div>`);

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

  // ================= 4. Formulaire du rapport =================

  async function ecranFormulaire() {
    const p = etat.profil;
    const dimanche = dimancheDeReference();
    const { data: existant } = await sb.from('rapports_culte').select('*')
      .eq('eglise_id', p.eglise_id).eq('date_culte', dimanche).eq('type_culte', 'dimanche').maybeSingle();

    if (existant && existant.statut === 'vu') { toast('Ce rapport a déjà été vu par l’apôtre.'); return aller('/rapport/' + existant.id); }
    const v = existant || {};
    const compteur = (id, libelle, art) => `
      <div class="compteur">
        <label for="${id}">${libelle}</label>
        <div class="commandes">
          <button type="button" data-moins="${id}" aria-label="Retirer ${art}">−</button>
          <input id="${id}" type="number" inputmode="numeric" min="0" value="${Number(v[id]) || 0}">
          <button type="button" data-plus="${id}" aria-label="Ajouter ${art}">+</button>
        </div>
      </div>`;

    afficher(`
      <div class="hero">
        <div class="hero-identite">
          <a class="bouton-rond" href="#/" aria-label="Retour">${ICONES.retour}</a>
          <div><h1 style="font-size:23px">Rapport du culte</h1><p>${esc(p.eglises ? p.eglises.nom : '')} · Dimanche ${esc(dateLongue(dimanche))}</p></div>
        </div>
      </div>
      <form class="contenu" id="form-rapport" novalidate>
        <fieldset class="carte" style="border:0;margin:0">
          <legend class="visuellement-cache">Le culte</legend><h2>Le culte</h2>
          <div class="champ"><label for="predicateur">Prédicateur</label>
            <input class="saisie" id="predicateur" type="text" placeholder="Nom du prédicateur" value="${esc(v.predicateur)}"></div>
          <div class="champ"><label for="theme">Thème du message</label>
            <input class="saisie" id="theme" type="text" placeholder="Ex. : La foi qui déplace les montagnes" value="${esc(v.theme)}"></div>
        </fieldset>
        <fieldset class="carte" style="border:0;margin:0">
          <legend class="visuellement-cache">Présence</legend><h2>Présence</h2>
          ${compteur('hommes', 'Hommes', 'un homme')}
          ${compteur('femmes', 'Femmes', 'une femme')}
          ${compteur('jeunes', 'Jeunes', 'un jeune')}
          ${compteur('enfants', 'Enfants', 'un enfant')}
          <div class="total"><span>Total présents</span><strong id="total">0</strong></div>
          <div class="deux-colonnes">
            <div class="champ"><label for="visiteurs">Visiteurs</label><input class="saisie" id="visiteurs" type="number" inputmode="numeric" min="0" value="${Number(v.visiteurs) || 0}"></div>
            <div class="champ"><label for="convertis">Nouveaux convertis</label><input class="saisie" id="convertis" type="number" inputmode="numeric" min="0" value="${Number(v.convertis) || 0}"></div>
          </div>
        </fieldset>
        <fieldset class="carte" style="border:0;margin:0">
          <legend class="visuellement-cache">Entrées du culte</legend><h2>Entrées du culte</h2>
          <div class="champ"><label for="offrandes">Offrandes</label>
            <div class="groupe"><input id="offrandes" type="number" inputmode="numeric" min="0" placeholder="0" value="${v.offrandes ? Number(v.offrandes) : ''}"><span class="suffixe">FCFA</span></div></div>
          <div class="champ"><label for="dimes">Dîmes</label>
            <div class="groupe"><input id="dimes" type="number" inputmode="numeric" min="0" placeholder="0" value="${v.dimes ? Number(v.dimes) : ''}"><span class="suffixe">FCFA</span></div></div>
        </fieldset>
        <fieldset class="carte" style="border:0;margin:0">
          <legend class="visuellement-cache">Événements particuliers</legend>
          <h2>Événements particuliers <span class="discret" style="font-family:var(--texte);font-weight:500">facultatif</span></h2>
          <label class="discret" for="evenements">Baptême, visite, annonce, difficulté…</label>
          <textarea class="saisie" id="evenements">${esc(v.evenements)}</textarea>
        </fieldset>
        <p class="erreur" id="erreur" hidden></p>
        <button class="btn" type="submit" id="btn-envoyer">${ICONES.envoyer} ${existant ? 'Enregistrer la correction' : 'Envoyer à l’apôtre'}</button>
      </form>`);

    const champsPresence = ['hommes', 'femmes', 'jeunes', 'enfants'];
    const entier = (id) => Math.max(0, parseInt(document.getElementById(id).value, 10) || 0);
    const majTotal = () => { document.getElementById('total').textContent = nombre(champsPresence.reduce((s, id) => s + entier(id), 0)); };
    majTotal();
    const form = document.getElementById('form-rapport');
    form.addEventListener('input', majTotal);
    form.addEventListener('click', (e) => {
      const plus = e.target.getAttribute('data-plus');
      const moins = e.target.getAttribute('data-moins');
      const id = plus || moins;
      if (!id) return;
      const champ = document.getElementById(id);
      champ.value = Math.max(0, entier(id) + (plus ? 1 : -1));
      majTotal();
    });

    form.onsubmit = async (e) => {
      e.preventDefault();
      const erreur = document.getElementById('erreur');
      const btn = document.getElementById('btn-envoyer');
      erreur.hidden = true;
      const contenu = {
        predicateur: document.getElementById('predicateur').value.trim(),
        theme: document.getElementById('theme').value.trim(),
        hommes: entier('hommes'), femmes: entier('femmes'), jeunes: entier('jeunes'), enfants: entier('enfants'),
        visiteurs: entier('visiteurs'), convertis: entier('convertis'),
        offrandes: entier('offrandes'), dimes: entier('dimes'),
        evenements: document.getElementById('evenements').value.trim()
      };
      if (!contenu.predicateur) { erreur.textContent = 'Indiquez le nom du prédicateur.'; erreur.hidden = false; return; }
      btn.disabled = true; btn.textContent = 'Envoi…';
      const r = existant
        ? await sb.from('rapports_culte').update(contenu).eq('id', existant.id).select('id').single()
        : await sb.from('rapports_culte').insert({ ...contenu, eglise_id: p.eglise_id, auteur_id: p.id, date_culte: dimanche, type_culte: 'dimanche' }).select('id').single();
      if (r.error) {
        erreur.textContent = messageErreur(r.error); erreur.hidden = false;
        btn.disabled = false; btn.innerHTML = ICONES.envoyer + ' Réessayer'; return;
      }
      toast(existant ? 'Correction enregistrée' : 'Rapport envoyé à l’apôtre');
      aller('/');
    };
  }

  // ================= 5. Accueil de l'apôtre =================

  async function chargerEglisesEtPasteurs() {
    if (etat.eglises.length) return;
    const [e, p] = await Promise.all([
      sb.from('eglises').select('id, nom, ordre').order('ordre'),
      sb.from('profils').select('id, nom, eglise_id, photo_url').eq('role', 'pasteur')
    ]);
    etat.eglises = e.data || [];
    etat.pasteurs = p.data || [];
  }

  async function ecranApotre(dimanche) {
    await chargerEglisesEtPasteurs();
    const { data: rapports, error } = await sb.from('rapports_culte')
      .select('*').eq('date_culte', dimanche).eq('type_culte', 'dimanche');
    const parEglise = new Map((rapports || []).map((r) => [r.eglise_id, r]));
    const recus = etat.eglises.filter((e) => parEglise.has(e.id)).length;
    const estFutur = dimanche >= dimancheDeReference();

    afficher(`
      <div class="hero">
        <div class="hero-ligne">
          <div class="marque">${logoRond()}<span>Cité de la Bonne Nouvelle</span></div>
          <div class="hero-identite">${lienProfil(etat.profil)}<button class="bouton-rond" id="sortir" aria-label="Se déconnecter">${ICONES.sortir}</button></div>
        </div>
        <div><div class="hero-petit">Bonjour, ${esc(etat.profil.nom)}</div><h1 style="font-size:28px">Rapports du dimanche</h1></div>
        <div class="selecteur">
          <a class="bouton-rond" href="#/dimanche/${ajouterJours(dimanche, -7)}" aria-label="Dimanche précédent">${ICONES.retour}</a>
          <div class="date">${esc(dateLongue(dimanche))}</div>
          ${estFutur ? '<span class="bouton-rond" style="opacity:.35" aria-hidden="true">' + ICONES.suivant + '</span>'
                     : `<a class="bouton-rond" href="#/dimanche/${ajouterJours(dimanche, 7)}" aria-label="Dimanche suivant">${ICONES.suivant}</a>`}
        </div>
        <div class="progression">
          <div class="barres" style="--n:${etat.eglises.length || 4}">${etat.eglises.map((e) => `<span class="${parEglise.has(e.id) ? 'ok' : ''}"></span>`).join('')}</div>
          <strong>${recus} sur ${etat.eglises.length} reçus</strong>
        </div>
      </div>
      <div class="contenu">
        ${error ? `<p class="erreur">${esc(messageErreur(error))}</p>` : ''}
        <div class="liste">
          ${etat.eglises.map((e) => {
            const pasteur = etat.pasteurs.find((x) => x.eglise_id === e.id);
            const r = parEglise.get(e.id);
            const corps = `<span class="corps"><strong>${esc(e.nom)}</strong><span>${esc(pasteur ? pasteur.nom : 'Pasteur non renseigné')}</span></span>`;
            if (!r) return `<div class="ligne absente">${avatarHTML(pasteur, 'petit absent')}${corps}<span class="pastille attente">En attente</span></div>`;
            const etiquette = r.statut === 'vu' ? '<span class="pastille vu">Vu</span>' : '<span class="pastille envoye">Nouveau</span>';
            return `<a class="ligne" href="#/rapport/${r.id}">${avatarHTML(pasteur, 'petit')}${corps}${etiquette}</a>`;
          }).join('')}
        </div>
        ${recus ? `
          <p class="discret" style="text-align:center;margin-top:12px">Exporter les rapports de ce dimanche</p>
          <div class="deux-colonnes"><button class="btn secondaire" id="export-pdf">PDF</button><button class="btn secondaire" id="export-excel">Excel</button></div>` : ''}
      </div>`);

    document.getElementById('sortir').onclick = deconnexion;
    if (recus) {
      const liste = etat.eglises.filter((e) => parEglise.has(e.id)).map((e) => ({ eglise: e.nom, ...parEglise.get(e.id) }));
      document.getElementById('export-pdf').onclick = () => exporterPDFDimanche(dimanche, liste);
      document.getElementById('export-excel').onclick = () => exporterExcelDimanche(dimanche, liste);
    }
  }

  // ================= 6. Détail d'un rapport =================

  async function ecranDetail(id) {
    const { data: r, error } = await sb.from('rapports_culte').select('*, eglises(nom), profils(nom)').eq('id', id).maybeSingle();
    if (error || !r) { toast(error ? messageErreur(error) : 'Rapport introuvable'); return aller('/'); }
    const estApotre = ['apotre', 'admin'].includes(etat.profil.role);
    const retour = estApotre ? '#/dimanche/' + r.date_culte : '#/';

    afficher(`
      <div class="hero haut">
        <div class="hero-ligne">
          <a class="bouton-rond" href="${retour}" aria-label="Retour">${ICONES.retour}</a>
          ${pastille(r.statut)}
        </div>
        <div><h1>${esc(r.eglises ? r.eglises.nom : '')}</h1>
        <p>${esc(r.profils ? r.profils.nom : '')} · Dimanche ${esc(dateLongue(r.date_culte))}</p></div>
      </div>
      <div class="contenu remonte">
        <section class="carte flottante">
          <div class="chiffre-cle">
            <div><div class="discret" style="font-weight:600">Total présents</div><div class="valeur">${nombre(r.total)}</div></div>
            <div class="secondaires"><span><strong>${nombre(r.visiteurs)}</strong> visiteurs</span><span><strong>${nombre(r.convertis)}</strong> nouveaux convertis</span></div>
          </div>
          <div class="quatre">
            <div><strong>${nombre(r.hommes)}</strong><span>Hommes</span></div>
            <div><strong>${nombre(r.femmes)}</strong><span>Femmes</span></div>
            <div><strong>${nombre(r.jeunes)}</strong><span>Jeunes</span></div>
            <div><strong>${nombre(r.enfants)}</strong><span>Enfants</span></div>
          </div>
        </section>
        <section class="carte paires">
          <div class="paire"><span>Prédicateur</span><strong>${esc(r.predicateur) || '—'}</strong></div>
          <div class="paire"><span>Thème</span><strong>${esc(r.theme) || '—'}</strong></div>
        </section>
        <section class="carte paires">
          <div class="paire"><span>Offrandes</span><strong>${fcfa(r.offrandes)}</strong></div>
          <div class="paire"><span>Dîmes</span><strong>${fcfa(r.dimes)}</strong></div>
        </section>
        ${r.evenements ? `<section class="carte"><h2 style="font-size:13px;font-family:var(--texte);letter-spacing:.06em;text-transform:uppercase;color:var(--gris)">Événements particuliers</h2><p class="texte-libre">${esc(r.evenements)}</p></section>` : ''}
        ${r.statut === 'vu' && r.commentaire_apotre ? `<div class="mot-apotre"><span>Mot de l’apôtre</span>${esc(r.commentaire_apotre)}</div>` : ''}
        ${estApotre && r.statut !== 'vu' ? `
          <div class="champ pas-imprime"><label for="commentaire">Mot pour le pasteur (facultatif)</label>
            <textarea class="saisie" id="commentaire" placeholder="Écrire un encouragement ou une remarque…"></textarea></div>
          <button class="btn pas-imprime" id="btn-vu">${ICONES.coche} Marquer comme vu</button>` : ''}
        ${!estApotre && r.statut === 'envoye' ? '<a class="btn secondaire pas-imprime" href="#/nouveau">Corriger ce rapport</a>' : ''}
        <div class="deux-colonnes pas-imprime">
          <button class="btn secondaire" id="export-pdf">Exporter en PDF</button>
          <button class="btn secondaire" id="imprimer">Imprimer</button>
        </div>
      </div>`);

    document.getElementById('export-pdf').onclick = () => exporterPDFRapport(r);
    document.getElementById('imprimer').onclick = () => window.print();
    const btnVu = document.getElementById('btn-vu');
    if (btnVu) btnVu.onclick = async () => {
      btnVu.disabled = true; btnVu.textContent = 'Enregistrement…';
      const { error: err } = await sb.rpc('marquer_vu', { p_rapport: r.id, p_commentaire: document.getElementById('commentaire').value });
      if (err) { toast(messageErreur(err)); btnVu.disabled = false; btnVu.innerHTML = ICONES.coche + ' Marquer comme vu'; return; }
      toast('Rapport marqué comme vu');
      aller('/dimanche/' + r.date_culte);
    };
  }

  // ================= Exports =================

  const COLONNES = [
    ['eglise', 'Église'], ['predicateur', 'Prédicateur'], ['theme', 'Thème'],
    ['hommes', 'Hommes'], ['femmes', 'Femmes'], ['jeunes', 'Jeunes'], ['enfants', 'Enfants'], ['total', 'Total'],
    ['visiteurs', 'Visiteurs'], ['convertis', 'Convertis'], ['offrandes', 'Offrandes (FCFA)'], ['dimes', 'Dîmes (FCFA)'],
    ['statut', 'Statut'], ['evenements', 'Événements']
  ];
  const libelleStatut = (s) => (s === 'vu' ? 'Vu' : 'Envoyé');

  function exporterExcelDimanche(dimanche, liste) {
    const lignes = liste.map((r) => Object.fromEntries(COLONNES.map(([cle, titre]) => [titre, cle === 'statut' ? libelleStatut(r.statut) : r[cle]])));
    const tot = (cle) => liste.reduce((s, r) => s + (Number(r[cle]) || 0), 0);
    lignes.push({ 'Église': 'TOTAL', 'Hommes': tot('hommes'), 'Femmes': tot('femmes'), 'Jeunes': tot('jeunes'), 'Enfants': tot('enfants'), 'Total': tot('total'), 'Visiteurs': tot('visiteurs'), 'Convertis': tot('convertis'), 'Offrandes (FCFA)': tot('offrandes'), 'Dîmes (FCFA)': tot('dimes') });
    const feuille = XLSX.utils.json_to_sheet(lignes, { header: COLONNES.map((c) => c[1]) });
    feuille['!cols'] = COLONNES.map(([cle]) => ({ wch: ['theme', 'evenements'].includes(cle) ? 36 : cle === 'predicateur' || cle === 'eglise' ? 22 : 12 }));
    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(classeur, feuille, 'Dimanche ' + dimanche);
    XLSX.writeFile(classeur, 'CBN-rapports-' + dimanche + '.xlsx');
  }

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

  function exporterPDFDimanche(dimanche, liste) {
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape' });
    entetePDF(doc, 'Rapports du dimanche', dateLongue(dimanche));
    const cols = COLONNES.filter(([c]) => c !== 'evenements');
    doc.autoTable({
      startY: 34,
      head: [cols.map((c) => c[1])],
      body: liste.map((r) => cols.map(([cle]) => (cle === 'statut' ? libelleStatut(r.statut) : ['offrandes', 'dimes', 'hommes', 'femmes', 'jeunes', 'enfants', 'total', 'visiteurs', 'convertis'].includes(cle) ? nombre(r[cle]) : (r[cle] || '')))),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [75, 38, 114] },
      alternateRowStyles: { fillColor: [247, 245, 250] }
    });
    const avecEvenements = liste.filter((r) => r.evenements);
    if (avecEvenements.length) {
      doc.autoTable({
        head: [['Église', 'Événements particuliers']],
        body: avecEvenements.map((r) => [r.eglise, r.evenements]),
        styles: { fontSize: 9 }, headStyles: { fillColor: [75, 38, 114] }, columnStyles: { 0: { cellWidth: 45 } }
      });
    }
    doc.save('CBN-rapports-' + dimanche + '.pdf');
  }

  function exporterPDFRapport(r) {
    const doc = new window.jspdf.jsPDF();
    const eglise = r.eglises ? r.eglises.nom : '';
    entetePDF(doc, eglise, 'Dimanche ' + dateLongue(r.date_culte));
    doc.autoTable({
      startY: 34,
      body: [
        ['Pasteur', r.profils ? r.profils.nom : ''], ['Prédicateur', r.predicateur], ['Thème', r.theme],
        ['Hommes', nombre(r.hommes)], ['Femmes', nombre(r.femmes)], ['Jeunes', nombre(r.jeunes)], ['Enfants', nombre(r.enfants)],
        ['Total présents', nombre(r.total)], ['Visiteurs', nombre(r.visiteurs)], ['Nouveaux convertis', nombre(r.convertis)],
        ['Offrandes', fcfa(r.offrandes)], ['Dîmes', fcfa(r.dimes)],
        ['Événements particuliers', r.evenements || '—'], ['Statut', libelleStatut(r.statut)],
        ...(r.commentaire_apotre ? [['Mot de l’apôtre', r.commentaire_apotre]] : [])
      ],
      styles: { fontSize: 11, cellPadding: 3.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55, textColor: [74, 63, 87] } },
      alternateRowStyles: { fillColor: [247, 245, 250] }
    });
    doc.save('CBN-' + eglise.replace(/\s+/g, '-') + '-' + r.date_culte + '.pdf');
  }

  // ================= Démarrage =================

  window.addEventListener('hashchange', router);
  sb.auth.onAuthStateChange((evenement) => { if (evenement === 'SIGNED_OUT') { etat.profil = null; } });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

  if (CFG.SUPABASE_URL.includes('VOTRE-PROJET')) {
    afficher('<div class="chargement"><img src="icon-192.png" alt="" width="96" height="96"><p>Application pas encore reliée à la base de données (fichier config.js).</p></div>');
  } else {
    router();
  }
})();
