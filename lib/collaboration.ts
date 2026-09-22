import type { SupabaseClient } from '@supabase/supabase-js'
import { journaliserDecision } from '@/lib/decisions-log'
import { plancherPrixCents, prixAutorise, type Participant } from '@/lib/collaboration-parts'

// Modèle de collaboration (Phase 12). Les états vivent dans beat_splits.statut ;
// la quote-part de A (beats.quote_part_proprietaire) et le drapeau
// beats.hors_vente_collab sont recalculés par la base à chaque changement.

export type StatutCollaboration = 'invitee' | 'active' | 'refusee' | 'retiree' | 'quittee' | 'evincee'

// États « non terminés » : la collaboration compte encore dans la répartition
// et le beat reste hors vente (invitée, active — tant que les ventes collab ne
// sont pas ouvertes —, refusée tant que A n'a pas retiré l'invitation).
export const STATUTS_OUVERTS: StatutCollaboration[] = ['invitee', 'active', 'refusee']

export const LIBELLES_STATUT_COLLAB: Record<StatutCollaboration, string> = {
  invitee: 'Invitée',
  active: 'Active',
  refusee: 'Refusée',
  retiree: 'Invitation retirée',
  quittee: 'Quittée',
  evincee: 'Évincée',
}

export function estCollaborationOuverte(statut: string): boolean {
  return (STATUTS_OUVERTS as string[]).includes(statut)
}

// Qui peut faire passer une collaboration d'un état à un autre.
export const TRANSITIONS_COLLAB: Record<string, { de: StatutCollaboration[]; vers: StatutCollaboration; par: 'B' | 'A' }> = {
  accepter: { de: ['invitee'], vers: 'active', par: 'B' },
  refuser: { de: ['invitee'], vers: 'refusee', par: 'B' },
  retirer: { de: ['invitee', 'refusee'], vers: 'retiree', par: 'A' },
  quitter: { de: ['active'], vers: 'quittee', par: 'B' },
  evincer: { de: ['active'], vers: 'evincee', par: 'A' },
}

export type ActionCollaboration = 'invitation' | 'acceptation' | 'refus' | 'retrait_invitation' | 'depart' | 'eviction'

/**
 * Journalise un événement de collaboration (jamais bloquant, voir
 * lib/decisions-log.ts). Écrit une ligne pour le propriétaire du beat ; si
 * l'acteur est le collaborateur, une deuxième ligne est écrite pour lui afin
 * qu'il retrouve la preuve de ce qu'il a accepté dans son propre journal.
 */
export async function journaliserCollaboration(p: {
  action: ActionCollaboration
  collaborationId: string
  proprietaireId: string
  acteurId: string
  collaborateurId?: string | null
  motif?: string | null
  conditionsVersion?: number | null
  details: Record<string, unknown>
}): Promise<void> {
  const base = {
    actorType: 'beatmaker' as const,
    actorId: p.acteurId,
    entityType: 'collaboration' as const,
    entityId: p.collaborationId,
    action: p.action,
    motif: p.motif ?? null,
    referenceVersion: p.conditionsVersion != null ? String(p.conditionsVersion) : null,
    details: p.details,
  }
  await journaliserDecision({ ...base, beatmakerId: p.proprietaireId })
  if (p.collaborateurId && p.collaborateurId !== p.proprietaireId) {
    await journaliserDecision({ ...base, beatmakerId: p.collaborateurId })
  }
}

function formaterEuros(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €'
}

type LicenceCourte = { id: string; nom: string; modele: string; prix: number }

/**
 * Prix plancher d'un beat : aucune licence achetable de ce beat ne peut coûter
 * moins que ce plancher (sauf 0 € = beat offert). Les prix de licence sont
 * globaux au beatmaker par défaut, mais un beat peut avoir un prix spécifique
 * par licence (`beat_licences.prix_override`, `licenceOverrides` ici) — c'est
 * ce prix réellement appliqué qui est vérifié, pas le prix général.
 */
