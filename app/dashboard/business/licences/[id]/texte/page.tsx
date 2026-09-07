import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  modeleVersTypeLicenceTexte,
  texteTemplateStandard,
  texteTemplateIllimite,
  texteTemplateExclusive,
  variablesDisponibles,
} from '@/lib/licences-textes'
import LicenceTexteForm from './LicenceTexteForm'

function templateParDefaut(modele: string): string {
  const type = modeleVersTypeLicenceTexte(modele)
  if (type === 'illimite') return texteTemplateIllimite()
  if (type === 'exclusive') return texteTemplateExclusive()
  return texteTemplateStandard()
}

export default async function LicenceTextePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: licence } = await supabase
    .from('licences')
    .select('id, nom, modele')
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .maybeSingle()
  if (!licence) notFound()

  const { data: texteExistant } = await supabase
    .from('licences_textes')
    .select('contenu, version, updated_at')
    .eq('licence_id', id)
    .maybeSingle()

  const typeTexte = modeleVersTypeLicenceTexte(licence.modele)
  const templateDefaut = templateParDefaut(licence.modele)

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/dashboard/business/licences"
          className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-8"
        >
          ← Licences
        </Link>
        <h1 className="text-2xl font-bold mb-2">Texte de la licence {licence.nom}</h1>
        <p className="text-gray-400 text-sm mb-8">
          Ce texte est propre à cette licence — le modifier ne touche pas tes autres licences, même si elles
          utilisent le même modèle de départ. Une section &quot;Rôle de la plateforme&quot;, non éditable, est
          toujours ajoutée à la fin du contrat généré. Ce n&apos;est pas un texte juridique définitif — fais-le
          relire par un professionnel avant un vrai lancement commercial.
        </p>
        <LicenceTexteForm
          licenceId={licence.id}
          contenuInitial={texteExistant?.contenu ?? templateDefaut}
          templateParDefaut={templateDefaut}
          version={texteExistant?.version ?? null}
          updatedLe={texteExistant?.updated_at ?? null}
          variables={variablesDisponibles(typeTexte)}
        />
      </div>
    </main>
  )
}
