import { createAdminClient } from '@/utils/supabase/admin'
import { normaliserEmail } from '@/lib/email'
import { cookieAccesTelechargement, DUREE_COOKIE_ACCES } from '@/lib/telechargement-acces'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Vérification légère par email (Phase 11, 9 bis) — deux emails autorisés :
// celui de l'acheteur de la commande, ou celui du compte du beatmaker
// vendeur (accès support, demandé par Jake). Jamais de message distinguant
// "commande introuvable" de "email incorrect" — pas d'info à donner à
// quelqu'un qui devine.
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

  const admin = createAdminClient()
  const { data: commande } = await admin
    .from('commandes')
    .select('id, acheteur_email, beatmaker_id, client_id')
    .eq('id', commandeId)
    .maybeSingle()

  if (!commande) {
    return NextResponse.json({ ok: false, erreur: 'Cet email ne correspond pas à cette commande.' }, { status: 404 })
  }

  const [{ data: beatmaker }, { data: client }] = await Promise.all([
    admin.from('beatmakers').select('email').eq('id', commande.beatmaker_id).maybeSingle(),
    commande.client_id
      ? admin.from('clients').select('email').eq('id', commande.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  // acheteur_email peut être vide (commandes créées via abonnement/
  // renouvellement, ou client déjà connecté au checkout) — repli sur l'email
  // du client lié, même pattern que completerEmailManquant() dans
  // lib/admin-recherche.ts.
  const emailsAutorises = [commande.acheteur_email, client?.email, beatmaker?.email].map(normaliserEmail).filter(Boolean)

  if (!emailsAutorises.includes(emailSaisi)) {
    return NextResponse.json({ ok: false, erreur: 'Cet email ne correspond pas à cette commande.' }, { status: 403 })
  }

  const cookieStore = await cookies()
  cookieStore.set(cookieAccesTelechargement(commandeId), '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: DUREE_COOKIE_ACCES,
    path: `/telechargement/${commandeId}`,
    sameSite: 'lax',
  })

  return NextResponse.json({ ok: true })
}
