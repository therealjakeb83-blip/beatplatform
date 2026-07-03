'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { BlocEmail } from '@/lib/email-blocs'
import BlocEditor, { type BeatOption, type ContactOption } from '../../../_components/BlocEditor'
import { CATEGORIE_LABEL } from '../../../_lib/categories'

type Props = {
  beats: BeatOption[]
  contacts: ContactOption[]
  creerTemplate: (nom: string, categorie: string, objetDefaut: string, contenu: BlocEmail[]) => Promise<void>
  genererApercu: (blocs: BlocEmail[], clientId?: string) => Promise<string>
}

const champ = 'w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none transition-colors'
const label = 'text-[11px] text-gray-500 mb-1 block'

export default function NouveauTemplateClient({ beats, contacts, creerTemplate, genererApercu }: Props) {
  const [nom, setNom] = useState('Nouveau template')
  const [categorie, setCategorie] = useState('newsletter')
  const [objetDefaut, setObjetDefaut] = useState('')

  return (
    <BlocEditor
      blocsInitiaux={[]}
      beats={beats}
      contacts={contacts}
      labelEnregistrer="Créer le template"
      entete={
        <>
          <Link href="/dashboard/business/marketing/templates" className="text-gray-500 hover:text-white transition-colors text-sm flex-shrink-0">
            ← Templates
          </Link>
          <span className="text-gray-700 flex-shrink-0">/</span>
          <input
            value={nom}
            onChange={e => setNom(e.target.value)}
            className="bg-transparent text-sm font-semibold text-white outline-none border-b border-transparent hover:border-gray-700 focus:border-indigo-500 transition-colors px-1 w-56 min-w-0"
          />
        </>
      }
      parametresSupplementaires={
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Paramètres</p>
          <div>
            <label className={label}>Catégorie</label>
            <select value={categorie} onChange={e => setCategorie(e.target.value)} className={champ}>
              {Object.entries(CATEGORIE_LABEL).map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Objet par défaut</label>
            <input value={objetDefaut} onChange={e => setObjetDefaut(e.target.value)} placeholder="🎵 Les nouveautés du mois" className={champ} />
          </div>
        </div>
      }
      onEnregistrer={async blocs => { await creerTemplate(nom, categorie, objetDefaut, blocs) }}
      genererApercu={genererApercu}
    />
  )
}
