import { createAdminClient } from '@/utils/supabase/admin'
import { normaliserEmail } from '@/lib/email'
import { poserCookieAcces, UUID } from '@/lib/telechargement-acces'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Vérification par email (Phase 11, 9 bis ; rang 9f, Lot 1) — emails
// acceptés : ceux de l'acheteur (commande ou compte lié), ou celui d'un
// vendeur de la commande (accès support, demandé par Jake). Le cookie signé
// dit qui a confirmé : un vendeur n'est jamais enregistré au journal.
// 5 essais ratés par commande → bloqué 1 h (décision 3 bis). Même réponse
// que la commande existe ou non.
const REFUS = 'Cet email ne correspond pas à cette commande.'
const TROP = 'Trop d\'essais, réessaie dans une heure.'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ commandeId: string }> }
) {
  const { commandeId } = await params
  const body = await request.json().catch(() => null) as { email?: string } | null
  const emailSaisi = normaliserEmail(body?.email)

  if (!emailSaisi) {
    return NextResponse.json({ ok: false, erreur: 'Email requis.' }, { status: 400 })
  }
  if (!UUID.test(commandeId)) {
    return NextResponse.json({ ok: false, erreur: REFUS }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: blocage } = await admin
    .from('essais_acces_commande')
    .select('bloque_jusqu')
    .eq('commande_id', commandeId)
    .maybeSingle()
  if (blocage?.bloque_jusqu && new Date(blocage.bloque_jusqu) > new Date()) {
    return NextResponse.json({ ok: false, erreur: TROP }, { status: 429 })
  }

  const { data: commande } = await admin
    .from('commandes')
    .select('id, acheteur_email, beatmaker_id, client_id')
    .eq('id', commandeId)
    .maybeSingle()

  let qui: 'acheteur' | 'vendeur' | null = null
  if (commande) {
    const [{ data: tranches }, { data: client }] = await Promise.all([
      admin.from('commande_tranches').select('vendeur_id').eq('commande_id', commandeId),
      commande.client_id
        ? admin.from('clients').select('email').eq('id', commande.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    const vendeurIds = [...new Set([commande.beatmaker_id, ...(tranches ?? []).map(t => t.vendeur_id as string)])]
    const { data: vendeurs } = await admin.from('beatmakers').select('email').in('id', vendeurIds)

    // acheteur_email peut être vide (abonnement, client connecté au
    // checkout) — repli sur l'email du client lié.
    const emailsAcheteur = [commande.acheteur_email, client?.email].map(normaliserEmail).filter(Boolean)
    const emailsVendeurs = (vendeurs ?? []).map(v => normaliserEmail(v.email)).filter(Boolean)
    if (emailsVendeurs.includes(emailSaisi)) qui = 'vendeur'
    else if (emailsAcheteur.includes(emailSaisi)) qui = 'acheteur'
  }

  if (!qui) {
    const { data: bloqueJusqu } = await admin.rpc('noter_essai_acces_commande', { p_commande_id: commandeId })
    return NextResponse.json({ ok: false, erreur: bloqueJusqu ? TROP : REFUS }, { status: bloqueJusqu ? 429 : 403 })
  }

  const cookieStore = await cookies()
  poserCookieAcces(cookieStore, commandeId, qui, 'email_tape')
  return NextResponse.json({ ok: true })
}