export async function verifierPlancherLicences(
  admin: SupabaseClient,
  params: {
    beatmakerId: string
    participants: Participant[]
    licencesActivesIds: string[]
    licenceOverrides?: Record<string, number | string | null | undefined>
    exclusifSurDemande?: boolean
  },
): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const plancher = plancherPrixCents(params.participants)
  if (plancher === 0 || params.licencesActivesIds.length === 0) return { ok: true }

  const { data } = await admin
    .from('licences')
    .select('id, nom, modele, prix')
    .eq('beatmaker_id', params.beatmakerId)
    .in('id', params.licencesActivesIds)

  for (const l of (data ?? []) as LicenceCourte[]) {
    if (l.modele === 'exclusive' && params.exclusifSurDemande) continue
    const override = params.licenceOverrides?.[l.id]
    const prixEuros = override != null && override !== '' ? parseInt(String(override)) : l.prix
    const cents = Math.round(prixEuros * 100)
    if (!prixAutorise(cents, plancher)) {
      return {
        ok: false,
        erreur: `La licence « ${l.nom} » est à ${formaterEuros(cents)} : avec cette répartition, le prix minimum de ce beat est ${formaterEuros(plancher)}. Augmente le prix de cette licence (ou le prix spécifique à ce beat) ou change la répartition.`,
      }
    }
  }
  return { ok: true }
}

/** Participants (A en premier) d'un beat à partir de ses collaborations non terminées. */
export function participantsDepuisParts(partsCollaborateurs: number[]): Participant[] {
  const somme = partsCollaborateurs.reduce((s, p) => s + p, 0)
  return [
    { id: 'proprietaire', pourcentage: 100 - somme },
    ...partsCollaborateurs.map((pourcentage, i) => ({ id: `collab-${i}`, pourcentage })),
  ]
}

/**
 * Avant de BAISSER le prix général d'une licence : vérifie qu'aucun beat en
 * collaboration (non terminée) ayant cette licence active ne passerait sous
 * son prix plancher. Retourne les titres des beats bloquants.
 *
 * `beatIdsAVerifier` restreint la vérification à cette liste précise (utilisé
 * par le changement de prix "certains beats"/"futurs beats seulement" —
 * app/api/licences/[id]/modifier — où seule une partie des beats reçoit
 * réellement le nouveau prix). Sans ce paramètre, tous les beats utilisant la
 * licence sont vérifiés. Par défaut, un prix spécifique reste prioritaire ;
 * `inclurePrixSpecifiques` permet au mode "tous les beats" de les contrôler
 * aussi, puisqu'il va supprimer leurs overrides.
 */
export async function beatsBloquantsBaissePrixLicence(
  admin: SupabaseClient,
  params: {
    beatmakerId: string
    licenceId: string
    nouveauPrixEuros: number
    beatIdsAVerifier?: string[]
    inclurePrixSpecifiques?: boolean
  },
): Promise<{ id: string; titre: string; plancherCents: number }[]> {
  if (params.beatIdsAVerifier && params.beatIdsAVerifier.length === 0) return []
  const nouveauCents = Math.round(params.nouveauPrixEuros * 100)

  let requeteBeats = admin
    .from('beats')
    .select('id, titre')
    .eq('beatmaker_id', params.beatmakerId)
    .eq('hors_vente_collab', true)
    .is('supprime_le', null)
  if (params.beatIdsAVerifier) requeteBeats = requeteBeats.in('id', params.beatIdsAVerifier)
  const { data: beats } = await requeteBeats
  const beatIds = (beats ?? []).map(b => b.id as string)
  if (beatIds.length === 0) return []

  const [{ data: parts }, { data: liens }] = await Promise.all([
    admin.from('beat_splits').select('beat_id, pourcentage').in('beat_id', beatIds).in('statut', STATUTS_OUVERTS),
    admin.from('beat_licences').select('beat_id, actif, sur_demande, prix_override').eq('licence_id', params.licenceId).in('beat_id', beatIds),
  ])

  const partsParBeat = new Map<string, number[]>()
  for (const p of (parts ?? []) as { beat_id: string; pourcentage: number }[]) {
    partsParBeat.set(p.beat_id, [...(partsParBeat.get(p.beat_id) ?? []), p.pourcentage])
  }

  const bloquants: { id: string; titre: string; plancherCents: number }[] = []
  for (const lien of (liens ?? []) as { beat_id: string; actif: boolean; sur_demande: boolean; prix_override: number | null }[]) {
    if (!lien.actif || lien.sur_demande) continue
    // Un prix propre à ce beat prime sur le prix général : la baisse ne le touche pas.
    if (lien.prix_override != null && !params.inclurePrixSpecifiques) continue
    const plancher = plancherPrixCents(participantsDepuisParts(partsParBeat.get(lien.beat_id) ?? []))
    if (!prixAutorise(nouveauCents, plancher)) {
      const titre = (beats ?? []).find(b => b.id === lien.beat_id)?.titre as string | undefined
      bloquants.push({ id: lien.beat_id, titre: titre ?? 'Beat', plancherCents: plancher })
    }
  }
  return bloquants
}

export { formaterEuros as formaterEurosCollab }
