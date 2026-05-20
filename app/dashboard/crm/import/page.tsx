'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

type LigneCSV = {
  order_id: string
  date: string
  nom: string
  email: string
  beat: string
  licence: string
  montant: number
}

type ResultatImport = {
  importes: number
  ignores: number
  erreurs: string[]
}

function detecterColonne(headers: string[], candidats: string[]): number {
  for (const candidat of candidats) {
    const idx = headers.findIndex(h => h.toLowerCase().trim().includes(candidat))
    if (idx !== -1) return idx
  }
  return -1
}

function parserCSV(texte: string): LigneCSV[] {
  const lignes = texte.trim().split('\n').filter(l => l.trim())
  if (lignes.length < 2) return []

  const headers = lignes[0].split(',').map(h => h.replace(/"/g, '').trim())

  const colOrderId = detecterColonne(headers, ['order id', 'order number', 'order_id', 'id'])
  const colDate = detecterColonne(headers, ['date', 'order date', 'created'])
  const colNom = detecterColonne(headers, ['customer name', 'customer', 'buyer name', 'buyer', 'name'])
  const colEmail = detecterColonne(headers, ['email', 'customer email', 'buyer email'])
  const colBeat = detecterColonne(headers, ['beat name', 'beat', 'track', 'product', 'title'])
  const colLicence = detecterColonne(headers, ['license', 'licence', 'license type', 'type'])
  const colMontant = detecterColonne(headers, ['net total', 'net amount', 'amount', 'price', 'total'])

  if (colEmail === -1 || colMontant === -1) return []

  const resultat: LigneCSV[] = []
  for (let i = 1; i < lignes.length; i++) {
    const cols = lignes[i].match(/(".*?"|[^,]+)(?=,|$)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) ?? lignes[i].split(',').map(c => c.trim())
    const email = cols[colEmail] ?? ''
    if (!email || !email.includes('@')) continue

    const montantStr = cols[colMontant]?.replace(/[^0-9.,]/g, '').replace(',', '.') ?? '0'
    const montant = parseFloat(montantStr) || 0

    resultat.push({
      order_id: colOrderId >= 0 ? (cols[colOrderId] ?? '') : `bs-${i}`,
      date: colDate >= 0 ? (cols[colDate] ?? '') : '',
      nom: colNom >= 0 ? (cols[colNom] ?? '') : '',
      email,
      beat: colBeat >= 0 ? (cols[colBeat] ?? '') : '',
      licence: colLicence >= 0 ? (cols[colLicence] ?? '') : '',
      montant,
    })
  }
  return resultat
}

export default function ImportPage() {
  const [lignes, setLignes] = useState<LigneCSV[]>([])
  const [etape, setEtape] = useState<'upload' | 'preview' | 'resultat'>('upload')
  const [resultat, setResultat] = useState<ResultatImport | null>(null)
  const [chargement, setChargement] = useState(false)
  const [erreurFichier, setErreurFichier] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function chargerFichier(fichier: File) {
    setErreurFichier(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const texte = e.target?.result as string
      const parsed = parserCSV(texte)
      if (parsed.length === 0) {
        setErreurFichier('Fichier non reconnu. Vérifie que c\'est bien un export BeatStars en CSV.')
        return
      }
      setLignes(parsed)
      setEtape('preview')
    }
    reader.readAsText(fichier, 'utf-8')
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const fichier = e.dataTransfer.files[0]
    if (fichier) chargerFichier(fichier)
  }

  async function confirmerImport() {
    setChargement(true)
    try {
      const res = await fetch('/api/crm/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lignes }),
      })
      const data = await res.json()
      setResultat(data)
      setEtape('resultat')
    } catch {
      setErreurFichier('Erreur lors de l\'import. Réessaie.')
    } finally {
      setChargement(false)
    }
  }

  function recommencer() {
    setLignes([])
    setResultat(null)
    setEtape('upload')
    setErreurFichier(null)
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/dashboard/crm" className="text-sm text-gray-500 hover:text-gray-300 mb-6 block">← Mon CRM</Link>
        <h1 className="text-2xl font-bold mb-2">Import BeatStars</h1>
        <p className="text-gray-500 text-sm mb-8">
          Importe ton historique de ventes BeatStars pour retrouver tes anciens clients dans le CRM.
        </p>

        {/* Étape 1 — Upload */}
        {etape === 'upload' && (
          <div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
              <h2 className="font-semibold text-white mb-2">Comment exporter depuis BeatStars ?</h2>
              <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
                <li>Va sur BeatStars → Dashboard → Sales ou Orders</li>
                <li>Clique sur &ldquo;Export&rdquo; ou &ldquo;Download CSV&rdquo;</li>
                <li>Glisse le fichier ici ou clique pour le sélectionner</li>
              </ol>
            </div>

            <div
              onDrop={onDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-gray-700 hover:border-indigo-500 rounded-2xl p-16 text-center cursor-pointer transition-colors"
            >
              <p className="text-4xl mb-4">📂</p>
              <p className="text-white font-semibold mb-1">Glisse ton fichier CSV ici</p>
              <p className="text-gray-500 text-sm">ou clique pour le sélectionner</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) chargerFichier(e.target.files[0]) }}
              />
            </div>

            {erreurFichier && (
              <p className="mt-4 text-red-400 text-sm text-center">{erreurFichier}</p>
            )}
          </div>
        )}

        {/* Étape 2 — Prévisualisation */}
        {etape === 'preview' && (
          <div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
              <p className="text-white font-semibold mb-1">
                {lignes.length} ligne{lignes.length > 1 ? 's' : ''} détectée{lignes.length > 1 ? 's' : ''}
              </p>
              <p className="text-gray-500 text-sm">
                Vérifie que les données sont correctes avant de confirmer.
              </p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
              <div className="grid grid-cols-4 gap-3 px-4 py-3 border-b border-gray-800 text-xs text-gray-500 font-medium uppercase tracking-wider">
                <span>Client</span>
                <span>Beat</span>
                <span>Licence</span>
                <span className="text-right">Montant</span>
              </div>
              {lignes.slice(0, 10).map((l, i) => (
                <div key={i} className={`grid grid-cols-4 gap-3 px-4 py-3 text-sm ${i < Math.min(9, lignes.length - 1) ? 'border-b border-gray-800' : ''}`}>
                  <div className="min-w-0">
                    <p className="text-white truncate">{l.nom || '—'}</p>
                    <p className="text-gray-600 text-xs truncate">{l.email}</p>
                  </div>
                  <p className="text-gray-300 truncate self-center">{l.beat || '—'}</p>
                  <p className="text-gray-300 truncate self-center">{l.licence || '—'}</p>
                  <p className="text-white font-semibold text-right self-center">{l.montant} €</p>
                </div>
              ))}
              {lignes.length > 10 && (
                <div className="px-4 py-3 text-center text-gray-600 text-sm">
                  + {lignes.length - 10} lignes supplémentaires
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={recommencer}
                className="px-5 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmerImport}
                disabled={chargement}
                className="flex-1 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold transition-colors"
              >
                {chargement ? 'Import en cours…' : `Importer ${lignes.length} ligne${lignes.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* Étape 3 — Résultat */}
        {etape === 'resultat' && resultat && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <p className="text-4xl mb-6">✓</p>
            <p className="text-xl font-bold text-white mb-2">Import terminé</p>
            <div className="flex justify-center gap-8 mt-6 mb-6">
              <div>
                <p className="text-3xl font-black text-green-400">{resultat.importes}</p>
                <p className="text-gray-500 text-sm">importé{resultat.importes > 1 ? 's' : ''}</p>
              </div>
              <div>
                <p className="text-3xl font-black text-gray-500">{resultat.ignores}</p>
                <p className="text-gray-500 text-sm">déjà présent{resultat.ignores > 1 ? 's' : ''}</p>
              </div>
            </div>
            {resultat.erreurs.length > 0 && (
              <div className="mb-6 text-left bg-gray-800 rounded-xl p-4">
                <p className="text-red-400 text-sm font-medium mb-2">Erreurs :</p>
                {resultat.erreurs.map((e, i) => <p key={i} className="text-gray-400 text-xs">{e}</p>)}
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button onClick={recommencer} className="px-5 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">
                Nouvel import
              </button>
              <Link href="/dashboard/crm" className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors">
                Voir le CRM →
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
