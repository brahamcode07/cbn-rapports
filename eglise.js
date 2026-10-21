/* CBN Rapports — vie de l'église : membres, suivi, départements, finances, documents */
(function () {
  'use strict';
  const C = window.CBN;
  const { sb, etat, ICONES, esc, nombre, fcfa, afficher, aller, toast, messageErreur } = C;

  const STATUTS = { membre: 'Membre', ouvrier: 'Ouvrier', sympathisant: 'Sympathisant', nouveau_converti: 'Nouveau converti', visiteur: 'Visiteur' };
  const TYPES_SUIVI = { appel: 'Appel', visite: 'Visite', autre: 'Autre' };
  const TYPES_OP = { dime: 'Dîme', offrande: 'Offrande', don: 'Don spécial', projet: 'Contribution aux projets', autre_entree: 'Autre entrée', depense: 'Dépense' };
  const CATEGORIES = { pv: 'Procès-verbal', correspondance: 'Correspondance', archive: 'Archive', autre: 'Autre' };
  const A_SUIVRE = ['nouveau_converti', 'visiteur'];

  // Onglet actif et lien de retour selon le rôle
  const ongletDe = (pasteurOnglet) => (C.estApotre() ? 'eglises' : pasteurOnglet);
  const retourEglise = (egliseId) => (C.estApotre() ? '#/eglise/' + egliseId : null);
  // L'apôtre doit d'abord choisir une église
  function cible(params) { const e = C.egliseDe(params); if (!e) aller('/eglises'); return e; }

  // ================= Églises (apôtre) =================

  async function ecranEglises() {
    if (!C.estApotre()) return aller('/');
    const mois = C.moisCourant();
    const [{ data: membres }, { data: ops }, { data: rapports }] = await Promise.all([
      sb.from('membres').select('eglise_id, statut'),
      sb.from('transactions').select('eglise_id, type, montant').gte('date_op', mois + '-01').lte('date_op', C.finDeMois(mois)),
      sb.from('rapports_culte').select('eglise_id, date_culte').eq('type_culte', 'dimanche').order('date_culte', { ascending: false }).limit(40)
    ]);
    afficher(`
      ${C.hero('Églises', { sousTitre: 'Membres, suivi, finances et documents de chaque église' })}
      <div class="contenu"><div class="liste">
        ${etat.eglises.map((e) => {
          const pasteur = etat.pasteurs.find((x) => x.eglise_id === e.id);
          const nbMembres = (membres || []).filter((m) => m.eglise_id === e.id).length;
          const op = (ops || []).filter((o) => o.eglise_id === e.id);
          const solde = op.reduce((s, o) => s + (o.type === 'depense' ? -1 : 1) * Number(o.montant), 0);
          const dernier = (rapports || []).find((r) => r.eglise_id === e.id);
          return `<a class="ligne" href="#/eglise/${e.id}">${C.avatarHTML(pasteur, 'petit')}
            <span class="corps"><strong>${esc(e.nom)}</strong><span>${esc(pasteur ? pasteur.nom : '')} · ${nombre(nbMembres)} membre${nbMembres > 1 ? 's' : ''}</span>
            <span>Solde de ${esc(C.moisLibelle(mois))} : ${fcfa(solde)}${dernier ? ' · dernier rapport le ' + esc(C.dateCourte(dernier.date_culte)) : ''}</span></span>${ICONES.suivant}</a>`;
        }).join('')}
      </div></div>`, 'eglises');
  }

  async function ecranEglise({ eglise }) {
    if (!C.estApotre()) return aller('/');
    const pasteur = etat.pasteurs.find((x) => x.eglise_id === eglise);
    const ligne = (lien, icone, titre, texte) => `<a class="ligne" href="#/eglise/${eglise}/${lien}"><span class="icone-ligne">${icone}</span><span class="corps"><strong>${titre}</strong><span>${texte}</span></span>${ICONES.suivant}</a>`;
    afficher(`
      ${C.hero(C.nomEglise(eglise), { retour: '#/eglises', sousTitre: esc(pasteur ? pasteur.nom : '') })}
      <div class="contenu"><div class="liste">
        ${ligne('membres', ICONES.membres, 'Membres', 'Registre des membres de l’église')}
        ${ligne('suivi', ICONES.suivi, 'Suivi des âmes', 'Nouveaux convertis et visiteurs')}
        ${ligne('finances', ICONES.finances, 'Finances', 'Rapport de gestion mois par mois')}
        ${ligne('departements', ICONES.groupe, 'Départements', 'Responsables et membres')}
        ${ligne('documents', ICONES.document, 'Documents', 'Procès-verbaux, correspondances, archives')}
        ${ligne('stats', ICONES.stats, 'Statistiques', 'Fréquentation et entrées de cette église')}
      </div></div>`, 'eglises');
  }

  // ================= Membres =================

  async function ecranMembres(params) {
    const eglise = cible(params);
    if (!eglise) return;
    const ecrire = C.peutEcrire(eglise);
    const [{ data, error }, { data: deps }] = await Promise.all([
      sb.from('membres').select('*').eq('eglise_id', eglise).order('nom'),
      sb.from('departements').select('id, nom').eq('eglise_id', eglise)
    ]);
    const membres = data || [];
    const filtre = ecranMembres.filtre || (ecranMembres.filtre = { texte: '', statut: '' });
    const compte = (s) => membres.filter((m) => m.statut === s).length;
    const nomDep = (id) => ((deps || []).find((d) => d.id === id) || {}).nom;
    const pre = C.prefixe(eglise);

    afficher(`
      ${C.hero('Membres', { retour: retourEglise(eglise), sousTitre: esc(C.nomEglise(eglise)) })}
      <div class="contenu">
        <div class="tuiles trois">
          <div class="tuile"><span>Total</span><strong>${nombre(membres.length)}</strong></div>
          <div class="tuile"><span>Ouvriers</span><strong>${nombre(compte('ouvrier'))}</strong></div>
          <div class="tuile"><span>À suivre</span><strong>${nombre(compte('nouveau_converti') + compte('visiteur'))}</strong></div>
        </div>
        ${ecrire ? `<a class="btn" href="#/membres/nouveau">${ICONES.plus} Ajouter un membre</a>` : ''}
        <div class="filtres">
          <input class="saisie" id="recherche" type="search" placeholder="Rechercher" value="${esc(filtre.texte)}" aria-label="Rechercher">
          <select class="saisie" id="f-statut" aria-label="Statut"><option value="">Tous les statuts</option>${Object.entries(STATUTS).map(([k, n]) => `<option value="${k}" ${filtre.statut === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
        </div>
        ${error ? `<p class="erreur">${esc(messageErreur(error))}</p>` : ''}
        <div class="liste" id="liste-membres"></div>
        ${membres.length ? '<button class="btn secondaire" id="export-excel">Exporter la liste en Excel</button>' : ''}
      </div>`, ongletDe('membres'));

    const dessiner = () => {
      const t = filtre.texte.toLowerCase();
      const vus = membres.filter((m) => (!filtre.statut || m.statut === filtre.statut) && (!t || m.nom.toLowerCase().includes(t) || m.telephone.includes(t)));
      document.getElementById('liste-membres').innerHTML = vus.length ? vus.map((m) => `
        <a class="ligne" href="${pre}/membre/${m.id}">
          ${C.avatarHTML({ nom: m.nom }, 'petit')}
          <span class="corps"><strong>${esc(m.nom)}</strong><span>${esc([nomDep(m.departement_id), C.telephoneLisible(m.telephone)].filter(Boolean).join(' · ') || '—')}</span></span>
          <span class="pastille ${A_SUIVRE.includes(m.statut) ? 'envoye' : 'neutre'}">${STATUTS[m.statut]}</span></a>`).join('')
        : `<p class="vide">${membres.length ? 'Aucun membre ne correspond.' : 'Aucun membre enregistré pour le moment.'}</p>`;
    };
    dessiner();
    document.getElementById('recherche').oninput = (e) => { filtre.texte = e.target.value; dessiner(); };
    document.getElementById('f-statut').onchange = (e) => { filtre.statut = e.target.value; dessiner(); };
    const ex = document.getElementById('export-excel');
    if (ex) ex.onclick = () => {
      const feuille = XLSX.utils.json_to_sheet(membres.map((m) => ({
        'Nom': m.nom, 'Téléphone': C.telephoneLisible(m.telephone), 'Sexe': m.sexe || '', 'Statut': STATUTS[m.statut],
        'Département': nomDep(m.departement_id) || '', 'Arrivée': m.date_arrivee || '', 'Formations suivies': m.formations, 'Notes': m.notes
      })));
      const classeur = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(classeur, feuille, 'Membres');
      XLSX.writeFile(classeur, 'CBN-membres-' + C.nomEglise(eglise).replace(/\s+/g, '-') + '.xlsx');
    };
  }

  async function formulaireMembre(m, eglise) {
    const { data: deps } = await sb.from('departements').select('id, nom').eq('eglise_id', eglise).order('nom');
    const v = m || { statut: 'membre' };
    return `
      <form class="carte" id="form-membre" novalidate>
        <h2>${m ? 'Modifier' : 'Nouveau membre'}</h2>
        <div class="champ"><label for="m-nom">Nom et prénom</label><input class="saisie" id="m-nom" value="${esc(v.nom)}" autocomplete="off"></div>
        <div class="champ"><label for="m-tel">Téléphone</label>
          <div class="groupe"><span class="prefixe">+237</span><input id="m-tel" type="tel" inputmode="tel" placeholder="6XX XX XX XX" value="${esc(String(v.telephone || '').replace(/^237/, ''))}"></div></div>
        <div class="deux-colonnes">
          <div class="champ"><label for="m-sexe">Sexe</label><select class="saisie" id="m-sexe"><option value="">—</option><option value="H" ${v.sexe === 'H' ? 'selected' : ''}>Homme</option><option value="F" ${v.sexe === 'F' ? 'selected' : ''}>Femme</option></select></div>
          <div class="champ"><label for="m-statut">Statut</label><select class="saisie" id="m-statut">${Object.entries(STATUTS).map(([k, n]) => `<option value="${k}" ${v.statut === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        </div>
        <div class="deux-colonnes">
          <div class="champ"><label for="m-dep">Département</label><select class="saisie" id="m-dep"><option value="">Aucun</option>${(deps || []).map((d) => `<option value="${d.id}" ${v.departement_id === d.id ? 'selected' : ''}>${esc(d.nom)}</option>`).join('')}</select></div>
          <div class="champ"><label for="m-arrivee">Arrivée à l’église</label><input class="saisie" id="m-arrivee" type="date" value="${esc(v.date_arrivee || '')}"></div>
        </div>
        <div class="champ"><label for="m-formations">Formations suivies</label><textarea class="saisie" id="m-formations" placeholder="Ex. : école de baptême, formation des ouvriers…">${esc(v.formations)}</textarea></div>
        <div class="champ"><label for="m-notes">Notes</label><textarea class="saisie" id="m-notes">${esc(v.notes)}</textarea></div>
        <p class="erreur" id="erreur" hidden></p>
        <button class="btn" type="submit" id="btn-membre">${ICONES.coche} Enregistrer</button>
      </form>`;
  }

  function lireMembre() {
    const val = (id) => document.getElementById(id).value.trim();
    const tel = val('m-tel').replace(/\D/g, '');
    return {
      nom: val('m-nom'), telephone: tel ? C.telephoneInternational(tel) : '', sexe: val('m-sexe') || null, statut: val('m-statut'),
      departement_id: val('m-dep') || null, date_arrivee: val('m-arrivee') || null, formations: val('m-formations'), notes: val('m-notes')
    };
  }

  async function ecranNouveauMembre() {
    const eglise = etat.profil.eglise_id;
    if (!C.peutEcrire(eglise)) return aller('/membres');
    afficher(`${C.hero('Nouveau membre', { retour: '#/membres', sousTitre: esc(C.nomEglise(eglise)) })}
      <div class="contenu">${await formulaireMembre(null, eglise)}</div>`, 'membres');
    document.getElementById('form-membre').onsubmit = async (e) => {
      e.preventDefault();
      const donnees = lireMembre();
      const erreur = document.getElementById('erreur');
      if (!donnees.nom) { erreur.textContent = 'Indiquez le nom du membre.'; erreur.hidden = false; return; }
      document.getElementById('btn-membre').disabled = true;
      const { data, error } = await sb.from('membres').insert({ ...donnees, eglise_id: eglise }).select('id').single();
      if (error) { erreur.textContent = messageErreur(error); erreur.hidden = false; document.getElementById('btn-membre').disabled = false; return; }
      toast('Membre ajouté');
      aller('/membre/' + data.id);
    };
  }

  async function ecranMembre({ id, modifier }) {
    const { data: m, error } = await sb.from('membres').select('*, departements(nom)').eq('id', id).maybeSingle();
    if (error || !m) { toast(error ? messageErreur(error) : 'Membre introuvable'); return aller('/'); }
    const ecrire = C.peutEcrire(m.eglise_id);
    const pre = C.prefixe(m.eglise_id);
    const retour = C.estApotre() ? pre + '/membres' : '#/membres';
    if (modifier && ecrire) {
      afficher(`${C.hero(m.nom, { retour: '#/membre/' + m.id })}<div class="contenu">${await formulaireMembre(m, m.eglise_id)}</div>`, 'membres');
      document.getElementById('form-membre').onsubmit = async (e) => {
        e.preventDefault();
        const donnees = lireMembre();
        const erreur = document.getElementById('erreur');
        if (!donnees.nom) { erreur.textContent = 'Indiquez le nom du membre.'; erreur.hidden = false; return; }
        const r = await sb.from('membres').update(donnees).eq('id', m.id);
        if (r.error) { erreur.textContent = messageErreur(r.error); erreur.hidden = false; return; }
        toast('Modifications enregistrées');
        aller('/membre/' + m.id);
      };
      return;
    }

    const { data: suivis } = await sb.from('suivis').select('*').eq('membre_id', m.id).order('date_suivi', { ascending: false }).order('created_at', { ascending: false });
    const telInt = C.telephoneInternational(m.telephone);
    afficher(`
      ${C.hero(m.nom, { retour, sousTitre: esc(STATUTS[m.statut] + ' · ' + C.nomEglise(m.eglise_id)) })}
      <div class="contenu">
        ${telInt ? `<div class="deux-colonnes">
          <a class="btn secondaire" href="tel:+${telInt}">${ICONES.suivi} Appeler</a>
          <a class="btn secondaire" href="https://wa.me/${telInt}" target="_blank" rel="noopener">${ICONES.whatsapp} WhatsApp</a></div>` : ''}
        <section class="carte paires">
          <div class="paire"><span>Téléphone</span><strong>${esc(C.telephoneLisible(m.telephone) || '—')}</strong></div>
          <div class="paire"><span>Sexe</span><strong>${m.sexe === 'H' ? 'Homme' : m.sexe === 'F' ? 'Femme' : '—'}</strong></div>
          <div class="paire"><span>Département</span><strong>${esc(m.departements ? m.departements.nom : '—')}</strong></div>
          <div class="paire"><span>Arrivée à l’église</span><strong>${m.date_arrivee ? esc(C.dateLongue(m.date_arrivee)) : '—'}</strong></div>
        </section>
        ${m.formations ? `<section class="carte"><h2 class="petit-titre">Formations suivies</h2><p class="texte-libre">${esc(m.formations)}</p></section>` : ''}
        ${m.notes ? `<section class="carte"><h2 class="petit-titre">Notes</h2><p class="texte-libre">${esc(m.notes)}</p></section>` : ''}
        ${ecrire ? `<a class="btn secondaire" href="#/membre/${m.id}/modifier">${ICONES.crayon} Modifier</a>` : ''}

        <section class="carte">
          <h2>Suivi</h2>
          ${ecrire ? `<form id="form-suivi" class="sous-formulaire" novalidate>
            <div class="deux-colonnes">
              <div class="champ"><label for="s-type">Type</label><select class="saisie" id="s-type">${Object.entries(TYPES_SUIVI).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
              <div class="champ"><label for="s-date">Date</label><input class="saisie" id="s-date" type="date" value="${C.aujourdhuiISO()}" max="${C.aujourdhuiISO()}"></div>
            </div>
            <div class="champ"><label for="s-note">Ce qui a été dit ou fait</label><textarea class="saisie" id="s-note" placeholder="Nouvelles, besoins de prière, prochaine étape…"></textarea></div>
            <button class="btn" type="submit">${ICONES.plus} Ajouter au suivi</button>
          </form>` : ''}
          <div class="chronologie">${(suivis || []).length ? suivis.map((s) => `
            <div class="evenement-suivi"><strong>${TYPES_SUIVI[s.type]} · ${esc(C.dateLongue(s.date_suivi))}</strong>${s.note ? `<p>${esc(s.note)}</p>` : ''}</div>`).join('')
            : '<p class="vide">Aucun appel ni visite enregistré.</p>'}</div>
        </section>
        ${ecrire ? '<button class="btn secondaire" id="supprimer">Supprimer ce membre</button>' : ''}
      </div>`, ongletDe('membres'));

    const form = document.getElementById('form-suivi');
    if (form) form.onsubmit = async (e) => {
      e.preventDefault();
      const r = await sb.from('suivis').insert({
        membre_id: m.id, eglise_id: m.eglise_id, type: document.getElementById('s-type').value,
        date_suivi: document.getElementById('s-date').value || C.aujourdhuiISO(), note: document.getElementById('s-note').value.trim()
      });
      if (r.error) return toast(messageErreur(r.error));
      toast('Suivi enregistré');
      ecranMembre({ id: m.id });
    };
    C.boutonConfirme(document.getElementById('supprimer'), async () => {
      const r = await sb.from('membres').delete().eq('id', m.id);
      if (r.error) return toast(messageErreur(r.error));
      toast('Membre supprimé');
      aller('/membres');
    }, 'Appuyez encore pour supprimer définitivement');
  }

  // ================= Suivi des âmes =================

  async function ecranSuivi(params) {
    const eglise = cible(params);
    if (!eglise) return;
    const [{ data: membres }, { data: suivis }] = await Promise.all([
      sb.from('membres').select('id, nom, telephone, statut, created_at').eq('eglise_id', eglise).in('statut', A_SUIVRE),
      sb.from('suivis').select('membre_id, date_suivi, type').eq('eglise_id', eglise).order('date_suivi', { ascending: false })
    ]);
    const auj = C.aujourdhuiISO();
    const liste = (membres || []).map((m) => {
      const dernier = (suivis || []).find((s) => s.membre_id === m.id);
      const jours = dernier ? C.ecartJours(dernier.date_suivi, auj) : null;
      return { ...m, dernier, jours, urgent: !dernier || jours > 7 };
    }).sort((a, b) => (b.urgent - a.urgent) || ((b.jours ?? 9999) - (a.jours ?? 9999)));
    const urgents = liste.filter((m) => m.urgent).length;
    const pre = C.prefixe(eglise);

    afficher(`
      ${C.hero('Suivi des âmes', { retour: C.estApotre() ? '#/eglise/' + eglise : '#/plus', sousTitre: esc(C.nomEglise(eglise)) })}
      <div class="contenu">
        <div class="info">${ICONES.info}<span>Nouveaux convertis et visiteurs. Un contact par semaine est conseillé (appel, ou visite le samedi soir). Ceux qui n’ont pas eu de nouvelles depuis plus de 7 jours apparaissent en premier.</span></div>
        <div class="tuiles trois">
          <div class="tuile"><span>À suivre</span><strong>${nombre(liste.length)}</strong></div>
          <div class="tuile"><span>À contacter</span><strong>${nombre(urgents)}</strong></div>
          <div class="tuile"><span>À jour</span><strong>${nombre(liste.length - urgents)}</strong></div>
        </div>
        <div class="liste">${liste.length ? liste.map((m) => `
          <a class="ligne" href="${pre}/membre/${m.id}">
            ${C.avatarHTML({ nom: m.nom }, 'petit')}
            <span class="corps"><strong>${esc(m.nom)}</strong><span>${STATUTS[m.statut]} · ${m.dernier ? `${TYPES_SUIVI[m.dernier.type]} il y a ${m.jours} jour${m.jours > 1 ? 's' : ''}` : 'Jamais contacté'}</span></span>
            <span class="pastille ${m.urgent ? 'attente' : 'vu'}">${m.urgent ? 'À contacter' : 'À jour'}</span></a>`).join('')
          : '<p class="vide">Aucun nouveau converti ni visiteur enregistré. Ajoutez-les dans Membres avec le statut « Nouveau converti » ou « Visiteur ».</p>'}</div>
      </div>`, ongletDe('plus'));
  }

  // ================= Départements =================

  async function ecranDepartements(params) {
    const eglise = cible(params);
    if (!eglise) return;
    const ecrire = C.peutEcrire(eglise);
    const [{ data: deps, error }, { data: membres }] = await Promise.all([
      sb.from('departements').select('*').eq('eglise_id', eglise).order('nom'),
      sb.from('membres').select('id, nom, departement_id').eq('eglise_id', eglise).not('departement_id', 'is', null)
    ]);
    const pre = C.prefixe(eglise);
    afficher(`
      ${C.hero('Départements', { retour: C.estApotre() ? '#/eglise/' + eglise : '#/plus', sousTitre: esc(C.nomEglise(eglise)) })}
      <div class="contenu">
        ${error ? `<p class="erreur">${esc(messageErreur(error))}</p>` : ''}
        ${(deps || []).map((d) => {
          const ses = (membres || []).filter((m) => m.departement_id === d.id);
          return `<section class="carte">
            <div class="entete-carte"><h2>${esc(d.nom)}</h2><span class="pastille neutre">${nombre(ses.length)} membre${ses.length > 1 ? 's' : ''}</span></div>
            ${ecrire ? `<div class="champ"><label for="resp-${d.id}">Responsable</label>
              <div class="ligne-saisie"><input class="saisie" id="resp-${d.id}" value="${esc(d.responsable)}" placeholder="Nom du responsable"><button class="btn secondaire petit" data-resp="${d.id}">Enregistrer</button></div></div>`
              : `<p class="discret">Responsable : ${esc(d.responsable || 'non renseigné')}</p>`}
            ${ses.length ? `<details><summary>Voir les membres</summary><div class="liste serree">${ses.map((m) => `<a class="ligne" href="${pre}/membre/${m.id}"><span class="corps"><strong>${esc(m.nom)}</strong></span>${ICONES.suivant}</a>`).join('')}</div></details>` : ''}
            ${ecrire && !ses.length ? `<button class="btn lien" data-suppr="${d.id}">Supprimer ce département</button>` : ''}
          </section>`;
        }).join('')}
        ${ecrire ? `<form class="carte" id="form-dep" novalidate><h2>Ajouter un département</h2>
          <div class="ligne-saisie"><input class="saisie" id="dep-nom" placeholder="Ex. : Accueil, Évangélisation" aria-label="Nom du département"><button class="btn petit" type="submit">${ICONES.plus} Ajouter</button></div></form>` : ''}
        <p class="discret">Le rapport mensuel des départements sera ajouté quand les départements seront structurés.</p>
      </div>`, ongletDe('plus'));

    document.querySelectorAll('[data-resp]').forEach((b) => {
      b.onclick = async () => {
        const id = b.dataset.resp;
        const r = await sb.from('departements').update({ responsable: document.getElementById('resp-' + id).value.trim() }).eq('id', id);
        toast(r.error ? messageErreur(r.error) : 'Responsable enregistré');
      };
    });
    document.querySelectorAll('[data-suppr]').forEach((b) => C.boutonConfirme(b, async () => {
      const r = await sb.from('departements').delete().eq('id', b.dataset.suppr);
      if (r.error) return toast(messageErreur(r.error));
      ecranDepartements(params);
    }));
    const f = document.getElementById('form-dep');
    if (f) f.onsubmit = async (e) => {
      e.preventDefault();
      const nom = document.getElementById('dep-nom').value.trim();
      if (!nom) return;
      const r = await sb.from('departements').insert({ eglise_id: eglise, nom });
      if (r.error) return toast(messageErreur(r.error));
      toast('Département ajouté');
      ecranDepartements(params);
    };
  }

  // ================= Finances =================

  function resume(ops) {
    const entrees = ops.filter((o) => o.type !== 'depense').reduce((s, o) => s + Number(o.montant), 0);
    const depenses = ops.filter((o) => o.type === 'depense').reduce((s, o) => s + Number(o.montant), 0);
    return { entrees, depenses, solde: entrees - depenses };
  }

  async function ecranFinances(params) {
    const eglise = cible(params);
    if (!eglise) return;
    const ecrire = C.peutEcrire(eglise);
    const mois = ecranFinances.mois || C.moisCourant();
    const { data, error } = await sb.from('transactions').select('*').eq('eglise_id', eglise)
      .gte('date_op', mois + '-01').lte('date_op', C.finDeMois(mois)).order('date_op', { ascending: false }).order('created_at', { ascending: false });
    const ops = data || [];
    const r = resume(ops);
    const parType = Object.keys(TYPES_OP).map((t) => ({ t, total: ops.filter((o) => o.type === t).reduce((s, o) => s + Number(o.montant), 0) })).filter((x) => x.total);
    const futur = mois >= C.moisCourant();

    afficher(`
      ${C.hero('Finances', { retour: retourEglise(eglise), sousTitre: esc(C.nomEglise(eglise)) })}
      <div class="contenu">
        <div class="selecteur clair">
          <button class="bouton-rond clair" id="mois-prec" aria-label="Mois précédent">${ICONES.retour}</button>
          <div class="date">${esc(C.moisLibelle(mois))}</div>
          <button class="bouton-rond clair" id="mois-suiv" aria-label="Mois suivant" ${futur ? 'disabled' : ''}>${ICONES.suivant}</button>
        </div>
        <div class="tuiles trois">
          <div class="tuile"><span>Entrées</span><strong class="positif">${fcfa(r.entrees)}</strong></div>
          <div class="tuile"><span>Dépenses</span><strong class="negatif">${fcfa(r.depenses)}</strong></div>
          <div class="tuile"><span>Solde</span><strong>${fcfa(r.solde)}</strong></div>
        </div>
        ${parType.length ? `<section class="carte paires">${parType.map((x) => `<div class="paire"><span>${TYPES_OP[x.t]}</span><strong class="${x.t === 'depense' ? 'negatif' : ''}">${x.t === 'depense' ? '− ' : ''}${fcfa(x.total)}</strong></div>`).join('')}</section>` : ''}
        ${ecrire ? `<details class="carte" id="ajout" ${ops.length ? '' : 'open'}><summary class="titre-details">${ICONES.plus} Ajouter une opération</summary>
          <form id="form-op" class="sous-formulaire" novalidate>
            <div class="deux-colonnes">
              <div class="champ"><label for="o-type">Type</label><select class="saisie" id="o-type">${Object.entries(TYPES_OP).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
              <div class="champ"><label for="o-date">Date</label><input class="saisie" id="o-date" type="date" value="${C.aujourdhuiISO()}" max="${C.aujourdhuiISO()}"></div>
            </div>
            <div class="champ"><label for="o-montant">Montant</label><div class="groupe"><input id="o-montant" type="number" inputmode="numeric" min="1" placeholder="0"><span class="suffixe">FCFA</span></div></div>
            <div class="champ"><label for="o-libelle">Libellé</label><input class="saisie" id="o-libelle" placeholder="Ex. : facture d’électricité, don de la famille…"></div>
            <p class="erreur" id="erreur" hidden></p>
            <button class="btn" type="submit">${ICONES.coche} Enregistrer</button>
          </form></details>` : ''}
        ${error ? `<p class="erreur">${esc(messageErreur(error))}</p>` : ''}
        <h2 class="titre-section">Opérations du mois</h2>
        <div class="liste">${ops.length ? ops.map((o) => `
          <div class="ligne"><span class="corps"><strong>${TYPES_OP[o.type]}${o.libelle ? ' · ' + esc(o.libelle) : ''}</strong><span>${esc(C.dateLongue(o.date_op))}</span></span>
          <strong class="${o.type === 'depense' ? 'negatif' : 'positif'}" style="white-space:nowrap">${o.type === 'depense' ? '− ' : '+ '}${fcfa(o.montant)}</strong>
          ${ecrire ? `<button class="bouton-suppr" data-op="${o.id}" aria-label="Supprimer cette opération">×</button>` : ''}</div>`).join('')
          : '<p class="vide">Aucune opération ce mois-ci.</p>'}</div>
        ${ops.length ? '<button class="btn secondaire" id="export-excel">Exporter le mois en Excel</button>' : ''}
        <p class="discret">Les finances de l’église sont tenues ici, séparément des offrandes et dîmes déclarées dans les rapports de culte.</p>
      </div>`, ongletDe('finances'));

    document.getElementById('mois-prec').onclick = () => { ecranFinances.mois = C.ajouterMois(mois, -1); ecranFinances(params); };
    document.getElementById('mois-suiv').onclick = () => { ecranFinances.mois = C.ajouterMois(mois, 1); ecranFinances(params); };
    document.querySelectorAll('[data-op]').forEach((b) => C.boutonConfirme(b, async () => {
      const res = await sb.from('transactions').delete().eq('id', b.dataset.op);
      if (res.error) return toast(messageErreur(res.error));
      toast('Opération supprimée');
      ecranFinances(params);
    }, 'Sûr ?'));
    const form = document.getElementById('form-op');
    if (form) form.onsubmit = async (e) => {
      e.preventDefault();
      const montant = parseInt(document.getElementById('o-montant').value, 10);
      const erreur = document.getElementById('erreur');
      if (!montant || montant <= 0) { erreur.textContent = 'Indiquez un montant.'; erreur.hidden = false; return; }
      const date = document.getElementById('o-date').value || C.aujourdhuiISO();
      const res = await sb.from('transactions').insert({ eglise_id: eglise, type: document.getElementById('o-type').value, date_op: date, montant, libelle: document.getElementById('o-libelle').value.trim() });
      if (res.error) { erreur.textContent = messageErreur(res.error); erreur.hidden = false; return; }
      toast('Opération enregistrée');
      ecranFinances.mois = date.slice(0, 7);
      ecranFinances(params);
    };
    const ex = document.getElementById('export-excel');
    if (ex) ex.onclick = () => {
      const lignes = ops.map((o) => ({ 'Date': o.date_op, 'Type': TYPES_OP[o.type], 'Libellé': o.libelle, 'Entrée (FCFA)': o.type === 'depense' ? '' : Number(o.montant), 'Dépense (FCFA)': o.type === 'depense' ? Number(o.montant) : '' }));
      lignes.push({ 'Date': 'TOTAL', 'Entrée (FCFA)': r.entrees, 'Dépense (FCFA)': r.depenses }, { 'Date': 'SOLDE', 'Entrée (FCFA)': r.solde });
      const classeur = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(classeur, XLSX.utils.json_to_sheet(lignes), 'Finances');
      XLSX.writeFile(classeur, 'CBN-finances-' + C.nomEglise(eglise).replace(/\s+/g, '-') + '-' + mois + '.xlsx');
    };
  }

  // Rapport de gestion de toutes les églises (apôtre)
  async function ecranFinancesCBN() {
    if (!C.estApotre()) return aller('/');
    const mois = ecranFinancesCBN.mois || C.moisCourant();
    const { data } = await sb.from('transactions').select('eglise_id, type, montant').gte('date_op', mois + '-01').lte('date_op', C.finDeMois(mois));
    const lignes = etat.eglises.map((e) => ({ e, ...resume((data || []).filter((o) => o.eglise_id === e.id)) }));
    const total = resume(data || []);
    afficher(`
      ${C.hero('Rapport de gestion', { retour: '#/plus', sousTitre: 'Finances de toutes les églises' })}
      <div class="contenu">
        <div class="selecteur clair">
          <button class="bouton-rond clair" id="mois-prec" aria-label="Mois précédent">${ICONES.retour}</button>
          <div class="date">${esc(C.moisLibelle(mois))}</div>
          <button class="bouton-rond clair" id="mois-suiv" aria-label="Mois suivant" ${mois >= C.moisCourant() ? 'disabled' : ''}>${ICONES.suivant}</button>
        </div>
        <div class="tuiles trois">
          <div class="tuile"><span>Entrées</span><strong class="positif">${fcfa(total.entrees)}</strong></div>
          <div class="tuile"><span>Dépenses</span><strong class="negatif">${fcfa(total.depenses)}</strong></div>
          <div class="tuile"><span>Solde</span><strong>${fcfa(total.solde)}</strong></div>
        </div>
        <div class="tableau-defile"><table class="tableau">
          <thead><tr><th>Église</th><th>Entrées</th><th>Dépenses</th><th>Solde</th></tr></thead>
          <tbody>${lignes.map((l) => `<tr><td><a href="#/eglise/${l.e.id}/finances">${esc(l.e.nom)}</a></td><td>${fcfa(l.entrees)}</td><td>${fcfa(l.depenses)}</td><td><strong>${fcfa(l.solde)}</strong></td></tr>`).join('')}</tbody>
        </table></div>
        <p class="discret">Touchez le nom d’une église pour voir le détail de ses opérations.</p>
      </div>`, 'plus');
    document.getElementById('mois-prec').onclick = () => { ecranFinancesCBN.mois = C.ajouterMois(mois, -1); ecranFinancesCBN(); };
    document.getElementById('mois-suiv').onclick = () => { ecranFinancesCBN.mois = C.ajouterMois(mois, 1); ecranFinancesCBN(); };
  }

  // ================= Documents =================

  async function ecranDocuments(params) {
    const apotre = C.estApotre();
    const eglise = apotre ? (params.eglise || null) : etat.profil.eglise_id;
    let q = sb.from('documents').select('*').order('created_at', { ascending: false });
    q = eglise ? q.or(`eglise_id.eq.${eglise},eglise_id.is.null`) : q;
    const { data, error } = await q;
    const docs = data || [];
    const taille = (o) => (o > 1048576 ? (o / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(o / 1024)) + ' Ko');

    afficher(`
      ${C.hero('Documents et archives', { retour: apotre ? (eglise ? '#/eglise/' + eglise : '#/plus') : '#/plus', sousTitre: esc(eglise ? C.nomEglise(eglise) + ' et documents généraux' : 'Toutes les églises') })}
      <div class="contenu">
        <details class="carte"><summary class="titre-details">${ICONES.plus} Ajouter un document</summary>
          <form id="form-doc" class="sous-formulaire" novalidate>
            <div class="champ"><label for="d-titre">Titre</label><input class="saisie" id="d-titre" placeholder="Ex. : PV de la réunion des ouvriers"></div>
            <div class="deux-colonnes">
              <div class="champ"><label for="d-cat">Catégorie</label><select class="saisie" id="d-cat">${Object.entries(CATEGORIES).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
              ${apotre ? `<div class="champ"><label for="d-eglise">Pour</label><select class="saisie" id="d-eglise"><option value="">Toute la CBN</option>${etat.eglises.map((e) => `<option value="${e.id}" ${eglise === e.id ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select></div>` : ''}
            </div>
            <div class="champ"><label for="d-fichier">Fichier (PDF, photo, Word, Excel · 10 Mo maximum)</label><input class="saisie fichier" id="d-fichier" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"></div>
            <p class="erreur" id="erreur" hidden></p>
            <button class="btn" type="submit" id="btn-doc">${ICONES.coche} Envoyer</button>
          </form></details>
        ${error ? `<p class="erreur">${esc(messageErreur(error))}</p>` : ''}
        <div class="liste">${docs.length ? docs.map((d) => `
          <div class="ligne"><span class="icone-ligne">${ICONES.document}</span>
            <span class="corps"><strong>${esc(d.titre)}</strong><span>${CATEGORIES[d.categorie]} · ${esc(d.eglise_id ? C.nomEglise(d.eglise_id) : 'Toute la CBN')} · ${esc(C.dateCourte(d.created_at.slice(0, 10)))} · ${taille(d.taille)}</span></span>
            <button class="btn secondaire petit" data-ouvrir="${esc(d.chemin)}">Ouvrir</button>
            ${C.peutPublier(d.eglise_id) ? `<button class="bouton-suppr" data-suppr="${d.id}" data-chemin="${esc(d.chemin)}" aria-label="Supprimer ce document">×</button>` : ''}</div>`).join('')
          : '<p class="vide">Aucun document pour le moment.</p>'}</div>
      </div>`, apotre ? (eglise ? 'eglises' : 'plus') : 'plus');

    document.querySelectorAll('[data-ouvrir]').forEach((b) => {
      b.onclick = async () => {
        const fenetre = window.open('', '_blank');
        const { data: lien, error: err } = await sb.storage.from('documents').createSignedUrl(b.dataset.ouvrir, 300);
        if (err) { if (fenetre) fenetre.close(); return toast(messageErreur(err)); }
        if (fenetre) fenetre.location = lien.signedUrl; else location.href = lien.signedUrl;
      };
    });
    document.querySelectorAll('[data-suppr]').forEach((b) => C.boutonConfirme(b, async () => {
      await sb.storage.from('documents').remove([b.dataset.chemin]);
      const r = await sb.from('documents').delete().eq('id', b.dataset.suppr);
      if (r.error) return toast(messageErreur(r.error));
      toast('Document supprimé');
      ecranDocuments(params);
    }, 'Sûr ?'));
    document.getElementById('form-doc').onsubmit = async (e) => {
      e.preventDefault();
      const erreur = document.getElementById('erreur');
      const montrer = (m) => { erreur.textContent = m; erreur.hidden = false; };
      const titre = document.getElementById('d-titre').value.trim();
      const fichier = document.getElementById('d-fichier').files[0];
      const pour = apotre ? (document.getElementById('d-eglise').value || null) : etat.profil.eglise_id;
      if (!titre) return montrer('Donnez un titre au document.');
      if (!fichier) return montrer('Choisissez un fichier.');
      if (fichier.size > 10 * 1048576) return montrer('Ce fichier dépasse 10 Mo.');
      const btn = document.getElementById('btn-doc');
      btn.disabled = true; btn.textContent = 'Envoi…';
      const nomPropre = fichier.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-');
      const chemin = (pour || 'general') + '/' + Date.now() + '-' + nomPropre;
      const up = await sb.storage.from('documents').upload(chemin, fichier, { contentType: fichier.type || 'application/octet-stream' });
      if (up.error) { btn.disabled = false; btn.textContent = 'Envoyer'; return montrer(messageErreur(up.error)); }
      const r = await sb.from('documents').insert({ eglise_id: pour, titre, categorie: document.getElementById('d-cat').value, chemin, nom_fichier: fichier.name, taille: fichier.size });
      if (r.error) { await sb.storage.from('documents').remove([chemin]); btn.disabled = false; btn.textContent = 'Envoyer'; return montrer(messageErreur(r.error)); }
      toast('Document ajouté');
      ecranDocuments(params);
    };
  }

  // ================= Routes =================
  const ID = '[0-9a-f-]{36}';
  C.route(/^\/eglises$/, ecranEglises);
  C.route(new RegExp(`^/eglise/(?<eglise>${ID})$`), ecranEglise);
  C.route(new RegExp(`^/eglise/(?<eglise>${ID})/membres$`), ecranMembres);
  C.route(new RegExp(`^/eglise/(?<eglise>${ID})/membre/(?<id>${ID})$`), ecranMembre);
  C.route(new RegExp(`^/eglise/(?<eglise>${ID})/suivi$`), ecranSuivi);
  C.route(new RegExp(`^/eglise/(?<eglise>${ID})/departements$`), ecranDepartements);
  C.route(new RegExp(`^/eglise/(?<eglise>${ID})/finances$`), ecranFinances);
  C.route(new RegExp(`^/eglise/(?<eglise>${ID})/documents$`), ecranDocuments);
  C.route(/^\/membres$/, ecranMembres);
  C.route(/^\/membres\/nouveau$/, ecranNouveauMembre);
  C.route(new RegExp(`^/membre/(?<id>${ID})$`), ecranMembre);
  C.route(new RegExp(`^/membre/(?<id>${ID})/modifier$`), (p) => ecranMembre({ ...p, modifier: true }));
  C.route(/^\/suivi$/, ecranSuivi);
  C.route(/^\/departements$/, ecranDepartements);
  C.route(/^\/finances$/, ecranFinances);
  C.route(/^\/finances-cbn$/, ecranFinancesCBN);
  C.route(/^\/documents$/, ecranDocuments);
})();
