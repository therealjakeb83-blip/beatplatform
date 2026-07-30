import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { envoyerRappelFonds, envoyerConfirmationExpiration } from '@/lib/emails'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sécurisation : Vercel injecte CRON_SECRET dans l'Authorization header
function estAutorise(request: Request): boolean {
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(request: Request) {
  if (!estAutorise(request)) {
    return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = Date.now()
  const JOUR = 24 * 60 * 60 * 1000

  let reversals = 0
  let rappels50 = 0
  let rappels30 = 0

  // ── J+60 : Reversal ─────────────────────────────────────────
  // Splits de collabs non inscrits, créés il y a 60+ jours
  // `commandes` n'a plus de relation directe vers `beats` depuis le passage
  // au panier multi-articles (Phase 2c) — le titre passe désormais par
  // beat_split_id → beat_splits → beats. Bug trouvé en testant F4 (audit
  // 2026-07-29) : cassait silencieusement les 3 requêtes de ce cron (relation
  // inexistante → erreur jamais vérifiée → traité comme "rien à traiter") —
  // plus aucun reversal J+60 ni rappel J+30/J+50 ne partait depuis le 2026-07-09.
  const { data: expires, error: errExpires } = await supabase
    .from('split_payments')
    .select(`
      id, montant, email_invite,
      commandes(
        beatmaker_id, stripe_transfer_group,
        beatmakers(stripe_account_id, nom_artiste, email)
      ),
      beat_splits(beats(titre))
    `)
    .eq('statut', 'en_attente')
    .not('email_invite', 'is', null)
    .lte('created_at', new Date(now - 60 * JOUR).toISOString())
  if (errExpires) console.error('[cron] Erreur lecture splits J+60:', errExpires.message)

  type ExpireSplit = {
    id: string
    montant: number
    email_invite: string
    commandes: {
      beatmaker_id: string
      stripe_transfer_group: string | null
      beatmakers: { stripe_account_id: string | null; nom_artiste: string; email: string } | null
    } | null
    beat_splits: { beats: { titre: string } | null } | null
  }

  for (const sp of (expires ?? []) as unknown as ExpireSplit[]) {
    const commande = sp.commandes
    if (!commande) continue

    const proprietaire = commande.beatmakers
    const titreBeat = sp.beat_splits?.beats?.titre ?? 'Beat'
    const transferGroup = commande.stripe_transfer_group
    const montantEuros = (sp.montant / 100).toFixed(2)

    // Marquer comme expiré
    await supabase.from('split_payments').update({ statut: 'expire' }).eq('id', sp.id)

    // Reversal → Transfer vers le beatmaker propriétaire
    if (proprietaire?.stripe_account_id && transferGroup && sp.montant > 0) {
      try {
        await stripe.transfers.create({
          amount: sp.montant,
          currency: 'eur',
          destination: proprietaire.stripe_account_id,
          transfer_group: transferGroup,
          description: `Reversal J+60 — ${titreBeat} — sp ${sp.id}`,
        })
        console.log('[cron] Reversal effectué pour sp', sp.id, '→', proprietaire.nom_artiste)
      } catch (err) {
        console.error('[cron] Erreur reversal sp', sp.id, ':', err)
      }
    }

    // Email de clôture au collab non inscrit
    await envoyerConfirmationExpiration({
      to: sp.email_invite,
      titreBeat,
      montantEuros,
      beatmakerId: commande.beatmaker_id,
    })

    reversals++
  }

  // ── J+50 : Avertissement final ───────────────────────────────
  const { data: splits50, error: err50 } = await supabase
    .from('split_payments')
    .select('id, montant, email_invite, commandes(beatmaker_id), beat_splits(beats(titre))')
    .eq('statut', 'en_attente')
    .not('email_invite', 'is', null)
    .lte('created_at', new Date(now - 50 * JOUR).toISOString())
    .gte('created_at', new Date(now - 51 * JOUR).toISOString())
  if (err50) console.error('[cron] Erreur lecture splits J+50:', err50.message)

  type RappelSplit = {
    id: string
    montant: number
    email_invite: string
    commandes: { beatmaker_id: string } | null
    beat_splits: { beats: { titre: string } | null } | null
  }

  for (const sp of (splits50 ?? []) as unknown as RappelSplit[]) {
    const titreBeat = sp.beat_splits?.beats?.titre ?? 'Beat'
    if (!sp.commandes) continue
    await envoyerRappelFonds({
      to: sp.email_invite,
      titreBeat,
      montantEuros: (sp.montant / 100).toFixed(2),
      joursRestants: 10,
      beatmakerId: sp.commandes.beatmaker_id,
    })
    rappels50++
  }

  // ── J+30 : Premier rappel ────────────────────────────────────
  const { data: splits30, error: err30 } = await supabase
    .from('split_payments')
    .select('id, montant, email_invite, commandes(beatmaker_id), beat_splits(beats(titre))')
    .eq('statut', 'en_attente')
    .not('email_invite', 'is', null)
    .lte('created_at', new Date(now - 30 * JOUR).toISOString())
    .gte('created_at', new Date(now - 31 * JOUR).toISOString())
  if (err30) console.error('[cron] Erreur lecture splits J+30:', err30.message)

  for (const sp of (splits30 ?? []) as unknown as RappelSplit[]) {
    const titreBeat = sp.beat_splits?.beats?.titre ?? 'Beat'
    if (!sp.commandes) continue
    await envoyerRappelFonds({
      to: sp.email_invite,
      titreBeat,
      montantEuros: (sp.montant / 100).toFixed(2),
      joursRestants: 30,
      beatmakerId: sp.commandes.beatmaker_id,
    })
    rappels30++
  }

  console.log(`[cron] splits-expiration — reversals: ${reversals}, rappels50: ${rappels50}, rappels30: ${rappels30}`)
  return NextResponse.json({ reversals, rappels50, rappels30 })
}
