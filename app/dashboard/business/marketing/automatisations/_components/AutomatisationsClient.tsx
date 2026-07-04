'use client'

import { useRef, useState } from 'react'
import ChampAvecVariables, { GROUPES_VARIABLES } from '../../_components/ChampAvecVariables'
import type { AutomatisationRow } from '../page'

type Recette = { type: string; label: string; description: string; corpsDefaut: string }

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
]

type Props = {
  automatisations: AutomatisationRow[]
  sauvegarder: (type: string, actif: boolean, objet: string, corps: string, delaiMinutes: number) => Promise<void>
}

const DELAIS = [
  { valeur: 1,    label: '1 minute (test)' },
  { valeur: 60,   label: '1 heure (test)' },
  { valeur: 1440, label: '1 jour (recommandé)' },
  { valeur: 2880, label: '2 jours' },
]

export default function AutomatisationsClient({ automatisations, sauvegarder }: Props) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Automatisations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Emails envoyés automatiquement selon l&apos;activité de tes clients — toujours le lendemain, jamais le jour même.
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
      </div>
    </div>
  )
}

function RecetteCard({ recette, existante, sauvegarder }: {
  recette: Recette
  existante?: AutomatisationRow
  sauvegarder: Props['sauvegarder']
}) {
  const [actif, setActif]               = useState(existante?.actif ?? false)
  const [objet, setObjet]               = useState(existante?.objet ?? '')
  const [corps, setCorps]               = useState(existante?.corps ?? recette.corpsDefaut)
  const [delaiMinutes, setDelaiMinutes] = useState(existante?.delai_minutes ?? 1440)
  const [enregistrement, setEnregistrement] = useState(false)
  const [enregistre, setEnregistre]     = useState(false)
  const champActifRef = useRef<((token: string) => void) | null>(null)

  function insererVariable(token: string) {
    champActifRef.current?.(token)
  }

  async function handleEnregistrer() {
    setEnregistrement(true)
    await sauvegarder(recette.type, actif, objet, corps, delaiMinutes)
    setEnregistrement(false)
    setEnregistre(true)
    setTimeout(() => setEnregistre(false), 2000)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div>
          <p className="text-sm font-semibold text-white">{recette.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{recette.description}</p>
        </div>
        <button
          onClick={() => setActif(a => !a)}
          className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 relative ${actif ? 'bg-indigo-600' : 'bg-gray-700'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${actif ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div className="p-5 grid grid-cols-[1fr_220px] gap-5">
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
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">Délai avant envoi</label>
            <select
              value={delaiMinutes}
              onChange={e => setDelaiMinutes(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white outline-none"
            >
              {DELAIS.map(d => <option key={d.valeur} value={d.valeur}>{d.label}</option>)}
            </select>
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
    </div>
  )
}
