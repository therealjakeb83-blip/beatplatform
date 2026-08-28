import { createAdminClient } from '@/utils/supabase/admin'

export type StatutLivraison = 'en_cours' | 'livree' | 'probleme'

export type ProblemeLivraison =
  | { type: 'contrat_manquant'; commandeLigneId: string }
  | { type: 'transfert_echoue'; splitPaymentId: string; beatmakerId: string }

// Un split_payments.statut='en_attente' n'est PAS toujours un échec : un
// collab pas encore inscrit (beatmaker_id null, email_invite renseigné) est
// délibérément en attente jusqu'à son inscription ou le reversal J+60 (voir
// app/api/cron/splits-expiration/route.ts) — comportement normal, pas un
// problème à signaler. Seul un split resté 'en_attente' alors qu'un
// beatmaker_id était résolu (le transfert Stripe a été tenté et a échoué,
// voir lib/webhook-paiement.ts::distribuerSplitsArticle) est un vrai échec.
export async function calculerStatutLivraison(
  commandeId: string
): Promise<{ statut: StatutLivraison; problemes: ProblemeLivraison[] }> {
  const supabase = createAdminClient()

  const [{ data: lignes }, { data: splits }] = await Promise.all([
    supabase.from('commande_lignes').select('id, contrat_pdf_url').eq('commande_id', commandeId),
    supabase.from('split_payments').select('id, statut, beatmaker_id').eq('commande_id', commandeId),
  ])

  const problemes: ProblemeLivraison[] = []

  for (const ligne of lignes ?? []) {
    if (!ligne.contrat_pdf_url) {
      problemes.push({ type: 'contrat_manquant', commandeLigneId: ligne.id })
    }
  }

  for (const sp of splits ?? []) {
    if (sp.statut === 'en_attente' && sp.beatmaker_id) {
      problemes.push({ type: 'transfert_echoue', splitPaymentId: sp.id, beatmakerId: sp.beatmaker_id })
    }
  }

  return { statut: problemes.length > 0 ? 'probleme' : 'livree', problemes }
}
