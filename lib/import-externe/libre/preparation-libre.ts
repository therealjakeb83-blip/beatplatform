import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normaliserEmail } from '@/lib/email'
import { dayKeyInTz, fuseauSur } from '@/lib/fuseau-horaire'
import {
  choisirEchantillon, decouperNom, emailsDejaContacts, numerosDejaImportes, r2,
  type Apercu, type CommandePayload, type ContactPayload, type LignePayload, type Preparation,
} from '../preparation'
import { chargerTauxBce, convertirEnEuros } from '../taux-bce'
import type { LigneRejetee } from '../beatstars'
import type { Tableau } from './tableau'
import { cleLicence, cleStatut, type Association, type Role } from './association'
import { decouperCase, extraireLicence, nettoyerLicence, titresAvecQuantite } from './articles'
import { deviseEcrite, instantDate, lireDate, lireMontant } from './valeurs'

// Préparation d'un import « format libre » à partir des réponses validées de
// l'assistant, SANS RIEN ÉCRIRE (aperçu ET import : le serveur refait tout).
// Règles (grill-me point 19 + décisions du 2026-10-10) :
// - seul l'email est obligatoire ; date / montant / titre absents = INCONNUS ;
// - seules les commandes réglées (statuts cochés par le beatmaker) ;
// - lignes au même n° = une commande ; sans n°, chaque ligne = une commande
//   (n° = empreinte email + date + titre + montant) ;
// - ligne sans titre dans une commande qui a des articles = ignorée ;
// - total payé réparti au prorata des prix d'articles quand ils sont tous
//   connus, sinon gardé sur la commande seule (articles sans prix) ;
// - commande à 0 € = offerte, comme sur My Producer ; $ converti au taux BCE
//   du jour de la vente, non converti si la date est inconnue.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type LigneLue = {
  numero: number
  cellules: string[]
  email: string
  date: Date | null
  dateBrute: string
  titre: string
  montantCommande: number | null
  montantLigne: number | null
  quantite: number | null
  remise: number | null
  nom: string | null
}

type Article = { titre: string | null; licence: string | null; licence_id: string | null; prix: number | null; titreOriginal: string | null }

function colonne(a: Association, role: Role): number {
  return a.colonnes.indexOf(role)
}

