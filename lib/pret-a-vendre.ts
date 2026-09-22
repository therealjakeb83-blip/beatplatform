import { stripe } from '@/lib/stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

// Checklist unique « prêt à vendre » (Phase 12 lot 2, Q7/Q7b) — vérifiée
// côté serveur à tous les points d'entrée de vente (voir express-checkout).
// A (concédant/maître de la vente) a 3 critères en plus de B (simple
// collaborateur) : mandat de livraison + CGV + mentions légales publiées.
// Le « nom sur la facture » (5e info fiscale de Q7) n'apparaît pas ici : il
// se résout toujours via raison_sociale || nom_artiste (lib/facture.ts),
// et nom_artiste est obligatoire dès l'inscription — jamais bloquant.
// Le numéro d'entreprise reste facultatif (Q7) — jamais un critère.

export type CleCriterePretAVendre =
  | 'stripe'
  | 'libelle_releve'
  | 'mandat_facturation'
  | 'statut_tva'
  | 'adresse'
  | 'mandat_livraison'
  | 'cgv'
  | 'mentions_legales'

export type CriterePretAVendre = {
  cle: CleCriterePretAVendre
  libelle: string
  ok: boolean
  lienReglage: string
}

export type ResultatPretAVendre = {
  pret: boolean
  criteres: CriterePretAVendre[]
}

type BeatmakerPourReadiness = {
  stripe_account_id: string | null
  stripe_compte_operationnel: boolean | null
  statement_descriptor: string | null
  mandat_facturation_accepte_at: string | null
  tva_decision_prise_le: string | null
  tva_active: boolean | null
  tva_numero: string | null
  adresse: string | null
  ville: string | null
  code_postal: string | null
  fulfillment_mandat_accepte_at: string | null
  fulfillment_mandat_revoque_at: string | null
}

// Fonction pure (testable sans Supabase ni Stripe) — la checklist affichée
// dans le dashboard et la vérification au checkout partagent exactement le
// même calcul, jamais deux logiques qui pourraient diverger.
export function evaluerPretAVendre(
  beatmaker: BeatmakerPourReadiness,
  options: { estConcedant: boolean; cgvPubliees: boolean; mentionsLegalesPubliees: boolean }
): ResultatPretAVendre {
  const statutTvaOk = !!beatmaker.tva_decision_prise_le
    && (!beatmaker.tva_active || !!beatmaker.tva_numero?.trim())

  const criteres: CriterePretAVendre[] = [
    {
      cle: 'stripe',
      libelle: 'Compte Stripe opérationnel',
      ok: !!beatmaker.stripe_compte_operationnel,
      lienReglage: '/dashboard/paiements',
    },
    {
      cle: 'libelle_releve',
      libelle: 'Identité sur le relevé bancaire',
      ok: !!beatmaker.statement_descriptor?.trim(),
      lienReglage: '/dashboard/paiements',
    },
    {
      cle: 'mandat_facturation',
      libelle: 'Mandat de facturation accepté',
      ok: !!beatmaker.mandat_facturation_accepte_at,
      lienReglage: '/dashboard/business/facturation',
    },
    {
      cle: 'statut_tva',
      libelle: 'Statut de TVA choisi',
      ok: statutTvaOk,
      lienReglage: '/dashboard/business/facturation',
    },
    {
      cle: 'adresse',
      libelle: 'Adresse complète',
      ok: !!(beatmaker.adresse?.trim() && beatmaker.ville?.trim() && beatmaker.code_postal?.trim()),
      lienReglage: '/dashboard/legal',
    },
  ]

  if (options.estConcedant) {
    criteres.push(
      {
        cle: 'mandat_livraison',
        libelle: 'Mandat de livraison automatique accepté',
        ok: !!beatmaker.fulfillment_mandat_accepte_at && !beatmaker.fulfillment_mandat_revoque_at,
        lienReglage: '/dashboard/paiements',
      },
      {
        cle: 'cgv',
        libelle: 'CGV publiées',
        ok: options.cgvPubliees,
        lienReglage: '/dashboard/legal',
      },
      {
        cle: 'mentions_legales',
        libelle: 'Mentions légales publiées',
        ok: options.mentionsLegalesPubliees,
        lienReglage: '/dashboard/legal',
      },
    )
  }

  return { pret: criteres.every(c => c.ok), criteres }
}

// Revérifie une fois auprès de Stripe si la colonne stockée vaut encore
// false — rattrape les comptes déjà connectés avant l'introduction de
// stripe_compte_operationnel, sans script de rattrapage à faire lancer par
// Jake. Ne fait JAMAIS d'appel Stripe si la colonne vaut déjà true (chemin
// rapide pour tous les checkouts suivants).
async function estCompteStripeOperationnel(
  admin: SupabaseClient,
  beatmakerId: string,
  stripeAccountId: string | null,
  flagStocke: boolean | null,
): Promise<boolean> {
  if (flagStocke) return true
  if (!stripeAccountId) return false

  try {
    const account = await stripe.accounts.retrieve(stripeAccountId)
    const operationnel = !!(account.charges_enabled && account.payouts_enabled)
    if (operationnel) {
      await admin.from('beatmakers').update({ stripe_compte_operationnel: true }).eq('id', beatmakerId)
    }
    return operationnel
  } catch (err) {
    console.error('[pret-a-vendre] Erreur vérification compte Stripe', stripeAccountId, ':', err instanceof Error ? err.message : err)
    return false
  }
}

// Calcule la checklist complète pour un beatmaker donné, avec la
// revérification Stripe et la lecture des pages légales publiées (utile
// seulement pour un concédant — jamais interrogé pour un simple B).
export async function calculerPretAVendre(
  admin: SupabaseClient,
  beatmakerId: string,
  options: { estConcedant: boolean },
): Promise<ResultatPretAVendre> {
  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('stripe_account_id, stripe_compte_operationnel, statement_descriptor, mandat_facturation_accepte_at, tva_decision_prise_le, tva_active, tva_numero, adresse, ville, code_postal, fulfillment_mandat_accepte_at, fulfillment_mandat_revoque_at')
    .eq('id', beatmakerId)
    .single()

  if (!beatmaker) {
    return { pret: false, criteres: [] }
  }

  const stripeOperationnel = await estCompteStripeOperationnel(
    admin,
    beatmakerId,
    beatmaker.stripe_account_id,
    beatmaker.stripe_compte_operationnel,
  )

  let cgvPubliees = true
  let mentionsLegalesPubliees = true
  if (options.estConcedant) {
    const { data: pages } = await admin
      .from('boutique_pages_legales')
      .select('type_page')
      .eq('beatmaker_id', beatmakerId)
      .in('type_page', ['cgv', 'mentions_legales'])
    const typesPublies = new Set((pages ?? []).map((p: { type_page: string }) => p.type_page))
    cgvPubliees = typesPublies.has('cgv')
    mentionsLegalesPubliees = typesPublies.has('mentions_legales')
  }

  return evaluerPretAVendre(
    { ...beatmaker, stripe_compte_operationnel: stripeOperationnel },
    { estConcedant: options.estConcedant, cgvPubliees, mentionsLegalesPubliees },
  )
}
