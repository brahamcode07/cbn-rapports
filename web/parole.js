/* CBN — La Parole : verset du jour, versets sur le Royaume, plans de lecture de la Bible, lecteur de la Bible.
   Texte biblique : Louis Segond 1910 (domaine public), chargé chapitre par chapitre puis gardé sur le téléphone. */
(function () {
  'use strict';
  const C = window.CBN;
  const { ICONES, esc, afficher, aller, toast } = C;
  const PLAN = window.CBN_PLAN_VERSETS || [];
  const API = 'https://api.getbible.net/v2/ls1910';

  // ================= Les livres de la Bible =================
  const LIVRES = [
    ['Genèse', 50], ['Exode', 40], ['Lévitique', 27], ['Nombres', 36], ['Deutéronome', 34], ['Josué', 24], ['Juges', 21], ['Ruth', 4],
    ['1 Samuel', 31], ['2 Samuel', 24], ['1 Rois', 22], ['2 Rois', 25], ['1 Chroniques', 29], ['2 Chroniques', 36], ['Esdras', 10],
    ['Néhémie', 13], ['Esther', 10], ['Job', 42], ['Psaumes', 150], ['Proverbes', 31], ['Ecclésiaste', 12], ['Cantique des cantiques', 8],
    ['Ésaïe', 66], ['Jérémie', 52], ['Lamentations', 5], ['Ézéchiel', 48], ['Daniel', 12], ['Osée', 14], ['Joël', 3], ['Amos', 9],
    ['Abdias', 1], ['Jonas', 4], ['Michée', 7], ['Nahum', 3], ['Habacuc', 3], ['Sophonie', 3], ['Aggée', 2], ['Zacharie', 14], ['Malachie', 4],
    ['Matthieu', 28], ['Marc', 16], ['Luc', 24], ['Jean', 21], ['Actes', 28], ['Romains', 16], ['1 Corinthiens', 16], ['2 Corinthiens', 13],
    ['Galates', 6], ['Éphésiens', 6], ['Philippiens', 4], ['Colossiens', 4], ['1 Thessaloniciens', 5], ['2 Thessaloniciens', 3],
    ['1 Timothée', 6], ['2 Timothée', 4], ['Tite', 3], ['Philémon', 1], ['Hébreux', 13], ['Jacques', 5], ['1 Pierre', 5], ['2 Pierre', 3],
    ['1 Jean', 5], ['2 Jean', 1], ['3 Jean', 1], ['Jude', 1], ['Apocalypse', 22]
  ];
  const nomLivre = (n) => (LIVRES[n - 1] || ['?'])[0];
  function referenceLisible(ref) {
    const [l, ch, v] = ref.split(':');
    return `${nomLivre(Number(l))} ${ch}:${v}`;
  }
  // Toute la Bible en une liste de chapitres : [livre, chapitre]
  const CHAPITRES = [];
  LIVRES.forEach(([, n], i) => { for (let c = 1; c <= n; c++) CHAPITRES.push([i + 1, c]); });

  // ================= Chargement du texte =================
  const memoire = new Map();
  async function chargerChapitre(livre, chap) {
    const cle = livre + ':' + chap;
    if (memoire.has(cle)) return memoire.get(cle);
    const r = await fetch(`${API}/${livre}/${chap}.json`);
    if (!r.ok) throw new Error('Chapitre indisponible');
    const d = await r.json();
    const versets = (d.verses || []).map((v) => ({ n: v.verse, t: String(v.text).trim().replace(/\s+/g, ' ') }));
    memoire.set(cle, versets);
    return versets;
  }
  async function texteVerset(ref) {
    const cleLocale = 'cbn_v_' + ref;
    try { const t = localStorage.getItem(cleLocale); if (t) return t; } catch (e) { /* rien */ }
    const [l, ch, v] = ref.split(':');
    const [debut, fin] = v.split('-').map(Number);
    const versets = await chargerChapitre(Number(l), Number(ch));
    let t = versets.filter((x) => x.n >= debut && x.n <= (fin || debut)).map((x) => x.t).join(' ');
    // Les titres des psaumes (« Cantique de David. ») ne font pas partie du verset à méditer
    if (Number(l) === 19) t = t.replace(/^((Cantique|Psaume|De David|De Salomon|Au chef des chantres)[^.]*\.\s*)+/, '');
    t = t.charAt(0).toUpperCase() + t.slice(1);
    try { localStorage.setItem(cleLocale, t); } catch (e) { /* rien */ }
    return t;
  }

  // ================= Verset du jour =================
  function numeroDuJour(iso) {
    const d = C.versDate(iso);
    const debut = Date.UTC(d.getUTCFullYear(), 0, 1);
    return Math.min(365, Math.floor((d - debut) / 86400000) + 1);
  }
  function versetDuJour(iso) {
    const e = PLAN[numeroDuJour(iso) - 1] || PLAN[0];
    return { ref: e[0], titre: e[1], pensee: e[2], lisible: referenceLisible(e[0]) };
  }
  // Remplit les éléments [data-verset="ref"] avec le texte du verset
  function remplirVersets(racine = document) {
    racine.querySelectorAll('[data-verset]').forEach(async (el) => {
      try { el.textContent = '« ' + (await texteVerset(el.dataset.verset)) + ' »'; el.classList.remove('chargement-texte'); }
      catch (e) { el.textContent = 'Texte indisponible hors connexion. Ouvrez votre Bible à ' + referenceLisible(el.dataset.verset) + '.'; }
    });
  }
  function partageVerset(v, texte, iso) {
    return `*Verset du jour* — ${C.dateLongue(iso)}\n« ${texte} »\n${v.lisible}\n\n*${v.titre}* : ${v.pensee}\n\nCité de la Bonne Nouvelle : ${location.origin + location.pathname}#/verset/${iso}`;
  }
  function carteVersetDuJour(iso, { lienPage = true, meditation = null } = {}) {
    const v = versetDuJour(iso);
    const auj = iso === C.aujourdhuiISO();
    return `<section class="carte flottante verset-jour">
      <span class="surtitre">${auj ? 'Verset du jour' : 'Verset du ' + esc(C.dateCourte(iso))}</span>
      <blockquote class="verset grand"><span data-verset="${v.ref}" class="chargement-texte">Chargement du verset…</span><cite>${esc(v.lisible)}</cite></blockquote>
      <div class="pensee"><strong>${esc(v.titre)}</strong><p>${esc(v.pensee)}</p></div>
      ${meditation ? `<a class="lien-carte" href="#/meditation/${meditation.date_med}">${ICONES.livre}<span><small>Méditation de l’apôtre</small><strong>${esc(meditation.titre)}</strong></span>${ICONES.suivant}</a>` : ''}
      <div class="actions-verset">
        <button class="btn whatsapp petit" type="button" data-partager-verset="${iso}">${ICONES.whatsapp} Partager</button>
        <a class="btn secondaire petit" href="#/bible/${v.ref.split(':')[0]}/${v.ref.split(':')[1]}">${ICONES.livre} Lire le chapitre</a>
        ${lienPage ? `<a class="btn lien petit" href="#/parole">Plus</a>` : ''}
      </div>
    </section>`;
  }
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-partager-verset]');
    if (!b) return;
    const iso = b.dataset.partagerVerset;
    const v = versetDuJour(iso);
    let texte = '';
    try { texte = await texteVerset(v.ref); } catch (err) { texte = v.lisible; }
    window.open('https://wa.me/?text=' + encodeURIComponent(partageVerset(v, texte, iso)), '_blank', 'noopener');
  });

  // ================= Versets sur le Royaume (accueil) =================
  const ROYAUME = [
    ['que ton règne vienne ; que ta volonté soit faite sur la terre comme au ciel.', 'Matthieu 6:10'],
    ['Cherchez premièrement le royaume et la justice de Dieu ; et toutes ces choses vous seront données par-dessus.', 'Matthieu 6:33'],
    ['Le temps est accompli, et le royaume de Dieu est proche. Repentez-vous, et croyez à la bonne nouvelle.', 'Marc 1:15'],
    ['Car voici, le royaume de Dieu est au milieu de vous.', 'Luc 17:21'],
    ['Car le royaume de Dieu, ce n’est pas le manger et le boire, mais la justice, la paix et la joie, par le Saint-Esprit.', 'Romains 14:17'],
    ['Car le royaume de Dieu ne consiste pas en paroles, mais en puissance.', '1 Corinthiens 4:20'],
    ['Ne crains point, petit troupeau ; car votre Père a trouvé bon de vous donner le royaume.', 'Luc 12:32'],
    ['Cette bonne nouvelle du royaume sera prêchée dans le monde entier, pour servir de témoignage à toutes les nations.', 'Matthieu 24:14'],
    ['Le royaume du monde est remis à notre Seigneur et à son Christ ; et il régnera aux siècles des siècles.', 'Apocalypse 11:15'],
    ['Ton règne est un règne de tous les siècles, Et ta domination subsiste dans tous les âges.', 'Psaume 145:13']
  ];
  function carrouselRoyaume() {
    const depart = numeroDuJour(C.aujourdhuiISO()) % ROYAUME.length;
    return `<div class="royaume" id="royaume" data-index="${depart}" aria-live="polite">
      <p class="royaume-texte">« ${esc(ROYAUME[depart][0].charAt(0).toUpperCase() + ROYAUME[depart][0].slice(1))} »</p>
      <span class="royaume-ref">${esc(ROYAUME[depart][1])}</span>
      <div class="royaume-points" aria-hidden="true">${ROYAUME.map((_, i) => `<span class="${i === depart ? 'actif' : ''}"></span>`).join('')}</div>
    </div>`;
  }
  let minuteurRoyaume = null;
  function animerRoyaume() {
    clearInterval(minuteurRoyaume);
    minuteurRoyaume = setInterval(() => {
      const el = document.getElementById('royaume');
      if (!el) return clearInterval(minuteurRoyaume);
      const i = (Number(el.dataset.index) + 1) % ROYAUME.length;
      el.dataset.index = i;
      el.classList.add('fondu');
      setTimeout(() => {
        el.querySelector('.royaume-texte').textContent = '« ' + ROYAUME[i][0].charAt(0).toUpperCase() + ROYAUME[i][0].slice(1) + ' »';
        el.querySelector('.royaume-ref').textContent = ROYAUME[i][1];
        el.querySelectorAll('.royaume-points span').forEach((p, k) => p.classList.toggle('actif', k === i));
        el.classList.remove('fondu');
      }, 350);
    }, 7000);
  }

  // ================= Plans de lecture =================
  const PLANS = {
    an: { nom: 'La Bible en 1 an', jours: 365, texte: 'Environ 3 à 4 chapitres par jour, 15 à 20 minutes.' },
    semestre: { nom: 'La Bible en 6 mois', jours: 182, texte: 'Environ 6 à 7 chapitres par jour, 30 à 40 minutes.' }
  };
  const CLE_PLAN = 'cbn_plan_lecture';
  function planActif() { try { return JSON.parse(localStorage.getItem(CLE_PLAN) || 'null'); } catch (e) { return null; } }
  function enregistrerPlan(p) { try { localStorage.setItem(CLE_PLAN, JSON.stringify(p)); } catch (e) { toast('Impossible d’enregistrer sur ce téléphone.'); } }
  function lectureDuJour(plan, jour) {
    const N = PLANS[plan.plan].jours;
    const a = Math.floor(((jour - 1) * CHAPITRES.length) / N);
    const b = Math.floor((jour * CHAPITRES.length) / N);
    return CHAPITRES.slice(a, b);
  }
  // Regroupe des chapitres consécutifs : « Genèse 1–3 »
  function resumeLecture(chapitres) {
    const groupes = [];
    chapitres.forEach(([l, c]) => {
      const g = groupes[groupes.length - 1];
      if (g && g.l === l && g.fin === c - 1) g.fin = c; else groupes.push({ l, debut: c, fin: c });
    });
    return groupes.map((g) => nomLivre(g.l) + ' ' + (g.debut === g.fin ? g.debut : g.debut + '–' + g.fin)).join(' · ');
  }
  function jourActuel(plan) {
    return Math.max(1, Math.min(PLANS[plan.plan].jours, C.ecartJours(plan.debut, C.aujourdhuiISO()) + 1));
  }
  function prochainJourNonLu(plan) {
    for (let j = 1; j <= PLANS[plan.plan].jours; j++) if (!plan.lus.includes(j)) return j;
    return null;
  }

  function carteLecture() {
    const p = planActif();
    if (!p || !PLANS[p.plan]) {
      return `<a class="carte lien-plan" href="#/bible">
        <span class="icone-ligne grande">${ICONES.livre}</span>
        <span class="corps"><strong>Lire toute la Bible</strong><span>Choisissez un plan : en 1 an ou en 6 mois.</span></span>${ICONES.suivant}</a>`;
    }
    const N = PLANS[p.plan].jours;
    const j = prochainJourNonLu(p) || N;
    const pct = Math.round((p.lus.length / N) * 100);
    return `<a class="carte lien-plan" href="#/bible">
      <span class="anneau" style="--p:${pct}"><span>${pct}%</span></span>
      <span class="corps"><strong>${esc(PLANS[p.plan].nom)} · jour ${j}</strong><span>${esc(resumeLecture(lectureDuJour(p, j)))}</span></span>${ICONES.suivant}</a>`;
  }

  async function ecranPlan() {
    const p = planActif();
    if (!p || !PLANS[p.plan]) {
      afficher(`
        ${C.heroFideles('Lire toute la Bible', { retour: '#/parole', sousTitre: 'Choisissez votre rythme. Votre progression est gardée sur ce téléphone.' })}
        <div class="contenu">
          ${Object.entries(PLANS).map(([cle, x]) => `
            <button class="carte choix-plan" type="button" data-choisir="${cle}">
              <span class="icone-ligne grande">${ICONES.livre}</span>
              <span class="corps"><strong>${x.nom}</strong><span>${x.texte}</span><span>${x.jours} jours · de la Genèse à l’Apocalypse</span></span>${ICONES.suivant}
            </button>`).join('')}
          <a class="btn secondaire" href="#/bible/livres">${ICONES.livre} Ouvrir la Bible librement</a>
        </div>`, 'parole', 'fideles');
      document.querySelectorAll('[data-choisir]').forEach((b) => {
        b.onclick = () => {
          enregistrerPlan({ plan: b.dataset.choisir, debut: C.aujourdhuiISO(), lus: [] });
          toast('Plan commencé aujourd’hui. Bonne lecture !');
          ecranPlan();
        };
      });
      return;
    }
    const N = PLANS[p.plan].jours;
    const attendu = jourActuel(p);
    const suivant = prochainJourNonLu(p);
    const retard = Math.max(0, attendu - p.lus.filter((j) => j <= attendu).length);
    const pct = Math.round((p.lus.length / N) * 100);
    const debutListe = Math.max(1, (suivant || N) - 2);
    const jours = [];
    for (let j = debutListe; j <= Math.min(N, debutListe + 9); j++) jours.push(j);
    const ligneJour = (j) => {
      const lu = p.lus.includes(j);
      const ch = lectureDuJour(p, j);
      return `<div class="ligne jour-plan ${lu ? 'lu' : ''} ${j === suivant ? 'courant' : ''}">
        <button class="case-lu" type="button" data-cocher="${j}" aria-label="${lu ? 'Marquer le jour ' + j + ' comme non lu' : 'Marquer le jour ' + j + ' comme lu'}" aria-pressed="${lu}">${lu ? ICONES.coche : ''}</button>
        <a class="corps lien-corps" href="#/bible/${ch[0][0]}/${ch[0][1]}/j${j}"><strong>Jour ${j}${j === attendu ? ' · aujourd’hui' : ''}</strong><span>${esc(resumeLecture(ch))}</span></a>
        ${ICONES.suivant}
      </div>`;
    };
    afficher(`
      ${C.heroFideles(esc(PLANS[p.plan].nom), { retour: '#/parole', sousTitre: 'Commencé le ' + esc(C.dateLongue(p.debut)) })}
      <div class="contenu">
        <section class="carte progression-plan">
          <span class="anneau grand" style="--p:${pct}"><span>${pct}%</span></span>
          <div><strong>${p.lus.length} jour${p.lus.length > 1 ? 's' : ''} lu${p.lus.length > 1 ? 's' : ''} sur ${N}</strong>
            <p class="discret">${suivant ? (retard > 1 ? `${retard} jours de retard : rien de grave, reprenez simplement là où vous en êtes.` : 'Vous êtes à jour. Continuez ainsi !') : 'Bravo, vous avez lu toute la Bible !'}</p></div>
        </section>
        ${suivant ? `<a class="btn" href="#/bible/${lectureDuJour(p, suivant)[0][0]}/${lectureDuJour(p, suivant)[0][1]}/j${suivant}">${ICONES.livre} Lire le jour ${suivant}</a>` : ''}
        <h2 class="titre-section">Mes lectures</h2>
        <div class="liste">${jours.map(ligneJour).join('')}</div>
        <details class="carte">
          <summary class="titre-details">Changer de plan ou recommencer</summary>
          <div class="sous-formulaire">
            <p class="discret">Votre progression actuelle sera effacée.</p>
            ${Object.entries(PLANS).map(([cle, x]) => `<button class="btn secondaire" type="button" data-recommencer="${cle}">${x.nom} (recommencer aujourd’hui)</button>`).join('')}
          </div>
        </details>
      </div>`, 'parole', 'fideles');
    document.querySelectorAll('[data-cocher]').forEach((b) => {
      b.onclick = () => {
        const j = Number(b.dataset.cocher);
        const plan = planActif();
        plan.lus = plan.lus.includes(j) ? plan.lus.filter((x) => x !== j) : [...plan.lus, j];
        enregistrerPlan(plan);
        ecranPlan();
      };
    });
    document.querySelectorAll('[data-recommencer]').forEach((b) => C.boutonConfirme(b, () => {
      enregistrerPlan({ plan: b.dataset.recommencer, debut: C.aujourdhuiISO(), lus: [] });
      toast('Nouveau plan commencé');
      ecranPlan();
    }, 'Appuyez encore pour recommencer'));
  }

  // ================= Lecteur de la Bible =================
  function tailleTexte() { try { return Number(localStorage.getItem('cbn_taille_bible')) || 18; } catch (e) { return 18; } }

  async function ecranLecteur({ livre, chap, jour }) {
    const l = Number(livre), c = Number(chap);
    if (!LIVRES[l - 1] || c < 1 || c > LIVRES[l - 1][1]) return aller('/bible/livres');
    const p = planActif();
    const j = jour ? Number(jour) : null;
    const lecture = j && p && PLANS[p.plan] ? lectureDuJour(p, j) : null;
    const idx = lecture ? lecture.findIndex(([a, b]) => a === l && b === c) : -1;
    const lienChap = ([a, b]) => `#/bible/${a}/${b}${lecture ? '/j' + j : ''}`;
    const iGlobal = CHAPITRES.findIndex(([a, b]) => a === l && b === c);
    const precedent = lecture ? (idx > 0 ? lecture[idx - 1] : null) : CHAPITRES[iGlobal - 1];
    const suivant = lecture ? (idx >= 0 && idx < lecture.length - 1 ? lecture[idx + 1] : null) : CHAPITRES[iGlobal + 1];
    const dernierDuJour = lecture && idx === lecture.length - 1;
    afficher(`
      ${C.heroFideles(esc(nomLivre(l) + ' ' + c), { retour: lecture ? '#/bible' : '#/bible/livres', sousTitre: lecture ? `Plan de lecture · jour ${j} · chapitre ${idx + 1} sur ${lecture.length}` : 'Louis Segond 1910' })}
      <div class="contenu">
        <div class="barre-lecture">
          <button class="bouton-rond clair" type="button" data-taille="-1" aria-label="Texte plus petit">A−</button>
          <button class="bouton-rond clair" type="button" data-taille="1" aria-label="Texte plus grand">A+</button>
          <a class="btn secondaire petit" href="#/bible/livres">${ICONES.livre} Livres</a>
        </div>
        <article class="carte texte-bible" id="texte-bible" style="--taille:${tailleTexte()}px"><p class="discret">Chargement du chapitre…</p></article>
        <div class="deux-colonnes">
          ${precedent ? `<a class="btn secondaire" href="${lienChap(precedent)}">${ICONES.retour} ${esc(nomLivre(precedent[0]) + ' ' + precedent[1])}</a>` : '<span></span>'}
          ${suivant ? `<a class="btn secondaire" href="${lienChap(suivant)}">${esc(nomLivre(suivant[0]) + ' ' + suivant[1])} ${ICONES.suivant}</a>` : '<span></span>'}
        </div>
        ${dernierDuJour ? `<button class="btn" type="button" id="jour-lu" ${p.lus.includes(j) ? 'disabled' : ''}>${ICONES.coche} ${p.lus.includes(j) ? 'Jour ' + j + ' déjà lu' : 'J’ai lu le jour ' + j}</button>` : ''}
      </div>`, 'parole', 'fideles');
    document.querySelectorAll('[data-taille]').forEach((b) => {
      b.onclick = () => {
        const t = Math.max(14, Math.min(28, tailleTexte() + Number(b.dataset.taille) * 2));
        try { localStorage.setItem('cbn_taille_bible', String(t)); } catch (e) { /* rien */ }
        document.getElementById('texte-bible').style.setProperty('--taille', t + 'px');
      };
    });
    const btnLu = document.getElementById('jour-lu');
    if (btnLu) btnLu.onclick = () => {
      const plan = planActif();
      if (!plan.lus.includes(j)) plan.lus.push(j);
      enregistrerPlan(plan);
      toast('Jour ' + j + ' marqué comme lu. Que Dieu vous bénisse !');
      aller('/bible');
    };
    try {
      const versets = await chargerChapitre(l, c);
      const zone = document.getElementById('texte-bible');
      if (zone) zone.innerHTML = versets.map((v) => `<p><sup>${v.n}</sup>${esc(v.t)}</p>`).join('');
    } catch (e) {
      const zone = document.getElementById('texte-bible');
      if (zone) zone.innerHTML = '<p class="erreur">Impossible de charger ce chapitre. Vérifiez votre connexion : les chapitres déjà ouverts restent lisibles hors connexion.</p>';
    }
  }

  function ecranLivres() {
    const bloc = (titre, de, a) => `<h2 class="titre-section">${titre}</h2>
      <div class="grille-livres">${LIVRES.slice(de, a).map(([n], i) => `<a href="#/bible/${de + i + 1}/1">${esc(n)}</a>`).join('')}</div>`;
    afficher(`
      ${C.heroFideles('La Bible', { retour: '#/parole', sousTitre: 'Louis Segond 1910' })}
      <div class="contenu">
        ${bloc('Ancien Testament', 0, 39)}
        ${bloc('Nouveau Testament', 39, 66)}
      </div>`, 'parole', 'fideles');
  }

  // ================= Page « Parole » =================
  async function ecranParole() {
    const auj = C.aujourdhuiISO();
    const { data } = await C.sb.from('meditations').select('id, date_med, titre, reference').lte('date_med', auj).order('date_med', { ascending: false }).limit(5);
    const medAuj = (data || []).find((m) => m.date_med === auj);
    afficher(`
      ${C.heroFideles('La Parole', { sousTitre: 'Un verset et une pensée pour chaque jour, et toute la Bible à lire.', grand: true })}
      <div class="contenu remonte-un-peu">
        ${carteVersetDuJour(auj, { lienPage: false, meditation: medAuj })}
        <h2 class="titre-section">Plan de lecture</h2>
        ${carteLecture()}
        <a class="btn secondaire" href="#/bible/livres">${ICONES.livre} Ouvrir la Bible</a>
        ${(data || []).length ? `<div class="entete-section"><h2 class="titre-section">Méditations de l’apôtre</h2><a href="#/meditations">Tout voir</a></div>
          <div class="liste">${data.map((m) => `<a class="ligne" href="#/meditation/${m.date_med}">
            <span class="date-bloc petit clair" aria-hidden="true"><strong>${C.versDate(m.date_med).getUTCDate()}</strong><span>${esc(C.moisCourt(m.date_med.slice(0, 7)))}</span></span>
            <span class="corps"><strong>${esc(m.titre)}</strong><span>${esc(m.reference || C.dateJour(m.date_med))}</span></span>${ICONES.suivant}</a>`).join('')}</div>` : ''}
        <h2 class="titre-section">Les jours précédents</h2>
        <div class="liste">${[1, 2, 3, 4, 5, 6].map((k) => {
          const d = C.ajouterJours(auj, -k);
          const v = versetDuJour(d);
          return `<a class="ligne" href="#/verset/${d}"><span class="date-bloc petit clair" aria-hidden="true"><strong>${C.versDate(d).getUTCDate()}</strong><span>${esc(C.moisCourt(d.slice(0, 7)))}</span></span>
            <span class="corps"><strong>${esc(v.titre)}</strong><span>${esc(v.lisible)}</span></span>${ICONES.suivant}</a>`;
        }).join('')}</div>
      </div>`, 'parole', 'fideles');
    remplirVersets();
  }

  function ecranVerset({ date }) {
    if (date > C.aujourdhuiISO()) return aller('/parole');
    afficher(`
      ${C.heroFideles('Verset du ' + esc(C.dateCourte(date)), { retour: '#/parole', sousTitre: esc(C.dateJour(date).replace(/^./, (x) => x.toUpperCase())) })}
      <div class="contenu">${carteVersetDuJour(date, { lienPage: false })}</div>`, 'parole', 'fideles');
    remplirVersets();
  }

  C.route(/^\/parole$/, ecranParole, { public: true });
  C.route(/^\/verset\/(?<date>\d{4}-\d{2}-\d{2})$/, ecranVerset, { public: true });
  C.route(/^\/bible$/, ecranPlan, { public: true });
  C.route(/^\/bible\/livres$/, ecranLivres, { public: true });
  C.route(/^\/bible\/(?<livre>\d{1,2})\/(?<chap>\d{1,3})(\/j(?<jour>\d{1,3}))?$/, ecranLecteur, { public: true });

  Object.assign(C, { versetDuJour, texteVerset, remplirVersets, carteVersetDuJour, carrouselRoyaume, animerRoyaume, carteLecture, referenceLisible });
})();
