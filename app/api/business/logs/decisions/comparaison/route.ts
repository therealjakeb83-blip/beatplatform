import { createClient } from '@/utils/supabase/server'

// Reconstruit l'ancien/nouveau texte d'une décision "publication"/
// "modification_texte" pour affichage dans la modale de détail du journal
// (merchant_decisions_log ne stocke jamais le contenu lui-même — seulement
// les numéros de version, voir memory project_grillme_9bis_synthese). Le
// texte réel vit dans les tables *_historique (versions remplacées) ou la
// table live (version actuelle) — cherche d'abord dans l'historique, qui
// reste correct même si la page/licence a été republiée depuis.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const url = new URL(request.url)
  const entityType = url.searchParams.get('entity_type')
  const entityId = url.searchParams.get('entity_id')
  const versionActuelle = url.searchParams.get('reference_version')
  const versionPrecedente = url.searchParams.get('version_precedente')
  const typePage = url.searchParams.get('type_page')

  if (!entityId || !entityType) return Response.json({ error: 'Paramètres manquants' }, { status: 400 })

  if (entityType === 'page_legale') {
    if (!typePage) return Response.json({ error: 'type_page manquant' }, { status: 400 })

    const [{ data: ancien }, { data: nouveauHistorique }, { data: nouveauLive }] = await Promise.all([
      versionPrecedente
        ? supabase.from('boutique_pages_legales_historique')
            .select('contenu')
            .eq('beatmaker_id', user.id).eq('type_page', typePage).eq('version', versionPrecedente)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      versionActuelle
        ? supabase.from('boutique_pages_legales_historique')
            .select('contenu')
            .eq('beatmaker_id', user.id).eq('type_page', typePage).eq('version', versionActuelle)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('boutique_pages_legales').select('contenu, version').eq('id', entityId).eq('beatmaker_id', user.id).maybeSingle(),
    ])

    const nouveau = nouveauHistorique?.contenu
      ?? (nouveauLive && String(nouveauLive.version) === versionActuelle ? nouveauLive.contenu : null)

    return Response.json({ ancien: ancien?.contenu ?? null, nouveau: nouveau ?? null })
  }

  if (entityType === 'licence_texte') {
    const [{ data: ancien }, { data: nouveauHistorique }, { data: nouveauLive }] = await Promise.all([
      versionPrecedente
        ? supabase.from('licences_textes_historique')
            .select('contenu')
            .eq('beatmaker_id', user.id).eq('licence_id', entityId).eq('version', versionPrecedente)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      versionActuelle
        ? supabase.from('licences_textes_historique')
            .select('contenu')
            .eq('beatmaker_id', user.id).eq('licence_id', entityId).eq('version', versionActuelle)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('licences_textes').select('contenu, version').eq('licence_id', entityId).eq('beatmaker_id', user.id).maybeSingle(),
    ])

    const nouveau = nouveauHistorique?.contenu
      ?? (nouveauLive && String(nouveauLive.version) === versionActuelle ? nouveauLive.contenu : null)

    return Response.json({ ancien: ancien?.contenu ?? null, nouveau: nouveau ?? null })
  }

  return Response.json({ error: 'Entité sans comparatif' }, { status: 400 })
}
