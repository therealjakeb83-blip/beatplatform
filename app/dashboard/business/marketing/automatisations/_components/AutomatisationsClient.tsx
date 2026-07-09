'use client'

import { useRef, useState, useTransition } from 'react'
import ChampAvecVariables, { GROUPES_VARIABLES } from '../../_components/ChampAvecVariables'
import type { AutomatisationRow, EvenementFileAttente } from '../page'

type Recette = {
  type: string
  label: string
  description: string
  corpsDefaut: string
  variablesSupplementaires?: { token: string; label: string }[]
}

const RECETTES: Recette[] = [
  {
    type: 'bienvenue_abonnement',
    label: 'Bienvenue abonnement',
    description: "Envoyé le lendemain d'un nouvel abonnement.",
    corpsDefaut: `Yo {{prénom}}, ça va ?
J'ai vu ton abonnement d'hier, merci beaucoup et bienvenue dans l'équipe 💙
Si jamais tu cherches un style en particulier, dis moi et je te prépare une petite sélection perso de beats directement dans ton mood !
Et si t'as besoin d'un MP3 pour maquetter un beat privé, n'hésites pas, je suis là 🦾
À très vite,
Jake`,
  },
  {
    type: 'abonnement_en_attente',
    label: 'Abonnement en attente',
    description: "Envoyé le lendemain d'un renouvellement en échec (pas une annulation).",
    corpsDefaut: `Salut {{prénom}}, ça va ?
Juste pour te prévenir : le renouvellement n'est pas passé ce mois-ci (rien de grave 👌🏼)
Ton abo est en pause — tu as un mois pour le relancer via ton espace client, sinon il sera automatiquement annulé.
Rassure-toi, ça ne bloque pas ta progression vers le prochain beat cadeau (il te reste {{mois_avant_cadeau}} mois)
Si t'as la moindre question, je suis là :)
Jake`,
    variablesSupplementaires: [
      { token: 'mois_avant_cadeau', label: 'Mois avant le beat cadeau' },
    ],
  },
  {
    type: 'churn_message_perso',
    label: 'Churn message perso',
    description: "Envoyé le lendemain de la décision d'annuler (même si l'abonné reste actif jusqu'à la fin de sa période payée) — distinct d'un simple renouvellement en échec.",
    corpsDefaut: `Salut {{prénom}}, ça va ?
J'ai vu que t'avais mis fin à ton abo hier, merci d'avoir tenté l'aventure✨
Si t'as 2 minutes, ça m'aiderait vraiment d'avoir ton ressenti : ce que t'as aimé dans l'expérience, ce qui t'a déçu ou manqué, ton retour est super précieux pour moi 🙏
À très vite,
Jake
PS : Et n'hésite pas à m'envoyer tes prochains morceaux, je suis toujours super chaud d'écouter ;)`,
  },
  {
    type: 'remerciement_1er_achat',
    label: 'Remerciement achat — 1er achat',
    description: "Envoyé le lendemain du tout premier achat de licence d'un client.",
    corpsDefaut: `Salut {{prénom}}, ça va ?
Je viens de voir ton achat d'hier, merci pour la force ça fait plaisir d'avoir un nouvel artiste qui bosse sur mes prods 🙏🏼
N'hésite pas à m'envoyer ce que tu feras sur {{le_beat}}, je te donnerai mon avis avec plaisir !
Et si jamais ça t'intéresse, j'ai aussi quelques prods qui sont pas sur YouTube, je peux t'envoyer 2–3 extraits
À très vite,
Jake`,
    variablesSupplementaires: [
      { token: 'le_beat', label: 'Le beat / Les beats (auto)' },
    ],
  },
]

type Props = {
  automatisations: AutomatisationRow[]
  sauvegarder: (
    type: string, actif: boolean, objet: string, corps: string,
    delaiHeures: number, heureCibleMinutes: number | null,
  ) => Promise<void>
  fileAttente: EvenementFileAttente[]
  executerMaintenant: (evenementId: string) => Promise<void>
}

function minutesVersHeure(m: number): string {
  return `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`
}
function heureVersMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export default function AutomatisationsClient({ automatisations, sauvegarder, fileAttente, executerMaintenant }: Props) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Automatisations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Emails envoyés automatiquement selon l&apos;activité de tes clients — jamais à l&apos;heure exacte de l&apos;événement.
          </p>
        </div>

        {RECETTES.map(recette => (
          <RecetteCard
            key={recette.type}
            recette={recette}
            existante={automatisations.find(a => a.type === recette.type)}
            sauvegarder={sauvegarder}
          />
        ))}

        <FileAttenteTable fileAttente={fileAttente} executerMaintenant={executerMaintenant} />
      </div>
    </div>
  )
}

