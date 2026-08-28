import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { stripe } from '@/lib/stripe'

// Remboursement réel (Phase 3, refonte 9 bis) — scopé aux ventes solo Direct
// Charge uniquement (stripe_account_id renseigné). Deux autres cas existent
// en base mais sont volontairement hors périmètre ici, pas juste "pas encore
// codés par oubli" :
// - stripe_transfer_group renseigné (vente collab) : l'argent a déjà été
//   distribué en Transfers séparés à chaque collaborateur au moment de la
//   vente (voir distribuerSplitsArticle() dans lib/webhook-paiement.ts) — un
//   simple refund ne récupère rien chez eux. Mécanique de clawback gelée
//   jusqu'au choix du processeur collab (Phase 13, voir
//   project_grillme_9bis_synthese).
// - stripe_account_id vide sans collab (ancien destination charge, avant la
//   bascule du 2026-08-27) : aucune vraie commande de ce type ne peut être
//   générée à nouveau (bascule totale et immédiate) — pas codé plutôt que de
//   maintenir un chemin mort pour des données de test qui seront effacées au
//   lancement.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commandeId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = createAdminClient()

  const { data: commande } = await admin
    .from('commandes')
    .select('id, statut, beatmaker_id, prix_paye, stripe_payment_id, stripe_account_id, stripe_transfer_group')
    .eq('id', commandeId)
    .eq('beatmaker_id', user.id)
    .single()

  if (!commande) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
  if (commande.statut !== 'payee') {
    return NextResponse.json({ error: 'Seules les commandes payées peuvent être remboursées' }, { status: 400 })
  }

  if (commande.stripe_transfer_group) {
    return NextResponse.json({
      error: 'Remboursement des ventes avec collaborateur(s) pas encore automatisé — à traiter manuellement pour le moment.',
    }, { status: 400 })
  }

  if (!commande.stripe_account_id || !commande.stripe_payment_id) {
    return NextResponse.json({
      error: 'Cette commande est hors périmètre du remboursement automatique (vente antérieure au passage en Direct Charge).',
    }, { status: 400 })
  }

  try {
    await stripe.refunds.create(
      { payment_intent: commande.stripe_payment_id },
      { stripeAccount: commande.stripe_account_id }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur Stripe inconnue'
    console.error('[rembourser] Erreur stripe.refunds.create:', message)
    return NextResponse.json({ error: `Erreur Stripe : ${message}` }, { status: 500 })
  }

  const { error } = await admin
    .from('commandes')
    .update({ statut: 'remboursee', montant_rembourse: commande.prix_paye })
    .eq('id', commandeId)
    .eq('beatmaker_id', user.id)

  if (error) return NextResponse.json({ error: 'Remboursement Stripe effectué mais erreur de mise à jour du statut — vérifier manuellement' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
