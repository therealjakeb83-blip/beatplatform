// Changement de slug d'une boutique (rang 9c bis, lot 3). Seul chemin pour
// changer un slug : choix unique du beatmaker (adminId null) ou changement par
// l'admin. L'ancien slug part dans `anciens_slugs` (renvoi pour toujours,
// réservé), tout se passe dans la fonction SQL changer_slug_boutique.
import { createAdminClient } from '@/utils/supabase/admin'
import { messageRefusSlug, nettoyerSlug, refusSlug } from '@/lib/slug-regles'
import { stripe } from '@/lib/stripe'
import { adresseDeLaBoutique } from '@/lib/adresse-boutique'

export const MESSAGE_SLUG_PRIS = 'Cette adresse est déjà prise.'
export const MESSAGE_SLUG_FIGE = 'Ton adresse est déjà choisie. Une erreur ? Contacte le support.'

export type DisponibiliteSlug = { slug: string; disponible: boolean; refus?: string }

// Un ancien nom d'une autre boutique compte comme pris (sans le dire).
export async function disponibiliteSlug(brut: string, beatmakerId: string): Promise<DisponibiliteSlug> {
  const slug = nettoyerSlug(brut)
  const refus = refusSlug(slug)
  if (refus) return { slug, disponible: false, refus: messageRefusSlug(refus) }

  const admin = createAdminClient()
  const { data: actuel } = await admin.from('beatmakers').select('slug').eq('id', beatmakerId).maybeSingle()
  if (actuel?.slug === slug) return { slug, disponible: false, refus: "C'est déjà l'adresse actuelle." }
  const [pris, ancien] = await Promise.all([
    admin.from('beatmakers').select('id').eq('slug', slug).neq('id', beatmakerId).limit(1),
    admin.from('anciens_slugs').select('id').eq('slug', slug).is('libere_le', null).neq('beatmaker_id', beatmakerId).limit(1),
  ])
  if (pris.error || ancien.error) throw pris.error ?? ancien.error
  return { slug, disponible: !pris.data?.length && !ancien.data?.length }
}

export type ResultatChangementSlug = { ok: true; slug: string; ancien: string } | { ok: false; erreur: string }

function messageErreurSql(message: string, code?: string): string {
  if (message.includes('SLUG_FIGE')) return MESSAGE_SLUG_FIGE
  if (message.includes('SLUG_IDENTIQUE')) return "C'est déjà l'adresse actuelle."
  if (message.includes('BOUTIQUE_INTROUVABLE')) return 'Boutique introuvable.'
  if (message.includes('SLUG_PRIS') || message.includes('SLUG_ANCIEN_NOM') || code === '23505') return MESSAGE_SLUG_PRIS
  return "Impossible de changer l'adresse pour le moment. Réessaie."
}

export async function changerSlugBoutique(beatmakerId: string, brut: string, adminId: string | null): Promise<ResultatChangementSlug> {
  const slug = nettoyerSlug(brut)
  const refus = refusSlug(slug)
  if (refus) return { ok: false, erreur: messageRefusSlug(refus) }

  const { data, error } = await createAdminClient().rpc('changer_slug_boutique', {
    p_beatmaker_id: beatmakerId,
    p_nouveau: slug,
    p_admin: adminId,
  })
  if (error) {
    console.error('[slug] Changement refusé', beatmakerId, slug, error.message)
    return { ok: false, erreur: messageErreurSql(error.message, error.code) }
  }
  console.log('[slug] Boutique', beatmakerId, ':', data, '→', slug, adminId ? '(admin)' : '(choix du beatmaker)')
  await mettreAJourAdresseStripe(beatmakerId, slug)
  return { ok: true, slug, ancien: data as string }
}

// L'adresse de la boutique connue de Stripe (donnée à la création du compte
// vendeur) suit le nouveau slug. Jamais bloquant : l'ancienne adresse renvoie
// de toute façon vers la nouvelle.
async function mettreAJourAdresseStripe(beatmakerId: string, slug: string): Promise<void> {
  try {
    const { data } = await createAdminClient().from('beatmakers').select('stripe_account_id').eq('id', beatmakerId).maybeSingle()
    const compte = data?.stripe_account_id as string | null | undefined
    if (!compte) return
    const { accueil } = await adresseDeLaBoutique(beatmakerId, slug)
    await stripe.accounts.update(compte, { business_profile: { url: accueil } })
    console.log('[slug] Adresse Stripe mise à jour', compte, accueil)
  } catch (err) {
    console.warn('[slug] Adresse Stripe non mise à jour', beatmakerId, err instanceof Error ? err.message : err)
  }
}
