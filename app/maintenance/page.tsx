import type { Metadata } from 'next'
import { NOM_PLATEFORME } from '@/lib/constantes'
import { retourSur } from '@/lib/maintenance'

export const metadata: Metadata = {
  title: `${NOM_PLATEFORME} — Bientôt disponible`,
  robots: { index: false, follow: false },
}

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erreur?: string }>
}) {
  const { next, erreur } = await searchParams
  const retour = retourSur(next)

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-xl font-bold tracking-tight mb-10">{NOM_PLATEFORME}</p>
        <h1 className="text-3xl font-bold mb-3">Bientôt disponible</h1>
        <p className="text-zinc-400">La plateforme des beatmakers arrive très vite.</p>
      </div>

      <details open={!!erreur} className="mt-24 w-full max-w-xs text-center">
        <summary className="list-none cursor-pointer text-xs text-zinc-700 hover:text-zinc-500 select-none">
          Accès privé
        </summary>
        <form action="/api/maintenance/acces" method="POST" className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="next" value={retour} />
          <input
            type="password"
            name="mot_de_passe"
            required
            autoFocus={!!erreur}
            autoComplete="current-password"
            placeholder="Mot de passe"
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          {erreur && <p className="text-xs text-red-400">Mot de passe incorrect.</p>}
          <button
            type="submit"
            className="bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium py-3 rounded-xl transition-colors"
          >
            Entrer
          </button>
        </form>
      </details>
    </main>
  )
}
