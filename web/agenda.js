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
    return [`*${ev.titre}*`, `${TYPES[ev.type]} · ${C.nomEglise(ev.eglise_id)}`, quand(ev), ev.lieu ? 'Lieu : ' + ev.lieu : '', ev.description, '',
      ev.inscriptions ? 'Inscription : ' + location.origin + location.pathname + '#/inscription/' + ev.id : 'Tous les programmes de la Cité de la Bonne Nouvelle : ' + ADRESSE()]
      .filter((l, i) => l || i === 5).join('\n');
  }

  function carteEvenement(ev, gerer) {
    const jour = C.versDate(ev.date_debut);
    return `${ev.affiche_url ? `<a class="affiche-programme" href="${esc(ev.affiche_url)}" target="_blank" rel="noopener" aria-label="Voir l’affiche de ${esc(ev.titre)} en grand"><img src="${esc(ev.affiche_url)}" alt="Affiche : ${esc(ev.titre)}" loading="lazy"></a>` : ''}<article class="carte evenement ${ev.affiche_url ? 'avec-affiche' : ''}">
      <div class="date-bloc" aria-hidden="true"><strong>${jour.getUTCDate()}</strong><span>${esc(C.moisCourt(ev.date_debut.slice(0, 7)))}</span></div>
      <div class="evenement-corps">
        <div class="evenement-tags"><span class="pastille type-${ev.type}">${TYPES[ev.type]}</span><span class="discret">${esc(C.nomEglise(ev.eglise_id))}</span></div>
        <h3>${esc(ev.titre)}</h3>
        <p class="discret">${esc(quand(ev))}${ev.lieu ? '<br>' + esc(ev.lieu) : ''}</p>
        ${ev.description ? `<p class="texte-libre">${esc(ev.description)}</p>` : ''}
        <div class="evenement-actions">
          ${ev.inscriptions && !gerer ? `<a class="btn petit" href="#/inscription/${ev.id}">${ICONES.coche} S’inscrire</a>` : ''}
          <a class="btn whatsapp petit" href="https://wa.me/?text=${encodeURIComponent(texteWhatsApp(ev))}" target="_blank" rel="noopener">${ICONES.whatsapp} Partager</a>
          ${gerer && ev.inscriptions ? `<a class="btn secondaire petit" href="#/agenda/${ev.id}/inscrits">${ICONES.membres} Inscrits</a>` : ''}
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
      const y = window.scrollY;
      afficher(`
        ${C.heroFideles('Programmes et annonces', { sousTitre: 'Cultes, programmes, retraites et conventions de la Cité de la Bonne Nouvelle.' })}
        <div class="contenu">
          ${puces(f)}
          ${erreur ? `<p class="erreur">${esc(messageErreur(erreur))}</p>` : ''}
          ${listeParMois(filtrer(evenements, f), false)}
          <p class="discret" style="text-align:center">Partagez cette page : ${esc(ADRESSE())}</p>
        </div>`, 'programmes', 'fideles');
      window.scrollTo(0, y);
      document.querySelectorAll('[data-eglise]').forEach((b) => { b.onclick = () => { ecranPublic.filtre = b.dataset.eglise; dessiner(); }; });
    };
    dessiner();
    window.scrollTo(0, 0);
  }

  // ================= Inscription à un programme (sans compte) =================

  async function ecranInscription({ id }) {
    const [{ data: ev }, eglises] = await Promise.all([sb.from('evenements').select('*').eq('id', id).maybeSingle(), C.eglisesPubliques()]);
    const ouvert = ev && ev.inscriptions && (ev.date_fin || ev.date_debut) >= C.aujourdhuiISO();
    if (!ouvert) {
      afficher(`${C.heroFideles('Inscription', { retour: '#/programmes' })}<div class="contenu"><p class="vide">${ev ? 'Les inscriptions à ce programme sont fermées.' : 'Ce programme n’existe plus.'}</p></div>`, 'programmes', 'fideles');
      return;
    }
    afficher(`
      ${C.heroFideles('Inscription', { retour: '#/programmes', sousTitre: esc(ev.titre) + ' · ' + esc(quand(ev)) })}
      <form class="contenu" id="form-ins" novalidate>
        <section class="carte">
          <div class="champ"><label for="i-nom">Nom et prénom</label><input class="saisie" id="i-nom" maxlength="100" autocomplete="name"></div>
          <div class="champ"><label for="i-tel">Téléphone ou WhatsApp</label>
            <div class="groupe"><span class="prefixe">+237</span><input id="i-tel" type="tel" inputmode="tel" maxlength="20" placeholder="6XX XX XX XX"></div></div>
          <div class="champ"><label for="i-eglise">Votre église</label>
            <select class="saisie" id="i-eglise"><option value="">Autre église / aucune</option>${eglises.map((e) => `<option value="${e.id}" ${ev.eglise_id === e.id ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select></div>
          <div class="compteur"><label for="i-nombre">Nombre de personnes</label>
            <div class="commandes"><button type="button" data-n="-1" aria-label="Une personne de moins">−</button><input id="i-nombre" type="number" min="1" max="50" value="1" inputmode="numeric"><button type="button" data-n="1" aria-label="Une personne de plus">+</button></div></div>
        </section>
        <p class="erreur" id="erreur" hidden></p>
        <button class="btn" type="submit" id="btn-ins">${ICONES.coche} Je m’inscris</button>
      </form>`, 'programmes', 'fideles');
    const nb = document.getElementById('i-nombre');
    document.querySelectorAll('[data-n]').forEach((b) => { b.onclick = () => { nb.value = Math.min(50, Math.max(1, (parseInt(nb.value, 10) || 1) + Number(b.dataset.n))); }; });
    document.getElementById('form-ins').onsubmit = async (e) => {
      e.preventDefault();
      const erreur = document.getElementById('erreur');
      const montrer = (t) => { erreur.textContent = t; erreur.hidden = false; };
      const nom = document.getElementById('i-nom').value.trim();
      const tel = document.getElementById('i-tel').value.replace(/[^\d+]/g, '');
      if (nom.length < 2) return montrer('Indiquez votre nom.');
      if (tel.replace(/\D/g, '').length < 9) return montrer('Indiquez un numéro de téléphone (9 chiffres).');
      const btn = document.getElementById('btn-ins');
      btn.disabled = true; btn.textContent = 'Envoi…';
      const r = await sb.from('inscriptions').insert({ evenement_id: ev.id, nom, telephone: C.telephoneInternational(tel), eglise_id: document.getElementById('i-eglise').value || null, nombre: Math.min(50, Math.max(1, parseInt(nb.value, 10) || 1)) });
      if (r.error) { btn.disabled = false; btn.innerHTML = ICONES.coche + ' Réessayer'; return montrer(messageErreur(r.error)); }
      afficher(`
        ${C.heroFideles('Inscription reçue', { sousTitre: esc(ev.titre) })}
        <div class="contenu">
          <section class="carte flottante merci">
            <div class="icone-ligne grande">${ICONES.coche}</div>
            <div class="grand-titre">À bientôt, ${esc(nom.split(' ')[0])} !</div>
            <p class="discret">${esc(quand(ev))}${ev.lieu ? ' · ' + esc(ev.lieu) : ''}</p>
          </section>
          <a class="btn whatsapp" href="https://wa.me/?text=${encodeURIComponent(texteWhatsApp(ev))}" target="_blank" rel="noopener">${ICONES.whatsapp} Inviter quelqu’un</a>
          <a class="btn lien" href="#/programmes">Voir les autres programmes</a>
        </div>`, 'programmes', 'fideles');
    };
  }

  // ================= Liste des inscrits (gestion) =================

  async function ecranInscrits({ id }) {
    const [{ data: ev }, { data: liste, error }] = await Promise.all([
      sb.from('evenements').select('*').eq('id', id).maybeSingle(),
      sb.from('inscriptions').select('*').eq('evenement_id', id).order('created_at')
    ]);
    if (!ev) return aller('/agenda');
    const total = (liste || []).reduce((s, i) => s + (i.nombre || 1), 0);
    const peutGerer = C.peutPublier(ev.eglise_id);
    afficher(`
      ${C.hero('Inscrits', { retour: '#/agenda', sousTitre: esc(ev.titre) + ' · ' + esc(quand(ev)) })}
      <div class="contenu">
        <div class="tuiles trois">
          <div class="tuile"><span>Inscriptions</span><strong>${(liste || []).length}</strong></div>
          <div class="tuile"><span>Personnes</span><strong>${total}</strong></div>
          <div class="tuile"><span>Statut</span><strong>${ev.inscriptions ? 'Ouvert' : 'Fermé'}</strong></div>
        </div>
        ${(liste || []).length ? '<button class="btn secondaire" id="excel">Exporter en Excel</button>' : ''}
        ${error ? `<p class="erreur">${esc(messageErreur(error))}</p>` : ''}
        <div class="liste serree">${(liste || []).length ? liste.map((i) => `
          <div class="ligne">
            <span class="corps"><strong>${esc(i.nom)}${i.nombre > 1 ? ' · ' + i.nombre + ' pers.' : ''}</strong><span>${esc(C.telephoneLisible(i.telephone))} · ${esc(i.eglise_id ? C.nomEglise(i.eglise_id) : 'Autre église')}</span></span>
            ${i.telephone ? `<a class="bouton-suppr" href="${esc(C.lienWhatsApp(i.telephone, 'Bonjour ' + i.nom.split(' ')[0] + ', votre inscription à « ' + ev.titre + ' » est bien enregistrée.'))}" target="_blank" rel="noopener" aria-label="WhatsApp">${ICONES.whatsapp}</a>` : ''}
            ${peutGerer ? `<button class="bouton-suppr" data-suppr="${i.id}" aria-label="Supprimer l’inscription">×</button>` : ''}
          </div>`).join('') : '<p class="vide">Aucune inscription pour le moment. Partagez le programme sur WhatsApp : le lien d’inscription est inclus.</p>'}</div>
      </div>`, 'agenda');
    const x = document.getElementById('excel');
    if (x) x.onclick = () => {
      const feuille = XLSX.utils.json_to_sheet(liste.map((i) => ({ Nom: i.nom, Téléphone: C.telephoneLisible(i.telephone), Église: i.eglise_id ? C.nomEglise(i.eglise_id) : 'Autre', Personnes: i.nombre, 'Inscrit le': new Date(i.created_at).toLocaleString('fr-FR') })));
      const classeur = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(classeur, feuille, 'Inscrits');
      XLSX.writeFile(classeur, 'CBN-inscrits-' + ev.titre.replace(/[^\w]+/g, '-') + '.xlsx');
    };
    document.querySelectorAll('[data-suppr]').forEach((b) => C.boutonConfirme(b, async () => {
      const r = await sb.from('inscriptions').delete().eq('id', b.dataset.suppr);
      if (r.error) return toast(messageErreur(r.error));
      ecranInscrits({ id });
    }, 'Sûr ?'));
  }

  // ================= Gestion des programmes (connecté) =================

  async function ecranAgenda() {
    const { evenements, erreur } = await charger(C.ajouterJours(C.aujourdhuiISO(), -1));
    const f = ecranAgenda.filtre || '';
    afficher(`
      ${C.hero('Programmes', { sousTitre: 'Ce que vous publiez ici apparaît sur la page publique des fidèles.' })}
      <div class="contenu">
        <div class="deux-colonnes">
          <a class="btn" href="#/agenda/nouveau">${ICONES.plus} Ajouter</a>
          <a class="btn secondaire" href="#/programmes">${ICONES.globe} Vue des fidèles</a>
        </div>
        ${puces(f)}
        ${erreur ? `<p class="erreur">${esc(messageErreur(erreur))}</p>` : ''}
        ${listeParMois(filtrer(evenements, f), true)}
      </div>`, 'agenda');
    document.querySelectorAll('[data-eglise]').forEach((b) => { b.onclick = () => { ecranAgenda.filtre = b.dataset.eglise; ecranAgenda(); }; });
  }

  // Réduit une image (affiche) avant l'envoi : 1400 px de large au plus, en JPEG
  function reduireAffiche(fichier) {
    return new Promise((ok, ko) => {
      const img = new Image();
      const url = URL.createObjectURL(fichier);
      img.onload = () => {
        const echelle = Math.min(1, 1400 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * echelle); cv.height = Math.round(img.height * echelle);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob((bl) => (bl ? ok(bl) : ko(new Error('Image illisible'))), 'image/jpeg', 0.84);
      };
      img.onerror = () => ko(new Error('Image illisible'));
      img.src = url;
    });
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
    const puce = (nom, valeur, libelle, coche) => `<label class="puce-choix"><input type="radio" name="${nom}" value="${valeur}" ${coche ? 'checked' : ''}><span>${libelle}</span></label>`;
    afficher(`
      ${C.hero(ev ? 'Modifier le programme' : 'Nouveau programme', { retour: '#/agenda', sousTitre: 'Il apparaîtra sur la page des fidèles, avec son affiche.' })}
      <form class="contenu formulaire-moderne" id="form-ev" novalidate>
        <section class="carte">
          <h2 class="titre-bloc">${ICONES.image} Affiche du programme <small>facultatif</small></h2>
          <label class="zone-affiche ${v.affiche_url ? 'remplie' : ''}" for="e-affiche" id="zone-affiche">
            ${v.affiche_url ? `<img src="${esc(v.affiche_url)}" alt="Affiche actuelle">` : `${ICONES.image}<strong>Ajouter une affiche (flyer)</strong><span class="discret">Photo ou image JPG, PNG</span>`}
          </label>
          <input class="visuellement-cache" id="e-affiche" type="file" accept="image/*">
          ${v.affiche_url ? '<button class="btn lien petit" type="button" id="retirer-affiche">Retirer l’affiche</button>' : ''}
        </section>
        <section class="carte">
          <h2 class="titre-bloc">${ICONES.agenda} Le programme</h2>
          <div class="champ"><span class="libelle">Type</span><div class="puces-choix">${Object.entries(TYPES).map(([k, n]) => puce('e-type', k, n, v.type === k)).join('')}</div></div>
          <div class="champ"><label for="e-titre">Titre</label><input class="saisie" id="e-titre" value="${esc(v.titre)}" placeholder="Ex. : Veillée de prière, Convention annuelle"></div>
          <div class="champ"><span class="libelle">Pour</span>
            ${apotre ? `<div class="puces-choix">${puce('e-eglise', '', 'Toute la CBN', !v.eglise_id)}${etat.eglises.map((e) => puce('e-eglise', e.id, esc(e.nom.replace('CBN ', '')), v.eglise_id === e.id)).join('')}</div>`
                     : `<p class="valeur-fixe">${esc(C.nomEglise(etat.profil.eglise_id))}</p>`}</div>
        </section>
        <section class="carte">
          <h2 class="titre-bloc">${ICONES.lieu} Quand et où</h2>
          <div class="deux-colonnes">
            <div class="champ"><label for="e-debut">Date de début</label><input class="saisie" id="e-debut" type="date" value="${esc(v.date_debut)}"></div>
            <div class="champ"><label for="e-fin">Date de fin</label><input class="saisie" id="e-fin" type="date" value="${esc(v.date_fin || '')}"></div>
          </div>
          <div class="deux-colonnes">
            <div class="champ"><label for="e-heure">Heure</label><input class="saisie" id="e-heure" value="${esc(v.heure)}" placeholder="9 h 00"></div>
            <div class="champ"><label for="e-lieu">Lieu</label><input class="saisie" id="e-lieu" value="${esc(v.lieu)}" placeholder="Temple de Mbouda"></div>
          </div>
        </section>
        <section class="carte">
          <h2 class="titre-bloc">${ICONES.document} Détails</h2>
          <div class="champ"><label for="e-desc">Description</label><textarea class="saisie" id="e-desc" placeholder="Orateur, thème, contribution, consignes…">${esc(v.description)}</textarea></div>
          <label class="interrupteur"><input type="checkbox" role="switch" id="e-ins" ${v.inscriptions ? 'checked' : ''}><span><strong>Inscriptions en ligne</strong><small>Les fidèles s’inscrivent depuis l’application, vous recevez la liste.</small></span></label>
        </section>
        <p class="erreur" id="erreur" hidden></p>
        <button class="btn" type="submit" id="btn-ev">${ICONES.coche} ${ev ? 'Enregistrer' : 'Publier le programme'}</button>
        ${ev ? '<button class="btn secondaire" type="button" id="supprimer">Supprimer ce programme</button>' : ''}
      </form>`, 'agenda');

    let affiche = null;          // nouvelle image choisie (Blob)
    let retirer = false;
    const zone = document.getElementById('zone-affiche');
    document.getElementById('e-affiche').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) return toast('Choisissez une image.');
      try {
        affiche = await reduireAffiche(f);
        retirer = false;
        zone.classList.add('remplie');
        zone.innerHTML = `<img src="${URL.createObjectURL(affiche)}" alt="Aperçu de l’affiche">`;
      } catch (err) { toast(err.message); }
    };
    const btnRetirer = document.getElementById('retirer-affiche');
    if (btnRetirer) btnRetirer.onclick = () => {
      retirer = true; affiche = null;
      zone.classList.remove('remplie');
      zone.innerHTML = `${ICONES.image}<strong>Ajouter une affiche (flyer)</strong><span class="discret">Photo ou image JPG, PNG</span>`;
      btnRetirer.remove();
    };

    document.getElementById('form-ev').onsubmit = async (e) => {
      e.preventDefault();
      const val = (k) => document.getElementById(k).value.trim();
      const choix = (n) => (document.querySelector(`input[name="${n}"]:checked`) || {}).value;
      const erreur = document.getElementById('erreur');
      const montrer = (m) => { erreur.textContent = m; erreur.hidden = false; };
      erreur.hidden = true;
      const donnees = {
        type: choix('e-type') || 'programme', titre: val('e-titre'), date_debut: val('e-debut'), date_fin: val('e-fin') || null,
        heure: val('e-heure'), lieu: val('e-lieu'), description: val('e-desc'), inscriptions: document.getElementById('e-ins').checked,
        eglise_id: apotre ? (choix('e-eglise') || null) : etat.profil.eglise_id
      };
      if (!donnees.titre) return montrer('Indiquez le titre du programme.');
      if (!donnees.date_debut) return montrer('Indiquez la date.');
      if (donnees.date_fin && donnees.date_fin < donnees.date_debut) return montrer('La date de fin est avant la date de début.');
      const btn = document.getElementById('btn-ev');
      btn.disabled = true;
      try {
        if (affiche) {
          btn.textContent = 'Envoi de l’affiche…';
          const chemin = `${donnees.eglise_id || 'general'}/${Date.now()}.jpg`;
          const up = await sb.storage.from('affiches').upload(chemin, affiche, { contentType: 'image/jpeg', cacheControl: '31536000' });
          if (up.error) throw up.error;
          donnees.affiche_url = sb.storage.from('affiches').getPublicUrl(chemin).data.publicUrl;
        } else if (retirer) {
          donnees.affiche_url = null;
        }
        btn.textContent = 'Enregistrement…';
        const r = ev ? await sb.from('evenements').update(donnees).eq('id', ev.id) : await sb.from('evenements').insert(donnees);
        if (r.error) throw r.error;
        toast(ev ? 'Programme modifié' : 'Programme publié');
        aller('/agenda');
      } catch (err) {
        btn.disabled = false; btn.innerHTML = ICONES.coche + ' Réessayer';
        montrer(messageErreur(err));
      }
    };
    C.boutonConfirme(document.getElementById('supprimer'), async () => {
      const r = await sb.from('evenements').delete().eq('id', ev.id);
      if (r.error) return toast(messageErreur(r.error));
      toast('Programme supprimé');
      aller('/agenda');
    }, 'Appuyez encore pour supprimer');
  }

  C.route(/^\/programmes$/, ecranPublic, { public: true });
  C.route(/^\/inscription\/(?<id>[0-9a-f-]{36})$/, ecranInscription, { public: true });
  C.route(/^\/agenda\/(?<id>[0-9a-f-]{36})\/inscrits$/, ecranInscrits);
  C.route(/^\/agenda$/, ecranAgenda);
  C.route(/^\/agenda\/nouveau$/, () => ecranFormulaire({}));
  C.route(/^\/agenda\/(?<id>[0-9a-f-]{36})$/, ecranFormulaire);

  C.demarrer();
})();
