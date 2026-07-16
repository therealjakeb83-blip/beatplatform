import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { calculerEcheance, LABELS_AUTOMATISATION, resoudreJournee, jourParisISO, type TypeAutomatisation, type EvenementAutomatisation } from '@/lib/automatisations'
import { RECETTES, ORDRE_CATEGORIES, slugCategorie } from './_lib/recettes'
import type { AutomatisationRow, EvenementFileAttente } from './_lib/types'
import { executerMaintenant, previsualiser, supprimerEvenement, executerPlusieurs, supprimerPlusieurs, activerToutesLesAutomatisations, sauvegarderSignature } from './_lib/actions'
import FileAttenteTable from './_components/FileAttenteTable'
import ReglagesGlobaux from './_components/ReglagesGlobaux'

export default async function AutomatisationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const [{ data }, { data: beatmaker }] = await Promise.all([
    supabase
      .from('automatisations')
      .select('id, type, actif, objet, corps, delai_heures, heure_cible_minutes, config')
      .eq('beatmaker_id', user.id),
    supabase
      .from('beatmakers')
      .select('nom_artiste, signature_emails')
      .eq('id', user.id)
      .single(),
  ])

  const automatisations = (data ?? []) as AutomatisationRow[]

  const admin = createAdminClient()
  const { data: evenementsRaw } = await admin
    .from('automatisation_evenements')
    .select('id, beatmaker_id, client_id, type, reference_id, created_at, clients(prenom, nom, email)')
    .eq('beatmaker_id', user.id)
    .eq('traite', false)
    .order('created_at', { ascending: false })

  type EvenementRaw = EvenementAutomatisation & {
    clients: { prenom: string | null; nom: string; email: string } | null
  }

  const configParType = new Map(automatisations.map(a => [a.type as TypeAutomatisation, a]))

  // Regroupée par (client, jour calendaire Paris) — reflète ce qui sera
  // réellement envoyé (combo/dominant/silence), pas les événements bruts un
  // par un (docs/automatisations/combinaisons-5.7.md) : demandé par Jake
  // après avoir vu 2 lignes pour ce qui n'allait produire qu'1 seul mail.
  const groupes = new Map<string, EvenementRaw[]>()
  for (const e of ((evenementsRaw ?? []) as unknown as EvenementRaw[])) {
    const cle = `${e.client_id}:${jourParisISO(e.created_at)}`
    const arr = groupes.get(cle) ?? []
    arr.push(e)
    groupes.set(cle, arr)
  }

  const fileAttente: EvenementFileAttente[] = [...groupes.values()].map(groupe => {
    const premier = groupe[0]
    const clientNom = [premier.clients?.prenom, premier.clients?.nom].filter(Boolean).join(' ') || '—'
    const clientEmail = premier.clients?.email ?? '—'

    const actifs = groupe.filter(e => configParType.get(e.type)?.actif)
    if (actifs.length === 0) {
      // Aucune recette active concernée par ce groupe — rien ne sera envoyé,
      // affiché tel quel plutôt que caché (le beatmaker doit comprendre
      // pourquoi rien ne part).
      return {
        id: premier.id,
        flux: groupe.length === 1 ? (LABELS_AUTOMATISATION[premier.type] ?? premier.type) : `${groupe.length} événements (recette${groupe.length > 1 ? 's' : ''} inactive${groupe.length > 1 ? 's' : ''})`,
        clientNom, clientEmail, echeanceISO: null,
      }
    }

    const resolution = resoudreJournee(actifs)
    if (resolution.kind === 'rien') {
      return { id: premier.id, flux: 'Aucun envoi (annulé par un autre événement du même jour)', clientNom, clientEmail, echeanceISO: null }
    }

    const configResolu = configParType.get(resolution.typeTemplate)
    const comboNonConfiguree = resolution.repliCombo && (!configResolu?.actif || !configResolu.objet || !configResolu.corps)
    const resiliationRapideNonConfiguree = resolution.typeTemplate === 'combo_abo_resilie_rapidement'
      && (!configResolu?.actif || !configResolu.objet || !configResolu.corps)

    const flux = comboNonConfiguree && resolution.repliCombo
      ? `${LABELS_AUTOMATISATION[resolution.repliCombo.achat[0].type]} seul (combo non configurée — bienvenue abo silencieuse)`
      : resiliationRapideNonConfiguree
      ? 'Aucun envoi (combo "Abo résilié rapidement" non configurée — silence par défaut)'
      : LABELS_AUTOMATISATION[resolution.typeTemplate] ?? resolution.typeTemplate

    // Échéance affichée = la plus tardive des événements concernés (le mail
    // combiné ne peut pas partir avant que tous soient prêts).
    const echeances = resolution.evenementsSources
      .map(e => {
        const c = configParType.get(e.type)
        return c ? calculerEcheance(e.created_at, c.delai_heures, c.heure_cible_minutes) : null
      })
      .filter((d): d is Date => d !== null)
    const echeanceISO = echeances.length > 0 ? new Date(Math.max(...echeances.map(d => d.getTime()))).toISOString() : null

    return { id: premier.id, flux, clientNom, clientEmail, echeanceISO }
  })

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Automatisations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Emails envoyés automatiquement selon l&apos;activité de tes clients — jamais à l&apos;heure exacte de l&apos;événement.
          </p>
        </div>

        <ReglagesGlobaux
          signatureActuelle={beatmaker?.signature_emails ?? null}
          nomArtiste={beatmaker?.nom_artiste ?? ''}
          activerToutesLesAutomatisations={activerToutesLesAutomatisations}
          sauvegarderSignature={sauvegarderSignature}
        />

        <div className="space-y-3">
          {ORDRE_CATEGORIES.map(categorie => {
            const recettesCategorie = RECETTES.filter(r => r.categorie === categorie)
            if (recettesCategorie.length === 0) return null
            const nbActives = recettesCategorie.filter(r => automatisations.find(a => a.type === r.type)?.actif).length

            return (
              <Link
                key={categorie}
                href={`/dashboard/business/marketing/automatisations/${slugCategorie(categorie)}`}
                className="flex items-center gap-3 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl px-5 py-4 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{categorie}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {recettesCategorie.length} recette{recettesCategorie.length > 1 ? 's' : ''}
                    {nbActives > 0 && ` · ${nbActives} active${nbActives > 1 ? 's' : ''}`}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )
          })}
        </div>

        <FileAttenteTable
          fileAttente={fileAttente}
          executerMaintenant={executerMaintenant}
          previsualiser={previsualiser}
          supprimerEvenement={supprimerEvenement}
          executerPlusieurs={executerPlusieurs}
          supprimerPlusieurs={supprimerPlusieurs}
        />
      </div>
    </div>
  )
}
