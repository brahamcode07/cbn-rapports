/* CBN Rapports — rapports de culte (tous les types) et statistiques */
(function () {
  'use strict';
  const C = window.CBN;
  const { sb, etat, ICONES, esc, nombre, fcfa, afficher, aller, toast, messageErreur } = C;

  const TYPES = {
    dimanche: 'Culte du dimanche',
    mercredi: 'Mercredi d’enseignement',
    vendredi: 'Vendredi de prière',
    programme: 'Programme spécial',
    convention: 'Convention'
  };
  const nomType = (t) => TYPES[t] || t;

  function pastille(statut) {
    if (statut === 'vu') return '<span class="pastille vu">Vu</span>';
    if (statut === 'envoye') return '<span class="pastille envoye">Envoyé</span>';
    return '<span class="pastille attente">En attente</span>';
  }

  // ================= Accueil du pasteur =================

  async function ecranPasteur() {
    const p = etat.profil;
    const dimanche = C.dimancheDeReference();
    const { data: rapports, error } = await sb.from('rapports_culte')
      .select('id, date_culte, type_culte, statut, created_at, commentaire_apotre')
      .eq('eglise_id', p.eglise_id).order('date_culte', { ascending: false }).order('created_at', { ascending: false }).limit(15);

    const courant = (rapports || []).find((r) => r.date_culte === dimanche && r.type_culte === 'dimanche');
    const precedents = (rapports || []).filter((r) => r !== courant);

    let carte;
    if (!courant) {
      carte = `<span class="surtitre">Rapport à envoyer</span>
        <div class="grand-titre">Culte du dimanche<br>${esc(C.dateLongue(dimanche))}</div>
        <a class="btn" href="#/nouveau">${ICONES.crayon} Remplir le rapport</a>`;
    } else if (courant.statut === 'envoye') {
      carte = `<span class="surtitre">Envoyé à ${esc(C.heure(courant.created_at))}</span>
        <div class="grand-titre">Culte du dimanche<br>${esc(C.dateLongue(dimanche))}</div>
        <p class="discret">L’apôtre ne l’a pas encore vu. Vous pouvez encore le corriger.</p>
        <div class="deux-colonnes"><a class="btn secondaire" href="#/rapport/${courant.id}">Voir</a><a class="btn secondaire" href="#/corriger/${courant.id}">Corriger</a></div>`;
    } else {
      carte = `<span class="surtitre vu">Vu par l’apôtre</span>
        <div class="grand-titre">Culte du dimanche<br>${esc(C.dateLongue(dimanche))}</div>
        ${courant.commentaire_apotre ? `<div class="mot-apotre"><span>Mot de l’apôtre</span>${esc(courant.commentaire_apotre)}</div>` : ''}
        <a class="btn secondaire" href="#/rapport/${courant.id}">Voir le rapport</a>`;
    }

    afficher(`
      <div class="hero haut">
        <div class="hero-ligne">
          <div class="hero-identite">
            ${C.lienProfil(p)}
            <a href="#/profil" class="lien-profil"><div class="hero-petit">Bonjour,</div><div class="hero-nom">${esc(p.nom)}</div><div class="hero-petit souligne">Mon profil</div></a>
          </div>
          <button class="bouton-rond" id="sortir" aria-label="Se déconnecter">${ICONES.sortir}</button>
        </div>
        <div class="hero-identite">${C.logoRond()}<h1>${esc(p.eglises ? p.eglises.nom : '')}</h1></div>
      </div>
      <div class="contenu remonte">
        <section class="carte flottante">${carte}</section>
        <a class="btn secondaire" href="#/nouveau/autre">${ICONES.plus} Rapport d’un autre culte</a>
        ${error ? `<p class="erreur">${esc(messageErreur(error))}</p>` : ''}
        <h2 class="titre-section">Rapports précédents</h2>
        <div class="liste">
          ${precedents.length ? precedents.map(ligneRapport).join('') : '<p class="vide">Vos rapports envoyés apparaîtront ici.</p>'}
        </div>
        ${precedents.length ? '<a class="btn lien" href="#/rapports">Voir tous les rapports</a>' : ''}
      </div>`, 'rapports');
    document.getElementById('sortir').onclick = C.deconnexion;
  }

  function ligneRapport(r) {
    const sous = r.commentaire_apotre ? 'Commentaire de l’apôtre' : (r.eglise_id && C.estApotre() ? C.nomEglise(r.eglise_id) : 'Envoyé à ' + C.heure(r.created_at));
    return `<a class="ligne" href="#/rapport/${r.id}">
      <span class="corps"><strong>${esc(nomType(r.type_culte))} · ${esc(C.dateCourte(r.date_culte))}</strong><span>${esc(sous)}</span></span>
      ${pastille(r.statut)}</a>`;
  }

  // ================= Formulaire (nouveau ou correction) =================

  async function ecranFormulaire({ id, autre }) {
    const p = etat.profil;
    if (C.estApotre()) return aller('/');
    let existant = null;
    if (id) {
      const r = await sb.from('rapports_culte').select('*').eq('id', id).maybeSingle();
      existant = r.data;
      if (!existant) { toast('Rapport introuvable'); return aller('/'); }
    } else if (!autre) {
      const r = await sb.from('rapports_culte').select('*').eq('eglise_id', p.eglise_id)
        .eq('date_culte', C.dimancheDeReference()).eq('type_culte', 'dimanche').maybeSingle();
      existant = r.data;
    }
    if (existant && existant.statut === 'vu') { toast('Ce rapport a déjà été vu par l’apôtre.'); return aller('/rapport/' + existant.id); }

    const v = existant || {};
    const type = v.type_culte || (autre ? 'mercredi' : 'dimanche');
    const date = v.date_culte || (autre ? C.aujourdhuiISO() : C.dimancheDeReference());
    const compteur = (cle, libelle, art) => `
      <div class="compteur">
        <label for="${cle}">${libelle}</label>
        <div class="commandes">
          <button type="button" data-moins="${cle}" aria-label="Retirer ${art}">−</button>
          <input id="${cle}" type="number" inputmode="numeric" min="0" value="${Number(v[cle]) || 0}">
          <button type="button" data-plus="${cle}" aria-label="Ajouter ${art}">+</button>
        </div>
      </div>`;

    afficher(`
      <div class="hero">
        <div class="hero-identite">
          <a class="bouton-rond" href="#/" aria-label="Retour">${ICONES.retour}</a>
          <div><h1 style="font-size:23px">${existant ? 'Corriger le rapport' : 'Rapport du culte'}</h1><p>${esc(p.eglises ? p.eglises.nom : '')}</p></div>
        </div>
      </div>
      <form class="contenu" id="form-rapport" novalidate>
        <fieldset class="carte" style="border:0;margin:0">
          <legend class="visuellement-cache">Le culte</legend><h2>Le culte</h2>
          <div class="champ-pile">
            <div class="champ"><label for="type_culte">Type de culte</label>
              <select class="saisie" id="type_culte" ${existant ? 'disabled' : ''}>${Object.entries(TYPES).map(([k, n]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
            <div class="champ"><label for="date_culte">Date</label>
              <input class="saisie" id="date_culte" type="date" value="${date}" max="${C.aujourdhuiISO()}" ${existant ? 'disabled' : ''}></div>
          </div>
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

    const presence = ['hommes', 'femmes', 'jeunes', 'enfants'];
    const entier = (cle) => Math.max(0, parseInt(document.getElementById(cle).value, 10) || 0);
    const majTotal = () => { document.getElementById('total').textContent = nombre(presence.reduce((s, cle) => s + entier(cle), 0)); };
    majTotal();
    const form = document.getElementById('form-rapport');
    form.addEventListener('input', majTotal);
    form.addEventListener('click', (e) => {
      const plus = e.target.getAttribute('data-plus');
      const moins = e.target.getAttribute('data-moins');
      const cle = plus || moins;
      if (!cle) return;
      document.getElementById(cle).value = Math.max(0, entier(cle) + (plus ? 1 : -1));
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
      const dateChoisie = document.getElementById('date_culte').value;
      if (!contenu.predicateur) { erreur.textContent = 'Indiquez le nom du prédicateur.'; erreur.hidden = false; return; }
      if (!existant && (!dateChoisie || dateChoisie > C.aujourdhuiISO())) { erreur.textContent = 'Choisissez une date qui n’est pas dans le futur.'; erreur.hidden = false; return; }
      btn.disabled = true; btn.textContent = 'Envoi…';
      const r = existant
        ? await sb.from('rapports_culte').update(contenu).eq('id', existant.id).select('id').single()
        : await sb.from('rapports_culte').insert({ ...contenu, eglise_id: p.eglise_id, auteur_id: p.id, date_culte: dateChoisie, type_culte: document.getElementById('type_culte').value }).select('id').single();
      if (r.error) {
        erreur.textContent = messageErreur(r.error); erreur.hidden = false;
        btn.disabled = false; btn.innerHTML = ICONES.envoyer + ' Réessayer'; return;
      }
      toast(existant ? 'Correction enregistrée' : 'Rapport envoyé à l’apôtre');
      aller('/');
    };
  }

  // ================= Accueil de l'apôtre =================

  async function ecranApotre({ date }) {
    const dimanche = date || C.dimancheDeReference();
    const [{ data: rapports, error }, { data: autres }] = await Promise.all([
      sb.from('rapports_culte').select('*').eq('date_culte', dimanche).eq('type_culte', 'dimanche'),
      sb.from('rapports_culte').select('id, eglise_id, date_culte, type_culte, statut, created_at, commentaire_apotre')
        .neq('type_culte', 'dimanche').order('date_culte', { ascending: false }).limit(6)
    ]);
    const parEglise = new Map((rapports || []).map((r) => [r.eglise_id, r]));
    const recus = etat.eglises.filter((e) => parEglise.has(e.id)).length;
    const estFutur = dimanche >= C.dimancheDeReference();

    afficher(`
      <div class="hero">
        <div class="hero-ligne">
          <div class="marque">${C.logoRond()}<span>Cité de la Bonne Nouvelle</span></div>
          <div class="hero-identite">${C.lienProfil(etat.profil)}<button class="bouton-rond" id="sortir" aria-label="Se déconnecter">${ICONES.sortir}</button></div>
        </div>
        <div><div class="hero-petit">Bonjour, ${esc(etat.profil.nom)}</div><h1 style="font-size:28px">Rapports du dimanche</h1></div>
        <div class="selecteur">
          <a class="bouton-rond" href="#/dimanche/${C.ajouterJours(dimanche, -7)}" aria-label="Dimanche précédent">${ICONES.retour}</a>
          <div class="date">${esc(C.dateLongue(dimanche))}</div>
          ${estFutur ? '<span class="bouton-rond" style="opacity:.35" aria-hidden="true">' + ICONES.suivant + '</span>'
                     : `<a class="bouton-rond" href="#/dimanche/${C.ajouterJours(dimanche, 7)}" aria-label="Dimanche suivant">${ICONES.suivant}</a>`}
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
            if (!r) return `<div class="ligne absente">${C.avatarHTML(pasteur, 'petit absent')}${corps}<span class="pastille attente">En attente</span></div>`;
            const etiquette = r.statut === 'vu' ? '<span class="pastille vu">Vu</span>' : '<span class="pastille envoye">Nouveau</span>';
            return `<a class="ligne" href="#/rapport/${r.id}">${C.avatarHTML(pasteur, 'petit')}${corps}${etiquette}</a>`;
          }).join('')}
        </div>
        ${recus ? `
          <p class="discret" style="text-align:center;margin-top:4px">Exporter les rapports de ce dimanche</p>
          <div class="deux-colonnes"><button class="btn secondaire" id="export-pdf">PDF</button><button class="btn secondaire" id="export-excel">Excel</button></div>` : ''}
        <h2 class="titre-section">Autres cultes récents</h2>
        <div class="liste">${(autres || []).length ? autres.map(ligneRapport).join('') : '<p class="vide">Aucun rapport de mercredi, vendredi, programme ou convention pour le moment.</p>'}</div>
        <a class="btn lien" href="#/rapports">Voir tous les rapports</a>
      </div>`, 'rapports');

    document.getElementById('sortir').onclick = C.deconnexion;
    if (recus) {
      const liste = etat.eglises.filter((e) => parEglise.has(e.id)).map((e) => ({ eglise: e.nom, ...parEglise.get(e.id) }));
      document.getElementById('export-pdf').onclick = () => exporterPDFListe('Rapports du dimanche', C.dateLongue(dimanche), liste, 'CBN-rapports-' + dimanche);
      document.getElementById('export-excel').onclick = () => exporterExcelListe(liste, 'Dimanche ' + dimanche, 'CBN-rapports-' + dimanche);
    }
  }

  // ================= Tous les rapports (avec filtres) =================

  async function ecranListe() {
    const apotre = C.estApotre();
    const filtres = ecranListe.filtres || (ecranListe.filtres = { eglise: '', type: '', mois: '' });
    let q = sb.from('rapports_culte').select('*').order('date_culte', { ascending: false }).order('created_at', { ascending: false }).limit(100);
    if (!apotre) q = q.eq('eglise_id', etat.profil.eglise_id);
    else if (filtres.eglise) q = q.eq('eglise_id', filtres.eglise);
    if (filtres.type) q = q.eq('type_culte', filtres.type);
    if (filtres.mois) q = q.gte('date_culte', filtres.mois + '-01').lte('date_culte', C.finDeMois(filtres.mois));
    const { data, error } = await q;
    const liste = (data || []).map((r) => ({ eglise: C.nomEglise(r.eglise_id), ...r }));
    const mois = Array.from({ length: 12 }, (_, i) => C.ajouterMois(C.moisCourant(), -i));

    afficher(`
      ${C.hero(apotre ? 'Tous les rapports' : 'Tous mes rapports', { retour: '#/' })}
      <div class="contenu">
        <div class="filtres">
          ${apotre ? `<select class="saisie" id="f-eglise" aria-label="Église"><option value="">Toutes les églises</option>${etat.eglises.map((e) => `<option value="${e.id}" ${filtres.eglise === e.id ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select>` : ''}
          <select class="saisie" id="f-type" aria-label="Type de culte"><option value="">Tous les cultes</option>${Object.entries(TYPES).map(([k, n]) => `<option value="${k}" ${filtres.type === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
          <select class="saisie" id="f-mois" aria-label="Mois"><option value="">Tous les mois</option>${mois.map((m) => `<option value="${m}" ${filtres.mois === m ? 'selected' : ''}>${esc(C.moisLibelle(m))}</option>`).join('')}</select>
        </div>
        ${error ? `<p class="erreur">${esc(messageErreur(error))}</p>` : ''}
        <p class="discret">${liste.length} rapport${liste.length > 1 ? 's' : ''}</p>
        <div class="liste">${liste.length ? liste.map(ligneRapport).join('') : '<p class="vide">Aucun rapport pour ces filtres.</p>'}</div>
        ${liste.length ? '<div class="deux-colonnes"><button class="btn secondaire" id="export-pdf">Exporter en PDF</button><button class="btn secondaire" id="export-excel">Exporter en Excel</button></div>' : ''}
      </div>`, apotre ? 'rapports' : 'plus');

    ['eglise', 'type', 'mois'].forEach((cle) => {
      const el = document.getElementById('f-' + cle);
      if (el) el.onchange = () => { filtres[cle] = el.value; ecranListe(); };
    });
    if (liste.length) {
      const titre = [filtres.eglise ? C.nomEglise(filtres.eglise) : (apotre ? 'Toutes les églises' : C.nomEglise(etat.profil.eglise_id)), filtres.type ? nomType(filtres.type) : 'Tous les cultes', filtres.mois ? C.moisLibelle(filtres.mois) : 'Récents'].join(' · ');
      document.getElementById('export-pdf').onclick = () => exporterPDFListe('Rapports des cultes', titre, liste, 'CBN-rapports');
      document.getElementById('export-excel').onclick = () => exporterExcelListe(liste, 'Rapports', 'CBN-rapports');
    }
  }

  // ================= Détail d'un rapport =================

  async function ecranDetail({ id }) {
    const { data: r, error } = await sb.from('rapports_culte').select('*, eglises(nom), profils(nom)').eq('id', id).maybeSingle();
    if (error || !r) { toast(error ? messageErreur(error) : 'Rapport introuvable'); return aller('/'); }
    const apotre = C.estApotre();
    const retour = apotre && r.type_culte === 'dimanche' ? '#/dimanche/' + r.date_culte : (apotre ? '#/rapports' : '#/');

    afficher(`
      <div class="hero haut">
        <div class="hero-ligne"><a class="bouton-rond" href="${retour}" aria-label="Retour">${ICONES.retour}</a>${pastille(r.statut)}</div>
        <div><h1>${esc(r.eglises ? r.eglises.nom : '')}</h1>
        <p>${esc(nomType(r.type_culte))} · ${esc(C.dateLongue(r.date_culte))}<br>${esc(r.profils ? r.profils.nom : '')}</p></div>
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
        ${r.evenements ? `<section class="carte"><h2 class="petit-titre">Événements particuliers</h2><p class="texte-libre">${esc(r.evenements)}</p></section>` : ''}
        ${r.statut === 'vu' && r.commentaire_apotre ? `<div class="mot-apotre"><span>Mot de l’apôtre</span>${esc(r.commentaire_apotre)}</div>` : ''}
        ${apotre && r.statut !== 'vu' ? `
          <div class="champ pas-imprime"><label for="commentaire">Mot pour le pasteur (facultatif)</label>
            <textarea class="saisie" id="commentaire" placeholder="Écrire un encouragement ou une remarque…"></textarea></div>
          <button class="btn pas-imprime" id="btn-vu">${ICONES.coche} Marquer comme vu</button>` : ''}
        ${!apotre && r.statut === 'envoye' ? `<a class="btn secondaire pas-imprime" href="#/corriger/${r.id}">Corriger ce rapport</a>` : ''}
        <div class="deux-colonnes pas-imprime">
          <button class="btn secondaire" id="export-pdf">Exporter en PDF</button>
          <button class="btn secondaire" id="imprimer">Imprimer</button>
        </div>
      </div>`, 'rapports');

    document.getElementById('export-pdf').onclick = () => exporterPDFRapport(r);
    document.getElementById('imprimer').onclick = () => window.print();
    const btnVu = document.getElementById('btn-vu');
    if (btnVu) btnVu.onclick = async () => {
      btnVu.disabled = true; btnVu.textContent = 'Enregistrement…';
      const { error: err } = await sb.rpc('marquer_vu', { p_rapport: r.id, p_commentaire: document.getElementById('commentaire').value });
      if (err) { toast(messageErreur(err)); btnVu.disabled = false; btnVu.innerHTML = ICONES.coche + ' Marquer comme vu'; return; }
      toast('Rapport marqué comme vu');
      aller(r.type_culte === 'dimanche' ? '/dimanche/' + r.date_culte : '/rapports');
    };
  }

  // ================= Statistiques =================

  async function ecranStats({ eglise }) {
    const apotre = C.estApotre();
    const cible = apotre ? (eglise || ecranStats.choix || '') : etat.profil.eglise_id;
    const debut = C.ajouterMois(C.moisCourant(), -5) + '-01';
    let q = sb.from('rapports_culte').select('eglise_id, date_culte, type_culte, total, convertis, visiteurs, offrandes, dimes')
      .gte('date_culte', C.ajouterJours(C.dimancheDeReference(), -7 * 11) < debut ? C.ajouterJours(C.dimancheDeReference(), -7 * 11) : debut);
    if (cible) q = q.eq('eglise_id', cible);
    const [{ data: rapports, error }, { data: membres }] = await Promise.all([
      q, apotre && !cible ? sb.from('membres').select('eglise_id') : Promise.resolve({ data: null })
    ]);
    const R = rapports || [];
    const dimanches = R.filter((r) => r.type_culte === 'dimanche');

    // 12 derniers dimanches : total présents (toutes les églises choisies)
    const semaines = Array.from({ length: 12 }, (_, i) => C.ajouterJours(C.dimancheDeReference(), -7 * (11 - i)));
    const parSemaine = semaines.map((d) => {
      const ceux = dimanches.filter((r) => r.date_culte === d);
      return { label: C.dateCourte(d), valeur: ceux.reduce((s, r) => s + r.total, 0), recus: ceux.length, attendus: cible ? 1 : etat.eglises.length };
    });

    // 6 derniers mois
    const mois = Array.from({ length: 6 }, (_, i) => C.ajouterMois(C.moisCourant(), i - 5));
    const parMois = mois.map((m) => {
      const duMois = R.filter((r) => r.date_culte.startsWith(m));
      const dim = duMois.filter((r) => r.type_culte === 'dimanche');
      const datesDim = new Set(dim.map((r) => r.date_culte));
      const presenceMoy = datesDim.size ? Math.round(dim.reduce((s, r) => s + r.total, 0) / datesDim.size) : 0;
      return {
        mois: m, presenceMoy,
        convertis: duMois.reduce((s, r) => s + r.convertis, 0),
        visiteurs: duMois.reduce((s, r) => s + r.visiteurs, 0),
        entrees: duMois.reduce((s, r) => s + Number(r.offrandes) + Number(r.dimes), 0)
      };
    });
    parMois.forEach((m, i) => { const prec = parMois[i - 1]; m.croissance = prec && prec.presenceMoy ? Math.round((m.presenceMoy - prec.presenceMoy) * 100 / prec.presenceMoy) : null; });
    const ceMois = parMois[5], moisPrec = parMois[4];
    const variation = (a, b) => (b ? Math.round((a - b) * 100 / b) : null);
    const tendance = (v) => (v === null ? '<span class="tendance">—</span>' : `<span class="tendance ${v > 0 ? 'hausse' : v < 0 ? 'baisse' : ''}">${v > 0 ? '▲' : v < 0 ? '▼' : '='} ${Math.abs(v)} % vs mois précédent</span>`);

    // Comparaison entre églises (apôtre, vue « toutes »)
    let comparaison = '';
    if (apotre && !cible) {
      const derniers = semaines.slice(-4);
      const lignes = etat.eglises.map((e) => {
        const dim = dimanches.filter((r) => r.eglise_id === e.id && derniers.includes(r.date_culte));
        const moy = dim.length ? Math.round(dim.reduce((s, r) => s + r.total, 0) / dim.length) : 0;
        const duMois = R.filter((r) => r.eglise_id === e.id && r.date_culte.startsWith(C.moisCourant()));
        return {
          nom: e.nom, moy,
          entrees: duMois.reduce((s, r) => s + Number(r.offrandes) + Number(r.dimes), 0),
          convertis: duMois.reduce((s, r) => s + r.convertis, 0),
          membres: (membres || []).filter((m) => m.eglise_id === e.id).length
        };
      });
      const max = Math.max(1, ...lignes.map((l) => l.moy));
      comparaison = `
        <section class="carte">
          <h2>Comparaison entre églises</h2>
          <p class="discret">Présence moyenne des 4 derniers dimanches</p>
          <div class="barres-h">${lignes.map((l) => `<div class="barre-h" title="${esc(l.nom)} : ${nombre(l.moy)} présents en moyenne">
            <span class="barre-nom">${esc(l.nom.replace('CBN ', ''))}</span>
            <span class="barre-piste"><span class="barre-remplie" style="width:${Math.round(l.moy * 100 / max)}%"></span></span>
            <strong>${nombre(l.moy)}</strong></div>`).join('')}</div>
          <div class="tableau-defile"><table class="tableau">
            <thead><tr><th>Église</th><th>Présence moy.</th><th>Entrées du mois</th><th>Convertis du mois</th><th>Membres</th></tr></thead>
            <tbody>${lignes.map((l) => `<tr><td>${esc(l.nom)}</td><td>${nombre(l.moy)}</td><td>${fcfa(l.entrees)}</td><td>${nombre(l.convertis)}</td><td>${nombre(l.membres)}</td></tr>`).join('')}</tbody>
          </table></div>
        </section>`;
    }

    afficher(`
      ${C.hero('Statistiques', { retour: apotre ? null : '#/plus', sousTitre: esc(cible ? C.nomEglise(cible) : 'Toute la CBN') })}
      <div class="contenu">
        ${apotre ? `<select class="saisie" id="f-eglise" aria-label="Église"><option value="">Toute la CBN</option>${etat.eglises.map((e) => `<option value="${e.id}" ${cible === e.id ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select>` : ''}
        ${error ? `<p class="erreur">${esc(messageErreur(error))}</p>` : ''}
        <div class="tuiles">
          <div class="tuile"><span>Présence moyenne le dimanche · ${esc(C.moisLibelle(ceMois.mois))}</span><strong>${nombre(ceMois.presenceMoy)}</strong>${tendance(variation(ceMois.presenceMoy, moisPrec.presenceMoy))}</div>
          <div class="tuile"><span>Entrées des cultes · ${esc(C.moisLibelle(ceMois.mois))}</span><strong>${fcfa(ceMois.entrees)}</strong>${tendance(variation(ceMois.entrees, moisPrec.entrees))}</div>
          <div class="tuile"><span>Nouveaux convertis · ${esc(C.moisLibelle(ceMois.mois))}</span><strong>${nombre(ceMois.convertis)}</strong>${tendance(variation(ceMois.convertis, moisPrec.convertis))}</div>
        </div>
        <section class="carte">
          <h2>Fréquentation du dimanche</h2>
          <p class="discret">Total des présents, 12 derniers dimanches${cible ? '' : ' (toutes les églises)'}</p>
          ${graphLigne(parSemaine)}
        </section>
        <section class="carte">
          <h2>Entrées des cultes par mois</h2>
          <p class="discret">Offrandes + dîmes déclarées dans les rapports, en FCFA</p>
          ${graphBarres(parMois.map((m) => ({ label: C.moisCourt(m.mois), valeur: m.entrees, texte: fcfa(m.entrees) })))}
        </section>
        <section class="carte">
          <h2>Mois par mois</h2>
          <div class="tableau-defile"><table class="tableau">
            <thead><tr><th>Mois</th><th>Présence moy.</th><th>Croissance</th><th>Visiteurs</th><th>Convertis</th><th>Entrées</th></tr></thead>
            <tbody>${parMois.slice().reverse().map((m) => `<tr><td>${esc(C.moisLibelle(m.mois))}</td><td>${nombre(m.presenceMoy)}</td><td>${m.croissance === null ? '—' : (m.croissance > 0 ? '+' : '') + m.croissance + ' %'}</td><td>${nombre(m.visiteurs)}</td><td>${nombre(m.convertis)}</td><td>${fcfa(m.entrees)}</td></tr>`).join('')}</tbody>
          </table></div>
        </section>
        ${comparaison}
      </div>`, apotre ? 'stats' : 'plus');

    const sel = document.getElementById('f-eglise');
    if (sel) sel.onchange = () => { ecranStats.choix = sel.value; ecranStats({}); };
  }

  // Graphique en ligne (une seule série) dessiné en SVG
  function graphLigne(points) {
    const L = 340, H = 170, g = 34, d = 12, h = 14, b = 28;
    const max = Math.max(10, ...points.map((p) => p.valeur));
    const pas = Math.pow(10, Math.floor(Math.log10(max)));
    const haut = Math.ceil(max / pas) * pas;
    const x = (i) => g + (i * (L - g - d)) / (points.length - 1);
    const y = (v) => H - b - (v * (H - b - h)) / haut;
    const avec = points.map((p, i) => ({ ...p, i, complet: p.recus >= p.attendus })).filter((p) => p.recus);
    const complets = avec.filter((p) => p.complet);
    const chemin = complets.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)} ${y(p.valeur).toFixed(1)}`).join(' ');
    const graduations = [0, haut / 2, haut];
    if (!avec.length) return '<p class="vide">Pas encore de rapports du dimanche sur cette période.</p>';
    const dernier = complets.length ? complets[complets.length - 1] : avec[avec.length - 1];
    return `<svg class="graph" viewBox="0 0 ${L} ${H}" role="img" aria-label="Évolution des présents le dimanche">
      ${graduations.map((v) => `<line x1="${g}" x2="${L - d}" y1="${y(v)}" y2="${y(v)}" class="grille"/><text x="${g - 6}" y="${y(v) + 4}" class="axe" text-anchor="end">${nombre(v)}</text>`).join('')}
      ${points.map((p, i) => (i % 3 === 2 || i === points.length - 1 ? `<text x="${x(i)}" y="${H - 8}" class="axe" text-anchor="middle">${esc(p.label.replace(/ \S+$/, (m) => m.slice(0, 4)))}</text>` : '')).join('')}
      <path d="${chemin}" class="trait"/>
      ${avec.map((p) => `<circle cx="${x(p.i)}" cy="${y(p.valeur)}" r="5" class="point${p.complet ? '' : ' incomplet'}"><title>${esc(p.label)} : ${nombre(p.valeur)} présents (${p.recus} rapport${p.recus > 1 ? 's' : ''} sur ${p.attendus})</title></circle>`).join('')}
      <text x="${Math.min(x(dernier.i), L - d - 2)}" y="${y(dernier.valeur) - 10}" class="etiquette" text-anchor="end">${nombre(dernier.valeur)}</text>
    </svg>${avec.some((p) => !p.complet) ? '<p class="discret legende"><span class="rond-vide" aria-hidden="true"></span> Point creux : tous les rapports de ce dimanche ne sont pas encore arrivés.</p>' : ''}`;
  }

  // Graphique en barres verticales (une seule série)
  function graphBarres(points) {
    const L = 340, H = 170, g = 8, d = 8, h = 22, b = 26;
    const max = Math.max(1, ...points.map((p) => p.valeur));
    const larg = (L - g - d) / points.length;
    const y = (v) => H - b - (v * (H - b - h)) / max;
    if (!points.some((p) => p.valeur)) return '<p class="vide">Pas encore d’entrées sur cette période.</p>';
    return `<svg class="graph" viewBox="0 0 ${L} ${H}" role="img" aria-label="Entrées par mois">
      <line x1="${g}" x2="${L - d}" y1="${H - b}" y2="${H - b}" class="grille"/>
      ${points.map((p, i) => {
        const bx = g + i * larg + larg * 0.18, bw = larg * 0.64, by = y(p.valeur), bh = H - b - by;
        return `<g><path d="M${bx} ${H - b} V${by + Math.min(4, bh)} q0 -4 4 -4 h${bw - 8} q4 0 4 4 V${H - b} Z" class="barre"><title>${esc(p.label)} : ${esc(p.texte)}</title></path>
          <text x="${bx + bw / 2}" y="${H - 8}" class="axe" text-anchor="middle">${esc(p.label)}</text>
          ${i === points.length - 1 || p.valeur === max ? `<text x="${bx + bw / 2}" y="${by - 6}" class="etiquette" text-anchor="middle">${esc(nombre(Math.round(p.valeur / 1000)))} k</text>` : ''}</g>`;
      }).join('')}
    </svg>`;
  }

  // ================= Exports =================

  const COLONNES = [
    ['eglise', 'Église'], ['date_culte', 'Date'], ['type_culte', 'Culte'], ['predicateur', 'Prédicateur'], ['theme', 'Thème'],
    ['hommes', 'Hommes'], ['femmes', 'Femmes'], ['jeunes', 'Jeunes'], ['enfants', 'Enfants'], ['total', 'Total'],
    ['visiteurs', 'Visiteurs'], ['convertis', 'Convertis'], ['offrandes', 'Offrandes (FCFA)'], ['dimes', 'Dîmes (FCFA)'],
    ['statut', 'Statut'], ['evenements', 'Événements']
  ];
  const NUM = ['offrandes', 'dimes', 'hommes', 'femmes', 'jeunes', 'enfants', 'total', 'visiteurs', 'convertis'];
  const valeur = (r, cle) => (cle === 'statut' ? (r.statut === 'vu' ? 'Vu' : 'Envoyé') : cle === 'type_culte' ? nomType(r.type_culte) : cle === 'date_culte' ? C.dateCourte(r.date_culte) : r[cle]);

  function exporterExcelListe(liste, feuilleNom, fichier) {
    const lignes = liste.map((r) => Object.fromEntries(COLONNES.map(([cle, titre]) => [titre, valeur(r, cle)])));
    const tot = (cle) => liste.reduce((s, r) => s + (Number(r[cle]) || 0), 0);
    const total = { 'Église': 'TOTAL' };
    COLONNES.filter(([c]) => NUM.includes(c)).forEach(([c, t]) => { total[t] = tot(c); });
    lignes.push(total);
    const feuille = XLSX.utils.json_to_sheet(lignes, { header: COLONNES.map((c) => c[1]) });
    feuille['!cols'] = COLONNES.map(([cle]) => ({ wch: ['theme', 'evenements'].includes(cle) ? 36 : ['predicateur', 'eglise', 'type_culte'].includes(cle) ? 22 : 12 }));
    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(classeur, feuille, feuilleNom.slice(0, 30));
    XLSX.writeFile(classeur, fichier + '.xlsx');
  }

  function exporterPDFListe(titre, sousTitre, liste, fichier) {
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape' });
    C.entetePDF(doc, titre, sousTitre);
    const cols = COLONNES.filter(([c]) => c !== 'evenements');
    doc.autoTable({
      startY: 34,
      head: [cols.map((c) => c[1])],
      body: liste.map((r) => cols.map(([cle]) => (NUM.includes(cle) ? nombre(r[cle]) : (valeur(r, cle) || '')))),
      styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [75, 38, 114] }, alternateRowStyles: { fillColor: [247, 245, 250] }
    });
    const avec = liste.filter((r) => r.evenements);
    if (avec.length) {
      doc.autoTable({ head: [['Église', 'Date', 'Événements particuliers']], body: avec.map((r) => [r.eglise, C.dateCourte(r.date_culte), r.evenements]),
        styles: { fontSize: 9 }, headStyles: { fillColor: [75, 38, 114] }, columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 30 } } });
    }
    doc.save(fichier + '.pdf');
  }

  function exporterPDFRapport(r) {
    const doc = new window.jspdf.jsPDF();
    const eglise = r.eglises ? r.eglises.nom : '';
    C.entetePDF(doc, eglise, nomType(r.type_culte) + ' · ' + C.dateLongue(r.date_culte));
    doc.autoTable({
      startY: 34,
      body: [
        ['Pasteur', r.profils ? r.profils.nom : ''], ['Prédicateur', r.predicateur], ['Thème', r.theme],
        ['Hommes', nombre(r.hommes)], ['Femmes', nombre(r.femmes)], ['Jeunes', nombre(r.jeunes)], ['Enfants', nombre(r.enfants)],
        ['Total présents', nombre(r.total)], ['Visiteurs', nombre(r.visiteurs)], ['Nouveaux convertis', nombre(r.convertis)],
        ['Offrandes', fcfa(r.offrandes)], ['Dîmes', fcfa(r.dimes)],
        ['Événements particuliers', r.evenements || '—'], ['Statut', r.statut === 'vu' ? 'Vu' : 'Envoyé'],
        ...(r.commentaire_apotre ? [['Mot de l’apôtre', r.commentaire_apotre]] : [])
      ],
      styles: { fontSize: 11, cellPadding: 3.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55, textColor: [74, 63, 87] } },
      alternateRowStyles: { fillColor: [247, 245, 250] }
    });
    doc.save('CBN-' + eglise.replace(/\s+/g, '-') + '-' + r.type_culte + '-' + r.date_culte + '.pdf');
  }

  // ================= Routes =================
  C.route(/^\/$/, () => (C.estApotre() ? ecranApotre({}) : ecranPasteur()));
  C.route(/^\/dimanche\/(?<date>\d{4}-\d{2}-\d{2})$/, ecranApotre);
  C.route(/^\/nouveau$/, () => ecranFormulaire({}));
  C.route(/^\/nouveau\/autre$/, () => ecranFormulaire({ autre: true }));
  C.route(/^\/corriger\/(?<id>[0-9a-f-]{36})$/, ecranFormulaire);
  C.route(/^\/rapport\/(?<id>[0-9a-f-]{36})$/, ecranDetail);
  C.route(/^\/rapports$/, ecranListe);
  C.route(/^\/stats$/, ecranStats);
  C.route(/^\/eglise\/(?<eglise>[0-9a-f-]{36})\/stats$/, ecranStats);
})();
