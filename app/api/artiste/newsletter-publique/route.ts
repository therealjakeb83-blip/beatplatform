import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { slug, email } = body as { slug?: string; email?: string }

  const emailNorm = (email ?? '').toLowerCase().trim()
  if (!slug || !emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return NextResponse.json({ erreur: 'Email invalide.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!beatmaker) {
    return NextResponse.json({ erreur: 'Boutique introuvable.' }, { status: 404 })
  }

  const { data: existing } = await admin
    .from('clients')
    .select('id')
    .eq('email', emailNorm)
    .maybeSingle()

  let clientId: string
  if (existing) {
    clientId = existing.id
    await admin.from('clients').update({ newsletter_consent: true }).eq('id', clientId)
  } else {
    const newId = crypto.randomUUID()
    const nom = emailNorm.split('@')[0].replace(/[._+\-]/g, ' ').replace(/\s+/g, ' ').trim() || emailNorm
    await admin.from('clients').insert({ id: newId, email: emailNorm, nom, newsletter_consent: true })
    clientId = newId
  }

  const { data: existingLead } = await admin
    .from('leads')
    .select('id, newsletter_inscrit')
    .eq('client_id', clientId)
    .eq('beatmaker_id', beatmaker.id)
    .maybeSingle()

  if (!existingLead) {
    await admin.from('leads').insert({
      client_id: clientId,
      beatmaker_id: beatmaker.id,
      source: 'newsletter',
      newsletter_inscrit: true,
    })
  } else if (!existingLead.newsletter_inscrit) {
    await admin.from('leads').update({ newsletter_inscrit: true }).eq('id', existingLead.id)
  }

  return NextResponse.json({ ok: true })
}
