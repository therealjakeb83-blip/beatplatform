import Link from 'next/link'

export default function PageLegale({
  slug,
  nomArtiste,
  titre,
  contenu,
}: {
  slug: string
  nomArtiste: string
  titre: string
  contenu: string
}) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link href={`/${slug}`} className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-8">
        ← Boutique de {nomArtiste}
      </Link>

      <h1 className="text-2xl font-black text-white mb-6">{titre}</h1>

      <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{contenu}</p>
    </div>
  )
}
