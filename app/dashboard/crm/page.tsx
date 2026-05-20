import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

type ClientCRM = {
  id: string | null
  email: string
  nom: string
  nb_achats: number
  ca_total: number
  abonnement_actif: boolean
  date_premier_contact: string
}

function initiales(nom: string) {
  return nom.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?'
}

export default async function CRMPage({
  searchParams,
}: {
  searchParams: Promise<{ recherche?: string; filtre?: string }>
}) {
  const params = await searchParams
  const recherche = params.recherche?.toLowerCase() ?? ''
  const filtre = params.filtre ?? 'tous'

  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const [{ data: commandes }, { data: abonnements }] = await Promise.all([
    supabase
      .from('commandes')
      .select('client_id, acheteur_email, acheteur_nom, prix_paye, statut, created_at')
      .eq('beatmaker_id', user.id),
    supabase
      .from('abonnements_boutique')
      .select('client_id, acheteur_email, acheteur_nom, statut, created_at')
      .eq('beatmaker_id', user.id),
  ])

  const clientIds = [...new Set([
    ...(commandes ?? []).filter(c => c.client_id).map(c => c.client_id as string),
    ...(abonnements ?? []).filter(a => a.client_id).map(a => a.client_id as string),
  ])]

  const { data: clientsData } = clientIds.length > 0
    ? await admin.from('clients').select('id, email, nom, prenom').in('id', clientIds)
    : { data: [] }

  const clientsById = new Map((clientsData ?? []).map(c => [c.id, c]))

  function getEmail(clientId: string | null, fallback: string | null) {
    if (clientId) return clientsById.get(clientId)?.email ?? fallback ?? ''
    return fallback ?? ''
  }

  function getNom(clientId: string | null, fallback: string | null) {
    if (clientId) {
      const c = clientsById.get(clientId)
      if (c) return `${c.prenom ?? ''} ${c.nom ?? ''}`.trim()
    }
    return fallback ?? ''
  }

  const crmMap = new Map<string, ClientCRM>()

  function upsert(email: string, id: string | null, nom: string, date: string) {
    if (!email) return
    if (!crmMap.has(email)) {
      crmMap.set(email, { id, email, nom: nom || email, nb_achats: 0, ca_total: 0, abonnement_actif: false, date_premier_contact: date })
    } else {
      const entry = crmMap.get(email)!
      if (!entry.id && id) entry.id = id
      if ((!entry.nom || entry.nom === email) && nom) entry.nom = nom
      if (date < entry.date_premier_contact) entry.date_premier_contact = date
    }
  }

  for (const cmd of commandes ?? []) {
    const email = getEmail(cmd.client_id, cmd.acheteur_email)
    const nom = getNom(cmd.client_id, cmd.acheteur_nom)
    if (!email) continue
    upsert(email, cmd.client_id, nom, cmd.created_at)
    const entry = crmMap.get(email)!
    if (cmd.statut === 'payee') {
      entry.nb_achats++
      entry.ca_total += cmd.prix_paye
    }
  }

  for (const abo of abonnements ?? []) {
    const email = getEmail(abo.client_id, abo.acheteur_email)
    const nom = getNom(abo.client_id, abo.acheteur_nom)
    if (!email) continue
    upsert(email, abo.client_id, nom, abo.created_at)
    if (abo.statut === 'actif') crmMap.get(email)!.abonnement_actif = true
  }

  const tous = Array.from(crmMap.values())
    .sort((a, b) => new Date(b.date_premier_contact).getTime() - new Date(a.date_premier_contact).getTime())

  const stats = {
    total: tous.length,
    acheteurs: tous.filter(c => c.nb_achats > 0).length,
    abonnes: tous.filter(c => c.abonnement_actif).length,
    ca: tous.reduce((s, c) => s + c.ca_total, 0),
  }

  let clients = tous
  if (recherche) clients = clients.filter(c => c.nom.toLowerCase().includes(recherche) || c.email.toLowerCase().includes(recherche))
  if (filtre === 'acheteurs') clients = clients.filter(c => c.nb_achats > 0)
  if (filtre === 'abonnes') clients = clients.filter(c => c.abonnement_actif)
  if (filtre === 'leads') clients = clients.filter(c => c.nb_achats === 0 && !c.abonnement_actif)

  const FILTRES = [
    { key: 'tous', label: 'Tous' },
    { key: 'acheteurs', label: 'Acheteurs' },
    { key: 'abonnes', label: 'Abonnés' },
    { key: 'leads', label: 'Leads' },
  ]

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-300 mb-2 block">← Dashboard</Link>
            <h1 className="text-2xl font-bold">Mon CRM</h1>
          </div>
          <Link
            href="/dashboard/crm/doublons"
            className="text-sm px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
          >
            Doublons
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Clients', value: stats.total },
            { label: 'Acheteurs', value: stats.acheteurs },
            { label: 'Abonnés actifs', value: stats.abonnes },
            { label: 'CA total', value: `${stats.ca} €` },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs mb-1">{s.label}</p>
              <p className="text-2xl font-black text-white">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search + filtres */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <form className="flex-1">
            {filtre !== 'tous' && <input type="hidden" name="filtre" value={filtre} />}
            <input
              type="text"
              name="recherche"
              defaultValue={recherche}
              placeholder="Rechercher par nom ou email…"
              className="w-full px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
            />
          </form>
          <div className="flex gap-2">
            {FILTRES.map(f => (
              <Link
                key={f.key}
                href={`/dashboard/crm?filtre=${f.key}${recherche ? `&recherche=${encodeURIComponent(recherche)}` : ''}`}
                className={`px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                  filtre === f.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Liste */}
        {clients.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-lg mb-2">
              {recherche ? 'Aucun résultat pour cette recherche.' : 'Aucun client pour l\'instant.'}
            </p>
            {!recherche && (
              <p className="text-sm text-gray-700">
                Tes clients apparaîtront ici après leurs premiers achats ou abonnements.
              </p>
            )}
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {clients.map((c, i) => (
              <div
                key={c.email}
                className={`flex items-center gap-4 px-5 py-4 ${
                  i < clients.length - 1 ? 'border-b border-gray-800' : ''
                } ${c.id ? 'hover:bg-gray-800/40 transition-colors' : ''}`}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-indigo-900/60 flex items-center justify-center text-indigo-300 font-bold text-sm flex-shrink-0">
                  {initiales(c.nom)}
                </div>

                {/* Nom + email */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{c.nom !== c.email ? c.nom : '—'}</p>
                  <p className="text-xs text-gray-500 truncate">{c.email}</p>
                </div>

                {/* Achats */}
                <div className="text-right w-16 hidden sm:block">
                  <p className="font-semibold text-white">{c.nb_achats}</p>
                  <p className="text-xs text-gray-600">achat{c.nb_achats > 1 ? 's' : ''}</p>
                </div>

                {/* CA */}
                <div className="text-right w-20 hidden sm:block">
                  <p className="font-semibold text-white">{c.ca_total} €</p>
                  <p className="text-xs text-gray-600">CA</p>
                </div>

                {/* Badge abonné */}
                <div className="w-20 flex justify-center">
                  {c.abonnement_actif && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 font-medium whitespace-nowrap">
                      Abonné
                    </span>
                  )}
                </div>

                {/* Date */}
                <div className="text-right w-24 hidden md:block">
                  <p className="text-xs text-gray-500">
                    {new Date(c.date_premier_contact).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>

                {/* Lien fiche */}
                {c.id ? (
                  <Link
                    href={`/dashboard/crm/${c.id}`}
                    className="text-gray-600 hover:text-indigo-400 transition-colors text-lg flex-shrink-0"
                    title="Voir la fiche"
                  >
                    →
                  </Link>
                ) : (
                  <div className="w-5 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