export async function preparerImportLibre(
  admin: SupabaseClient,
  beatmakerId: string,
  tableau: Tableau,
  a: Association,
  nomFichier: string,
): Promise<Preparation> {
  const { data: bm } = await admin.from('beatmakers').select('fuseau_horaire').eq('id', beatmakerId).maybeSingle()
  const fuseau = fuseauSur(bm?.fuseau_horaire)
  const c = (role: Role) => colonne(a, role)
  const val = (cellules: string[], role: Role) => { const i = c(role); return i >= 0 ? (cellules[i] ?? '').trim() : '' }
  const a_ = (role: Role) => c(role) >= 0

  const rejets: LigneRejetee[] = []
  const lignesRejeteesParGroupe = new Set<string>()
  let nbLignesEcartees = 0
  const statutsRegles = a.statutsRegles ? new Set(a.statutsRegles) : null
  const avecQuantite = a_('titre') && titresAvecQuantite(tableau.lignes.map(l => val(l.cellules, 'titre')))

  // ── Lecture ligne à ligne ─────────────────────────────────────────────
  const groupes = new Map<string, LigneLue[]>()
  const groupesEcartes = new Set<string>()
  for (const l of tableau.lignes) {
    const numeroCmd = val(l.cellules, 'numero')
    const cleGroupe = numeroCmd ? `n:${numeroCmd}` : `l:${l.numero}`
    if (statutsRegles && !statutsRegles.has(cleStatut(val(l.cellules, 'statut')))) {
      nbLignesEcartees++
      groupesEcartes.add(cleGroupe)
      continue
    }
    const rejeter = (raison: string) => { rejets.push({ numero: l.numero, raison, cellules: l.cellules }); lignesRejeteesParGroupe.add(cleGroupe) }

    const email = normaliserEmail(val(l.cellules, 'email'))
    if (!email || !EMAIL.test(email)) { rejeter(email ? `Email invalide (« ${val(l.cellules, 'email')} »)` : 'Email manquant'); continue }

    // € et $ seulement (décision de Jake) : une autre devise est refusée
    const deviseLigne = val(l.cellules, 'devise')
    if (deviseLigne && deviseEcrite(deviseLigne) !== a.devise) {
      rejeter(deviseEcrite(deviseLigne) ? `Devise ${deviseLigne} différente de celle choisie pour ce fichier` : `Devise non acceptée (« ${deviseLigne} ») : seuls les euros et les dollars le sont pour l’instant`)
      continue
    }

    const dateBrute = val(l.cellules, 'date')
    const dateLue = lireDate(dateBrute, a.ordreDate)
    if (dateLue === undefined) { rejeter(`Date illisible (« ${dateBrute} »)`); continue }

    const montants: Partial<Record<'montant_commande' | 'montant_ligne' | 'remise' | 'quantite', number | null>> = {}
    let illisible: string | null = null
    for (const role of ['montant_commande', 'montant_ligne', 'remise', 'quantite'] as const) {
      const brut = val(l.cellules, role)
      const m = lireMontant(brut)
      if (m === undefined) { illisible = `${role === 'quantite' ? 'Quantité' : 'Montant'} illisible (« ${brut} »)`; break }
      montants[role] = m
    }
    if (illisible) { rejeter(illisible); continue }

    const prenom = val(l.cellules, 'prenom'), nom = val(l.cellules, 'nom'), complet = val(l.cellules, 'nom_complet')
    const nomAcheteur = (prenom || nom ? `${prenom} ${nom}` : complet).replace(/\s+/g, ' ').trim() || null

    const lue: LigneLue = {
      numero: l.numero,
      cellules: l.cellules,
      email,
      date: dateLue ? instantDate(dateLue, fuseau) : null,
      dateBrute,
      titre: val(l.cellules, 'titre'),
      montantCommande: montants.montant_commande ?? null,
      montantLigne: montants.montant_ligne ?? null,
      quantite: montants.quantite ?? null,
      remise: montants.remise ?? null,
      nom: nomAcheteur,
    }
    const g = groupes.get(cleGroupe) ?? []
    g.push(lue)
    groupes.set(cleGroupe, g)
  }

  // Une ligne rejetée = toute sa commande non importée (jamais une commande à moitié)
  for (const cle of lignesRejeteesParGroupe) groupes.delete(cle)
  const nbCommandesEcartees = [...groupesEcartes].filter(g => !groupes.has(g) && !lignesRejeteesParGroupe.has(g)).length

  // ── Commandes ─────────────────────────────────────────────────────────
  let nbLignesSansArticle = 0
  const occurrences = new Map<string, number>()
  type CommandeLue = { numero: string; lignes: LigneLue[]; articles: Article[]; total: number | null; remise: number | null; date: Date | null }
  const lues: CommandeLue[] = []

  for (const [cle, lignes] of groupes) {
    const avecTitre = lignes.filter(l => l.titre)
    nbLignesSansArticle += avecTitre.length > 0 ? lignes.length - avecTitre.length : 0
    const articles: Article[] = []
    for (const l of avecTitre) {
      const morceaux = decouperCase(l.titre, a.separateurArticles, avecQuantite)
      const decoupee = morceaux.length > 1
      for (const m of morceaux) {
        // quantité de la colonne : seulement pour une case non découpée dont le
        // titre ne porte pas déjà sa propre quantité (« 1× … ») — sinon une case
        // multi-articles que le beatmaker a choisi de ne pas découper serait
        // recopiée autant de fois que la colonne compte d'articles
        const n = decoupee || avecQuantite ? m.quantite : Math.max(1, Math.round(l.quantite ?? m.quantite))
        const prixUnitaire = decoupee ? null : l.montantLigne !== null ? r2(l.montantLigne / n) : null
        for (let k = 0; k < Math.min(n, 50); k++) articles.push({ ...licenceArticle(m.titre, val(l.cellules, 'licence'), a), prix: prixUnitaire })
      }
    }
    if (articles.length === 0) articles.push({ titre: null, licence: null, licence_id: null, prix: null, titreOriginal: null })

    const total = lignes.find(l => l.montantCommande !== null)?.montantCommande ?? null
    const remise = lignes.find(l => l.remise !== null)?.remise ?? null
    const date = lignes.find(l => l.date)?.date ?? null

    let numero = cle.startsWith('n:') ? cle.slice(2) : ''
    if (!numero) {
      const base = [lignes[0].email, lignes[0].dateBrute, lignes.map(l => l.titre).join('|'), total ?? lignes[0].montantLigne ?? ''].join('\u001f')
      const empreinte = createHash('sha256').update(base).digest('hex').slice(0, 16)
      const n = (occurrences.get(empreinte) ?? 0) + 1
      occurrences.set(empreinte, n)
      numero = `emp-${empreinte}${n > 1 ? `-${n}` : ''}`
    }
    lues.push({ numero, lignes, articles, total, remise, date })
  }

  // ── Déjà importées, montants, conversion ──────────────────────────────
  const deja = await numerosDejaImportes(admin, beatmakerId, a.plateforme)
  const nouvelles = lues.filter(x => !deja.has(x.numero))
  nouvelles.sort((x, y) => (y.date?.getTime() ?? -Infinity) - (x.date?.getTime() ?? -Infinity))

  const jours = nouvelles.filter(x => x.date).map(x => dayKeyInTz(x.date!.toISOString(), fuseau)).sort()
  const tauxBce = a.devise === 'EUR' || jours.length === 0 ? null : await chargerTauxBce(a.devise, jours[0], jours[jours.length - 1])

  let nbMontantsInconnus = 0
  const commandes: CommandePayload[] = nouvelles.map(x => {
    const prixConnus = x.articles.every(ar => ar.prix !== null)
    const sommePrix = prixConnus ? x.articles.reduce((s, ar) => s + (ar.prix ?? 0), 0) : null
    const total = x.total ?? (prixConnus ? r2(sommePrix!) : null)
    let montants: (number | null)[]
    if (total === null) montants = x.articles.map(ar => ar.prix)
    else if (x.articles.length === 1) montants = [total]
    else if (prixConnus && sommePrix! > 0) montants = repartir(total, x.articles.map(ar => ar.prix!))
    else if (total === 0) montants = x.articles.map(() => 0)
    else montants = x.articles.map(() => null)
    if (total === null) nbMontantsInconnus++

    let taux: number | null = 1
    let dateTaux: string | null = null
    if (a.devise !== 'EUR') {
      if (x.date && tauxBce) { const t = tauxBce.taux(dayKeyInTz(x.date.toISOString(), fuseau)); taux = t.taux; dateTaux = t.dateTaux }
      else taux = null
    }
    const enEuros = (m: number | null) => m === null || taux === null ? null : a.devise === 'EUR' ? m : convertirEnEuros(m, taux)
    const offert = total === 0

    const lignes: LignePayload[] = x.articles.map((ar, i) => ({
      ordre: i + 1,
      titre: ar.titre,
      titre_original: ar.titreOriginal,
      licence: ar.licence,
      licence_id: ar.licence_id,
      prix_catalogue: null,
      remise: null,
      montant_depense: montants[i],
      montant_paye: montants[i],
      montant_depense_eur: enEuros(montants[i]),
      offert,
      vendeur_principal: null,
      collaborateurs: [],
    }))
    const premiere = x.lignes[0]
    return {
      numero_externe: x.numero,
      date_vente: x.date?.toISOString() ?? null,
      acheteur_email: premiere.email,
      acheteur_nom: x.lignes.find(l => l.nom)?.nom ?? null,
      type_boutique: null,
      reference_paiement: null,
      devise: a.devise,
      taux_change: taux,
      date_taux: dateTaux,
      total_catalogue: null,
      total_remise: x.remise,
      total_depense: total,
      total_paye: total,
      total_depense_eur: enEuros(total),
      lignes,
    }
  })

  // ── Contacts ──────────────────────────────────────────────────────────
  const parEmail = new Map<string, { nom: string | null; premiere: string | null }>()
  for (const cmd of commandes) {
    const ex = parEmail.get(cmd.acheteur_email)
    if (!ex) parEmail.set(cmd.acheteur_email, { nom: cmd.acheteur_nom, premiere: cmd.date_vente })
    else {
      if (!ex.nom && cmd.acheteur_nom) ex.nom = cmd.acheteur_nom
      if (cmd.date_vente && (!ex.premiere || cmd.date_vente < ex.premiere)) ex.premiere = cmd.date_vente
    }
  }
  const emails = [...parEmail.keys()]
  const existants = await emailsDejaContacts(admin, beatmakerId, emails)
  const contacts: ContactPayload[] = emails.map(email => {
    const v = parEmail.get(email)!
    return { email, ...decouperNom(v.nom, email), premiere_date: v.premiere }
  })

  // ── Aperçu ────────────────────────────────────────────────────────────
  const datees = lues.filter(x => x.date).map(x => x.date!.getTime()).sort((p, q) => p - q)
  const sansDate = !a_('date'), sansNumero = !a_('numero')
  const sansMontant = !a_('montant_commande') && !a_('montant_ligne')
  const avertissements: string[] = []
  if (sansNumero && sansDate) avertissements.push('Ni date ni n° de commande : impossible de reconnaître une commande déjà importée. Réimporter ce fichier (ou un fichier qui le contient) créera des doublons.')
  else if (sansNumero) avertissements.push('Pas de n° de commande : chaque ligne du fichier devient une commande.')
  if (sansDate) avertissements.push('Pas de date : ces commandes ne compteront ni dans l’ancienneté ni dans le dernier achat de tes clients.')
  if (sansMontant) avertissements.push('Pas de montant : ces commandes compteront dans le nombre de commandes, mais pas dans le total dépensé ni dans le panier moyen.')
  else if (nbMontantsInconnus > 0) avertissements.push(`${nbMontantsInconnus.toLocaleString('fr-FR')} commande(s) sans montant : comptées dans le nombre de commandes, pas dans le total dépensé.`)
  if (!a_('titre')) avertissements.push('Pas de titre : chaque vente apparaîtra comme « Beat non précisé » et ne pourra pas être reliée à un beat.')
  if (!a_('prenom') && !a_('nom') && !a_('nom_complet')) avertissements.push('Pas de nom : l’email tiendra lieu de nom pour les nouveaux contacts.')
  if (a.devise !== 'EUR' && commandes.some(cmd => !cmd.date_vente && cmd.total_depense !== null)) avertissements.push('Montants en dollars sans date : impossible de les convertir en euros, ils compteront comme montant inconnu dans le CRM.')

  const apercu: Apercu = {
    plateforme: a.plateforme,
    plateformeLibelle: a.plateforme,
    nomFichier,
    nomVendeur: null,
    devise: a.devise,
    periodeDebut: datees.length ? new Date(datees[0]).toISOString() : null,
    periodeFin: datees.length ? new Date(datees[datees.length - 1]).toISOString() : null,
    nbCommandesFichier: lues.length,
    nbDejaImportees: lues.length - nouvelles.length,
    nbNouvelles: commandes.length,
    nbBeats: commandes.reduce((s, cmd) => s + cmd.lignes.length, 0),
    nbAcheteurs: emails.length,
    nbAcheteursNouveaux: emails.length - existants.size,
    nbAcheteursExistants: existants.size,
    totalDepense: r2(commandes.reduce((s, cmd) => s + (cmd.total_depense ?? 0), 0)),
    totalDepenseEur: r2(commandes.reduce((s, cmd) => s + (cmd.total_depense_eur ?? 0), 0)),
    echantillon: choisirEchantillon(commandes, [
      commandes.find(cmd => cmd.lignes.length > 1),
      commandes.find(cmd => cmd.lignes.some(l => l.offert)),
      commandes.find(cmd => cmd.lignes.some(l => l.licence_id)),
      commandes.find(cmd => cmd.total_depense === null || !cmd.date_vente),
    ]),
    rejets,
    enTetes: tableau.enTetes,
    nbCommandesRejetees: lignesRejeteesParGroupe.size,
    format: 'libre',
    nbLignesEcartees,
    nbCommandesEcartees,
    nbLignesSansArticle,
    nbMontantsInconnus,
    avertissements,
  }

  const datesNouvelles = commandes.map(cmd => cmd.date_vente).filter((d): d is string => !!d).sort()
  return {
    apercu,
    importMeta: {
      plateforme: a.plateforme,
      nom_fichier: nomFichier,
      nom_vendeur: null,
      devise: a.devise,
      periode_debut: datesNouvelles[0] ?? null,
      periode_fin: datesNouvelles.at(-1) ?? null,
      nb_rejetees: rejets.length,
      nb_ecartees: nbLignesEcartees,
    },
    contacts,
    commandes,
  }
}

