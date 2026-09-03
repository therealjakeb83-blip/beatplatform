import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { texteTemplateStandard } from '@/lib/licences-textes'
import LicenceTexteForm from './LicenceTexteForm'

export default async function LicenceTextesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: texteExistant } = await supabase
    .from('licences_textes')
    .select('contenu, version, updated_at')
    .eq('beatmaker_id', user.id)
    .eq('type_licence', 'standard')
    .maybeSingle()

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard/business/licences"
          className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-8"
        >
          ← Licences
        </Link>
        <h1 className="text-2xl font-bold mb-2">Texte de la licence MP3 / WAV / STEMS</h1>
        <p className="text-gray-400 text-sm mb-8">
          Ce même texte s&apos;applique à tes 3 premiers niveaux de licence (MP3, WAV, STEMS) — seuls le titre, les
          fichiers livrés et les limites d&apos;exploitation changent automatiquement selon la licence achetée. Tu
          peux utiliser le modèle par défaut tel quel ou le modifier librement. Une section &quot;Rôle de la
          plateforme&quot;, non éditable, est toujours ajoutée à la fin du contrat généré. Ce n&apos;est pas un texte
          juridique définitif — fais-le relire par un professionnel avant un vrai lancement commercial. Les licences
          Illimité et Exclusive seront ajoutées séparément.
        </p>
        <LicenceTexteForm
          contenuInitial={texteExistant?.contenu ?? texteTemplateStandard()}
          templateParDefaut={texteTemplateStandard()}
          version={texteExistant?.version ?? null}
          updatedLe={texteExistant?.updated_at ?? null}
        />
      </div>
    </main>
  )
}
