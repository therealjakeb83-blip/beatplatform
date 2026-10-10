import type { SupabaseClient } from '@supabase/supabase-js'
import { lireBeatStars, PLATEFORME_BEATSTARS, DEVISE_BEATSTARS, type CommandeLue, type LigneRejetee } from './beatstars'
import { chargerTauxBce, convertirEnEuros } from './taux-bce'
import { dayKeyInTz, fuseauSur } from '@/lib/fuseau-horaire'
import { libellePlateforme } from './plateformes'

// Préparation d'un import, SANS RIEN ÉCRIRE : sert à l'écran de vérification
// ET à l'import lui-même (le serveur relit le fichier et recalcule tout, il ne
// fait jamais confiance à ce que le navigateur renvoie).


export class ErreurImport extends Error {}

// null = INCONNU (format libre : seul l'email est obligatoire), jamais 0
export type LignePayload = {
  ordre: number
  titre: string | null
  titre_original: string | null
  licence: string | null
  licence_id?: string | null
  prix_catalogue: number | null
  remise: number | null
  montant_depense: number | null
  montant_paye: number | null
  montant_depense_eur: number | null
  offert: boolean
  vendeur_principal: string | null
  collaborateurs: string[]
  beat_id?: string | null
}

export type CommandePayload = {
  numero_externe: string
  date_vente: string | null
  acheteur_email: string
  acheteur_nom: string | null
  type_boutique: string | null
  reference_paiement: string | null
  moyen_paiement?: string | null
  montant_tva?: number | null
  source_marketing?: string | null
  devise: string
  taux_change: number | null
  date_taux: string | null
  total_catalogue: number | null
  total_remise: number | null
  total_depense: number | null
  total_paye: number | null
  total_depense_eur: number | null
  lignes: LignePayload[]
}

export type ContactPayload = {
  email: string; prenom: string; nom: string; premiere_date: string | null
  // format libre : coordonnées, enregistrées seulement si l'import CRÉE la fiche
  adresse?: string | null; ville?: string | null; code_postal?: string | null; pays?: string | null; telephone?: string | null
}

export type Apercu = {
  plateforme: string
  plateformeLibelle: string
  nomFichier: string
  nomVendeur: string | null
  devise: string
  periodeDebut: string | null
  periodeFin: string | null
  nbCommandesFichier: number
  nbDejaImportees: number
  nbNouvelles: number
  nbBeats: number
  nbAcheteurs: number
  nbAcheteursNouveaux: number
  nbAcheteursExistants: number
  totalDepense: number
  totalDepenseEur: number
  echantillon: CommandePayload[]
  rejets: LigneRejetee[]
  enTetes: string[]
  nbCommandesRejetees: number
  format: 'beatstars' | 'libre'
  // format libre : commandes non réglées écartées, lignes sans article
  // ignorées, montants inconnus, données absentes du fichier
  nbLignesEcartees: number
  nbCommandesEcartees: number
  nbLignesSansArticle: number
  nbMontantsInconnus: number
  avertissements: string[]
}

export type Preparation = {
  apercu: Apercu
  importMeta: Record<string, unknown>
  contacts: ContactPayload[]
  commandes: CommandePayload[]
}

export const r2 = (n: number) => Math.round(n * 100) / 100

export async function numerosDejaImportes(admin: SupabaseClient, beatmakerId: string, plateforme: string): Promise<Set<string>> {
  return new Set((await commandesDejaImportees(admin, beatmakerId, plateforme)).keys())
}

// n° déjà importé → email de l'acheteur de cette commande (format libre : un
// même n° pour un autre acheteur = conflit, jamais ignoré en silence)
export async function commandesDejaImportees(admin: SupabaseClient, beatmakerId: string, plateforme: string): Promise<Map<string, string>> {
  const vus = new Map<string, string>()
  for (let debut = 0; ; debut += 1000) {
    const { data, error } = await admin
      .from('commandes_externes')
      .select('numero_externe, acheteur_email')
      .eq('beatmaker_id', beatmakerId)
      .eq('plateforme', plateforme)
      .order('numero_externe')
      .range(debut, debut + 999)
    if (error) { console.error('[import-externe] lecture des numéros déjà importés:', error); throw new ErreurImport('Lecture des imports précédents impossible.') }
    for (const d of data ?? []) vus.set(d.numero_externe, d.acheteur_email)
    if (!data || data.length < 1000) break
  }
  return vus
}

