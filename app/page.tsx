import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-zinc-800">
        <span className="text-xl font-bold tracking-tight">My Producer</span>
        <span className="text-sm text-zinc-500">La plateforme des beatmakers</span>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Bienvenue sur My Producer
          </h1>
          <p className="text-zinc-400 text-lg max-w-md mx-auto">
            Boutique, paiements, splits, abonnements — tout ce dont un beatmaker a besoin pour vendre ses instrus.
          </p>
        </div>

        {/* Two cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">

          {/* Beatmaker */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col gap-6">
            <div>
              <div className="text-2xl mb-3">🎹</div>
              <h2 className="text-xl font-semibold mb-2">Tu es beatmaker</h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Crée ta boutique en ligne, vends tes beats avec licences automatiques, gère tes collabs et tes abonnés.
              </p>
            </div>
            <div className="flex flex-col gap-3 mt-auto">
              <Link
                href="/inscription"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-center font-medium py-3 px-6 rounded-xl transition-colors"
              >
                Créer mon compte
              </Link>
              <Link
                href="/connexion"
                className="text-center text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Déjà inscrit ? Se connecter →
              </Link>
            </div>
          </div>

          {/* Artiste */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col gap-6">
            <div>
              <div className="text-2xl mb-3">🎵</div>
              <h2 className="text-xl font-semibold mb-2">Tu es artiste</h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Achète des licences, accède aux beats de tes producteurs préférés, gère tes abonnements et téléchargements.
              </p>
            </div>
            <div className="flex flex-col gap-3 mt-auto">
              <Link
                href="/artiste/connexion"
                className="bg-zinc-700 hover:bg-zinc-600 text-white text-center font-medium py-3 px-6 rounded-xl transition-colors"
              >
                Se connecter
              </Link>
              <Link
                href="/artiste/inscription"
                className="text-center text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Pas encore de compte ? S'inscrire →
              </Link>
            </div>
          </div>
        </div>

        {/* Demo link */}
        <p className="mt-12 text-sm text-zinc-600">
          Curieux de voir à quoi ressemble une boutique ?{" "}
          <Link href="/jakeb-test" className="text-zinc-400 hover:text-white underline transition-colors">
            Voir la boutique démo →
          </Link>
        </p>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-zinc-700 border-t border-zinc-900">
        My Producer — Propulsé par Stripe · Supabase · Vercel
      </footer>
    </div>
  );
}
