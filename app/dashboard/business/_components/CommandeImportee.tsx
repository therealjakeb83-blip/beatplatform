'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { libellePlateforme, libelleTypeBoutique } from '@/lib/import-externe/plateformes'

// Commande importée d'une autre plateforme : ligne cliquable + petit panneau
// de détail. Volontairement AUCUN bouton facture / contrat / téléchargement /
// remboursement (décision 20) : la vente n'a pas eu lieu sur My Producer.

export type LigneImportee = {
  id: string
  titre: string
  titre_original: string | null
  licence: string | null
  prix_catalogue: number
  remise: number
  montant_depense: number
  montant_paye: number
  montant_depense_eur: number
  offert: boolean
  vendeur_principal: string | null
  collaborateurs: string[]
  image_url: string | null
  beat?: { titre: string } | null
}

// Vente reliée à un beat du catalogue (page « Relier les beats ») : titre et
// pochette du beat de la boutique ; le titre importé reste dans le panneau de
// détail et au survol. Vente non reliée : titre importé.
export function TitreLigneImportee({ ligne, classeTitre = 'font-medium text-white' }: { ligne: LigneImportee; classeTitre?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 align-middle">
      {ligne.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ligne.image_url} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
      )}
      <span className={classeTitre} title={ligne.beat ? `Titre importé : ${ligne.titre}` : undefined}>{ligne.beat?.titre ?? ligne.titre}</span>
    </span>
  )
}

export type CommandeImporteeDetail = {
  id: string
  plateforme: string
  numero_externe: string
  date_vente: string
  devise: string
  taux_change: number
  date_taux: string | null
  total_catalogue: number
  total_remise: number
  total_depense: number
  total_paye: number
  total_depense_eur: number
  type_boutique: string | null
  reference_paiement: string | null
  acheteur_nom: string | null
  acheteur_email: string
  import_date: string | null
  import_fichier: string | null
  lignes: LigneImportee[]
}

export function fmtDevise(n: number, devise: string): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: devise, minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function BadgePlateforme({ plateforme }: { plateforme: string }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 font-semibold whitespace-nowrap">
      {libellePlateforme(plateforme)}
    </span>
  )
}

export function MentionsLigne({ ligne, typeBoutique }: { ligne: LigneImportee; typeBoutique?: string | null }) {
  const boutique = libelleTypeBoutique(typeBoutique)
  return (
    <span className="flex flex-wrap gap-1.5 mt-1">
      {ligne.offert && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-green-500/15 text-green-400">Offert</span>}
      {ligne.vendeur_principal && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-300">
          Vendu par {ligne.vendeur_principal} — tu étais collaborateur
        </span>
      )}
      {!ligne.vendeur_principal && ligne.collaborateurs.length > 0 && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-800 text-gray-400">Collab avec {ligne.collaborateurs.join(', ')}</span>
      )}
      {boutique && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-800 text-gray-500">{boutique}</span>}
    </span>
  )
}

export function MontantLigne({ ligne, devise }: { ligne: LigneImportee; devise: string }) {
  if (ligne.offert) return <span className="text-green-400 font-semibold">Offert</span>
  return (
    <span className="whitespace-nowrap">
      <span className="font-semibold text-white">{fmtDevise(ligne.montant_depense, devise)}</span>
      {devise !== 'EUR' && <span className="text-gray-500 text-xs"> ≈ {fmtDevise(ligne.montant_depense_eur, 'EUR')}</span>}
    </span>
  )
}

function Panneau({ commande, onClose }: { commande: CommandeImporteeDetail; onClose: () => void }) {
  const d = commande.devise
  const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const ligne = (label: string, valeur: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-1.5 border-b border-gray-800 last:border-0 text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 text-right">{valeur}</span>
    </div>
  )
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-800 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BadgePlateforme plateforme={commande.plateforme} />
              <span className="text-xs text-gray-500">{date(commande.date_vente)}</span>
            </div>
            <h2 className="text-white font-bold">Commande importée</h2>
            <p className="text-xs text-gray-500 mt-0.5">{commande.acheteur_nom ?? commande.acheteur_email}</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {commande.lignes.map(l => (
            <div key={l.id} className="bg-gray-950/60 border border-gray-800 rounded-xl p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm"><TitreLigneImportee ligne={l} classeTitre="font-semibold text-white" /></p>
                  <MentionsLigne ligne={l} />
                </div>
                <MontantLigne ligne={l} devise={d} />
              </div>
              <div className="mt-2">
                {l.beat && ligne('Titre importé', l.titre)}
                {ligne('Licence', l.licence ?? 'Non précisée')}
                {ligne('Prix catalogue', fmtDevise(l.prix_catalogue, d))}
                {ligne('Remise', l.remise > 0 ? `− ${fmtDevise(l.remise, d)}` : '–')}
                {ligne('Total payé par le client (frais et TVA de la plateforme compris)', fmtDevise(l.montant_paye, d))}
                {l.titre_original && l.titre_original !== l.titre && ligne('Article d’origine', l.titre_original)}
              </div>
            </div>
          ))}

          <div>
            {ligne('Total dépensé', <>{fmtDevise(commande.total_depense, d)}{d !== 'EUR' && <span className="text-gray-500"> ≈ {fmtDevise(commande.total_depense_eur, 'EUR')}</span>}</>)}
            {d !== 'EUR' && ligne('Taux de change', `1 € = ${commande.taux_change} ${d} (BCE${commande.date_taux ? `, ${date(commande.date_taux)}` : ''})`)}
            {ligne(`N° de facture ${libellePlateforme(commande.plateforme)}`, <span className="font-mono">{commande.numero_externe}</span>)}
            {commande.reference_paiement && ligne('Référence de paiement', <span className="font-mono">{commande.reference_paiement}</span>)}
            {libelleTypeBoutique(commande.type_boutique) && ligne('Vendu sur', libelleTypeBoutique(commande.type_boutique))}
            {ligne('Import d’origine', commande.import_date ? `${date(commande.import_date)}${commande.import_fichier ? ` — ${commande.import_fichier}` : ''}` : '–')}
          </div>
          <p className="text-[11px] text-gray-600">
            Vente réalisée sur {libellePlateforme(commande.plateforme)} : pas de facture, de contrat ni de téléchargement sur My Producer.
          </p>
        </div>
      </div>
    </div>
  )
}

// Ligne de tableau cliquable qui ouvre le panneau (rendu dans <body> : un
// panneau ne peut pas vivre à l'intérieur d'un <tr>) ; ouvert seulement après
// un clic, donc toujours côté navigateur
export function LigneTableauImportee({
  commande, className, children,
}: { commande: CommandeImporteeDetail; className?: string; children: React.ReactNode }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <>
      <tr className={`${className ?? ''} cursor-pointer`} onClick={() => setOuvert(true)}>{children}</tr>
      {ouvert && createPortal(<Panneau commande={commande} onClose={() => setOuvert(false)} />, document.body)}
    </>
  )
}
