import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { texteTemplateStandard, texteTemplateIllimite, texteTemplateExclusive, type TypeLicenceTexte } from '@/lib/licences-textes'
import LicenceTexteForm from './LicenceTexteForm'

const CATEGORIES: { type: TypeLicenceTexte; titre: string; template: () => string }[] = [
  { type: 'standard', titre: 'MP3 / WAV / STEMS', template: texteTemplateStandard },
  { type: 'illimite', titre: 'Illimité', template: texteTemplateIllimite },
  { type: 'exclusive', titre: 'Exclusive', template: texteTemplateExclusive },
]

export default async function LicenceTextesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: textesExistants } = await supabase
    .from('licences_textes')
    .select('type_licence, contenu, version, updated_at')
    .eq('beatmaker_id', user.id)
    .in('type_licence', CATEGORIES.map(c => c.type))

  const categories = CATEGORIES.map(c => {
    const existant = textesExistants?.find(t => t.type_licence === c.type)
    return {
      type: c.type,
      titre: c.titre,
      contenuActuel: existant?.contenu ?? null,
      templateParDefaut: c.template(),
      version: existant?.version ?? null,
      updatedLe: existant?.updated_at ?? null,
    }
  })

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard/business/licences"
          className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-8"
        >
          ← Licences
        </Link>
        <h1 className="text-2xl font-bold mb-2">Texte des contrats de licence</h1>
        <p className="text-gray-400 text-sm mb-8">
          MP3 / WAV / STEMS partagent le même texte — seuls le titre, les fichiers livrés et les limites
          d&apos;exploitation changent automatiquement selon la licence achetée. Illimité et Exclusive ont chacune
          leur propre texte indépendant. Tu peux utiliser le modèle par défaut tel quel ou le modifier librement.
          Une section &quot;Rôle de la plateforme&quot;, non éditable, est toujours ajoutée à la fin du contrat
          généré. Ce n&apos;est pas un texte juridique définitif — fais-le relire par un professionnel avant un
          vrai lancement commercial.
        </p>
        <LicenceTexteForm categories={categories} />
      </div>
    </main>
  )
}
