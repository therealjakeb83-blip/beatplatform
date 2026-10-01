import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { journaliserDecision } from '@/lib/decisions-log'
import { envoyerReponseLitige, accepterLitige } from '@/lib/litiges'

export const runtime = 'nodejs'
export const maxDuration = 60

// Litige d'une commande, géré par son propriétaire (A) — Phase 13, lot 4b.
// action = 'repondre' (preuves automatiques + texte + fichier, envoyé sur le
// compte de chaque vendeur, définitif) ou 'accepter' (= litige perdu).
// Voir lib/litiges.ts.

const TYPES_FICHIER = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const TAILLE_MAX = 3 * 1024 * 1024

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: commandeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = createAdminClient()
  const { data: commande } = await admin.from('commandes').select('id').eq('id', commandeId).eq('beatmaker_id', user.id).maybeSingle()
  if (!commande) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  const action = form.get('action')

  let resultat
  if (action === 'accepter') {
    resultat = await accepterLitige(admin, commandeId)
  } else if (action === 'repondre') {
    const texte = String(form.get('texte') ?? '').slice(0, 15000)
    const brut = form.get('fichier')
    let fichier = null
    if (brut instanceof File && brut.size > 0) {
      if (!TYPES_FICHIER.has(brut.type)) return NextResponse.json({ error: 'Fichier refusé : PDF, JPEG ou PNG seulement.' }, { status: 400 })
      if (brut.size > TAILLE_MAX) return NextResponse.json({ error: 'Fichier trop lourd (3 Mo maximum).' }, { status: 400 })
      fichier = { nom: brut.name || 'piece-jointe', type: brut.type, donnees: Buffer.from(await brut.arrayBuffer()) }
    }
    resultat = await envoyerReponseLitige(admin, commandeId, { texte, fichier })
  } else {
    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  }

  if (resultat.erreur) return NextResponse.json({ error: resultat.erreur }, { status: 400 })

  await journaliserDecision({
    beatmakerId: user.id,
    actorType: 'beatmaker',
    actorId: user.id,
    entityType: 'commande',
    entityId: commandeId,
    action: action === 'accepter' ? 'litige_accepte' : 'litige_reponse',
    details: { envoyees: resultat.envoyees, ignorees: resultat.ignorees, echecs: resultat.echecs },
  })

  return NextResponse.json(resultat)
}