export async function emailsDejaContacts(admin: SupabaseClient, beatmakerId: string, emails: string[]): Promise<Set<string>> {
  const existants = new Set<string>()
  for (let i = 0; i < emails.length; i += 200) {
    const lot = emails.slice(i, i + 200)
    const { data: clients, error } = await admin.from('clients').select('id, email').in('email', lot)
    if (error) { console.error('[import-externe] lecture clients:', error); throw new ErreurImport('Lecture des contacts impossible.') }
    if (!clients?.length) continue
    const { data: leads, error: e2 } = await admin
      .from('leads').select('client_id').eq('beatmaker_id', beatmakerId).in('client_id', clients.map(c => c.id))
    if (e2) { console.error('[import-externe] lecture leads:', e2); throw new ErreurImport('Lecture des contacts impossible.') }
    const avecLead = new Set((leads ?? []).map(l => l.client_id))
    for (const c of clients) if (avecLead.has(c.id)) existants.add(c.email)
  }
  return existants
}

// Nom de la commande la plus récente, coupé au 1er espace ; pseudo seul =
// prénom ; aucun nom = l'email tient lieu de nom (décisions 9 et 19)
export function decouperNom(nom: string | null, email: string): { prenom: string; nom: string } {
  const n = (nom ?? '').trim().replace(/\s+/g, ' ')
  if (!n) return { prenom: email, nom: '' }
  const i = n.indexOf(' ')
  return i < 0 ? { prenom: n, nom: '' } : { prenom: n.slice(0, i), nom: n.slice(i + 1) }
}

export function choisirEchantillon(commandes: CommandePayload[], prioritaires: (CommandePayload | undefined)[] = []): CommandePayload[] {
  const choix: CommandePayload[] = []
  const ajouter = (c: CommandePayload | undefined) => { if (c && !choix.includes(c)) choix.push(c) }
  ajouter(commandes[0])
  for (const c of prioritaires) ajouter(c)
  ajouter(commandes.find(c => c.lignes.some(l => l.vendeur_principal)))
  ajouter(commandes.find(c => c.lignes.some(l => l.offert)))
  ajouter(commandes.find(c => c.lignes.length > 1))
  ajouter(commandes.find(c => c.lignes.some(l => l.collaborateurs.length > 0 && !l.vendeur_principal)))
  // Compléter avec des acheteurs différents de ceux déjà montrés
  for (const c of commandes) {
    if (choix.length >= 5) break
    if (!choix.some(x => x.acheteur_email === c.acheteur_email)) ajouter(c)
  }
  for (const c of commandes) { if (choix.length >= 5) break; ajouter(c) }
  return choix.slice(0, 5)
}

