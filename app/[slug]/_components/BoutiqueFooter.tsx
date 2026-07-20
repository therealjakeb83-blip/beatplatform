import Link from 'next/link'
import NewsletterForm from './NewsletterForm'

export default function BoutiqueFooter({
  slug,
  nomArtiste,
  instagramUrl,
  youtubeUrl,
  tiktokUrl,
}: {
  slug: string
  nomArtiste: string
  instagramUrl: string | null
  youtubeUrl: string | null
  tiktokUrl: string | null
}) {
  return (
    <footer className="border-t border-gray-800 bg-black mt-14">
      <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">Beats</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href={`/${slug}/beats`} className="text-gray-400 hover:text-white transition-colors">Nouveautés</Link></li>
            <li><Link href={`/${slug}/selection`} className="text-gray-400 hover:text-white transition-colors">Sélection</Link></li>
            <li><Link href={`/${slug}/membres`} className="text-gray-400 hover:text-white transition-colors">Réservés aux membres</Link></li>
            <li><Link href={`/${slug}#parcourir-styles`} className="text-gray-400 hover:text-white transition-colors">Styles</Link></li>
            <li><Link href={`/${slug}#parcourir-type-beat`} className="text-gray-400 hover:text-white transition-colors">Type beats</Link></li>
            <li><Link href={`/${slug}#parcourir-instruments`} className="text-gray-400 hover:text-white transition-colors">Instruments</Link></li>
            <li><Link href={`/${slug}#parcourir-ambiances`} className="text-gray-400 hover:text-white transition-colors">Ambiances</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">Compte</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href={`/${slug}/abonnement`} className="text-gray-400 hover:text-white transition-colors">Devenir membre</Link></li>
            <li><Link href={`/${slug}/mon-compte`} className="text-gray-400 hover:text-white transition-colors">Mon compte</Link></li>
            <li><Link href={`/${slug}/mon-compte/favoris`} className="text-gray-400 hover:text-white transition-colors">Favoris</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">Légal</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href={`/${slug}/mentions-legales`} className="text-gray-400 hover:text-white transition-colors">Mentions légales</Link></li>
            <li><Link href={`/${slug}/cgv`} className="text-gray-400 hover:text-white transition-colors">CGV</Link></li>
            <li><Link href={`/${slug}/confidentialite`} className="text-gray-400 hover:text-white transition-colors">Confidentialité</Link></li>
          </ul>
          {(instagramUrl || youtubeUrl || tiktokUrl) && (
            <div className="flex gap-2 mt-4">
              {instagramUrl && (
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors text-xs font-bold">IG</a>
              )}
              {youtubeUrl && (
                <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors text-xs font-bold">YT</a>
              )}
              {tiktokUrl && (
                <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors text-xs font-bold">TK</a>
              )}
            </div>
          )}
        </div>

        <div className="col-span-2 sm:col-span-1">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">Newsletter</h3>
          <NewsletterForm slug={slug} />
        </div>
      </div>

      <div className="border-t border-gray-900">
        <div className="max-w-5xl mx-auto px-6 py-5 text-xs text-gray-600">
          © {new Date().getFullYear()} {nomArtiste}
        </div>
      </div>
    </footer>
  )
}
