import { verifierTokenDesinscription, incrementerCompteurCampagne } from '@/lib/mailing'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function pageHtml(titre: string, message: string): string {
  return `<!doctype html>
<html>
  <body style="font-family:Arial,sans-serif;background:#0a0a0a;color:#e5e7eb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
    <div style="text-align:center;max-width:420px;padding:32px;">
      <h1 style="font-size:20px;margin:0 0 12px;">${titre}</h1>
      <p style="font-size:14px;color:#9ca3af;margin:0;">${message}</p>
    </div>
  </body>
</html>`
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  const verif = token ? verifierTokenDesinscription(token) : null

  if (!verif) {
    return new NextResponse(pageHtml('Lien invalide', 'Ce lien de désinscription est invalide ou expiré.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const admin = createAdminClient()
  const { clientId, beatmakerId, campagneId } = verif

  await admin.from('clients').update({ newsletter_consent: false }).eq('id', clientId)

  await admin.from('leads')
    .update({ newsletter_inscrit: false })
    .eq('client_id', clientId)
    .eq('beatmaker_id', beatmakerId)

  const { data: envoi } = await admin
    .from('campagne_envois')
    .select('id, desinscrit_at')
    .eq('campagne_id', campagneId)
    .eq('client_id', clientId)
    .maybeSingle()

  if (envoi && !envoi.desinscrit_at) {
    await admin.from('campagne_envois').update({ desinscrit_at: new Date().toISOString() }).eq('id', envoi.id)
    await incrementerCompteurCampagne(campagneId, 'desinscrits')
  }

  return new NextResponse(
    pageHtml('Désinscription confirmée', 'Tu ne recevras plus les emails marketing de cette boutique. Tu peux fermer cette page.'),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
