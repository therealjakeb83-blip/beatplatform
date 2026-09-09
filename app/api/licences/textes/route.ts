import { createClient } from '@/utils/supabase/server'
import { journaliserDecision } from '@/lib/decisions-log'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { licence_id, contenu } = await request.json()

  if (typeof licence_id !== 'string') {
    return Response.json({ error: 'Licence invalide' }, { status: 400 })
  }
  if (typeof contenu !== 'string' || !contenu.trim()) {
    return Response.json({ error: 'Le contenu ne peut pas être vide' }, { status: 400 })
  }

  // Vérifie que la licence appartient bien au beatmaker connecté avant
  // d'écrire quoi que ce soit.
  const { data: licence } = await supabase
    .from('licences')
    .select('id')
    .eq('id', licence_id)
    .eq('beatmaker_id', user.id)
    .maybeSingle()
  if (!licence) return Response.json({ error: 'Licence introuvable' }, { status: 404 })

  const { data: existant } = await supabase
    .from('licences_textes')
    .select('contenu, version')
    .eq('licence_id', licence_id)
    .maybeSingle()

  const nouvelleVersion = (existant?.version ?? 0) + 1

  // Archive la version remplacée avant de l'écraser — même principe que
  // boutique_pages_legales_historique (Phase 4) : un texte de licence est
  // un document juridique, son ancienne version ne doit jamais être perdue.
  if (existant) {
    const { error: historiqueError } = await supabase.from('licences_textes_historique').insert({
      licence_id,
      beatmaker_id: user.id,
      contenu: existant.contenu,
      version: existant.version,
    })
    if (historiqueError) console.error('[licences/textes] Erreur archivage historique:', JSON.stringify(historiqueError))
  }

  const { error } = await supabase
    .from('licences_textes')
    .upsert({
      licence_id,
      beatmaker_id: user.id,
      contenu,
      version: nouvelleVersion,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'licence_id' })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  await journaliserDecision({
    beatmakerId: user.id,
    actorType: 'beatmaker',
    actorId: user.id,
    entityType: 'licence_texte',
    entityId: licence_id,
    action: 'modification_texte',
    referenceVersion: String(nouvelleVersion),
    details: { version_precedente: existant?.version ?? null },
  })

  return Response.json({ success: true })
}
