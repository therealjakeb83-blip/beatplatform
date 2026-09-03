import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { stripe } from '@/lib/stripe'
import { genererContratPdfPourVente } from '@/lib/contrat'
import { uploadPdfContrat } from '@/lib/livraison'
import { calculerStatutLivraison } from '@/lib/livraison-statut'

export const runtime = 'nodejs'

// Reprise encadrée (Phase 5, refonte 9 bis) — ne rejoue QUE ce qui a
// réellement échoué (contrat PDF manquant, transfert Stripe resté en
// attente alors qu'un compte était résolu), jamais toute la commande
// depuis zéro. Idempotent : appelable plusieurs fois sans effet de bord,
// une opération déjà réussie n'est jamais retentée. Jamais une nouvelle
// décision commerciale — mêmes données déjà figées à l'achat (Phase 4),
// juste rejouer une opération technique qui a échoué.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commandeId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const admin = createAdminClient()

  const { data: commande } = await admin
    .from('commandes')
    .select('id, created_at, acheteur_nom, acheteur_email, acheteur_adresse, stripe_transfer_group, beatmaker_id, beatmakers(nom_artiste)')
    .eq('id', commandeId)
    .eq('beatmaker_id', user.id)
    .single()

  if (!commande) return NextResponse.json({ erreur: 'Commande introuvable' }, { status: 404 })

  const beatmaker = commande.beatmakers as unknown as { nom_artiste: string } | null

  let contratsRegeneres = 0
  let transfertsReussis = 0
  const echecs: string[] = []

  // ── Contrats PDF manquants ──────────────────────────────────
  const { data: lignesManquantes } = await admin
    .from('commande_lignes')
    .select('id, beat_id, licence_id, licence_nom, splits_snapshot, prix_paye, beats(titre)')
    .eq('commande_id', commandeId)
    .is('contrat_pdf_url', null)

  for (const ligne of (lignesManquantes ?? []) as unknown as {
    id: string
    beat_id: string | null
    licence_id: string | null
    licence_nom: string | null
    splits_snapshot: { nom_artiste: string; pourcentage: number }[] | null
    prix_paye: number
    beats: { titre: string } | null
  }[]) {
    if (!ligne.beat_id || !ligne.licence_id) {
      echecs.push(`Contrat impossible à générer pour la ligne ${ligne.id} (données manquantes)`)
      continue
    }
    try {
      const pdfBytes = await genererContratPdfPourVente(admin, {
        beatId: ligne.beat_id,
        licenceId: ligne.licence_id,
        beatmakerId: commande.beatmaker_id,
        acheteurNom: commande.acheteur_nom,
        acheteurEmail: commande.acheteur_email,
        acheteurAdresse: commande.acheteur_adresse,
        prixPaye: Number(ligne.prix_paye),
        splits: ligne.splits_snapshot ?? [{ nom_artiste: beatmaker?.nom_artiste ?? 'Beatmaker', pourcentage: 100 }],
        dateVente: new Date(commande.created_at),
      })
      const pdfUrl = await uploadPdfContrat(ligne.id, pdfBytes)
      await admin.from('commande_lignes').update({ contrat_pdf_url: pdfUrl }).eq('id', ligne.id)
      contratsRegeneres++
    } catch (err) {
      echecs.push(`Contrat PDF toujours en échec pour "${ligne.beats?.titre ?? ligne.id}" : ${err instanceof Error ? err.message : 'erreur inconnue'}`)
    }
  }

  // ── Transferts collab échoués (jamais les attentes légitimes — collab pas
  // encore inscrit, beatmaker_id null, voir lib/livraison-statut.ts) ──────
  if (commande.stripe_transfer_group) {
    const { data: splitsEnEchec } = await admin
      .from('split_payments')
      .select('id, montant, beat_split_id, beatmakers(stripe_account_id, nom_artiste), beat_splits(beats(titre))')
      .eq('commande_id', commandeId)
      .eq('statut', 'en_attente')
      .not('beatmaker_id', 'is', null)

    for (const sp of (splitsEnEchec ?? []) as unknown as {
      id: string
      montant: number
      beatmakers: { stripe_account_id: string | null; nom_artiste: string } | null
      beat_splits: { beats: { titre: string } | null } | null
    }[]) {
      const titreBeat = sp.beat_splits?.beats?.titre ?? 'Beat'
      if (!sp.beatmakers?.stripe_account_id) {
        echecs.push(`Transfert vers ${sp.beatmakers?.nom_artiste ?? 'un collaborateur'} toujours impossible (compte Stripe non connecté)`)
        continue
      }
      try {
        const transfer = await stripe.transfers.create({
          amount: sp.montant,
          currency: 'eur',
          destination: sp.beatmakers.stripe_account_id,
          transfer_group: commande.stripe_transfer_group,
          description: `Reprise livraison — ${titreBeat} — sp ${sp.id}`,
        })
        await admin.from('split_payments').update({ statut: 'transfere', stripe_transfer_id: transfer.id }).eq('id', sp.id)
        transfertsReussis++
      } catch (err) {
        echecs.push(`Transfert vers ${sp.beatmakers.nom_artiste} toujours en échec : ${err instanceof Error ? err.message : 'erreur inconnue'}`)
      }
    }
  }

  const { statut } = await calculerStatutLivraison(commandeId)
  await admin.from('commandes').update({
    statut_livraison: statut,
    fichiers_livres: statut === 'livree',
  }).eq('id', commandeId)

  return NextResponse.json({ statut, contratsRegeneres, transfertsReussis, echecs })
}
