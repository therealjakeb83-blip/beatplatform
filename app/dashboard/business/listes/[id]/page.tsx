import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type ListeContact = {
  id: string
  label: string
  nom: string
  email: string
  pays: string | null
  statut: 'abonne' | 'ancien' | 'client' | 'lead'
  ltv: number
  dernier_achat_iso: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initiales(label: string, nom: string): string {
  return `${label[0] ?? ''}${nom[0] ?? ''}`.toUpperCase() || '?'
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmt(euros: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(euros)
}

const STATUT_LABEL: Record<ListeContact['statut'], string> = {
  abonne: 'Abonné',
  ancien: 'Ancien abonné',
  client: 'Client',
  lead:   'Lead',
}

const STATUT_CLS: Record<ListeContact['statut'], string> = {
  abonne: 'text-indigo-400',
  ancien: 'text-gray-500',
  client: 'text-green-400',
  lead:   'text-gray-400',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ListeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: listeId } = await params
  const supabase = await createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')
  const beatmakerId = user.id

  const { data: liste } = await supabase
    .from('listes_crm')
    .select('id, nom, description')
    .eq('id', listeId)
    .eq('beatmaker_id', beatmakerId)
    .single()

  if (!liste) notFound()

  const { data: membres } = await supabase
    .from('listes_crm_contacts')
    .select('client_id')
    .eq('liste_id', listeId)

  const clientIds = (membres ?? []).map(m => m.client_id)

  // ── En-tête commun ──────────────────────────────────────────────────────────

  const header = (
    <div className="px-6 py-4 border-b border-gray-800 flex-shrink-0">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
        <Link href="/dashboard/business/listes" className="hover:text-white transition-colors">
          Listes
        </Link>
        <span className="text-gray-700">›</span>
        <span className="text-white">{liste.nom}</span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white">{liste.nom}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {liste.description && <>{liste.description} · </>}
            <span className="text-gray-400">
              {clientIds.length} contact{clientIds.length !== 1 ? 's' : ''}
            </span>
          </p>
        </div>
        <button
          disabled
          title="Disponible dans le sprint Marketing"
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-xl text-sm font-semibold text-gray-500 cursor-not-allowed"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M1.75 2A1.75 1.75 0 0 0 0 3.75v.736a.75.75 0 0 0 .579.731A39.4 39.4 0 0 1 8 6.5a39.4 39.4 0 0 1 7.421-1.283.75.75 0 0 0 .579-.731V3.75A1.75 1.75 0 0 0 14.25 2h-12.5Z" />
            <path d="M.003 10.563A.75.75 0 0 0 1 11.25v1A1.75 1.75 0 0 0 2.75 14h10.5A1.75 1.75 0 0 0 15 12.25v-1a.75.75 0 0 0 .997-.687A41 41 0 0 0 8 8a41 41 0 0 0-7.997 2.563Z" />
          </svg>
          Lancer une campagne
        </button>
      </div>
    </div>
  )

  // ── Liste vide ──────────────────────────────────────────────────────────────

  if (clientIds.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {header}
        <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
          <p className="text-gray-500 text-sm mb-1">Aucun contact dans cette liste</p>
          <p className="text-gray-700 text-xs">
            Ajoute des contacts depuis leur fiche individuelle
          </p>
        </div>
      </div>
    )
  }

  // ── Données contacts ────────────────────────────────────────────────────────

  const [clientsRes, commandesRes, abosRes] = await Promise.all([
    admin
      .from('clients')
      .select('id, prenom, nom, email, pays, surnom, nom_artiste')
      .in('id', clientIds),
    supabase
      .from('commandes')
      .select('client_id, prix_paye, type_commande, statut, created_at')
      .eq('beatmaker_id', beatmakerId)
      .in('client_id', clientIds)
      .not('client_id', 'is', null),
    supabase
      .from('abonnements_boutique')
      .select('client_id, statut')
      .eq('beatmaker_id', beatmakerId)
      .in('client_id', clientIds)
      .not('client_id', 'is', null),
  ])

  const clients   = clientsRes.data   ?? []
  const commandes = commandesRes.data ?? []
  const abos      = abosRes.data      ?? []

  // Maps
  const aboParClient = new Map<string, string>()
  for (const abo of abos) {
    if (!aboParClient.has(abo.client_id as string)) {
      aboParClient.set(abo.client_id as string, abo.statut)
    }
  }

  const cmdsParClient = new Map<string, typeof commandes>()
  for (const cmd of commandes) {
    const id  = cmd.client_id as string
    const arr = cmdsParClient.get(id) ?? []
    arr.push(cmd)
    cmdsParClient.set(id, arr)
  }

  // Build contacts list
  const contacts: ListeContact[] = clients.map(c => {
    const raw = c as Record<string, unknown>
    const cmds = cmdsParClient.get(c.id) ?? []

    const payees    = cmds.filter(cmd => cmd.statut === 'payee')
    const ltv       = payees.reduce((s, cmd) => s + (cmd.prix_paye ?? 0), 0)
    const licences  = cmds.filter(cmd => cmd.type_commande === 'LICENCE')
    const dernierAchat = licences.length
      ? new Date(Math.max(...licences.map(cmd => new Date(cmd.created_at).getTime()))).toISOString()
      : null

    const aboStatut = aboParClient.get(c.id)
    let statut: ListeContact['statut']
    if (aboStatut === 'actif' || aboStatut === 'impaye') statut = 'abonne'
    else if (aboStatut === 'annule')                     statut = 'ancien'
    else if (licences.length > 0)                        statut = 'client'
    else                                                 statut = 'lead'

    const label = (raw.surnom as string | null)
      ?? (raw.nom_artiste as string | null)
      ?? c.prenom
      ?? ''

    return {
      id:                c.id,
      label,
      nom:               c.nom ?? '',
      email:             c.email ?? '',
      pays:              c.pays ?? null,
      statut,
      ltv,
      dernier_achat_iso: dernierAchat,
    }
  })

  contacts.sort((a, b) => b.ltv - a.ltv)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {header}

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Contact
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Statut
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Dernier achat
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                LTV
              </th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <tr
                key={c.id}
                className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40 transition-colors"
              >
                {/* Contact */}
                <td className="px-6 py-3">
                  <Link href={`/dashboard/business/contacts/${c.id}`} className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0">
                      {c.pays
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={`https://flagcdn.com/w40/${c.pays.toLowerCase()}.png`} alt={c.pays} className="w-full h-full object-cover" />
                        : <span className="text-indigo-300 font-bold text-xs">{initiales(c.label, c.nom)}</span>
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white group-hover:text-indigo-300 transition-colors text-xs">
                        {c.label} {c.nom}
                      </p>
                      <p className="text-[10px] text-gray-600 truncate">{c.email}</p>
                    </div>
                  </Link>
                </td>

                {/* Statut */}
                <td className="px-6 py-3 text-xs">
                  <span className={STATUT_CLS[c.statut]}>{STATUT_LABEL[c.statut]}</span>
                </td>

                {/* Dernier achat */}
                <td className="px-6 py-3 text-right text-xs text-gray-400 whitespace-nowrap">
                  {c.dernier_achat_iso
                    ? formatDate(c.dernier_achat_iso)
                    : <span className="text-gray-700">—</span>
                  }
                </td>

                {/* LTV */}
                <td className="px-6 py-3 text-right text-white font-semibold text-xs whitespace-nowrap">
                  {fmt(c.ltv)}
                </td>

                {/* Lien fiche */}
                <td className="px-3 py-3 text-center">
                  <Link
                    href={`/dashboard/business/contacts/${c.id}`}
                    className="text-gray-600 hover:text-indigo-400 transition-colors"
                  >
                    →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
