/* CBN — Responsables (Apôtre, Maman Apôtre, pasteurs) et leaders visibles par les fidèles,
   lien Facebook, et gestion de tout cela par les administrateurs. */
(function () {
  'use strict';
  const C = window.CBN;
  const { sb, etat, ICONES, esc, afficher, aller, toast, messageErreur } = C;
  const ID = '[0-9a-f-]{36}';
  const TITRES = ['Apôtre', 'Maman Apôtre', 'Pasteur', 'Maman Pasteur', 'Évangéliste', 'Prophète', 'Ancien', 'Diacre'];
  const ROLES_LEADER = ['Responsable de département', 'Chef de cellule', 'Ancien', 'Diacre', 'Diaconesse', 'Responsable de la jeunesse',
    'Responsable des femmes', 'Responsable des hommes', 'Chef de chorale', 'Intercession', 'Protocole et accueil', 'Responsable des enfants'];

  // ================= Données =================
  const cache = { responsables: null, leaders: null, parametres: null };
  function viderCache() { cache.responsables = cache.leaders = cache.parametres = null; }

  async function chargerResponsables() {
    if (cache.responsables) return cache.responsables;
    const { data, error } = await sb.from('responsables').select('*').eq('actif', true).order('ordre').order('nom');
    if (error) throw error;
    cache.responsables = data || [];
    return cache.responsables;
  }
  async function chargerLeaders() {
    if (cache.leaders) return cache.leaders;
    const { data } = await sb.rpc('leaders_publics');
    cache.leaders = data || [];
    return cache.leaders;
  }
  async function chargerParametres() {
    if (cache.parametres) return cache.parametres;
    const { data } = await sb.from('parametres').select('cle, valeur');
    cache.parametres = Object.fromEntries((data || []).map((p) => [p.cle, p.valeur]));
    return cache.parametres;
  }

  // ================= Petits éléments =================
  const telIntl = (t) => C.telephoneInternational(t);
  function avatar(r, classe) {
    return `<span class="avatar ${classe || ''}">${r.photo_url ? `<img src="${esc(r.photo_url)}" alt="" loading="lazy">` : esc(C.initiales(r.nom))}</span>`;
  }
  function boutonsContact(tel, whatsapp, nom) {
    const t = telIntl(tel);
    if (!t) return '';
    return `<div class="actions-contact">
      <a class="btn secondaire petit" href="tel:+${t}" aria-label="Appeler ${esc(nom)}">${ICONES.suivi} Appeler</a>
      ${whatsapp !== false ? `<a class="btn petit whatsapp" href="https://wa.me/${t}" target="_blank" rel="noopener" aria-label="Écrire à ${esc(nom)} sur WhatsApp">${ICONES.message} WhatsApp</a>` : ''}
    </div>`;
  }
  function carteResponsable(r) {
    return `<article class="carte responsable">
      <div class="responsable-tete">
        ${avatar(r, 'grand')}
        <div class="responsable-nom">
          <small>${esc(r.titre)}</small>
          <strong>${esc(r.nom)}</strong>
          ${r.eglise_id ? `<span>${esc(C.nomEglise(r.eglise_id))}</span>` : '<span>Cité de la Bonne Nouvelle</span>'}
        </div>
      </div>
      ${r.presentation ? `<p class="texte-libre">${esc(r.presentation)}</p>` : ''}
      ${boutonsContact(r.telephone, r.whatsapp, r.nom)}
    </article>`;
  }

  // Rangée de visages sur l'accueil des fidèles
  function rangeeResponsables(liste) {
    if (!liste || !liste.length) return '';
    return `<div class="entete-section"><h2 class="titre-section">Nos responsables</h2><a href="#/responsables">Les contacter</a></div>
      <div class="rangee-responsables">${liste.map((r) => `
        <a href="#/responsables" class="mini-responsable">
          ${avatar(r, 'moyen')}
          <strong>${esc(r.nom)}</strong>
          <span>${esc(r.titre)}</span>
        </a>`).join('')}</div>`;
  }

  // Bloc « Suivez-nous » en bas de l'accueil
  function blocSuivezNous(parametres) {
    const fb = parametres && parametres.facebook;
    if (!fb) return '';
    return `<a class="carte suivez-nous" href="${esc(fb)}" target="_blank" rel="noopener">
      <span class="icone-facebook">${ICONES.facebook}</span>
      <span class="corps"><small>Suivez-nous sur Facebook</small><strong>Cité de la Bonne Nouvelle</strong></span>
      ${ICONES.suivant}
    </a>`;
  }

  // ================= Page publique « Nos responsables » =================
  async function ecranResponsables() {
    let responsables = [], leaders = [], erreur = null;
    try {
      [responsables, leaders] = await Promise.all([chargerResponsables(), chargerLeaders(), C.eglisesPubliques()]);
    } catch (e) { erreur = e; }
    const direction = responsables.filter((r) => !r.eglise_id);
    const sections = etat.eglises.map((e) => {
      const resp = responsables.filter((r) => r.eglise_id === e.id);
      const lead = leaders.filter((l) => l.eglise_id === e.id);
      if (!resp.length && !lead.length) return '';
      return `<h2 class="titre-section">${esc(e.nom)}</h2>
        ${resp.map(carteResponsable).join('')}
        ${lead.length ? `<section class="carte">
          <h3 class="petit-titre">Leaders</h3>
          <div class="liste-leaders">${lead.map((l) => `
            <div class="leader">
              ${avatar(l, '')}
              <span class="corps"><strong>${esc(l.nom)}</strong><span>${esc(l.role_leader)}</span></span>
              ${telIntl(l.telephone) ? `<span class="contacts-mini">
                <a class="bouton-rond petit" href="tel:+${telIntl(l.telephone)}" aria-label="Appeler ${esc(l.nom)}">${ICONES.suivi}</a>
                <a class="bouton-rond petit whatsapp" href="https://wa.me/${telIntl(l.telephone)}" target="_blank" rel="noopener" aria-label="WhatsApp ${esc(l.nom)}">${ICONES.message}</a>
              </span>` : ''}
            </div>`).join('')}</div>
        </section>` : ''}`;
    }).join('');
    afficher(`
      ${C.heroFideles('Nos responsables', { sousTitre: 'Appelez ou écrivez sur WhatsApp à l’apôtre, aux pasteurs et aux leaders.', retour: etat.profil ? '#/fideles' : '#/' })}
      <div class="contenu">
        ${erreur ? `<p class="erreur">${esc(messageErreur(erreur))}</p>` : ''}
        ${direction.length ? `<h2 class="titre-section" style="margin-top:0">Direction de la CBN</h2>${direction.map(carteResponsable).join('')}` : ''}
        ${sections}
        ${!erreur && !responsables.length ? '<p class="vide">La liste des responsables sera bientôt disponible.</p>' : ''}
      </div>`, 'accueil', 'fideles');
  }

  // ================= Gestion (administrateurs) =================
  async function ecranGestion() {
    if (!C.peutGererSite()) { toast('Réservé aux administrateurs.'); return aller('/plus'); }
    await C.chargerEglisesEtPasteurs();
    const [{ data, error }, params] = await Promise.all([
      sb.from('responsables').select('*').order('ordre').order('nom'),
      (cache.parametres = null, chargerParametres())
    ]);
    const liste = data || [];
    afficher(`
      ${C.hero('Responsables et liens', { retour: '#/plus', sousTitre: 'Ce que les fidèles voient dans « Nos responsables »' })}
      <div class="contenu">
        ${error ? `<p class="erreur">${esc(messageErreur(error))}</p>` : ''}
        <form class="carte" id="form-fb">
          <h2 class="titre-bloc">${ICONES.facebook} Page Facebook</h2>
          <div class="champ"><label for="p-fb">Adresse de la page</label>
            <input class="saisie" id="p-fb" type="url" inputmode="url" placeholder="https://www.facebook.com/…" value="${esc(params.facebook || '')}"></div>
          <p class="aide">Elle s’affiche en bas de l’accueil des fidèles. Laissez vide pour la cacher.</p>
          <button class="btn secondaire" type="submit">${ICONES.coche} Enregistrer le lien</button>
        </form>
        <div class="entete-section"><h2 class="titre-section">Responsables</h2><a href="#/gerer/responsable/nouveau">${ICONES.plus} Ajouter</a></div>
        <div class="liste">${liste.map((r) => `
          <a class="ligne" href="#/gerer/responsable/${r.id}">
            ${avatar(r, '')}
            <span class="corps"><strong>${esc(r.titre)} ${esc(r.nom)}</strong><span>${esc([r.eglise_id ? C.nomEglise(r.eglise_id) : 'Direction', C.telephoneLisible(r.telephone) || 'Pas de numéro'].join(' · '))}</span></span>
            ${r.actif ? '' : '<span class="pastille neutre">Masqué</span>'}${ICONES.suivant}
          </a>`).join('') || '<p class="vide">Aucun responsable.</p>'}</div>
        <a class="btn secondaire" href="#/responsables">${ICONES.globe} Voir la page des fidèles</a>
      </div>`, 'plus');
    document.getElementById('form-fb').onsubmit = async (e) => {
      e.preventDefault();
      let url = document.getElementById('p-fb').value.trim();
      if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
      if (url && !/facebook\.com|fb\.com|fb\.me/i.test(url)) { toast('Ce lien ne ressemble pas à une page Facebook.'); return; }
      const { error: err } = await sb.from('parametres').upsert({ cle: 'facebook', valeur: url });
      if (err) { toast(messageErreur(err)); return; }
      cache.parametres = null;
      toast(url ? 'Lien Facebook enregistré ✓' : 'Lien Facebook retiré');
    };
  }

  // Photo carrée, 600 px, pour un affichage net et léger
  function photoCarree(fichier) {
    return new Promise((ok, ko) => {
      const img = new Image();
      const url = URL.createObjectURL(fichier);
      img.onload = () => {
        const cote = Math.min(img.width, img.height);
        const cv = document.createElement('canvas');
        cv.width = cv.height = Math.min(600, cote);
        cv.getContext('2d').drawImage(img, (img.width - cote) / 2, (img.height - cote) / 2, cote, cote, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob((b) => (b ? ok(b) : ko(new Error('Image illisible'))), 'image/jpeg', 0.86);
      };
      img.onerror = () => ko(new Error('Image illisible'));
      img.src = url;
    });
  }

  async function ecranFiche({ id }, { soi } = {}) {
    await C.chargerEglisesEtPasteurs();
    if (!etat.eglises.length) { const { data } = await sb.from('eglises').select('id, nom, ordre').order('ordre'); etat.eglises = data || []; }
    const admin = C.peutGererSite();
    let r = null;
    if (soi) {
      const { data } = await sb.from('responsables').select('*').eq('profil_id', etat.profil.id).maybeSingle();
      r = data;
      if (!r) {
        afficher(`${C.hero('Ma fiche publique', { retour: '#/plus' })}<div class="contenu"><p class="vide">Vous n’avez pas encore de fiche publique. Demandez à l’Apôtre Elvis Yumto ou au Pasteur Abraham DM de vous ajouter dans « Responsables et liens ».</p></div>`, 'plus');
        return;
      }
    } else if (id) {
      const { data } = await sb.from('responsables').select('*').eq('id', id).maybeSingle();
      r = data;
      if (!r) { toast('Fiche introuvable.'); return aller('/gerer/responsables'); }
    }
    if (!admin && !(r && r.profil_id === etat.profil.id)) { toast('Réservé aux administrateurs.'); return aller('/plus'); }
    const nouveau = !r;
    const v = r || { titre: 'Pasteur', whatsapp: true, actif: true, ordre: 50, eglise_id: null };
    const ficheId = v.id || (crypto.randomUUID ? crypto.randomUUID() : null);
    let photoUrl = v.photo_url || null;
    let nouvellePhoto = null;
    const retour = soi ? '#/plus' : '#/gerer/responsables';

    afficher(`
      ${C.hero(nouveau ? 'Nouveau responsable' : (soi ? 'Ma fiche publique' : v.titre + ' ' + v.nom), { retour, sousTitre: 'Visible par tous les fidèles dans « Nos responsables »' })}
      <form class="contenu formulaire-moderne" id="form-resp" novalidate>
        <section class="carte">
          <h2 class="titre-bloc">${ICONES.image} Photo</h2>
          <div class="photo-fiche">
            <span class="avatar tres-grand" id="apercu-photo">${photoUrl ? `<img src="${esc(photoUrl)}" alt="">` : esc(C.initiales(v.nom || '?'))}</span>
            <div class="photo-actions">
              <label class="btn secondaire petit" for="r-photo">${ICONES.image} Choisir une photo</label>
              <input type="file" id="r-photo" accept="image/*" hidden>
              <button type="button" class="btn secondaire petit" id="r-sans-photo" ${photoUrl ? '' : 'hidden'}>Retirer la photo</button>
              <p class="aide">Sans photo, les initiales sont affichées.</p>
            </div>
          </div>
        </section>
        <section class="carte">
          <h2 class="titre-bloc">${ICONES.profil} Identité</h2>
          <div class="champ"><label for="r-titre">Titre</label>
            <input class="saisie" id="r-titre" list="titres" value="${esc(v.titre)}" required>
            <datalist id="titres">${TITRES.map((t) => `<option value="${esc(t)}">`).join('')}</datalist></div>
          <div class="champ"><label for="r-nom">Nom affiché</label><input class="saisie" id="r-nom" value="${esc(v.nom || '')}" placeholder="Ex. : Elvis Yumto" required></div>
          ${admin ? `<div class="champ"><label for="r-eglise">Église</label>
            <select class="saisie" id="r-eglise"><option value="">Direction (toute la CBN)</option>${etat.eglises.map((e) => `<option value="${e.id}" ${v.eglise_id === e.id ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select></div>`
            : `<p class="valeur-fixe">${esc(v.eglise_id ? C.nomEglise(v.eglise_id) : 'Direction de la CBN')}</p>`}
          <div class="champ"><label for="r-pres">Présentation <small>facultatif</small></label>
            <textarea class="saisie" id="r-pres" maxlength="400" placeholder="Quelques mots pour les fidèles : ministère, horaires où l’on peut vous joindre…">${esc(v.presentation || '')}</textarea></div>
        </section>
        <section class="carte">
          <h2 class="titre-bloc">${ICONES.suivi} Contact</h2>
          <div class="champ"><label for="r-tel">Numéro de téléphone</label>
            <div class="groupe"><span class="prefixe">+237</span><input id="r-tel" type="tel" inputmode="tel" value="${esc((v.telephone || '').replace(/^237/, ''))}" placeholder="6XX XX XX XX"></div></div>
          <label class="interrupteur"><input type="checkbox" role="switch" id="r-wa" ${v.whatsapp !== false ? 'checked' : ''}><span><strong>Ce numéro a WhatsApp</strong><small>Affiche le bouton « WhatsApp » à côté de « Appeler ».</small></span></label>
        </section>
        ${admin ? `<section class="carte">
          <h2 class="titre-bloc">${ICONES.menu} Affichage</h2>
          <div class="champ"><label for="r-ordre">Position dans la liste</label><input class="saisie" id="r-ordre" type="number" min="0" max="999" value="${Number(v.ordre) || 0}"><p class="aide">Les plus petits nombres apparaissent en premier (Apôtre : 1, Maman Apôtre : 2).</p></div>
          <label class="interrupteur"><input type="checkbox" role="switch" id="r-actif" ${v.actif !== false ? 'checked' : ''}><span><strong>Visible par les fidèles</strong><small>Décochez pour masquer cette fiche sans la supprimer.</small></span></label>
        </section>` : ''}
        <p class="erreur" id="r-erreur" hidden></p>
        <button class="btn" type="submit">${ICONES.coche} Enregistrer</button>
        ${admin && !nouveau && !v.profil_id ? `<button class="btn secondaire" type="button" id="r-suppr">Supprimer cette fiche</button>` : ''}
      </form>`, 'plus');

    const apercu = document.getElementById('apercu-photo');
    const sansPhoto = document.getElementById('r-sans-photo');
    document.getElementById('r-photo').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        nouvellePhoto = await photoCarree(f);
        apercu.innerHTML = `<img src="${URL.createObjectURL(nouvellePhoto)}" alt="">`;
        sansPhoto.hidden = false;
      } catch (err) { toast('Cette image ne peut pas être lue.'); }
    };
    sansPhoto.onclick = () => { nouvellePhoto = null; photoUrl = null; apercu.textContent = C.initiales(document.getElementById('r-nom').value || '?'); sansPhoto.hidden = true; };

    const btnSuppr = document.getElementById('r-suppr');
    if (btnSuppr) C.boutonConfirme(btnSuppr, async () => {
      const { error } = await sb.from('responsables').delete().eq('id', v.id);
      if (error) { toast(messageErreur(error)); btnSuppr.disabled = false; return; }
      viderCache(); toast('Fiche supprimée'); aller('/gerer/responsables');
    });

    document.getElementById('form-resp').onsubmit = async (e) => {
      e.preventDefault();
      const err = document.getElementById('r-erreur');
      const val = (i) => (document.getElementById(i) ? document.getElementById(i).value.trim() : '');
      const nom = val('r-nom'), titre = val('r-titre');
      const telBrut = val('r-tel').replace(/\D/g, '');
      if (!nom || !titre) { err.textContent = 'Le titre et le nom sont obligatoires.'; err.hidden = false; return; }
      if (telBrut && telBrut.replace(/^237/, '').length !== 9) { err.textContent = 'Le numéro doit avoir 9 chiffres (ex. : 6XX XX XX XX).'; err.hidden = false; return; }
      err.hidden = true;
      const bouton = e.submitter || e.target.querySelector('button[type=submit]');
      bouton.disabled = true;
      try {
        if (nouvellePhoto) {
          const chemin = `${ficheId}/${Date.now()}.jpg`;
          const up = await sb.storage.from('responsables').upload(chemin, nouvellePhoto, { contentType: 'image/jpeg', upsert: true });
          if (up.error) throw up.error;
          photoUrl = sb.storage.from('responsables').getPublicUrl(chemin).data.publicUrl;
        }
        const donnees = {
          nom, titre, telephone: telBrut ? C.telephoneInternational(telBrut) : '',
          whatsapp: document.getElementById('r-wa').checked, presentation: val('r-pres'), photo_url: photoUrl
        };
        if (admin) {
          donnees.eglise_id = val('r-eglise') || null;
          donnees.ordre = Number(val('r-ordre')) || 0;
          donnees.actif = document.getElementById('r-actif').checked;
        }
        const r2 = nouveau
          ? await sb.from('responsables').insert({ id: ficheId, ...donnees })
          : await sb.from('responsables').update(donnees).eq('id', v.id);
        if (r2.error) throw r2.error;
        viderCache();
        toast('Fiche enregistrée ✓');
        aller(soi ? '/plus' : '/gerer/responsables');
      } catch (ex) {
        err.textContent = messageErreur(ex); err.hidden = false; bouton.disabled = false;
      }
    };
  }

  // ================= Routes =================
  C.route(/^\/responsables$/, ecranResponsables, { public: true });
  C.route(/^\/gerer\/responsables$/, ecranGestion);
  C.route(/^\/gerer\/responsable\/nouveau$/, () => ecranFiche({}));
  C.route(new RegExp(`^/gerer/responsable/(?<id>${ID})$`), ecranFiche);
  C.route(/^\/ma-fiche$/, () => ecranFiche({}, { soi: true }));

  Object.assign(C, { chargerResponsables, chargerParametres, rangeeResponsables, blocSuivezNous, ROLES_LEADER });
})();
