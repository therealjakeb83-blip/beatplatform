import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TYPES_PAGES_LEGALES, texteTemplate } from '@/lib/pages-legales'
import PagesLegalesForm from './PagesLegalesForm'

export default async function PagesLegalesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('slug, nom_artiste')
    .eq('id', user.id)
    .single()

  if (!beatmaker) redirect('/dashboard')

  const { data: pagesExistantes } = await supabase
    .from('boutique_pages_legales')
    .select('type_page, contenu, version, adopte_le')
    .eq('beatmaker_id', user.id)

  const pages = TYPES_PAGES_LEGALES.map(({ type, titre, route }) => {
    const existante = pagesExistantes?.find(p => p.type_page === type)
    return {
      type,
      titre,
      route,
      contenu: existante?.contenu ?? texteTemplate(type, beatmaker.nom_artiste, beatmaker.slug),
      version: existante?.version ?? null,
      adopteLe: existante?.adopte_le ?? null,
    }
  })

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard"
          className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-8"
        >
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold mb-2">Pages légales de ta boutique</h1>
        <p className="text-gray-400 text-sm mb-8">
          CGV, mentions légales, confidentialité, contact et plan de site — visibles par tes clients sur{' '}
          <span className="text-gray-300">{beatmaker.slug}</span>. Tu peux garder le modèle proposé tel quel,
          le modifier, ou repartir de zéro. Ce ne sont pas des textes juridiques définitifs — fais-les relire
          par un professionnel avant un vrai lancement commercial.
        </p>
        <PagesLegalesForm pages={pages} slug={beatmaker.slug} />
      </div>
    </main>
  )
}
