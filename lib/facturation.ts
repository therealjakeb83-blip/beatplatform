import type { createAdminClient } from '@/utils/supabase/admin'
import { getZonedParts } from './fuseau-horaire'

// Mandat de facturation — My Producer génère la facture pour le compte du
// beatmaker en tant que mandataire technique, le beatmaker reste émetteur
// légal (voir memory/project_grillme_9bis_synthese.md, section Facturation).
// Versionné, même principe que lib/fulfillment.ts.

export const MANDAT_FACTURATION_VERSION_ACTUELLE = 1

export const MANDAT_FACTURATION_TEXTES: Record<number, string> = {
  1: `My Producer génère et te transmet automatiquement la facture correspondant à chaque vente, en ton nom et pour ton compte, en tant que mandataire technique.

Tu restes l'émetteur légal de cette facture — elle est établie en ton nom, avec tes informations légales, et My Producer n'apparaît jamais comme partie à la vente.

Ce mandat couvre la génération du document et l'attribution du numéro de facture, avec un format par défaut conforme aux exemples que l'administration fiscale autorise explicitement — que tu personnalises ce format ou que tu gardes celui par défaut, la conformité légale de la numérotation de tes factures (numéro unique, chronologique et continu) et de tes informations fiscales (identité légale, numéro de TVA le cas échéant) reste entièrement de ta responsabilité dans les deux cas, au même titre.

Ce mandat est nécessaire pour que My Producer puisse émettre une facture pour tes ventes — sans acceptation, aucune facture ne sera générée.`,
}

export function texteMandatFacturation(version: number): string {
  return MANDAT_FACTURATION_TEXTES[version] ?? MANDAT_FACTURATION_TEXTES[MANDAT_FACTURATION_VERSION_ACTUELLE]
}

// ============================================================
// Numérotation — voir memory/project_phase8_numerotation_facture.md pour
// tout le raisonnement (offset annuel, pas de chiffres aléatoires, ordre
// naturel par défaut, personnalisation avec responsabilité transférée).
// ============================================================

// Format par défaut : ordre naturel (compteur puis mois/année), aligné sur
// les exemples que BOFiP autorise explicitement pour les préfixes/suffixes
// de numérotation. Le compteur NUM inclut déjà l'offset annuel.
export const FORMAT_FACTURATION_PAR_DEFAUT = '{SLUG}-{NUM}{MM}{AA}'

export const VARIABLES_FACTURATION: { variable: string; description: string }[] = [
  { variable: '{SLUG}', description: 'Identifiant de ta boutique' },
  { variable: '{NUM}', description: 'Compteur séquentiel — doit obligatoirement figurer une seule fois, jamais dupliqué ni omis' },
  { variable: '{JJ}', description: "Jour d'émission (01-31)" },
  { variable: '{MM}', description: "Mois d'émission (01-12)" },
  { variable: '{AA}', description: "Année d'émission (2 chiffres)" },
]

export function formatFacturationValide(format: string): boolean {
  // NUM doit apparaître exactement une fois — c'est le seul élément dont la
  // continuité légale dépend, il ne peut ni manquer ni être dupliqué.
  const occurrencesNum = (format.match(/\{NUM\}/g) ?? []).length
  if (occurrencesNum !== 1) return false
  // Seules les variables connues sont autorisées, rien d'autre entre elles
  // ({SLUG}/{JJ}/{MM}/{AA} optionnelles et chacune au plus une fois).
  const sansVariables = format.replace(/\{SLUG\}|\{NUM\}|\{JJ\}|\{MM\}|\{AA\}/g, '')
  if (sansVariables.replace(/-/g, '').length > 0) return false
  for (const v of ['{SLUG}', '{JJ}', '{MM}', '{AA}']) {
    const occ = (format.match(new RegExp(v.replace(/[{}]/g, '\\$&'), 'g')) ?? []).length
    if (occ > 1) return false
  }
  return true
}

export function formaterNumeroFacture(format: string, params: { slug: string; num: number; jour: number; mois: number; annee: number }): string {
  const jj = String(params.jour).padStart(2, '0')
  const mm = String(params.mois).padStart(2, '0')
  const aa = String(params.annee).slice(-2)
  return format
    .replace(/\{SLUG\}/g, params.slug)
    .replace(/\{NUM\}/g, String(params.num))
    .replace(/\{JJ\}/g, jj)
    .replace(/\{MM\}/g, mm)
    .replace(/\{AA\}/g, aa)
}

// Point d'entrée : appelle la fonction Postgres atomique (jamais de calcul
// côté JS — voir supabase/phase8_facturation.sql) puis applique le format
// du beatmaker (personnalisé ou par défaut). L'année civile qui détermine
// la série de numérotation (nouvel offset annuel) est calculée dans le
// fuseau horaire propre du beatmaker (project_fuseau_horaire_par_beatmaker),
// pas le fuseau du serveur — une vente à 23h50 le 31 décembre chez un
// beatmaker ne doit pas basculer sur l'année suivante à tort.
export async function genererNumeroFacture(
  admin: ReturnType<typeof createAdminClient>,
  params: { beatmakerId: string; slug: string; format: string | null; dateVente: Date; fuseauHoraire: string }
): Promise<string> {
  const zoned = getZonedParts(params.dateVente, params.fuseauHoraire)
  const { data: num, error } = await admin.rpc('facturation_prochain_numero', {
    p_beatmaker_id: params.beatmakerId,
    p_annee: zoned.year,
  })
  if (error || num == null) {
    throw new Error(`Impossible d'attribuer un numéro de facture: ${error?.message}`)
  }
  const format = params.format && formatFacturationValide(params.format) ? params.format : FORMAT_FACTURATION_PAR_DEFAUT
  return formaterNumeroFacture(format, { slug: params.slug, num, jour: zoned.day, mois: zoned.month, annee: zoned.year })
}
