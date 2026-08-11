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
    .select('slug, nom_artiste, raison_sociale, numero_entreprise, adresse, ville, code_postal, email_contact_public')
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
      // Contenu déjà publié (peut contenir des {{variables}} non résolues
      // si jamais enregistré, ou du texte déjà figé si déjà sauvegardé) —
      // le template brut sert de point de départ tant que rien n'est publié.
      contenuActuel: existante?.contenu ?? null,
      templateBrut: texteTemplate(type, beatmaker.nom_artiste, beatmaker.slug),
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
          CGV, mentions légales, confidentialité, contact et plan de site. Tant que tu n&apos;as pas cliqué
          &quot;Enregistrer et publier&quot; sur une page, elle reste vide pour tes clients — rien ne se
          publie automatiquement. Ce ne sont pas des textes juridiques définitifs — fais-les relire par un
          professionnel avant un vrai lancement commercial.
        </p>
        <PagesLegalesForm
          pages={pages}
          slug={beatmaker.slug}
          infosInitiales={{
            nom_artiste: beatmaker.nom_artiste,
            raison_sociale: beatmaker.raison_sociale,
            numero_entreprise: beatmaker.numero_entreprise,
            adresse: beatmaker.adresse,
            ville: beatmaker.ville,
            code_postal: beatmaker.code_postal,
            email_contact_public: beatmaker.email_contact_public,
          }}
        />
      </div>
    </main>
  )
}
