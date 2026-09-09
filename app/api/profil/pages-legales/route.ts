import { createClient } from '@/utils/supabase/server'
import { TYPES_PAGES_LEGALES, type TypePageLegale } from '@/lib/pages-legales'
import { journaliserDecision } from '@/lib/decisions-log'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { type_page, contenu } = await request.json()

  const typeValide = TYPES_PAGES_LEGALES.some(t => t.type === type_page)
  if (!typeValide) return Response.json({ error: 'Type de page invalide' }, { status: 400 })
  if (typeof contenu !== 'string' || !contenu.trim()) {
    return Response.json({ error: 'Le contenu ne peut pas être vide' }, { status: 400 })
  }

  const { data: existante } = await supabase
    .from('boutique_pages_legales')
    .select('id, contenu, version, adopte_le')
    .eq('beatmaker_id', user.id)
    .eq('type_page', type_page as TypePageLegale)
    .maybeSingle()

  // Archive la version remplacée avant de l'écraser (Phase 4, snapshot
  // transactionnel) — sans ça, le texte exact d'une ancienne version des
  // CGV/mentions légales/etc. serait perdu pour toujours, alors qu'une
  // commande peut avoir besoin de prouver quelle version était en vigueur
  // au moment de la vente.
  if (existante) {
    const { error: historiqueError } = await supabase.from('boutique_pages_legales_historique').insert({
      beatmaker_id: user.id,
      type_page,
      contenu: existante.contenu,
      version: existante.version,
      adopte_le: existante.adopte_le,
    })
    if (historiqueError) console.error('[pages-legales] Erreur archivage historique:', JSON.stringify(historiqueError))
  }

  const nouvelleVersion = (existante?.version ?? 0) + 1

  const { data: page, error } = await supabase
    .from('boutique_pages_legales')
    .upsert({
      beatmaker_id: user.id,
      type_page,
      contenu,
      version: nouvelleVersion,
      adopte_le: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'beatmaker_id,type_page' })
    .select('id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  await journaliserDecision({
    beatmakerId: user.id,
    actorType: 'beatmaker',
    actorId: user.id,
    entityType: 'page_legale',
    entityId: page.id,
    action: 'publication',
    referenceVersion: String(nouvelleVersion),
    details: { type_page, version_precedente: existante?.version ?? null },
  })

  return Response.json({ success: true })
}
