/* CBN — Espace fidèles (sans compte) : accueil, prédications, méditations, prière.
   Et, pour l'apôtre et les pasteurs : gestion des prédications, des méditations et des demandes. */
(function () {
  'use strict';
  const C = window.CBN;
  const { sb, etat, ICONES, esc, afficher, aller, toast, messageErreur } = C;
  const ID = '[0-9a-f-]{36}';
  const TAILLE_MAX = 50 * 1024 * 1024;   // limite de l'offre gratuite de Supabase
  const app = () => document.getElementById('app');
  const adresse = (chemin) => location.origin + location.pathname + '#' + chemin;

  // ================= Outils =================

  async function eglisesPubliques() {
    if (etat.eglises.length) return etat.eglises;
    const { data } = await sb.from('eglises').select('id, nom, ordre').order('ordre');
    etat.eglises = data || [];
    return etat.eglises;
  }
  const urlMedia = (chemin) => sb.storage.from('predications').getPublicUrl(chemin).data.publicUrl;
  function duree(sec) {
    sec = Math.round(Number(sec) || 0);
    if (!sec) return '';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }
  const dureeLongue = (sec) => { const m = Math.round((Number(sec) || 0) / 60); return m ? (m >= 60 ? duree(sec) : m + ' min') : ''; };
  function salutation() {
    const h = Number(new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', hour12: false, timeZone: C.CFG.FUSEAU }).format(new Date()));
    return h >= 18 || h < 4 ? 'Bonsoir' : 'Bonjour';
  }
  const taille = (o) => (o >= 1048576 ? (o / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(o / 1024)) + ' Ko');

  // En-tête de l'espace fidèles
  function heroFideles(titre, { sousTitre, retour, grand } = {}) {
    const connecte = Boolean(etat.profil);
    return `<div class="hero public${grand ? ' grand' : ''}">
      <div class="hero-ligne">
        ${retour ? `<a class="bouton-rond" href="${retour}" aria-label="Retour">${ICONES.retour}</a>` : `<div class="marque">${C.logoRond()}<span>Cité de la Bonne Nouvelle</span></div>`}
        <div class="hero-identite">${C.boutonTheme()}<a class="pilule-or" href="${connecte ? '#/' : '#/connexion'}" aria-label="${connecte ? 'Mon espace' : 'Espace pasteurs : connexion'}">${ICONES.profil}<span>${connecte ? 'Mon espace' : 'Pasteurs'}</span></a></div>
      </div>
      <div><h1>${titre}</h1>${sousTitre ? `<p>${sousTitre}</p>` : ''}</div>
    </div>`;
  }

  function lignePredication(p) {
    const infos = [p.predicateur, C.dateCourte(p.date_pred), dureeLongue(p.duree)].filter(Boolean).join(' · ');
    return `<a class="ligne media" href="#/predication/${p.id}">
      <span class="icone-media ${p.media}">${p.media === 'video' ? ICONES.video : ICONES.lecture}</span>
      <span class="corps"><strong>${esc(p.titre)}</strong><span>${esc(infos)}</span></span>
      <span class="pastille neutre">${p.media === 'video' ? 'Vidéo' : 'Audio'}</span></a>`;
  }

  // ================= Lecteur audio permanent =================
  // Le son continue pendant la navigation dans l'application et écran éteint.
  const lecteur = { audio: null, piste: null };

  function audio() {
    if (lecteur.audio) return lecteur.audio;
    const a = new Audio();
    a.preload = 'metadata';
    ['play', 'pause', 'timeupdate', 'loadedmetadata', 'ended'].forEach((ev) => a.addEventListener(ev, majLecteur));
    lecteur.audio = a;
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => a.play());
      navigator.mediaSession.setActionHandler('pause', () => a.pause());
      navigator.mediaSession.setActionHandler('seekbackward', () => { a.currentTime = Math.max(0, a.currentTime - 15); });
      navigator.mediaSession.setActionHandler('seekforward', () => { a.currentTime = Math.min(a.duration || 0, a.currentTime + 15); });
    }
    return a;
  }

  function ecouter(p) {
    const a = audio();
    if (!lecteur.piste || lecteur.piste.id !== p.id) {
      lecteur.piste = p;
      a.src = urlMedia(p.chemin);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: p.titre, artist: p.predicateur || 'Cité de la Bonne Nouvelle', album: 'Prédications de la CBN',
          artwork: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }]
        });
      }
    }
    a.play().catch(() => toast('Lecture impossible. Vérifiez votre connexion.'));
    document.querySelectorAll('video').forEach((v) => v.pause());
  }

  function majLecteur() {
    const a = lecteur.audio, p = lecteur.piste;
    const barre = document.getElementById('lecteur');
    if (!a || !p) { barre.hidden = true; document.body.classList.remove('avec-lecteur'); return; }
    const enLecture = !a.paused;
    const ici = location.hash === '#/predication/' + p.id;
    // Barre en bas (cachée sur la page de la prédication elle-même)
    barre.hidden = ici;
    document.body.classList.toggle('avec-lecteur', !ici);
    if (!ici) {
      if (barre.dataset.id !== p.id) {
        barre.dataset.id = p.id;
        barre.innerHTML = `<div class="lecteur-progres"><span></span></div>
          <div class="lecteur-ligne">
            <button class="lecteur-bouton" type="button" data-lecteur="basculer" aria-label="Lecture"></button>
            <a class="lecteur-titre" href="#/predication/${p.id}"><strong>${esc(p.titre)}</strong><span>${esc(p.predicateur || 'Prédication')}</span></a>
            <button class="lecteur-fermer" type="button" data-lecteur="fermer" aria-label="Fermer le lecteur">${ICONES.fermer}</button>
          </div>`;
      }
      const b = barre.querySelector('[data-lecteur="basculer"]');
      b.innerHTML = enLecture ? ICONES.pause : ICONES.lecture;
      b.setAttribute('aria-label', enLecture ? 'Pause' : 'Lecture');
      barre.querySelector('.lecteur-progres span').style.width = (a.duration ? (a.currentTime / a.duration) * 100 : 0) + '%';
    }
    // Grand lecteur de la page
    const grand = document.getElementById('grand-lecteur');
    if (grand && grand.dataset.id === p.id) {
      const bouton = grand.querySelector('[data-lecteur="basculer"]');
      bouton.innerHTML = enLecture ? ICONES.pause : ICONES.lecture;
      bouton.setAttribute('aria-label', enLecture ? 'Pause' : 'Lecture');
      const curseur = grand.querySelector('input[type=range]');
      if (a.duration && !curseur.dataset.glisse) { curseur.max = Math.floor(a.duration); curseur.value = Math.floor(a.currentTime); }
      grand.querySelector('[data-temps]').textContent = duree(a.currentTime) || '0:00';
      grand.querySelector('[data-total]').textContent = duree(a.duration || p.duree) || '';
    }
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lecteur]');
    if (!b) return;
    const a = lecteur.audio;
    const action = b.dataset.lecteur;
    if (action === 'basculer') {
      if (!lecteur.piste || (b.dataset.id && b.dataset.id !== lecteur.piste.id)) return;
      if (a.paused) a.play(); else a.pause();
    } else if (action === 'reculer' && a) a.currentTime = Math.max(0, a.currentTime - 15);
    else if (action === 'avancer' && a) a.currentTime = Math.min(a.duration || 0, a.currentTime + 15);
    else if (action === 'fermer' && a) { a.pause(); lecteur.piste = null; a.removeAttribute('src'); majLecteur(); }
  });
  window.addEventListener('hashchange', () => setTimeout(majLecteur, 0));

  // ================= Accueil des fidèles =================

  async function ecranAccueil() {
    const auj = C.aujourdhuiISO();
    const [, med, preds, evs, resp, params] = await Promise.all([
      eglisesPubliques(),
      sb.from('meditations').select('id, date_med, titre').eq('date_med', auj).maybeSingle(),
      sb.from('predications').select('*').order('date_pred', { ascending: false }).order('created_at', { ascending: false }).limit(3),
      sb.from('evenements').select('*').or(`date_fin.gte.${auj},and(date_fin.is.null,date_debut.gte.${auj})`).order('date_debut').limit(4),
      C.chargerResponsables().catch(() => []),
      C.chargerParametres().catch(() => ({}))
    ]);
    const erreur = preds.error || evs.error;
    afficher(`
      <div class="hero public grand accueil-hero">
        <div class="hero-ligne">
          <div class="marque">${C.logoRond()}<span>Cité de la Bonne Nouvelle</span></div>
          <div class="hero-identite">${C.boutonTheme()}<a class="pilule-or" href="${etat.profil ? '#/' : '#/connexion'}" aria-label="${etat.profil ? 'Mon espace' : 'Espace pasteurs : connexion'}">${ICONES.profil}<span>${etat.profil ? 'Mon espace' : 'Pasteurs'}</span></a></div>
        </div>
        <div>
          <p class="hero-petit">${salutation()} et bienvenue</p>
          <h1>Bienvenue à la Cité de la Bonne Nouvelle</h1>
        </div>
        ${C.carrouselRoyaume()}
      </div>
      <div class="contenu remonte-un-peu">
        ${erreur ? `<p class="erreur">${esc(messageErreur(erreur))}</p>` : ''}
        ${C.carteVersetDuJour(auj, { meditation: med.data })}
        ${C.carteLecture()}
        <div class="entete-section"><h2 class="titre-section">Prochains programmes</h2><a href="#/programmes">Tout voir</a></div>
        ${(evs.data || []).length ? `<div class="defile-cartes">${evs.data.map((ev) => `
          <a class="carte-programme" href="#/programmes">
            ${ev.affiche_url ? `<img src="${esc(ev.affiche_url)}" alt="" loading="lazy">` : `<span class="affiche-vide">${ICONES.agenda}</span>`}
            <span class="carte-programme-corps">
              <small>${esc(C.dateCourte(ev.date_debut))}${ev.heure ? ' · ' + esc(ev.heure) : ''}</small>
              <strong>${esc(ev.titre)}</strong>
              <span>${esc(C.nomEglise(ev.eglise_id))}</span>
            </span>
          </a>`).join('')}</div>` : '<p class="vide">Aucun programme à venir pour le moment.</p>'}
        <div class="entete-section"><h2 class="titre-section">Dernières prédications</h2><a href="#/predications">Tout voir</a></div>
        <div class="liste">${(preds.data || []).length ? preds.data.map(lignePredication).join('') : '<p class="vide">Les prédications à écouter apparaîtront ici.</p>'}</div>
        ${C.rangeeResponsables(resp)}
        <section class="carte appel-priere">
          <div class="icone-ligne grande">${ICONES.priere}</div>
          <div><h2>Besoin de prière ?</h2><p class="discret">Confiez-nous votre sujet de prière ou posez une question à l’apôtre. Vous pouvez rester anonyme.</p></div>
          <a class="btn" href="#/priere">Envoyer une demande</a>
        </section>
        ${C.blocSuivezNous(params)}
        <p class="discret pied">Cité de la Bonne Nouvelle</p>
      </div>`, 'accueil', 'fideles');
    C.remplirVersets();
    C.animerRoyaume();
  }

  // ================= Prédications =================

  async function ecranPredications() {
    const { data, error } = await sb.from('predications').select('*').order('date_pred', { ascending: false }).order('created_at', { ascending: false }).limit(200);
    await eglisesPubliques();
    const f = ecranPredications.filtre || (ecranPredications.filtre = { media: '', texte: '' });
    const dessiner = () => {
      const t = f.texte.toLowerCase();
      const liste = (data || []).filter((p) => (!f.media || p.media === f.media)
        && (!t || (p.titre + ' ' + p.predicateur + ' ' + p.description).toLowerCase().includes(t)));
      document.getElementById('resultats').innerHTML = liste.length ? liste.map(lignePredication).join('')
        : `<p class="vide">${(data || []).length ? 'Aucune prédication ne correspond.' : 'Aucune prédication pour le moment.'}</p>`;
    };
    afficher(`
      ${heroFideles('Prédications', { sousTitre: 'Écoutez ou regardez les messages de la CBN, même écran éteint.' })}
      <div class="contenu">
        ${error ? `<p class="erreur">${esc(messageErreur(error))}</p>` : ''}
        <input class="saisie" id="recherche" type="search" placeholder="Rechercher un titre, un prédicateur…" value="${esc(f.texte)}" aria-label="Rechercher une prédication">
        <div class="puces" role="group" aria-label="Type de prédication">
          ${[['', 'Toutes'], ['audio', 'Audio'], ['video', 'Vidéo']].map(([v, n]) => `<button class="puce ${f.media === v ? 'active' : ''}" data-media="${v}">${n}</button>`).join('')}
        </div>
        <div class="liste" id="resultats"></div>
      </div>`, 'predications', 'fideles');
    dessiner();
    document.getElementById('recherche').oninput = (e) => { f.texte = e.target.value; dessiner(); };
    document.querySelectorAll('[data-media]').forEach((b) => {
      b.onclick = () => {
        f.media = b.dataset.media;
        document.querySelectorAll('[data-media]').forEach((x) => x.classList.toggle('active', x === b));
        dessiner();
      };
    });
  }

  async function ecranPredication({ id }) {
    const { data: p, error } = await sb.from('predications').select('*').eq('id', id).maybeSingle();
    await eglisesPubliques();
    if (error || !p) {
      afficher(`${heroFideles('Prédication', { retour: '#/predications' })}<div class="contenu"><p class="erreur">${esc(error ? messageErreur(error) : 'Cette prédication n’existe plus.')}</p></div>`, 'predications', 'fideles');
      return;
    }
    const url = urlMedia(p.chemin);
    const partage = `*${p.titre}*${p.predicateur ? '\n' + p.predicateur : ''}\nPrédication de la Cité de la Bonne Nouvelle à écouter ici :\n${adresse('/predication/' + p.id)}`;
    afficher(`
      ${heroFideles(esc(p.titre), { retour: '#/predications', sousTitre: esc([p.predicateur, C.dateLongue(p.date_pred), p.eglise_id ? C.nomEglise(p.eglise_id) : ''].filter(Boolean).join(' · ')) })}
      <div class="contenu">
        ${p.media === 'video' ? `
          <div class="video-cadre"><video controls playsinline preload="metadata" src="${esc(url)}" poster="icon-512.png"></video></div>`
        : `
          <section class="carte grand-lecteur" id="grand-lecteur" data-id="${p.id}">
            <div class="pochette" aria-hidden="true">${C.logoRond()}<span>${ICONES.ecouter}</span></div>
            <input type="range" min="0" max="${p.duree || 0}" value="0" step="1" aria-label="Position dans la prédication">
            <div class="temps"><span data-temps>0:00</span><span data-total>${esc(duree(p.duree))}</span></div>
            <div class="commandes-lecteur">
              <button class="bouton-rond clair" type="button" data-lecteur="reculer" aria-label="Reculer de 15 secondes">−15</button>
              <button class="lecture-grand" type="button" data-lecteur="basculer" data-id="${p.id}" aria-label="Lecture">${ICONES.lecture}</button>
              <button class="bouton-rond clair" type="button" data-lecteur="avancer" aria-label="Avancer de 15 secondes">+15</button>
            </div>
          </section>`}
        ${p.description ? `<section class="carte"><h2 class="petit-titre">À propos de ce message</h2><p class="texte-libre">${esc(p.description)}</p></section>` : ''}
        <div class="deux-colonnes">
          <a class="btn whatsapp" href="https://wa.me/?text=${encodeURIComponent(partage)}" target="_blank" rel="noopener">${ICONES.whatsapp} Partager</a>
          <a class="btn secondaire" href="${esc(url)}" download target="_blank" rel="noopener">${ICONES.nuage} Télécharger</a>
        </div>
      </div>`, 'predications', 'fideles');

    if (p.media === 'audio') {
      const grand = document.getElementById('grand-lecteur');
      grand.querySelector('[data-lecteur="basculer"]').onclick = (e) => {
        e.stopPropagation();
        if (lecteur.piste && lecteur.piste.id === p.id && !lecteur.audio.paused) lecteur.audio.pause();
        else ecouter(p);
      };
      const curseur = grand.querySelector('input[type=range]');
      curseur.oninput = () => { curseur.dataset.glisse = '1'; grand.querySelector('[data-temps]').textContent = duree(curseur.value) || '0:00'; };
      curseur.onchange = () => {
        delete curseur.dataset.glisse;
        if (lecteur.piste && lecteur.piste.id === p.id) lecteur.audio.currentTime = Number(curseur.value);
        else { ecouter(p); lecteur.audio.addEventListener('loadedmetadata', () => { lecteur.audio.currentTime = Number(curseur.value); }, { once: true }); }
      };
      majLecteur();
    } else {
      const v = app().querySelector('video');
      v.addEventListener('play', () => { if (lecteur.audio) lecteur.audio.pause(); });
    }
  }

  // ================= Méditations =================

  async function ecranMeditations() {
    const auj = C.aujourdhuiISO();
    const { data, error } = await sb.from('meditations').select('id, date_med, titre, reference').lte('date_med', auj).order('date_med', { ascending: false }).limit(60);
    const [premiere, ...autres] = data || [];
    afficher(`
      ${heroFideles('Méditations de l’apôtre', { retour: '#/parole', sousTitre: 'Les méditations écrites par l’apôtre Elvis Yumto.' })}
      <div class="contenu">
        ${error ? `<p class="erreur">${esc(messageErreur(error))}</p>` : ''}
        ${premiere ? `<a class="carte flottante meditation-carte" href="#/meditation/${premiere.date_med}">
            <span class="surtitre">${premiere.date_med === auj ? 'Aujourd’hui' : esc(C.dateJour(premiere.date_med))}</span>
            <div class="grand-titre">${esc(premiere.titre)}</div>
            ${premiere.reference ? `<p class="discret">${esc(premiere.reference)}</p>` : ''}
            <span class="lien-fleche">Lire ${ICONES.suivant}</span></a>` : '<p class="vide">Aucune méditation publiée pour le moment.</p>'}
        ${autres.length ? `<h2 class="titre-section">Méditations précédentes</h2>
          <div class="liste">${autres.map((m) => `<a class="ligne" href="#/meditation/${m.date_med}">
            <span class="date-bloc petit clair" aria-hidden="true"><strong>${C.versDate(m.date_med).getUTCDate()}</strong><span>${esc(C.moisCourt(m.date_med.slice(0, 7)))}</span></span>
            <span class="corps"><strong>${esc(m.titre)}</strong><span>${esc(m.reference || C.dateJour(m.date_med))}</span></span>${ICONES.suivant}</a>`).join('')}</div>` : ''}
      </div>`, 'parole', 'fideles');
  }

  async function ecranMeditation({ date }) {
    const auj = C.aujourdhuiISO();
    const { data: m, error } = await sb.from('meditations').select('*').eq('date_med', date).maybeSingle();
    if (error || !m || (date > auj && !C.estApotre())) return aller('/verset/' + (date > auj ? auj : date));
    const [{ data: avant }, { data: apres }] = await Promise.all([
      sb.from('meditations').select('date_med').lt('date_med', date).order('date_med', { ascending: false }).limit(1),
      sb.from('meditations').select('date_med').gt('date_med', date).lte('date_med', auj).order('date_med').limit(1)
    ]);
    const partage = [`*Méditation du jour* — ${C.dateLongue(m.date_med)}`, `*${m.titre}*`,
      m.verset ? `« ${m.verset} »${m.reference ? ' (' + m.reference + ')' : ''}` : m.reference,
      '', m.texte.length > 400 ? m.texte.slice(0, 400).trim() + '…' : m.texte, '', 'Lire la suite : ' + adresse('/meditation/' + m.date_med)]
      .filter((l) => l !== null && l !== undefined).join('\n');
    afficher(`
      ${heroFideles(esc(m.titre), { retour: '#/meditations', sousTitre: esc(C.dateJour(m.date_med).replace(/^./, (c) => c.toUpperCase())) })}
      <div class="contenu">
        <article class="carte lecture">
          ${m.verset || m.reference ? `<blockquote class="verset grand">${m.verset ? '« ' + esc(m.verset) + ' »' : ''}${m.reference ? `<cite>${esc(m.reference)}</cite>` : ''}</blockquote>` : ''}
          ${m.texte ? `<div class="texte-meditation">${esc(m.texte).split(/\n{2,}/).map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`).join('')}</div>` : ''}
          ${m.priere ? `<div class="mot-apotre"><span>Prière</span>${esc(m.priere)}</div>` : ''}
        </article>
        <a class="btn whatsapp" href="https://wa.me/?text=${encodeURIComponent(partage)}" target="_blank" rel="noopener">${ICONES.whatsapp} Partager sur WhatsApp</a>
        <div class="deux-colonnes">
          ${(avant || [])[0] ? `<a class="btn secondaire" href="#/meditation/${avant[0].date_med}">${ICONES.retour} Veille</a>` : '<span></span>'}
          ${(apres || [])[0] ? `<a class="btn secondaire" href="#/meditation/${apres[0].date_med}">Suivante ${ICONES.suivant}</a>` : '<span></span>'}
        </div>
      </div>`, 'parole', 'fideles');
  }

  // ================= Demande de prière / question =================

  async function ecranPriere() {
    const eglises = await eglisesPubliques();
    afficher(`
      ${heroFideles('Prière et questions', { sousTitre: 'Votre demande est reçue par votre pasteur et par l’apôtre. Votre nom et votre numéro sont facultatifs.' })}
      <form class="contenu" id="form-priere" novalidate>
        <fieldset class="carte" style="border:0;margin:0">
          <legend class="visuellement-cache">Type de demande</legend>
          <div class="choix-type">
            <label><input type="radio" name="type" value="priere" checked><span>${ICONES.priere}<strong>Demande de prière</strong><small>Un sujet pour lequel prier</small></span></label>
            <label><input type="radio" name="type" value="question"><span>${ICONES.livre}<strong>Question à l’apôtre</strong><small>Une question sur la foi, la vie…</small></span></label>
          </div>
        </fieldset>
        <section class="carte">
          <div class="champ"><label for="d-message">Votre message</label>
            <textarea class="saisie" id="d-message" maxlength="2000" placeholder="Écrivez votre sujet de prière ou votre question…" style="min-height:140px"></textarea>
            <span class="discret" id="d-compte" style="text-align:right">0 / 2000</span></div>
          <div class="champ"><label for="d-eglise">Votre église</label>
            <select class="saisie" id="d-eglise"><option value="">Je ne fréquente pas encore une église CBN</option>${eglises.map((e) => `<option value="${e.id}">${esc(e.nom)}</option>`).join('')}</select></div>
          <div class="champ"><label for="d-nom">Votre nom <span class="discret">(facultatif)</span></label>
            <input class="saisie" id="d-nom" maxlength="100" autocomplete="name" placeholder="Laissez vide pour rester anonyme"></div>
          <div class="champ"><label for="d-tel">Téléphone ou WhatsApp <span class="discret">(facultatif)</span></label>
            <div class="groupe"><span class="prefixe">+237</span><input id="d-tel" type="tel" inputmode="tel" maxlength="20" placeholder="Pour qu’on puisse vous rappeler"></div></div>
        </section>
        <p class="erreur" id="erreur" hidden></p>
        <button class="btn" type="submit" id="btn-priere">${ICONES.envoyer} Envoyer</button>
      </form>`, 'priere', 'fideles');

    const msg = document.getElementById('d-message');
    msg.oninput = () => { document.getElementById('d-compte').textContent = msg.value.length + ' / 2000'; };
    document.getElementById('form-priere').onsubmit = async (e) => {
      e.preventDefault();
      const erreur = document.getElementById('erreur');
      const montrer = (t) => { erreur.textContent = t; erreur.hidden = false; };
      erreur.hidden = true;
      const message = msg.value.trim();
      if (message.length < 3) return montrer('Écrivez votre message.');
      let dernier = 0;
      try { dernier = Number(localStorage.getItem('cbn_derniere_demande')) || 0; } catch (err) { /* rien */ }
      if (Date.now() - dernier < 60000) return montrer('Merci de patienter une minute avant d’envoyer une autre demande.');
      const tel = document.getElementById('d-tel').value.replace(/[^\d+]/g, '');
      const donnees = {
        type: document.querySelector('input[name=type]:checked').value,
        eglise_id: document.getElementById('d-eglise').value || null,
        nom: document.getElementById('d-nom').value.trim(),
        telephone: tel ? C.telephoneInternational(tel) : '',
        message
      };
      const btn = document.getElementById('btn-priere');
      btn.disabled = true; btn.textContent = 'Envoi…';
      const r = await sb.from('demandes').insert(donnees);
      if (r.error) { btn.disabled = false; btn.innerHTML = ICONES.envoyer + ' Réessayer'; return montrer(messageErreur(r.error)); }
      try { localStorage.setItem('cbn_derniere_demande', String(Date.now())); } catch (err) { /* rien */ }
      afficher(`
        ${heroFideles('Merci', { sousTitre: donnees.type === 'question' ? 'Votre question a bien été transmise à l’apôtre.' : 'Votre demande de prière a bien été reçue.' })}
        <div class="contenu">
          <section class="carte flottante merci">
            <div class="icone-ligne grande">${ICONES.coche}</div>
            <div class="grand-titre">${donnees.type === 'question' ? 'Question envoyée' : 'Nous prions avec vous'}</div>
            <p class="discret">${donnees.telephone ? 'Quelqu’un pourra vous rappeler au numéro indiqué.' : 'Vous n’avez pas laissé de numéro : votre demande reste anonyme.'}</p>
          </section>
          <a class="btn secondaire" href="#/priere" id="autre">Envoyer une autre demande</a>
          <a class="btn lien" href="#/">Retour à l’accueil</a>
        </div>`, 'priere', 'fideles');
      document.getElementById('autre').onclick = (ev) => { ev.preventDefault(); ecranPriere(); };
    };
  }

  // ================= Gestion : demandes reçues =================

  async function ecranDemandes() {
    const apotre = C.estApotre();
    const f = ecranDemandes.filtre || (ecranDemandes.filtre = { statut: 'nouvelle', type: '' });
    let q = sb.from('demandes').select('*').eq('statut', f.statut).order('created_at', { ascending: false }).limit(100);
    if (f.type) q = q.eq('type', f.type);
    const [{ data, error }, { count: nouvelles }] = await Promise.all([q, sb.from('demandes').select('id', { count: 'exact', head: true }).eq('statut', 'nouvelle')]);
    const quand = (ts) => C.dateCourte(new Intl.DateTimeFormat('en-CA', { timeZone: C.CFG.FUSEAU }).format(new Date(ts))) + ' à ' + C.heure(ts);
    afficher(`
      ${C.hero(apotre ? 'Prières et questions' : 'Demandes de prière', { retour: '#/plus', sousTitre: 'Envoyées par les fidèles depuis l’espace fidèles.' })}
      <div class="contenu">
        <div class="puces" role="group" aria-label="Filtrer">
          <button class="puce ${f.statut === 'nouvelle' ? 'active' : ''}" data-statut="nouvelle">Nouvelles${nouvelles ? ' (' + nouvelles + ')' : ''}</button>
          <button class="puce ${f.statut === 'traitee' ? 'active' : ''}" data-statut="traitee">Traitées</button>
          ${apotre ? `<button class="puce ${f.type === 'priere' ? 'active' : ''}" data-type="priere">Prières</button>
                      <button class="puce ${f.type === 'question' ? 'active' : ''}" data-type="question">Questions</button>` : ''}
        </div>
        ${error ? `<p class="erreur">${esc(messageErreur(error))}</p>` : ''}
        ${(data || []).length ? data.map((d) => `
          <article class="carte demande">
            <div class="entete-carte">
              <span class="pastille ${d.type === 'question' ? 'type-annonce' : 'neutre'}">${d.type === 'question' ? 'Question' : 'Prière'}</span>
              <span class="discret">${esc(quand(d.created_at))}</span>
            </div>
            <p class="texte-libre">${esc(d.message)}</p>
            <p class="discret">${esc(d.nom || 'Anonyme')} · ${esc(d.eglise_id ? C.nomEglise(d.eglise_id) : 'Sans église')}${d.telephone ? ' · ' + esc(C.telephoneLisible(d.telephone)) : ''}</p>
            <div class="evenement-actions">
              ${d.telephone ? `<a class="btn secondaire petit" href="tel:+${esc(C.telephoneInternational(d.telephone))}">${ICONES.suivi} Appeler</a>
                <a class="btn whatsapp petit" href="${esc(C.lienWhatsApp(d.telephone, 'Bonjour' + (d.nom ? ' ' + d.nom : '') + ', ici la Cité de la Bonne Nouvelle. Nous avons bien reçu votre ' + (d.type === 'question' ? 'question' : 'demande de prière') + '.'))}" target="_blank" rel="noopener">${ICONES.whatsapp} WhatsApp</a>` : ''}
              ${d.statut === 'nouvelle' ? `<button class="btn petit" data-traiter="${d.id}">${ICONES.coche} Traitée</button>` : ''}
              <button class="bouton-suppr" data-suppr="${d.id}" aria-label="Supprimer">Supprimer</button>
            </div>
          </article>`).join('') : `<p class="vide">${f.statut === 'nouvelle' ? 'Aucune nouvelle demande.' : 'Aucune demande traitée.'}</p>`}
      </div>`, 'plus');
    document.querySelectorAll('[data-statut]').forEach((b) => { b.onclick = () => { f.statut = b.dataset.statut; ecranDemandes(); }; });
    document.querySelectorAll('[data-type]').forEach((b) => { b.onclick = () => { f.type = f.type === b.dataset.type ? '' : b.dataset.type; ecranDemandes(); }; });
    document.querySelectorAll('[data-traiter]').forEach((b) => {
      b.onclick = async () => {
        b.disabled = true;
        const r = await sb.from('demandes').update({ statut: 'traitee', traite_par: etat.profil.id, traite_le: new Date().toISOString() }).eq('id', b.dataset.traiter);
        if (r.error) { b.disabled = false; return toast(messageErreur(r.error)); }
        toast('Demande marquée comme traitée');
        ecranDemandes();
      };
    });
    document.querySelectorAll('[data-suppr]').forEach((b) => C.boutonConfirme(b, async () => {
      const r = await sb.from('demandes').delete().eq('id', b.dataset.suppr);
      if (r.error) return toast(messageErreur(r.error));
      toast('Demande supprimée'); ecranDemandes();
    }, 'Confirmer'));
  }

  // ================= Gestion : prédications =================

  async function ecranGererPredications() {
    const { data, error } = await sb.from('predications').select('*').order('date_pred', { ascending: false }).order('created_at', { ascending: false }).limit(200);
    const total = (data || []).reduce((s, p) => s + (Number(p.taille) || 0), 0);
    afficher(`
      ${C.hero('Prédications', { retour: '#/plus', sousTitre: 'Messages audio et vidéo que les fidèles écoutent dans l’application.' })}
      <div class="contenu">
        <a class="btn" href="#/gerer/predications/nouvelle">${ICONES.plus} Ajouter une prédication</a>
        <div class="info">${ICONES.info}<span>Fichiers de 50 Mo au maximum (environ 1 h 45 d’audio MP3 en qualité normale, quelques minutes de vidéo). Espace utilisé : ${esc(taille(total))} sur 1 Go.</span></div>
        ${error ? `<p class="erreur">${esc(messageErreur(error))}</p>` : ''}
        <div class="liste">${(data || []).length ? data.map((p) => `
          <div class="ligne media">
            <span class="icone-media ${p.media}">${p.media === 'video' ? ICONES.video : ICONES.lecture}</span>
            <a class="corps lien-corps" href="#/predication/${p.id}"><strong>${esc(p.titre)}</strong><span>${esc([p.predicateur, C.dateCourte(p.date_pred), C.nomEglise(p.eglise_id), taille(p.taille)].filter(Boolean).join(' · '))}</span></a>
            ${C.peutPublier(p.eglise_id) ? `<a class="bouton-suppr" href="#/gerer/predication/${p.id}" aria-label="Modifier">${ICONES.crayon}</a>` : ''}
          </div>`).join('') : '<p class="vide">Aucune prédication. Ajoutez le premier message.</p>'}</div>
      </div>`, 'plus');
  }

  function televerser(chemin, fichier, progression) {
    return new Promise(async (resoudre, rejeter) => {
      const { data } = await sb.auth.getSession();
      const jeton = data.session && data.session.access_token;
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${C.CFG.SUPABASE_URL}/storage/v1/object/predications/${chemin.split('/').map(encodeURIComponent).join('/')}`);
      xhr.setRequestHeader('Authorization', 'Bearer ' + jeton);
      xhr.setRequestHeader('apikey', C.CFG.SUPABASE_ANON_KEY);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.setRequestHeader('cache-control', 'max-age=31536000');
      xhr.setRequestHeader('Content-Type', fichier.type || 'application/octet-stream');
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) progression(e.loaded / e.total); };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resoudre();
        let m = xhr.responseText;
        try { m = JSON.parse(xhr.responseText).message || m; } catch (err) { /* texte brut */ }
        rejeter(new Error(/size|too large|exceeded/i.test(m) ? 'Le fichier dépasse 50 Mo.' : m));
      };
      xhr.onerror = () => rejeter(new Error('Failed to fetch'));
      xhr.send(fichier);
    });
  }

  function lireDuree(fichier) {
    return new Promise((resoudre) => {
      const el = document.createElement(fichier.type.startsWith('video') ? 'video' : 'audio');
      const url = URL.createObjectURL(fichier);
      const fin = (d) => { URL.revokeObjectURL(url); resoudre(Math.round(d || 0)); };
      el.preload = 'metadata';
      el.onloadedmetadata = () => fin(isFinite(el.duration) ? el.duration : 0);
      el.onerror = () => fin(0);
      setTimeout(() => fin(0), 8000);
      el.src = url;
    });
  }

  async function ecranFormPredication({ id }) {
    let p = null;
    if (id) {
      const r = await sb.from('predications').select('*').eq('id', id).maybeSingle();
      p = r.data;
      if (!p || !C.peutPublier(p.eglise_id)) { toast('Vous ne pouvez pas modifier cette prédication.'); return aller('/gerer/predications'); }
    }
    const apotre = C.estApotre();
    const v = p || { date_pred: C.aujourdhuiISO(), eglise_id: apotre ? null : etat.profil.eglise_id, predicateur: '' };
    afficher(`
      ${C.hero(p ? 'Modifier la prédication' : 'Nouvelle prédication', { retour: '#/gerer/predications' })}
      <form class="contenu" id="form-pred" novalidate>
        ${p ? '' : `<section class="carte">
          <h2>Le fichier</h2>
          <label class="zone-fichier" for="p-fichier">
            ${ICONES.nuage}<strong id="p-nom-fichier">Choisir un fichier audio ou vidéo</strong>
            <span class="discret">MP3, M4A, MP4… 50 Mo au maximum</span>
          </label>
          <input class="visuellement-cache" id="p-fichier" type="file" accept="audio/*,video/*">
          <div class="progression-envoi" id="p-progression" hidden><span></span></div>
        </section>`}
        <section class="carte">
          <div class="champ"><label for="p-titre">Titre</label><input class="saisie" id="p-titre" maxlength="200" value="${esc(v.titre)}" placeholder="Ex. : La puissance de la prière"></div>
          <div class="champ"><label for="p-predicateur">Prédicateur</label><input class="saisie" id="p-predicateur" value="${esc(v.predicateur)}" placeholder="Ex. : Apôtre Elvis Yumto"></div>
          <div class="deux-colonnes">
            <div class="champ"><label for="p-date">Date du message</label><input class="saisie" id="p-date" type="date" value="${esc(v.date_pred)}" max="${C.aujourdhuiISO()}"></div>
            <div class="champ"><label for="p-eglise">Église</label>
              ${apotre ? `<select class="saisie" id="p-eglise"><option value="">Toute la CBN</option>${etat.eglises.map((e) => `<option value="${e.id}" ${v.eglise_id === e.id ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select>`
                       : `<input class="saisie" id="p-eglise" value="${esc(C.nomEglise(etat.profil.eglise_id))}" disabled>`}</div>
          </div>
          <div class="champ"><label for="p-desc">Description <span class="discret">(facultatif)</span></label><textarea class="saisie" id="p-desc" placeholder="Passages bibliques, résumé…">${esc(v.description)}</textarea></div>
        </section>
        <p class="erreur" id="erreur" hidden></p>
        <button class="btn" type="submit" id="btn-pred">${ICONES.coche} ${p ? 'Enregistrer' : 'Publier'}</button>
        ${p ? '<button class="btn secondaire" type="button" id="supprimer">Supprimer cette prédication</button>' : ''}
      </form>`, 'plus');

    let fichier = null;
    const champFichier = document.getElementById('p-fichier');
    if (champFichier) champFichier.onchange = () => {
      fichier = champFichier.files[0] || null;
      const nom = document.getElementById('p-nom-fichier');
      if (!fichier) { nom.textContent = 'Choisir un fichier audio ou vidéo'; return; }
      nom.textContent = fichier.name + ' · ' + taille(fichier.size);
      if (!document.getElementById('p-titre').value) document.getElementById('p-titre').value = fichier.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    };

    document.getElementById('form-pred').onsubmit = async (e) => {
      e.preventDefault();
      const erreur = document.getElementById('erreur');
      const montrer = (t) => { erreur.textContent = t; erreur.hidden = false; };
      erreur.hidden = true;
      const val = (k) => document.getElementById(k).value.trim();
      const donnees = {
        titre: val('p-titre'), predicateur: val('p-predicateur'), date_pred: val('p-date'), description: val('p-desc'),
        eglise_id: apotre ? (val('p-eglise') || null) : etat.profil.eglise_id
      };
      if (!p && !fichier) return montrer('Choisissez le fichier audio ou vidéo.');
      if (!p && !/^(audio|video)\//.test(fichier.type)) return montrer('Ce fichier n’est ni un audio ni une vidéo.');
      if (!p && fichier.size > TAILLE_MAX) return montrer(`Le fichier fait ${taille(fichier.size)} : la limite est de 50 Mo. Réduisez la qualité ou coupez le fichier.`);
      if (!donnees.titre) return montrer('Indiquez le titre.');
      if (!donnees.date_pred) return montrer('Indiquez la date du message.');
      const btn = document.getElementById('btn-pred');
      btn.disabled = true;
      if (p) {
        btn.textContent = 'Enregistrement…';
        const r = await sb.from('predications').update(donnees).eq('id', p.id);
        if (r.error) { btn.disabled = false; btn.innerHTML = ICONES.coche + ' Enregistrer'; return montrer(messageErreur(r.error)); }
        toast('Prédication modifiée'); return aller('/gerer/predications');
      }
      const ext = (fichier.name.match(/\.([a-z0-9]{2,5})$/i) || [, fichier.type.split('/')[1] || 'bin'])[1].toLowerCase();
      const propre = donnees.titre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'predication';
      const chemin = `${donnees.eglise_id || 'general'}/${Date.now()}-${propre}.${ext}`;
      const barre = document.getElementById('p-progression');
      barre.hidden = false;
      btn.textContent = 'Envoi du fichier… 0 %';
      try {
        const dureeSec = await lireDuree(fichier);
        await televerser(chemin, fichier, (x) => {
          barre.querySelector('span').style.width = Math.round(x * 100) + '%';
          btn.textContent = 'Envoi du fichier… ' + Math.round(x * 100) + ' %';
        });
        const r = await sb.from('predications').insert({ ...donnees, media: fichier.type.startsWith('video') ? 'video' : 'audio', chemin, taille: fichier.size, duree: dureeSec });
        if (r.error) { await sb.storage.from('predications').remove([chemin]); throw r.error; }
        toast('Prédication publiée');
        aller('/gerer/predications');
      } catch (err) {
        btn.disabled = false; btn.innerHTML = ICONES.coche + ' Réessayer';
        barre.hidden = true;
        montrer(messageErreur(err));
      }
    };
    C.boutonConfirme(document.getElementById('supprimer'), async () => {
      await sb.storage.from('predications').remove([p.chemin]);
      const r = await sb.from('predications').delete().eq('id', p.id);
      if (r.error) return toast(messageErreur(r.error));
      if (lecteur.piste && lecteur.piste.id === p.id) { lecteur.audio.pause(); lecteur.piste = null; majLecteur(); }
      toast('Prédication supprimée'); aller('/gerer/predications');
    }, 'Appuyez encore pour supprimer');
  }

  // ================= Gestion : méditations (apôtre et admin) =================

  async function ecranGererMeditations() {
    if (!C.estApotre()) return aller('/plus');
    const auj = C.aujourdhuiISO();
    const { data, error } = await sb.from('meditations').select('id, date_med, titre, reference').gte('date_med', C.ajouterJours(auj, -60)).order('date_med', { ascending: false });
    const aVenir = (data || []).filter((m) => m.date_med > auj).reverse();
    const passees = (data || []).filter((m) => m.date_med <= auj);
    const aujourdhui = passees.find((m) => m.date_med === auj);
    const ligne = (m) => `<a class="ligne" href="#/gerer/meditation/${m.id}">
      <span class="date-bloc petit clair" aria-hidden="true"><strong>${C.versDate(m.date_med).getUTCDate()}</strong><span>${esc(C.moisCourt(m.date_med.slice(0, 7)))}</span></span>
      <span class="corps"><strong>${esc(m.titre)}</strong><span>${esc(m.reference || C.dateJour(m.date_med))}</span></span>${ICONES.crayon}</a>`;
    afficher(`
      ${C.hero('Méditations du jour', { retour: '#/plus', sousTitre: 'Préparez-les à l’avance : chacune paraît automatiquement à sa date.' })}
      <div class="contenu">
        ${aujourdhui ? '' : `<div class="info">${ICONES.info}<span>Pas encore de méditation pour aujourd’hui : les fidèles voient la dernière publiée.</span></div>`}
        <a class="btn" href="#/gerer/meditation/nouvelle">${ICONES.plus} Écrire une méditation</a>
        ${error ? `<p class="erreur">${esc(messageErreur(error))}</p>` : ''}
        ${aVenir.length ? `<h2 class="titre-section">Programmées</h2><div class="liste">${aVenir.map(ligne).join('')}</div>` : ''}
        <h2 class="titre-section">Publiées</h2>
        <div class="liste">${passees.length ? passees.map(ligne).join('') : '<p class="vide">Aucune méditation publiée.</p>'}</div>
      </div>`, 'plus');
  }

  async function ecranFormMeditation({ id }) {
    if (!C.estApotre()) return aller('/plus');
    let m = null;
    if (id) { const r = await sb.from('meditations').select('*').eq('id', id).maybeSingle(); m = r.data; if (!m) return aller('/gerer/meditations'); }
    let date = C.aujourdhuiISO();
    if (!m) {
      // Proposer le prochain jour libre
      const { data } = await sb.from('meditations').select('date_med').gte('date_med', date).order('date_med').limit(60);
      const prises = new Set((data || []).map((x) => x.date_med));
      while (prises.has(date)) date = C.ajouterJours(date, 1);
    }
    const v = m || { date_med: date };
    afficher(`
      ${C.hero(m ? 'Modifier la méditation' : 'Nouvelle méditation', { retour: '#/gerer/meditations' })}
      <form class="contenu" id="form-med" novalidate>
        <section class="carte">
          <div class="champ"><label for="m-date">Date de parution</label><input class="saisie" id="m-date" type="date" value="${esc(v.date_med)}"></div>
          <div class="champ"><label for="m-titre">Titre</label><input class="saisie" id="m-titre" maxlength="200" value="${esc(v.titre)}" placeholder="Ex. : Marcher par la foi"></div>
          <div class="champ"><label for="m-ref">Référence biblique</label><input class="saisie" id="m-ref" value="${esc(v.reference)}" placeholder="Ex. : 2 Corinthiens 5:7"></div>
          <div class="champ"><label for="m-verset">Texte du verset</label><textarea class="saisie" id="m-verset" placeholder="Car nous marchons par la foi et non par la vue.">${esc(v.verset)}</textarea></div>
          <div class="champ"><label for="m-texte">Méditation</label><textarea class="saisie" id="m-texte" style="min-height:220px" placeholder="Laissez une ligne vide entre les paragraphes.">${esc(v.texte)}</textarea></div>
          <div class="champ"><label for="m-priere">Prière <span class="discret">(facultatif)</span></label><textarea class="saisie" id="m-priere">${esc(v.priere)}</textarea></div>
        </section>
        <p class="erreur" id="erreur" hidden></p>
        <button class="btn" type="submit" id="btn-med">${ICONES.coche} ${m ? 'Enregistrer' : 'Publier'}</button>
        ${m ? '<button class="btn secondaire" type="button" id="supprimer">Supprimer cette méditation</button>' : ''}
      </form>`, 'plus');
    document.getElementById('form-med').onsubmit = async (e) => {
      e.preventDefault();
      const erreur = document.getElementById('erreur');
      const montrer = (t) => { erreur.textContent = t; erreur.hidden = false; };
      const val = (k) => document.getElementById(k).value.trim();
      const donnees = { date_med: val('m-date'), titre: val('m-titre'), reference: val('m-ref'), verset: val('m-verset'), texte: val('m-texte'), priere: val('m-priere') };
      if (!donnees.date_med) return montrer('Choisissez la date de parution.');
      if (!donnees.titre) return montrer('Indiquez le titre.');
      if (!donnees.texte && !donnees.verset) return montrer('Écrivez la méditation.');
      const btn = document.getElementById('btn-med');
      btn.disabled = true;
      const r = m ? await sb.from('meditations').update(donnees).eq('id', m.id) : await sb.from('meditations').insert(donnees);
      if (r.error) {
        btn.disabled = false;
        return montrer(/duplicate|unique/i.test(r.error.message) ? 'Il y a déjà une méditation à cette date.' : messageErreur(r.error));
      }
      toast(donnees.date_med > C.aujourdhuiISO() ? 'Méditation programmée pour le ' + C.dateLongue(donnees.date_med) : 'Méditation publiée');
      aller('/gerer/meditations');
    };
    C.boutonConfirme(document.getElementById('supprimer'), async () => {
      const r = await sb.from('meditations').delete().eq('id', m.id);
      if (r.error) return toast(messageErreur(r.error));
      toast('Méditation supprimée'); aller('/gerer/meditations');
    }, 'Appuyez encore pour supprimer');
  }

  // ================= Routes =================
  C.route(/^\/$/, ecranAccueil, { invite: true });
  C.route(/^\/fideles$/, ecranAccueil, { public: true });
  C.route(/^\/predications$/, ecranPredications, { public: true });
  C.route(new RegExp(`^/predication/(?<id>${ID})$`), ecranPredication, { public: true });
  C.route(/^\/meditations$/, ecranMeditations, { public: true });
  C.route(/^\/meditation\/(?<date>\d{4}-\d{2}-\d{2})$/, ecranMeditation, { public: true });
  C.route(/^\/priere$/, ecranPriere, { public: true });
  C.route(/^\/demandes$/, ecranDemandes);
  C.route(/^\/gerer\/predications$/, ecranGererPredications);
  C.route(/^\/gerer\/predications\/nouvelle$/, () => ecranFormPredication({}));
  C.route(new RegExp(`^/gerer/predication/(?<id>${ID})$`), ecranFormPredication);
  C.route(/^\/gerer\/meditations$/, ecranGererMeditations);
  C.route(/^\/gerer\/meditation\/nouvelle$/, () => ecranFormMeditation({}));
  C.route(new RegExp(`^/gerer/meditation/(?<id>${ID})$`), ecranFormMeditation);

  C.heroFideles = heroFideles;
  C.eglisesPubliques = eglisesPubliques;
})();
