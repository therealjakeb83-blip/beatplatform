import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

type LigneCSV = {
  order_id: string
  date: string
  nom: string
  email: string
  beat: string
  licence: string
  montant: number
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const { lignes } = await request.json() as { lignes: LigneCSV[] }
  if (!Array.isArray(lignes) || lignes.length === 0) {
    return NextResponse.json({ erreur: 'Aucune donnée' }, { status: 400 })
  }

  // Récupérer les external_order_id déjà importés pour ce beatmaker
  const { data: existants } = await admin
    .from('commandes')
    .select('external_order_id')
    .eq('beatmaker_id', user.id)
    .eq('plateforme_source', 'beatstars')
    .not('external_order_id', 'is', null)

  const dejaPresentSet = new Set((existants ?? []).map(e => e.external_order_id))

  let importes = 0
  let ignores = 0
  const erreurs: string[] = []

  for (const ligne of lignes) {
    const orderId = ligne.order_id?.trim()

    if (orderId && dejaPresentSet.has(orderId)) {
      ignores++
      continue
    }

    if (!ligne.email?.includes('@')) {
      erreurs.push(`Ligne ignorée — email invalide : ${ligne.email}`)
      continue
    }

    // Chercher si ce client a déjà un compte My Producer
    const { data: clientExistant } = await admin
      .from('clients')
      .select('id')
      .eq('email', ligne.email.toLowerCase())
      .maybeSingle()

    const montantCents = Math.round(ligne.montant)

    // Déduire la date
    let createdAt: string | null = null
    if (ligne.date) {
      const d = new Date(ligne.date)
      if (!isNaN(d.getTime())) createdAt = d.toISOString()
    }

    const { error } = await admin.from('commandes').insert({
      beatmaker_id: user.id,
      client_id: clientExistant?.id ?? null,
      acheteur_email: ligne.email.toLowerCase(),
      acheteur_nom: ligne.nom || null,
      beat_id: null,
      licence_id: null,
      prix_paye: montantCents,
      devise: 'EUR',
      methode_paiement: 'beatstars',
      statut: 'payee',
      plateforme_source: 'beatstars',
      external_order_id: orderId || null,
      fichiers_livres: true,
      ...(createdAt ? { created_at: createdAt } : {}),
    })

    if (error) {
      erreurs.push(`Erreur pour ${ligne.email} : ${error.message}`)
    } else {
      importes++
      if (orderId) dejaPresentSet.add(orderId)
    }
  }

  return NextResponse.json({ importes, ignores, erreurs })
}
