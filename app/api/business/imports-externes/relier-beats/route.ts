import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { beatmakerImport } from '@/lib/import-externe/route-commun'
import { chargerLignesTitres, normaliserTitre } from '@/lib/import-externe/liens-beats'

type Demande = { cle?: unknown; action?: unknown; beat_id?: unknown }
const ACTIONS = new Set(['relier', 'ne_pas_relier', 'defaire'])

// POST { liens: [{ cle, action: 'relier'|'ne_pas_relier'|'defaire', beat_id? }] }
// Les titres bruts de chaque clé sont relus ici (jamais repris du navigateur),
// pour que TOUTES les lignes du titre suivent, même importées entre-temps.
// Une seule transaction pour toute la demande (« Valider les N propositions »).
export async function POST(req: Request) {
  const acces = await beatmakerImport(true)
  if ('refus' in acces) return acces.refus

  const body = await req.json().catch(() => null) as { liens?: Demande[] } | null
  const demandes = Array.isArray(body?.liens) ? body.liens : []
  if (demandes.length === 0) return NextResponse.json({ error: 'Rien à enregistrer.' }, { status: 400 })

  const admin = createAdminClient()
  const titresParCle = new Map<string, Set<string>>()
  for (const l of await chargerLignesTitres(admin, acces.beatmakerId)) {
    const cle = normaliserTitre(l.titre)
    titresParCle.set(cle, (titresParCle.get(cle) ?? new Set()).add(l.titre))
  }

  const liens = []
  for (const d of demandes) {
    if (typeof d.cle !== 'string' || typeof d.action !== 'string' || !ACTIONS.has(d.action)) {
      return NextResponse.json({ error: 'Demande invalide.' }, { status: 400 })
    }
    const titres = titresParCle.get(d.cle)
    if (!titres) return NextResponse.json({ error: 'Titre introuvable : recharge la page.' }, { status: 409 })
    if (d.action === 'relier' && typeof d.beat_id !== 'string') {
      return NextResponse.json({ error: 'Beat manquant.' }, { status: 400 })
    }
    liens.push({ cle: d.cle, titres: [...titres], action: d.action, beat_id: d.action === 'relier' ? d.beat_id : null })
  }

  const { data, error } = await admin.rpc('relier_titres_externes', { p_beatmaker_id: acces.beatmakerId, p_liens: liens })
  if (error) {
    console.error('[imports-externes/relier-beats]', error)
    const introuvable = error.message?.includes('beat_introuvable')
    return NextResponse.json({ error: introuvable ? 'Ce beat n’est pas dans ton catalogue.' : 'L’enregistrement a échoué : rien n’a été modifié.' }, { status: introuvable ? 400 : 500 })
  }
  return NextResponse.json({ resultat: data })
}
