import Link from 'next/link'
import { getAnalyticsPlateforme } from '@/lib/admin-analytics'
import { NOM_PLATEFORME } from '@/lib/constantes'

function fmtEuro(euros: number): string {
  return euros.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function Carte({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-lg font-bold mt-1" style={{ color: color ?? '#fff' }}>{value}</p>
      {sub && <p className="text-[11px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

function Bloc({ titre, description, children }: { titre: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-white">{titre}</h2>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export default async function AdminAnalyticsPage() {
  const data = await getAnalyticsPlateforme()

  return (
    <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-10">
      <div>
        <h1 className="text-xl font-bold text-white">Analytics plateforme</h1>
        <p className="text-sm text-gray-500 mt-0.5">Vue d&apos;ensemble {NOM_PLATEFORME} — ton revenu réel, la santé du business des boutiques, et l&apos;état technique de la plateforme.</p>
      </div>

      <Bloc titre="Ton revenu réel" description="Ce que les beatmakers te paient (abonnements_plateforme) — le seul argent qui est vraiment le tien.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Carte label="MRR" value={fmtEuro(data.revenu.mrr)} color="#4ade80" sub="Récurrent mensuel normalisé" />
          <Carte label="ARR" value={fmtEuro(data.revenu.arr)} color="#4ade80" sub="MRR × 12" />
          <Carte label="Abonnés actifs" value={String(data.revenu.nbActifs)} />
          <Carte label="En essai" value={String(data.revenu.nbEnEssai)} />
          <Carte label="Annulés" value={String(data.revenu.nbAnnules)} color="#f87171" />
          <Carte label="Impayés" value={String(data.revenu.nbImpayes)} color="#f87171" />
        </div>
      </Bloc>

      <Bloc titre="Volume d'affaires boutiques" description="CA net (HT) cumulé de toutes les boutiques — un signal de santé du business de tes beatmakers, pas ton revenu (0% de commission, voir décisions Stripe).">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Carte label="CA net total (tout historique)" value={fmtEuro(data.volumeAffaires.caNetTotal)} color="#22d3ee" />
          <Carte label="CA net — 30 derniers jours" value={fmtEuro(data.volumeAffaires.caNet30j)} color="#22d3ee" />
          <Carte label="Commandes (tout historique)" value={String(data.volumeAffaires.nbCommandesTotal)} />
        </div>
      </Bloc>

      <Bloc titre="Croissance">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Carte label="Boutiques actives" value={String(data.croissance.boutiquesActives)} />
          <Carte label="Nouveaux beatmakers — 7j" value={String(data.croissance.nouveauxBeatmakers7j)} color="#4ade80" />
          <Carte label="Nouveaux beatmakers — 30j" value={String(data.croissance.nouveauxBeatmakers30j)} color="#4ade80" />
          <Carte label="Churn plateforme — 30j" value={String(data.croissance.churn30j)} color="#f87171" sub="Résiliations abonnement plateforme" />
        </div>
      </Bloc>

      <Bloc titre="Classement des boutiques" description="Top 10 par CA net (HT), tout historique.">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {data.classement.length === 0 && <p className="px-4 py-6 text-sm text-gray-600 text-center">Aucune commande enregistrée.</p>}
          {data.classement.length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-[10px] uppercase">
                  <th className="text-left px-4 py-2">#</th>
                  <th className="text-left px-4 py-2">Boutique</th>
                  <th className="text-right px-4 py-2">CA net (HT)</th>
                  <th className="text-right px-4 py-2">Commandes</th>
                </tr>
              </thead>
              <tbody>
                {data.classement.map((b, i) => (
                  <tr key={b.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-gray-500">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/dashboard/admin/boutiques/${b.id}`} className="text-white hover:underline">
                        {b.nomArtiste} <span className="text-gray-600">({b.slug})</span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right text-cyan-400 font-medium">{fmtEuro(b.caNet)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-400">{b.nbCommandes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Bloc>

      <Bloc titre="Santé technique" description="Juste un signal d'alerte — le détail nominatif des emails envoyés par les boutiques n'est volontairement pas exposé ici (voir décision 2026-07-27 : redondant avec les logs de chaque beatmaker, et plus d'exposition que nécessaire sur les données de leurs clients).">
        <div className="grid grid-cols-2 gap-3">
          <Carte label="Échecs email — 7 derniers jours" value={String(data.santeTechnique.echecsEmail7j)} color={data.santeTechnique.echecsEmail7j > 0 ? '#f87171' : '#4ade80'} />
          <Link href="/dashboard/admin/stripe-events?filtre=echoue">
            <Carte label="Échecs webhook — 7 derniers jours" value={String(data.santeTechnique.echecsWebhook7j)} color={data.santeTechnique.echecsWebhook7j > 0 ? '#f87171' : '#4ade80'} sub="Voir Log Stripe →" />
          </Link>
        </div>
      </Bloc>

      <Bloc titre="Tendances catalogue">
        <div className="grid grid-cols-2 gap-3">
          <Carte label="Beats sur la plateforme" value={String(data.catalogue.totalBeats)} />
          <Carte label="Nouveaux beats — 30j" value={String(data.catalogue.nouveauxBeats30j)} color="#4ade80" />
        </div>
      </Bloc>
    </div>
  )
}
