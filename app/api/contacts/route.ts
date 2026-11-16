import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { ecrireFicheBoutique } from '@/lib/fiche-boutique-ecriture'
import { modifierFicheBoutique } from '@/app/dashboard/business/_lib/fiche-boutique'
import { changerStatutParBeatmaker } from '@/lib/newsletter'

export const runtime = 'nodejs'

const texte = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

// Ajout manuel d'un contact par le beatmaker (9d lot 3). Tout ce qu'il saisit
// va dans la fiche de SA boutique, marqué « modifié à la main » ; la fiche
// commune `clients` ne reçoit que l'email (identifiant). Une personne déjà
// connue d'une AUTRE boutique reçoit simplement une fiche ici : même réponse
// que pour une personne nouvelle (faille 5 : « existe déjà » révélait qu'un
// email était client ailleurs). Seul un contact déjà dans CETTE boutique est
// signalé.
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

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const prenom = texte(body.prenom)
  const nom = texte(body.nom)
  const emailNorm = texte(body.email).toLowerCase()

  if (!prenom || !nom || !emailNorm) {
    return NextResponse.json({ error: 'Prénom, nom et email sont obligatoires' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
  }

  const { data: existing } = await admin
    .from('clients')
    .select('id')
    .eq('email', emailNorm)
    .maybeSingle()

  let clientId: string
  let clientCree = false
  if (existing) {
    clientId = existing.id
    const { data: dejaIci } = await admin
      .from('leads')
      .select('id, efface_le')
      .eq('beatmaker_id', beatmaker.id)
      .eq('client_id', clientId)
      .maybeSingle()
    // Contact effacé par la boutique (9d lot 4) : on peut le rajouter, la
    // fiche repart de zéro avec la saisie (ecrire_fiche_boutique)
    if (dejaIci && !dejaIci.efface_le) {
      return NextResponse.json({ error: 'Ce contact est déjà dans tes contacts' }, { status: 409 })
    }
  } else {
    clientId = crypto.randomUUID()
    const { error: clientError } = await admin.from('clients').insert({ id: clientId, email: emailNorm, nom: '' })
    if (clientError) {
      console.error('[contacts] client insert error:', JSON.stringify(clientError))
      return NextResponse.json({ error: 'Erreur lors de la création du contact' }, { status: 500 })
    }
    clientCree = true
  }

  const { leadId } = await ecrireFicheBoutique(admin, {
    clientId,
    beatmakerId: beatmaker.id,
    source: 'manuel',
    donnees: { email: emailNorm },
  })
  if (!leadId) {
    if (clientCree) await admin.from('clients').delete().eq('id', clientId)
    return NextResponse.json({ error: 'Erreur lors de la création du contact' }, { status: 500 })
  }

  const telephone = texte(body.telephone)
  const pays = texte(body.pays).toUpperCase()
  const saisie = {
    prenom,
    nom,
    ...(telephone ? { telephones: [telephone] } : {}),
    ...(/^[A-Z]{2}$/.test(pays) ? { pays } : {}),
    ...(texte(body.nomArtiste) ? { nom_artiste: texte(body.nomArtiste) } : {}),
    ...(texte(body.instagram) ? { instagram: texte(body.instagram) } : {}),
    ...(texte(body.spotify) ? { spotify: texte(body.spotify) } : {}),
    ...(texte(body.youtube) ? { youtube: texte(body.youtube) } : {}),
    ...(texte(body.tiktok) ? { tiktok: texte(body.tiktok) } : {}),
  }
  try {
    await modifierFicheBoutique(admin, beatmaker.id, clientId, saisie)
  } catch (err) {
    console.error('[contacts] saisie de la fiche:', err)
    return NextResponse.json({ error: 'Contact créé, mais ses informations n\'ont pas pu être enregistrées' }, { status: 500 })
  }

  if (body.newsletter === 'inscrit') {
    await changerStatutParBeatmaker(admin, { clientId, beatmakerId: beatmaker.id, inscrire: true, sourceLead: 'manuel' })
  }

  return NextResponse.json({ id: clientId })
}
