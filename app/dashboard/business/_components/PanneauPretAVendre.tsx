import Link from 'next/link'
import type { ResultatPretAVendre } from '@/lib/pret-a-vendre'

// Panneau « Ce qu'il te manque pour vendre » (Phase 12 lot 2, T7-T9) —
// disparaît une fois tous les critères au vert. Chaque ligne manquante
// renvoie directement vers la bonne page de réglage.
export default function PanneauPretAVendre({ resultat }: { resultat: ResultatPretAVendre }) {
  if (resultat.pret) return null

  const manquants = resultat.criteres.filter(c => !c.ok)

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 mb-8">
      <h2 className="text-amber-400 font-bold text-lg mb-1">Ce qu&apos;il te manque pour vendre</h2>
      <p className="text-amber-200/70 text-sm mb-4">
        Ta boutique reste visible, mais tant que ces points ne sont pas réglés, tes acheteurs verront une erreur au moment de payer.
      </p>
      <ul className="flex flex-col gap-2">
        {manquants.map(critere => (
          <li key={critere.cle}>
            <Link
              href={critere.lienReglage}
              className="flex items-center gap-2 text-sm text-amber-200 hover:text-white transition-colors"
            >
              <span className="w-4 h-4 rounded-full border border-amber-400 flex-shrink-0" />
              {critere.libelle}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
