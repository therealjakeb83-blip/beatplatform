// Rang 9c, lot 5 : une seule règle pour dire si une boutique existe
// publiquement (boutique, page de paiement, domaine personnalisé, routes de
// paiement). Sans abonnement depuis son arrêt DÉFINITIF, le domaine est gardé
// 30 jours ; jamais de compte à rebours pendant un impayé ou une suspension.

import type { SupabaseClient } from '@supabase/supabase-js'
import { estRoleAdmin } from '@/lib/admin'

export const JOURS_DOMAINE_SANS_ABONNEMENT = 30

export type BeatmakerVisibilite = {
  role: string | null
  abonnement_exempte: boolean | null
  statut: string | null
}

export type AbonnementPlateformeResume = {
  statut: string
  date_annulation: string | null
  date_fin: string | null
}

export type EtatBoutique =
  | { visible: true }
  | {
      visible: false
      // suspendue : par l'admin ; impaye : Stripe réessaie encore ;
      // arrete : abonnement terminé (ou jamais pris), compte à rebours.
      raison: 'suspendue' | 'impaye' | 'arrete'
      finLe: string | null
      limiteLe: string | null
    }

const JOUR_MS = 24 * 60 * 60 * 1000

export function etatBoutique(
  beatmaker: BeatmakerVisibilite,
  abonnements: AbonnementPlateformeResume[],
): EtatBoutique {
  if (beatmaker.statut === 'suspendu') return { visible: false, raison: 'suspendue', finLe: null, limiteLe: null }
  if (estRoleAdmin(beatmaker.role) || beatmaker.abonnement_exempte) return { visible: true }
  if (abonnements.some(a => a.statut === 'actif' || a.statut === 'en_essai')) return { visible: true }
  if (abonnements.some(a => a.statut === 'impaye' || a.statut === 'suspendu')) {
    return { visible: false, raison: 'impaye', finLe: null, limiteLe: null }
  }
  const fins = abonnements
    .map(a => a.date_annulation ?? a.date_fin)
    .filter((d): d is string => !!d)
    .map(d => new Date(d).getTime())
    .filter(t => Number.isFinite(t))
  const fin = fins.length ? Math.max(...fins) : null
  return {
    visible: false,
    raison: 'arrete',
    finLe: fin === null ? null : new Date(fin).toISOString(),
    limiteLe: fin === null ? null : new Date(fin + JOURS_DOMAINE_SANS_ABONNEMENT * JOUR_MS).toISOString(),
  }
}

export async function chargerEtatBoutique(admin: SupabaseClient, beatmakerId: string): Promise<EtatBoutique | null> {
  const [{ data: beatmaker }, { data: abonnements }] = await Promise.all([
    admin.from('beatmakers').select('role, abonnement_exempte, statut').eq('id', beatmakerId).maybeSingle(),
    admin.from('abonnements_plateforme').select('statut, date_annulation, date_fin').eq('beatmaker_id', beatmakerId),
  ])
  if (!beatmaker) return null
  return etatBoutique(beatmaker as BeatmakerVisibilite, (abonnements ?? []) as AbonnementPlateformeResume[])
}

export const MESSAGE_BOUTIQUE_INDISPONIBLE = 'Cette boutique est temporairement indisponible.'

export function dateLimiteFr(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
}

// Routes de paiement : la boutique du vendeur principal doit exister
// publiquement (un collaborateur, lui, n'a pas besoin d'une boutique visible).
export async function boutiqueOuverteALaVente(admin: SupabaseClient, beatmakerId: string): Promise<boolean> {
  return (await chargerEtatBoutique(admin, beatmakerId))?.visible === true
}

// Encadré du dashboard (page Domaine + accueil) quand la boutique d'un domaine
// est indisponible. null = rien à afficher.
export function avertissementDomaineIndisponible(etat: EtatBoutique | null, domaine: string): string | null {
  if (!etat || etat.visible) return null
  const affiche = `${domaine} affiche « ${MESSAGE_BOUTIQUE_INDISPONIBLE} »`
  if (etat.raison === 'impaye') {
    return `Le dernier paiement de ton abonnement a échoué : ${affiche}. Mets à jour ta carte et ta boutique y revient automatiquement.`
  }
  if (etat.raison === 'arrete' && etat.limiteLe) {
    return `Ton abonnement est arrêté : ${affiche}. Il reste réservé à ta boutique jusqu'au ${dateLimiteFr(etat.limiteLe)} : réabonne-toi avant et ta boutique y revient automatiquement. Ensuite, il sera retiré de ton compte.`
  }
  if (etat.raison === 'arrete') return `Ton abonnement n'est pas actif : ${affiche}. Réabonne-toi et ta boutique y revient automatiquement.`
  return null
}
