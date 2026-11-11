// Référencement Google (rang 9c, lot 4) : robots.txt, plans de site, adresse
// canonique. Décisions de Jake (2026-11-11) : indexation FERMÉE jusqu'au
// lancement (étape 17 : INDEXATION_OUVERTE=true sur Vercel) ; un plan de site
// par boutique, comme Shopify ; une boutique n'est référencée qu'avec au moins
// un beat en vente (sinon noindex et hors plan de site, toujours ouverte).
import { createAdminClient } from '@/utils/supabase/admin'
import { estRoleAdmin } from '@/lib/admin'
import { URL_APP } from '@/lib/constantes'

export function indexationOuverte(): boolean {
  return process.env.INDEXATION_OUVERTE === 'true'
}

// Pages publiques listées dans le plan de site (chemins relatifs à l'accueil).
const PAGES_PUBLIQUES = ['', '/beats', '/selection', '/licences', '/comment-ca-marche', '/contact', '/cgv', '/confidentialite', '/mentions-legales', '/plan-de-site']
const PAGES_ABONNEMENT = ['/abonnement', '/membres']

// Pages personnelles d'une boutique, jamais à référencer.
export const CHEMINS_PRIVES_BOUTIQUE = ['/mon-compte', '/mon-abonnement', '/telechargement-gratuit']

type BeatmakerReferencement = {
  id: string
  slug: string
  statut: string | null
  role: string | null
  abonnement_exempte: boolean | null
  abo_actif: boolean | null
}

const SELECT_BEATMAKER = 'id, slug, statut, role, abonnement_exempte, abo_actif'
const PAGE_LECTURE = 1000

// Mêmes règles que les pages de la boutique : public, pas supprimé, pas hors vente
// en collab, déjà sorti.
function beatsEnVenteRequete(colonnes: string) {
  return createAdminClient()
    .from('beats')
    .select(colonnes)
    .eq('statut', 'public')
    .is('supprime_le', null)
    .eq('hors_vente_collab', false)
    .or(`date_sortie.is.null,date_sortie.lte.${new Date().toISOString()}`)
}

async function idsBeatsEnVente(beatmakerId: string): Promise<string[]> {
  const ids: string[] = []
  for (let debut = 0; ; debut += PAGE_LECTURE) {
    const { data, error } = await beatsEnVenteRequete('id')
      .eq('beatmaker_id', beatmakerId)
      .order('created_at', { ascending: false })
      .range(debut, debut + PAGE_LECTURE - 1)
    if (error) throw error
    const lignes = (data ?? []) as unknown as { id: string }[]
    ids.push(...lignes.map(l => l.id))
    if (lignes.length < PAGE_LECTURE) return ids
  }
}

// Même règle que app/[slug]/layout.tsx : pas suspendue, et abonnement plateforme
// actif ou en essai (sauf compte admin et boutiques exemptées).
async function boutiqueVisible(bm: BeatmakerReferencement): Promise<boolean> {
  if (bm.statut === 'suspendu') return false
  if (estRoleAdmin(bm.role) || bm.abonnement_exempte) return true
  const { data } = await createAdminClient()
    .from('abonnements_plateforme')
    .select('id')
    .eq('beatmaker_id', bm.id)
    .in('statut', ['actif', 'en_essai'])
    .limit(1)
    .maybeSingle()
  return !!data
}

async function beatmakerDuSlug(slug: string): Promise<BeatmakerReferencement | null> {
  const { data } = await createAdminClient().from('beatmakers').select(SELECT_BEATMAKER).eq('slug', slug).maybeSingle()
  return (data as BeatmakerReferencement | null) ?? null
}

// Chemins à mettre dans le plan de site de la boutique, ou null si elle ne doit pas
// être référencée (invisible, ou aucun beat en vente).
export async function cheminsReferencables(slug: string): Promise<string[] | null> {
  const bm = await beatmakerDuSlug(slug)
  if (!bm || !(await boutiqueVisible(bm))) return null
  const beats = await idsBeatsEnVente(bm.id)
  if (beats.length === 0) return null
  return [...PAGES_PUBLIQUES, ...(bm.abo_actif ? PAGES_ABONNEMENT : []), ...beats.map(id => `/${id}`)]
}

export async function boutiqueReferencable(slug: string): Promise<boolean> {
  return (await cheminsReferencables(slug).catch(() => null)) !== null
}

// Sommaire de sonoo.app : boutiques visibles, sans domaine actif, avec au moins un
// beat en vente. Celles qui ont un domaine sont listées sur leur domaine.
export async function boutiquesSonooReferencables(): Promise<string[]> {
  const admin = createAdminClient()
  const beatmakers: BeatmakerReferencement[] = []
  for (let debut = 0; ; debut += PAGE_LECTURE) {
    const { data, error } = await admin.from('beatmakers').select(SELECT_BEATMAKER).order('slug').range(debut, debut + PAGE_LECTURE - 1)
    if (error) throw error
    const lignes = (data ?? []) as BeatmakerReferencement[]
    beatmakers.push(...lignes)
    if (lignes.length < PAGE_LECTURE) break
  }

  const [{ data: abonnes }, { data: domaines }] = await Promise.all([
    admin.from('abonnements_plateforme').select('beatmaker_id').in('statut', ['actif', 'en_essai']),
    admin.from('domaines_boutique').select('beatmaker_id').eq('statut', 'actif'),
  ])
  const avecAbonnement = new Set((abonnes ?? []).map(a => a.beatmaker_id as string))
  const avecDomaine = new Set((domaines ?? []).map(d => d.beatmaker_id as string))

  const candidats = beatmakers.filter(bm =>
    bm.slug &&
    bm.statut !== 'suspendu' &&
    !avecDomaine.has(bm.id) &&
    (estRoleAdmin(bm.role) || bm.abonnement_exempte || avecAbonnement.has(bm.id))
  )

  const avecBeats = new Set<string>()
  for (let debut = 0; ; debut += PAGE_LECTURE) {
    const { data, error } = await beatsEnVenteRequete('beatmaker_id').order('id').range(debut, debut + PAGE_LECTURE - 1)
    if (error) throw error
    const lignes = (data ?? []) as unknown as { beatmaker_id: string }[]
    lignes.forEach(l => avecBeats.add(l.beatmaker_id))
    if (lignes.length < PAGE_LECTURE) break
  }

  return candidats.filter(bm => avecBeats.has(bm.id)).map(bm => bm.slug)
}

function echapperXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function reponseXml(xml: string): Response {
  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  })
}

export function planDeSiteXml(adresses: string[]): string {
  const lignes = adresses.map(a => `  <url><loc>${echapperXml(a)}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lignes}\n</urlset>\n`
}

export function sommairePlansDeSiteXml(adresses: string[]): string {
  const lignes = adresses.map(a => `  <sitemap><loc>${echapperXml(a)}</loc></sitemap>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lignes}\n</sitemapindex>\n`
}

export function accueilSonoo(slug: string): string {
  return `${URL_APP}/${slug}`
}
