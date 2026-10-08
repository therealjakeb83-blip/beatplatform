import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { inscrireParClient } from '@/lib/newsletter'

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
  } else {
    const newId = crypto.randomUUID()
    const nom = emailNorm.split('@')[0].replace(/[._+\-]/g, ' ').replace(/\s+/g, ' ').trim() || emailNorm
    await admin.from('clients').insert({ id: newId, email: emailNorm, nom })
    clientId = newId
  }

  await inscrireParClient(admin, { clientId, beatmakerId: beatmaker.id, origine: 'formulaire', sourceLead: 'newsletter' })

  return NextResponse.json({ ok: true })
}