// Total réparti au prorata des prix, au centime ; le reste sur le dernier article
function repartir(total: number, prix: number[]): number[] {
  const somme = prix.reduce((s, p) => s + p, 0)
  const centimes = Math.round(total * 100)
  const parts = prix.map(p => Math.floor(centimes * p / somme))
  parts[parts.length - 1] += centimes - parts.reduce((s, p) => s + p, 0)
  return parts.map(p => p / 100)
}

// Licence de l'article : colonne Licence, sinon partie détectée dans le titre,
// selon le choix du beatmaker (licence reliée / sans équivalent / pas une licence)
function licenceArticle(titre: string, colonneLicence: string, a: Association): Omit<Article, 'prix'> {
  if (colonneLicence) {
    const libelle = colonneLicence.trim()
    const choix = a.licences[cleLicence(nettoyerLicence(libelle))]
    if (choix?.choix === 'pas_licence') return { titre, licence: null, licence_id: null, titreOriginal: null }
    return { titre, licence: nettoyerLicence(libelle), licence_id: choix?.choix === 'licence' ? choix.licence_id : null, titreOriginal: null }
  }
  // case de plusieurs articles non découpée (« A - Licence WAV, 1× B - Licence MP3 ») :
  // pas de licence, elle ne serait que celle du dernier article
  if (a.formeLicence && !/\d+\s*[×x]\s/i.test(titre)) {
    const ex = extraireLicence(titre, a.formeLicence)
    if (ex) {
      const choix = a.licences[cleLicence(ex.licence)]
      if (choix && choix.choix !== 'pas_licence') {
        return { titre: ex.titre, licence: ex.licence, licence_id: choix.choix === 'licence' ? choix.licence_id : null, titreOriginal: titre }
      }
    }
  }
  return { titre, licence: null, licence_id: null, titreOriginal: null }
}