function fmtEcheance(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function FileAttenteTable({ fileAttente, executerMaintenant }: {
  fileAttente: EvenementFileAttente[]
  executerMaintenant: Props['executerMaintenant']
}) {
  const [enCours, setEnCours] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleExecuter(id: string) {
    setEnCours(id)
    startTransition(async () => {
      await executerMaintenant(id)
      setEnCours(null)
    })
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800">
        <p className="text-sm font-semibold text-white">File d&apos;attente</p>
        <p className="text-xs text-gray-500 mt-0.5">Événements en attente d&apos;envoi. Vérifiée automatiquement chaque jour — ou exécute un envoi maintenant pour tester.</p>
      </div>

      {fileAttente.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-gray-600 text-sm">Aucun événement en attente</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500 font-medium">
              <th className="text-left px-5 py-3">Flux de travail</th>
              <th className="text-left px-5 py-3">Client</th>
              <th className="text-left px-5 py-3">Date d&apos;exécution prévue</th>
              <th className="text-right px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {fileAttente.map(e => (
              <tr key={e.id}>
                <td className="px-5 py-3 text-white">{e.flux}</td>
                <td className="px-5 py-3 text-gray-400">
                  {e.clientNom} <span className="text-gray-600">{e.clientEmail}</span>
                </td>
                <td className="px-5 py-3 text-gray-400">{fmtEcheance(e.echeanceISO)}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => handleExecuter(e.id)}
                    disabled={isPending && enCours === e.id}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 transition-colors"
                  >
                    {isPending && enCours === e.id ? 'Exécution...' : 'Exécuter maintenant'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function RecetteCard({ recette, existante, sauvegarder }: {
  recette: Recette
  existante?: AutomatisationRow
  sauvegarder: Props['sauvegarder']
}) {
  const [depliee, setDepliee]           = useState(false)
  const [actif, setActif]               = useState(existante?.actif ?? false)
  const [objet, setObjet]               = useState(existante?.objet ?? '')
  const [corps, setCorps]               = useState(existante?.corps ?? recette.corpsDefaut)
  const [delaiHeures, setDelaiHeures]   = useState(existante?.delai_heures ?? 10)
  const [heureCibleActive, setHeureCibleActive] = useState(existante ? existante.heure_cible_minutes != null : true)
  const [heureCible, setHeureCible]     = useState(minutesVersHeure(existante?.heure_cible_minutes ?? 615))
  const [enregistrement, setEnregistrement] = useState(false)
  const [enregistre, setEnregistre]     = useState(false)
  const champActifRef = useRef<((token: string) => void) | null>(null)

  function insererVariable(token: string) {
    champActifRef.current?.(token)
  }

  async function handleEnregistrer() {
    setEnregistrement(true)
    await sauvegarder(
      recette.type, actif, objet, corps,
      delaiHeures, heureCibleActive ? heureVersMinutes(heureCible) : null,
    )
    setEnregistrement(false)
    setEnregistre(true)
    setTimeout(() => setEnregistre(false), 2000)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div
        onClick={() => setDepliee(d => !d)}
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform ${depliee ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-white">{recette.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{recette.description}</p>
          </div>
        </div>
        <div
          onClick={e => { e.stopPropagation(); setActif(a => !a) }}
          className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 relative cursor-pointer ${actif ? 'bg-indigo-600' : 'bg-gray-700'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${actif ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
      </div>

      {depliee && (
      <div className="p-5 border-t border-gray-800 grid grid-cols-[1fr_220px] gap-5">
        <div className="space-y-4">
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">Objet</label>
            <ChampAvecVariables
              value={objet}
              onChange={setObjet}
              onFocusChamp={inserer => { champActifRef.current = inserer }}
              placeholder="Ex : Bienvenue dans l'équipe 🎶"
              className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">Corps</label>
            <ChampAvecVariables
              value={corps}
              onChange={setCorps}
              onFocusChamp={inserer => { champActifRef.current = inserer }}
              multiline
              className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-3 text-sm text-white min-h-[180px]"
            />
          </div>

          <div className="flex items-end gap-4">
            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">Délai minimum</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={delaiHeures}
                  onChange={e => setDelaiHeures(Math.max(0, Number(e.target.value)))}
                  className="w-16 bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-2 py-2 text-sm text-white outline-none"
                />
                <span className="text-xs text-gray-500">heures</span>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-[11px] text-gray-500 mb-1">
                <input
                  type="checkbox"
                  checked={heureCibleActive}
                  onChange={e => setHeureCibleActive(e.target.checked)}
                  className="accent-indigo-600"
                />
                Aligner sur une heure fixe
              </label>
              {heureCibleActive ? (
                <input
                  type="time"
                  value={heureCible}
                  onChange={e => setHeureCible(e.target.value)}
                  className="bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-2 py-2 text-sm text-white outline-none"
                />
              ) : (
                <p className="text-[10px] text-amber-500 max-w-[220px]">
                  Mode test : envoi dès le délai passé, à n&apos;importe quelle heure.
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleEnregistrer}
            disabled={enregistrement}
            className="text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold transition-colors"
          >
            {enregistre ? 'Enregistré ✓' : enregistrement ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2">Variables</p>
          <p className="text-[10px] text-gray-700 mb-3">Clique dans un champ, puis clique une variable pour l&apos;insérer.</p>
          {recette.variablesSupplementaires && (
            <div className="mb-3">
              <p className="text-[10px] text-gray-500 mb-1.5">Spécifique à cette recette</p>
              <div className="flex flex-wrap gap-1">
                {recette.variablesSupplementaires.map(v => (
                  <button
                    key={v.token}
                    onClick={() => insererVariable(`{{${v.token}}}`)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {GROUPES_VARIABLES.map(g => (
            <div key={g.groupe} className="mb-3">
              <p className="text-[10px] text-gray-500 mb-1.5">{g.groupe}</p>
              <div className="flex flex-wrap gap-1">
                {g.vars.map(v => (
                  <button
                    key={v.token}
                    onClick={() => insererVariable(`{{${v.token}}}`)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  )
}
