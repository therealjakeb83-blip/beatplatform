import Link from 'next/link'

export default function PageLegale({
  slug,
  nomArtiste,
  titre,
  contenu,
  adopteLe,
}: {
  slug: string
  nomArtiste: string
  titre: string
  contenu: string
  adopteLe?: string | null
}) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link href={`/${slug}`} className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-8">
        ← Boutique de {nomArtiste}
      </Link>

      <h1 className="text-2xl font-black text-white mb-1">{titre}</h1>
      {adopteLe && (
        <p className="text-xs text-gray-600 mb-6">
          Dernière mise à jour le {new Date(adopteLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
      {!adopteLe && <div className="mb-6" />}

      <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{contenu}</p>
    </div>
  )
}
