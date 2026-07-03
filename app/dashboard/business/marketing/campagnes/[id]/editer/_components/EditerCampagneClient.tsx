'use client'

import Link from 'next/link'
import type { BlocEmail } from '@/lib/email-blocs'
import BlocEditor, { type BeatOption, type ContactOption } from '../../../../_components/BlocEditor'

type Props = {
  nom: string
  objet: string
  blocsInitiaux: BlocEmail[]
  beats: BeatOption[]
  contacts: ContactOption[]
  enregistrerContenuCampagne: (contenu: BlocEmail[]) => Promise<void>
  genererApercu: (blocs: BlocEmail[], clientId?: string) => Promise<string>
}

export default function EditerCampagneClient({ nom, objet, blocsInitiaux, beats, contacts, enregistrerContenuCampagne, genererApercu }: Props) {
  return (
    <BlocEditor
      blocsInitiaux={blocsInitiaux}
      beats={beats}
      contacts={contacts}
      labelEnregistrer="Enregistrer le contenu"
      entete={
        <>
          <Link href="/dashboard/business/marketing/campagnes" className="text-gray-500 hover:text-white transition-colors text-sm flex-shrink-0">
            ← Campagnes
          </Link>
          <span className="text-gray-700 flex-shrink-0">/</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">{nom}</p>
            <p className="text-[11px] text-gray-500 truncate leading-tight">{objet}</p>
          </div>
        </>
      }
      parametresSupplementaires={
        <p className="text-[11px] text-gray-600 leading-relaxed">
          Personnalise le contenu de cette campagne. Le nom et l&apos;objet se modifient depuis la liste des campagnes.
        </p>
      }
      onEnregistrer={enregistrerContenuCampagne}
      genererApercu={genererApercu}
    />
  )
}
