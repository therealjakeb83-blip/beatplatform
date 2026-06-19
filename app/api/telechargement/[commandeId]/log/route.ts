import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export const runtime = 'nodejs'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ commandeId: string }> }
) {
  const { commandeId } = await params
  const body = await req.json().catch(() => ({}))
  const { fichier } = body as { fichier?: string }

  if (!commandeId || !fichier) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const admin = createAdminClient()

  // Récupérer beatmaker_id et client_id depuis la commande
  const { data: commande } = await admin
    .from('commandes')
    .select('beatmaker_id, client_id')
    .eq('id', commandeId)
    .single()

  if (!commande) {
    return NextResponse.json({ ok: false }, { status: 404 })
  }

  const forwarded = req.headers.get('x-forwarded-for')
  const ip_address = forwarded ? forwarded.split(',')[0].trim() : null

  const { error } = await admin.from('licence_downloads').insert({
    commande_id:  commandeId,
    beatmaker_id: commande.beatmaker_id,
    client_id:    commande.client_id ?? null,
    fichier,
    ip_address,
  })

  if (error) {
    console.error('[log] Erreur insert licence_downloads:', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
