/* CBN Rapports — programmes : page publique des fidèles et gestion par l'apôtre et les pasteurs */
(function () {
  'use strict';
  const C = window.CBN;
  const { sb, etat, ICONES, esc, afficher, aller, toast, messageErreur } = C;

  const TYPES = { culte: 'Culte', programme: 'Programme', retraite: 'Retraite', convention: 'Convention', annonce: 'Annonce' };
  const ADRESSE = () => location.origin + location.pathname + '#/programmes';

  async function charger(depuis) {
    const [ev, eg] = await Promise.all([
      sb.from('evenements').select('*').or(`date_fin.gte.${depuis},and(date_fin.is.null,date_debut.gte.${depuis})`).order('date_debut').order('heure').limit(200),
      etat.eglises.length ? Promise.resolve({ data: etat.eglises }) : sb.from('eglises').select('id, nom, ordre').order('ordre')
    ]);
    if (!etat.eglises.length && eg.data) etat.eglises = eg.data;
    return { evenements: ev.data || [], erreur: ev.error };
  }

  function quand(ev) {
    const debut = C.dateJour(ev.date_debut);
    const fin = ev.date_fin && ev.date_fin !== ev.date_debut ? ' au ' + C.dateJour(ev.date_fin) : '';
    return (fin ? 'Du ' + debut + fin : debut.charAt(0).toUpperCase() + debut.slice(1)) + (ev.heure ? ' · ' + ev.heure : '');
  }

  function texteWhatsApp(ev) {
    return [`*${ev.titre}*`, `${TYPES[ev.type]} · ${C.nomEglise(ev.eglise_id)}`, quand(ev), ev.lieu ? 'Lieu : ' + ev.lieu : '', ev.description, '', 'Tous les programmes de la Cité de la Bonne Nouvelle : ' + ADRESSE()]
      .filter((l, i) => l || i === 5).join('\n');
  }

  function carteEvenement(ev, gerer) {
    const jour = C.versDate(ev.date_debut);
    return `<article class="carte evenement">
      <div class="date-bloc" aria-hidden="true"><strong>${jour.getUTCDate()}</strong><span>${esc(C.moisCourt(ev.date_debut.slice(0, 7)))}</span></div>
      <div class="evenement-corps">
        <div class="evenement-tags"><span class="pastille type-${ev.type}">${TYPES[ev.type]}</span><span class="discret">${esc(C.nomEglise(ev.eglise_id))}</span></div>
        <h3>${esc(ev.titre)}</h3>
        <p class="discret">${esc(quand(ev))}${ev.lieu ? '<br>' + esc(ev.lieu) : ''}</p>
        ${ev.description ? `<p class="texte-libre">${esc(ev.description)}</p>` : ''}
        <div class="evenement-actions">
          <a class="btn whatsapp petit" href="https://wa.me/?text=${encodeURIComponent(texteWhatsApp(ev))}" target="_blank" rel="noopener">${ICONES.whatsapp} Partager</a>
          ${gerer && C.peutPublier(ev.eglise_id) ? `<a class="btn secondaire petit" href="#/agenda/${ev.id}">${ICONES.crayon} Modifier</a>` : ''}
        </div>
      </div>
    </article>`;
  }

  function listeParMois(evenements, gerer) {
    if (!evenements.length) return '<p class="vide">Aucun programme à venir pour le moment.</p>';
    const mois = [...new Set(evenements.map((e) => e.date_debut.slice(0, 7)))];
    return mois.map((m) => `<h2 class="titre-section mois">${esc(C.moisLibelle(m))}</h2>
      ${evenements.filter((e) => e.date_debut.startsWith(m)).map((e) => carteEvenement(e, gerer)).join('')}`).join('');
  }

  function puces(filtre) {
    return `<div class="puces" role="group" aria-label="Filtrer par église">
      <button class="puce ${!filtre ? 'active' : ''}" data-eglise="">Toutes</button>
      ${etat.eglises.map((e) => `<button class="puce ${filtre === e.id ? 'active' : ''}" data-eglise="${e.id}">${esc(e.nom.replace('CBN ', ''))}</button>`).join('')}
    </div>`;
  }
  const filtrer = (evs, f) => (f ? evs.filter((e) => !e.eglise_id || e.eglise_id === f) : evs);

  // ================= Page publique (sans compte) =================

  async function ecranPublic() {
    const { evenements, erreur } = await charger(C.aujourdhuiISO());
    const dessiner = () => {
      const f = ecranPublic.filtre || '';
      app().innerHTML = `
        <div class="hero public">
          <div class="hero-ligne"><div class="marque">${C.logoRond()}<span>Cité de la Bonne Nouvelle</span></div>
            <a class="lien-discret" href="#/">Espace pasteurs</a></div>
          <div><h1>Programmes et annonces</h1><p>Cultes, programmes, retraites et conventions de nos églises de Mbouda, Galim, Babeté et Bafoussam.</p></div>
        </div>
        <div class="contenu">
          ${puces(f)}
          ${erreur ? `<p class="erreur">${esc(messageErreur(erreur))}</p>` : ''}
          ${listeParMois(filtrer(evenements, f), false)}
          <p class="discret" style="text-align:center">Partagez cette page : ${esc(ADRESSE())}</p>
        </div>`;
      document.body.classList.remove('avec-onglets');
      document.querySelectorAll('[data-eglise]').forEach((b) => { b.onclick = () => { ecranPublic.filtre = b.dataset.eglise; dessiner(); }; });
    };
    dessiner();
    window.scrollTo(0, 0);
  }
  const app = () => document.getElementById('app');

  // ================= Gestion des programmes (connecté) =================

  async function ecranAgenda() {
    const { evenements, erreur } = await charger(C.ajouterJours(C.aujourdhuiISO(), -1));
    const f = ecranAgenda.filtre || '';
    afficher(`
      ${C.hero('Programmes', { sousTitre: 'Ce que vous publiez ici apparaît sur la page publique des fidèles.' })}
      <div class="contenu">
        <div class="deux-colonnes">
          <a class="btn" href="#/agenda/nouveau">${ICONES.plus} Ajouter</a>
          <a class="btn secondaire" href="#/programmes">${ICONES.globe} Page publique</a>
        </div>
        ${puces(f)}
        ${erreur ? `<p class="erreur">${esc(messageErreur(erreur))}</p>` : ''}
        ${listeParMois(filtrer(evenements, f), true)}
      </div>`, 'agenda');
    document.querySelectorAll('[data-eglise]').forEach((b) => { b.onclick = () => { ecranAgenda.filtre = b.dataset.eglise; ecranAgenda(); }; });
  }

  async function ecranFormulaire({ id }) {
    let ev = null;
    if (id) {
      const r = await sb.from('evenements').select('*').eq('id', id).maybeSingle();
      ev = r.data;
      if (!ev || !C.peutPublier(ev.eglise_id)) { toast('Vous ne pouvez pas modifier ce programme.'); return aller('/agenda'); }
    }
    const apotre = C.estApotre();
    const v = ev || { type: 'programme', date_debut: C.aujourdhuiISO(), eglise_id: apotre ? null : etat.profil.eglise_id };
    afficher(`
      ${C.hero(ev ? 'Modifier le programme' : 'Nouveau programme', { retour: '#/agenda' })}
      <div class="contenu">
        <form class="carte" id="form-ev" novalidate>
          <div class="deux-colonnes">
            <div class="champ"><label for="e-type">Type</label><select class="saisie" id="e-type">${Object.entries(TYPES).map(([k, n]) => `<option value="${k}" ${v.type === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
            <div class="champ"><label for="e-eglise">Pour</label>
              ${apotre ? `<select class="saisie" id="e-eglise"><option value="">Toute la CBN</option>${etat.eglises.map((e) => `<option value="${e.id}" ${v.eglise_id === e.id ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select>`
                       : `<input class="saisie" id="e-eglise" value="${esc(C.nomEglise(etat.profil.eglise_id))}" disabled>`}</div>
          </div>
          <div class="champ"><label for="e-titre">Titre</label><input class="saisie" id="e-titre" value="${esc(v.titre)}" placeholder="Ex. : Veillée de prière, Convention annuelle"></div>
          <div class="deux-colonnes">
            <div class="champ"><label for="e-debut">Date de début</label><input class="saisie" id="e-debut" type="date" value="${esc(v.date_debut)}"></div>
            <div class="champ"><label for="e-fin">Date de fin (facultatif)</label><input class="saisie" id="e-fin" type="date" value="${esc(v.date_fin || '')}"></div>
          </div>
          <div class="deux-colonnes">
            <div class="champ"><label for="e-heure">Heure</label><input class="saisie" id="e-heure" value="${esc(v.heure)}" placeholder="Ex. : 9 h 00"></div>
            <div class="champ"><label for="e-lieu">Lieu</label><input class="saisie" id="e-lieu" value="${esc(v.lieu)}" placeholder="Ex. : Temple de Mbouda"></div>
          </div>
          <div class="champ"><label for="e-desc">Description</label><textarea class="saisie" id="e-desc" placeholder="Orateur, thème, contribution, consignes…">${esc(v.description)}</textarea></div>
          <p class="erreur" id="erreur" hidden></p>
          <button class="btn" type="submit" id="btn-ev">${ICONES.coche} ${ev ? 'Enregistrer' : 'Publier'}</button>
        </form>
        ${ev ? '<button class="btn secondaire" id="supprimer">Supprimer ce programme</button>' : ''}
      </div>`, 'agenda');

    document.getElementById('form-ev').onsubmit = async (e) => {
      e.preventDefault();
      const val = (k) => document.getElementById(k).value.trim();
      const erreur = document.getElementById('erreur');
      const montrer = (m) => { erreur.textContent = m; erreur.hidden = false; };
      const donnees = {
        type: val('e-type'), titre: val('e-titre'), date_debut: val('e-debut'), date_fin: val('e-fin') || null,
        heure: val('e-heure'), lieu: val('e-lieu'), description: val('e-desc'),
        eglise_id: apotre ? (val('e-eglise') || null) : etat.profil.eglise_id
      };
      if (!donnees.titre) return montrer('Indiquez le titre du programme.');
      if (!donnees.date_debut) return montrer('Indiquez la date.');
      if (donnees.date_fin && donnees.date_fin < donnees.date_debut) return montrer('La date de fin est avant la date de début.');
      document.getElementById('btn-ev').disabled = true;
      const r = ev ? await sb.from('evenements').update(donnees).eq('id', ev.id) : await sb.from('evenements').insert(donnees);
      if (r.error) { document.getElementById('btn-ev').disabled = false; return montrer(messageErreur(r.error)); }
      toast(ev ? 'Programme modifié' : 'Programme publié');
      aller('/agenda');
    };
    C.boutonConfirme(document.getElementById('supprimer'), async () => {
      const r = await sb.from('evenements').delete().eq('id', ev.id);
      if (r.error) return toast(messageErreur(r.error));
      toast('Programme supprimé');
      aller('/agenda');
    }, 'Appuyez encore pour supprimer');
  }

  C.route(/^\/programmes$/, ecranPublic, { public: true });
  C.route(/^\/agenda$/, ecranAgenda);
  C.route(/^\/agenda\/nouveau$/, () => ecranFormulaire({}));
  C.route(/^\/agenda\/(?<id>[0-9a-f-]{36})$/, ecranFormulaire);

  C.demarrer();
})();
