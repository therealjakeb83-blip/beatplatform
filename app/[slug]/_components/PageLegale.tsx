import Link from 'next/link'
import { lienBoutiqueServeur } from '@/app/[slug]/_lib/lien-boutique-serveur'
import { blocPlateforme } from '@/lib/bloc-plateforme-legal'
import type { TypePageLegale } from '@/lib/pages-legales'

export default async function PageLegale({
  slug,
  nomArtiste,
  titre,
  contenu,
  adopteLe,
  typePage,
}: {
  slug: string
  nomArtiste: string
  titre: string
  contenu: string
  adopteLe?: string | null
  // Page légale d'un type connu : le bloc obligatoire de la plateforme s'affiche dessous (9d lot 4)
  typePage?: TypePageLegale
}) {
  const lien = await lienBoutiqueServeur(slug)
  const bloc = typePage ? blocPlateforme(typePage) : null
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link href={lien()} className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-8">
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

      {bloc && (
        <section className="mt-10 pt-6 border-t border-gray-800 space-y-3">
          <h2 className="text-sm font-bold text-white">{bloc.titre}</h2>
          {bloc.paragraphes.map((p, i) => (
            <p key={i} className="text-gray-400 text-sm leading-relaxed">
              {p.texte}
              {p.lien && (
                <> <a href={p.lien.href} className="underline hover:text-white">{p.lien.libelle}</a>.</>
              )}
            </p>
          ))}
        </section>
      )}
    </div>
  )
}
