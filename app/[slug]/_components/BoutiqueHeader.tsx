import Link from 'next/link'

type BoutiqueHeaderProps = {
  nomArtiste: string
  tagline: string | null
  logoUrl: string | null
  instagramUrl: string | null
  youtubeUrl: string | null
  tiktokUrl: string | null
  nbBeats: number
  slug: string
  clientUser: { prenom: string; nom: string } | null
}

export default function BoutiqueHeader({
  nomArtiste,
  tagline,
  logoUrl,
  instagramUrl,
  youtubeUrl,
  tiktokUrl,
  nbBeats,
  slug,
  clientUser,
}: BoutiqueHeaderProps) {
  return (
    <header className="border-b border-gray-800 bg-gray-950">
      {/* Barre de nav artiste */}
      <div className="max-w-5xl mx-auto px-6 pt-4 flex justify-end">
        {clientUser ? (
          <Link
            href="/mon-compte"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
              {clientUser.prenom.slice(0, 1).toUpperCase()}
            </div>
            <span>Mon compte</span>
          </Link>
        ) : (
          <Link
            href={`/artiste/connexion?redirect=/${slug}`}
            className="text-sm text-gray-500 hover:text-indigo-400 transition-colors"
          >
            Se connecter
          </Link>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
          {/* Logo / initiales */}
          <div className="w-20 h-20 rounded-2xl bg-gray-800 flex-shrink-0 overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt={nomArtiste} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-black text-gray-400">
                {nomArtiste.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl font-black text-white">{nomArtiste}</h1>
            {tagline && (
              <p className="text-gray-400 mt-1 text-base">{tagline}</p>
            )}
            <p className="text-gray-600 text-sm mt-2">
              {nbBeats} beat{nbBeats !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Réseaux sociaux */}
          {(instagramUrl || youtubeUrl || tiktokUrl) && (
            <div className="flex gap-3">
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors text-sm font-bold"
                  aria-label="Instagram"
                >
                  IG
                </a>
              )}
              {youtubeUrl && (
                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors text-sm font-bold"
                  aria-label="YouTube"
                >
                  YT
                </a>
              )}
              {tiktokUrl && (
                <a
                  href={tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors text-sm font-bold"
                  aria-label="TikTok"
                >
                  TK
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
