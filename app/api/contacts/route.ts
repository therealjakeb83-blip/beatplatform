import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const supabase = await createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id')
    .eq('id', user.id)
    .single()
  if (!beatmaker) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const { prenom, nom, email, telephone, pays, nomArtiste, instagram, spotify, youtube, tiktok, newsletter } = body

  if (!prenom?.trim() || !nom?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Prénom, nom et email sont obligatoires' }, { status: 400 })
  }

  const emailNorm = (email as string).toLowerCase().trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
  }

  const { data: existing } = await admin
    .from('clients')
    .select('id')
    .eq('email', emailNorm)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'Un contact avec cet email existe déjà' }, { status: 409 })
  }

  const clientId = crypto.randomUUID()
  const { data: clientData, error: clientError } = await admin.from('clients').insert({
    id:                 clientId,
    prenom:             (prenom as string).trim(),
    nom:                (nom as string).trim(),
    email:              emailNorm,
    telephone:          (telephone as string)?.trim()  || null,
    pays:               (pays as string)?.trim()       || null,
    nom_artiste:        (nomArtiste as string)?.trim() || null,
    instagram:          (instagram as string)?.trim()  || null,
    spotify:            (spotify as string)?.trim()    || null,
    youtube:            (youtube as string)?.trim()    || null,
    tiktok:             (tiktok as string)?.trim()     || null,
    newsletter_consent: newsletter === 'inscrit',
  }).select('id')
  if (clientError) {
    console.error('[contacts] client insert error:', JSON.stringify(clientError))
    return NextResponse.json({ error: clientError.message }, { status: 500 })
  }
  console.log('[contacts] client inserted:', clientData)

  const { data: leadData, error: leadError } = await supabase.from('leads').insert({
    client_id:          clientId,
    beatmaker_id:       beatmaker.id,
    source:             'manuel',
    newsletter_inscrit: newsletter === 'inscrit',
  }).select('id')
  if (leadError) {
    console.error('[contacts] lead insert error:', JSON.stringify(leadError))
    await admin.from('clients').delete().eq('id', clientId)
    return NextResponse.json({ error: 'Erreur lors de la création du contact : ' + leadError.message }, { status: 500 })
  }
  console.log('[contacts] lead inserted:', leadData)

  return NextResponse.json({ id: clientId, debug: { clientInserted: !!clientData?.length, leadInserted: !!leadData?.length } })
}
