import Link from 'next/link'

// Mène à la page de paiement, la même que pour les licences, avec
// l'abonnement comme seul article — jamais d'ajout au panier (décision D1,
// 2026-10-01). Le paiement se fait directement sur le compte du beatmaker.
export default function SAbonnerButton({
  slug,
  prixAffiche,
}: {
  slug: string
  prixAffiche: string | null
}) {
  return (
    <Link
      href={`/paiement/${slug}?abonnement=1`}
      className="block w-full py-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-colors text-lg text-center shadow-[0_6px_20px_-4px_rgba(0,41,255,0.5)]"
    >
      {prixAffiche ? `S'abonner pour ${prixAffiche}€/mois` : `S'abonner`}
    </Link>
  )
}
