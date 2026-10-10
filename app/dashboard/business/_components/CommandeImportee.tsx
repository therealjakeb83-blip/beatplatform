'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { libellePlateforme, libelleTypeBoutique } from '@/lib/import-externe/plateformes'
import { libelleSource } from '@/lib/sources-marketing'

// Commande importée d'une autre plateforme : ligne cliquable + petit panneau
// de détail. Volontairement AUCUN bouton facture / contrat / téléchargement /
// remboursement (décision 20) : la vente n'a pas eu lieu sur My Producer.
// Format libre : titre, date ou montants peuvent être INCONNUS (null).

export type LigneImportee = {
  id: string
  titre: string | null
  titre_original: string | null
  licence: string | null
  licence_boutique?: string | null
  prix_catalogue: number | null
  remise: number | null
  montant_depense: number | null
  montant_paye: number | null
  montant_depense_eur: number | null
  offert: boolean
  vendeur_principal: string | null
  collaborateurs: string[]
  image_url: string | null
  beat?: { titre: string } | null
}

// Vente reliée à un beat du catalogue (page « Relier les beats ») : titre et
// pochette du beat de la boutique ; le titre importé reste dans le panneau de
// détail et au survol. Vente non reliée : titre importé.
export const TITRE_NON_PRECISE = 'Beat non précisé'

export const fmtDateImport = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Date inconnue'

export function TitreLigneImportee({ ligne, classeTitre = 'font-medium text-white' }: { ligne: LigneImportee; classeTitre?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 align-middle">
      {ligne.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ligne.image_url} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
      )}
      <span className={ligne.titre || ligne.beat ? classeTitre : 'italic text-gray-500'} title={ligne.beat ? `Titre importé : ${ligne.titre}` : undefined}>
        {ligne.beat?.titre ?? ligne.titre ?? TITRE_NON_PRECISE}
      </span>
    </span>
  )
}

export type CommandeImporteeDetail = {
  id: string
  plateforme: string
  numero_externe: string
  date_vente: string | null
  devise: string
  taux_change: number | null
  date_taux: string | null
  total_catalogue: number | null
  total_remise: number | null
  total_depense: number | null
  total_paye: number | null
  total_depense_eur: number | null
  type_boutique: string | null
  reference_paiement: string | null
  moyen_paiement?: string | null
  montant_tva?: number | null
  source_marketing?: string | null
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

export function MontantInconnu() {
  return <span className="italic text-gray-500 whitespace-nowrap">Montant inconnu</span>
}

export function MontantLigne({ ligne, devise }: { ligne: LigneImportee; devise: string }) {
  if (ligne.offert) return <span className="text-green-400 font-semibold">Offert</span>
  if (ligne.montant_depense === null) return <MontantInconnu />
  return (
    <span className="whitespace-nowrap">
      <span className="font-semibold text-white">{fmtDevise(ligne.montant_depense, devise)}</span>
      {devise !== 'EUR' && ligne.montant_depense_eur !== null && <span className="text-gray-500 text-xs"> ≈ {fmtDevise(ligne.montant_depense_eur, 'EUR')}</span>}
    </span>
  )
}

// Montant d'une commande entière (devise d'origine + ≈ € ; inconnu si absent)
export function MontantCommande({ commande, classe = 'font-semibold text-white' }: { commande: Pick<CommandeImporteeDetail, 'total_depense' | 'total_depense_eur' | 'devise'>; classe?: string }) {
  if (commande.total_depense === null) return <MontantInconnu />
  return (
    <span className="whitespace-nowrap">
      <span className={classe}>{fmtDevise(commande.total_depense, commande.devise)}</span>
      {commande.devise !== 'EUR' && commande.total_depense_eur !== null && <span className="text-gray-500 text-xs"> ≈ {fmtDevise(commande.total_depense_eur, 'EUR')}</span>}
    </span>
  )
}

function Panneau({ commande, onClose }: { commande: CommandeImporteeDetail; onClose: () => void }) {
  const d = commande.devise
  const date = fmtDateImport
  const montant = (n: number | null) => (n === null ? <MontantInconnu /> : fmtDevise(n, d))
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
                {l.beat && ligne('Titre importé', l.titre ?? TITRE_NON_PRECISE)}
                {ligne('Licence', l.licence_boutique
                  ? <>{l.licence_boutique}{l.licence && <span className="text-gray-500"> (« {l.licence} » dans le fichier)</span>}</>
                  : l.licence ?? 'Non précisée')}
                {l.prix_catalogue !== null && ligne('Prix catalogue', fmtDevise(l.prix_catalogue, d))}
                {l.remise !== null && ligne('Remise', l.remise > 0 ? `− ${fmtDevise(l.remise, d)}` : '–')}
                {commande.plateforme === 'beatstars'
                  ? ligne('Total payé par le client (frais et TVA de la plateforme compris)', montant(l.montant_paye))
                  : commande.lignes.length > 1 && ligne('Part de cet article dans le total', montant(l.montant_depense))}
                {l.titre_original && l.titre_original !== l.titre && ligne('Article d’origine', l.titre_original)}
              </div>
            </div>
          ))}

          <div>
            {ligne('Total dépensé', <MontantCommande commande={commande} classe="text-gray-200" />)}
            {commande.montant_tva != null && ligne('dont TVA', fmtDevise(commande.montant_tva, d))}
            {commande.total_remise !== null && commande.plateforme !== 'beatstars' && ligne('Remise indiquée dans le fichier', fmtDevise(commande.total_remise, d))}
            {commande.moyen_paiement && ligne('Moyen de paiement', commande.moyen_paiement)}
            {commande.source_marketing && ligne('Source de la vente', libelleSource(commande.source_marketing))}
            {d !== 'EUR' && commande.taux_change !== null && ligne('Taux de change', `1 € = ${commande.taux_change} ${d} (BCE${commande.date_taux ? `, ${date(commande.date_taux)}` : ''})`)}
            {commande.numero_externe.startsWith('emp-')
              ? ligne('N° de commande', 'Absent du fichier')
              : ligne(commande.plateforme === 'beatstars' ? 'N° de facture BeatStars' : `N° de commande ${libellePlateforme(commande.plateforme)}`, <span className="font-mono">{commande.numero_externe}</span>)}
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
