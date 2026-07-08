import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { envoyerEmailUnique } from '@/lib/email-logger'

export const runtime = 'nodejs'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commandeId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = createAdminClient()

  // Vérifier que la commande appartient à ce beatmaker
  const { data: commande } = await admin
    .from('commandes')
    .select(`
      id, acheteur_email, acheteur_nom, beatmaker_id, client_id,
      beats (titre),
      licences (nom),
      clients (email, prenom, nom)
    `)
    .eq('id', commandeId)
    .eq('beatmaker_id', user.id)
    .single()

  if (!commande) {
    return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
  }

  // Résoudre l'email destinataire
  const c = commande as unknown as {
    id: string
    acheteur_email: string | null
    acheteur_nom: string | null
    beatmaker_id: string
    client_id: string | null
    beats: { titre: string } | null
    licences: { nom: string } | null
    clients: { email: string; prenom: string | null; nom: string } | null
  }

  const destinataire = c.clients?.email ?? c.acheteur_email
  const nomDestinataire = c.clients
    ? [c.clients.prenom, c.clients.nom].filter(Boolean).join(' ')
    : c.acheteur_nom ?? destinataire

  if (!destinataire) {
    return NextResponse.json({ error: 'Aucun email pour ce client' }, { status: 400 })
  }

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('nom_artiste, slug')
    .eq('id', user.id)
    .single()

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://beatplatform.vercel.app'
  const downloadUrl = `${APP_URL}/telechargement/${commandeId}`
  const titreBeat = c.beats?.titre ?? 'votre beat'
  const nomLicence = c.licences?.nom ?? 'Licence'
  const nomArtiste = beatmaker?.nom_artiste ?? 'votre beatmaker'

  // Envoyer l'email
  const { error: envoiError } = await envoyerEmailUnique({
    beatmakerId: user.id,
    type: 'transactionnel',
    evenement: 'renvoi_commande',
    clientId: c.client_id,
    commandeId,
    to: destinataire,
    subject: `Vos fichiers — ${titreBeat} (${nomLicence})`,
    html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111;background:#fff;padding:32px;border-radius:12px;">
          <h2 style="color:#4f46e5;margin-top:0;">Vos fichiers sont disponibles</h2>
          <p>Bonjour ${nomDestinataire},</p>
          <p>
            Voici votre lien de téléchargement pour le beat
            <strong>${titreBeat}</strong> — licence <strong>${nomLicence}</strong>
            de <strong>${nomArtiste}</strong>.
          </p>
          <p style="margin:28px 0;">
            <a href="${downloadUrl}"
               style="background:#4f46e5;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;font-size:15px;">
              ↓ Télécharger mes fichiers
            </a>
          </p>
          <p style="color:#555;font-size:13px;">
            Vous pouvez revenir sur ce lien à tout moment pour retélécharger vos fichiers.
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="color:#888;font-size:11px;margin:0;">
            Propulsé par My Producer · Cet email a été envoyé suite à votre achat.
          </p>
        </div>
      `,
  })

  if (envoiError) {
    console.error('[renvoyer] Erreur email:', envoiError)
    return NextResponse.json({ error: 'Erreur envoi email' }, { status: 500 })
  }

  // Logger le renvoi dans licence_downloads
  await admin.from('licence_downloads').insert({
    commande_id:  commandeId,
    beatmaker_id: user.id,
    client_id:    c.client_id ?? null,
    fichier:      'email_renvoi',
  })

  return NextResponse.json({ ok: true, destinataire })
}