export async function preparerImport(
  admin: SupabaseClient,
  beatmakerId: string,
  texte: string,
  nomFichier: string,
): Promise<Preparation> {
  const lecture = lireBeatStars(texte)
  if (!lecture) {
    throw new ErreurImport('Format non reconnu : ce fichier n’est pas un export « Transactions » de BeatStars. Les fichiers des autres plateformes (Airbit, Instrurap…) seront bientôt acceptés.')
  }
  const plateforme = PLATEFORME_BEATSTARS
  const devise = DEVISE_BEATSTARS

  const deja = await numerosDejaImportes(admin, beatmakerId, plateforme)
  const nouvelles: CommandeLue[] = lecture.commandes.filter(c => !deja.has(c.numeroExterne))
  nouvelles.sort((a, b) => b.dateVente.getTime() - a.dateVente.getTime())

  const { data: bm } = await admin.from('beatmakers').select('fuseau_horaire').eq('id', beatmakerId).maybeSingle()
  const fuseau = fuseauSur(bm?.fuseau_horaire)

  let commandes: CommandePayload[] = []
  if (nouvelles.length > 0) {
    const jours = nouvelles.map(c => dayKeyInTz(c.dateVente.toISOString(), fuseau)).sort()
    const tauxBce = await chargerTauxBce(devise, jours[0], jours[jours.length - 1])
    commandes = nouvelles.map(c => {
      const { taux, dateTaux } = tauxBce.taux(dayKeyInTz(c.dateVente.toISOString(), fuseau))
      const lignes: LignePayload[] = c.beats.map(b => {
        const primary = b.parts.find(p => p.type === 'PRIMARY')!.nom
        return {
          ordre: b.ordre,
          titre: b.titre,
          titre_original: b.titreOriginal,
          licence: null,
          prix_catalogue: b.prixCatalogue,
          remise: b.remise,
          montant_depense: b.montantDepense,
          montant_paye: b.montantPaye,
          montant_depense_eur: convertirEnEuros(b.montantDepense, taux),
          offert: b.offert,
          vendeur_principal: primary !== lecture.nomVendeur ? primary : null,
          collaborateurs: [...new Set(b.parts.map(p => p.nom).filter(n => n !== primary && n !== lecture.nomVendeur))],
        }
      })
      return {
        numero_externe: c.numeroExterne,
        date_vente: c.dateVente.toISOString(),
        acheteur_email: c.acheteurEmail,
        acheteur_nom: c.acheteurNom,
        type_boutique: c.typeBoutique,
        reference_paiement: c.referencePaiement,
        devise,
        taux_change: taux,
        date_taux: dateTaux,
        total_catalogue: r2(lignes.reduce((s, l) => s + (l.prix_catalogue ?? 0), 0)),
        total_remise: r2(lignes.reduce((s, l) => s + (l.remise ?? 0), 0)),
        total_depense: r2(lignes.reduce((s, l) => s + (l.montant_depense ?? 0), 0)),
        total_paye: r2(lignes.reduce((s, l) => s + (l.montant_paye ?? 0), 0)),
        total_depense_eur: r2(lignes.reduce((s, l) => s + (l.montant_depense_eur ?? 0), 0)),
        lignes,
      }
    })
  }

  // Contacts : un par email ; nom = celui de la commande la plus récente qui en a un
  const parEmail = new Map<string, { nom: string | null; premiere: string | null }>()
  for (const c of commandes) {
    const ex = parEmail.get(c.acheteur_email)
    if (!ex) parEmail.set(c.acheteur_email, { nom: c.acheteur_nom, premiere: c.date_vente })
    else {
      if (!ex.nom && c.acheteur_nom) ex.nom = c.acheteur_nom
      if (c.date_vente && (!ex.premiere || c.date_vente < ex.premiere)) ex.premiere = c.date_vente
    }
  }
  const emails = [...parEmail.keys()]
  const existants = await emailsDejaContacts(admin, beatmakerId, emails)
  const contacts: ContactPayload[] = emails.map(email => {
    const v = parEmail.get(email)!
    return { email, ...decouperNom(v.nom, email), premiere_date: v.premiere }
  })

  const toutes = [...lecture.commandes].sort((a, b) => a.dateVente.getTime() - b.dateVente.getTime())

  const apercu: Apercu = {
    plateforme,
    plateformeLibelle: libellePlateforme(plateforme),
    nomFichier,
    nomVendeur: lecture.nomVendeur,
    devise,
    periodeDebut: toutes[0]?.dateVente.toISOString() ?? null,
    periodeFin: toutes.at(-1)?.dateVente.toISOString() ?? null,
    nbCommandesFichier: lecture.commandes.length,
    nbDejaImportees: lecture.commandes.length - nouvelles.length,
    nbNouvelles: commandes.length,
    nbBeats: commandes.reduce((s, c) => s + c.lignes.length, 0),
    nbAcheteurs: emails.length,
    nbAcheteursNouveaux: emails.length - existants.size,
    nbAcheteursExistants: existants.size,
    totalDepense: r2(commandes.reduce((s, c) => s + (c.total_depense ?? 0), 0)),
    totalDepenseEur: r2(commandes.reduce((s, c) => s + (c.total_depense_eur ?? 0), 0)),
    echantillon: choisirEchantillon(commandes),
    rejets: lecture.rejets,
    enTetes: lecture.enTetes,
    nbCommandesRejetees: lecture.nbCommandesRejetees,
    format: 'beatstars',
    nbLignesEcartees: 0,
    nbCommandesEcartees: 0,
    nbLignesSansArticle: 0,
    nbMontantsInconnus: 0,
    avertissements: [],
  }

  return {
    apercu,
    importMeta: {
      plateforme,
      nom_fichier: nomFichier,
      nom_vendeur: lecture.nomVendeur,
      devise,
      periode_debut: commandes.at(-1)?.date_vente ?? null,
      periode_fin: commandes[0]?.date_vente ?? null,
      nb_rejetees: lecture.rejets.length,
    },
    contacts,
    commandes,
  }
}
