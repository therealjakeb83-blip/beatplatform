'use client'

import { useState } from 'react'
import type { ReductionLotRow, LicenceOption } from '../page'

type FormData = {
  nom: string
  licence_id: string
  nb_a_acheter: string
  nb_offerts: string
}

const FORM_VIDE: FormData = { nom: '', licence_id: '', nb_a_acheter: '2', nb_offerts: '1' }

function formFromRegle(r: ReductionLotRow): FormData {
  return {
    nom: r.nom,
    licence_id: r.licence_id,
    nb_a_acheter: String(r.nb_a_acheter),
    nb_offerts: String(r.nb_offerts),
  }
}

export default function ReductionsLotClient({
  regles: initial,
  licences,
}: {
  regles: ReductionLotRow[]
  licences: LicenceOption[]
}) {
  const [regles, setRegles] = useState(initial)
  const [creating, setCreating] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(FORM_VIDE)
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState('')

  function licenceNom(id: string): string {
    return licences.find(l => l.id === id)?.nom ?? 'Licence supprimée'
  }

  function openCreate() {
    setCreating(true)
    setEditId(null)
    setForm({ ...FORM_VIDE, licence_id: licences[0]?.id ?? '' })
    setErreur('')
  }

  function openEdit(r: ReductionLotRow) {
    setEditId(r.id)
    setCreating(false)
    setForm(formFromRegle(r))
    setErreur('')
  }

  function fermer() {
    setCreating(false)
    setEditId(null)
    setErreur('')
  }

  async function creer() {
    setSaving(true)
    setErreur('')
    try {
      const res = await fetch('/api/business/reductions-lot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, nb_a_acheter: Number(form.nb_a_acheter), nb_offerts: Number(form.nb_offerts), actif: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erreur ?? 'Erreur lors de la création')
      setRegles(rs => [data.regle as ReductionLotRow, ...rs])
      fermer()
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inconnue.')
    } finally {
      setSaving(false)
    }
  }

  async function enregistrerEdit(r: ReductionLotRow) {
    setSaving(true)
    setErreur('')
    try {
      const res = await fetch(`/api/business/reductions-lot/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, nb_a_acheter: Number(form.nb_a_acheter), nb_offerts: Number(form.nb_offerts) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erreur ?? 'Erreur lors de la sauvegarde')
      setRegles(rs => rs.map(x => x.id === r.id ? data.regle as ReductionLotRow : x))
      fermer()
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inconnue.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActif(r: ReductionLotRow) {
    const nouveauActif = !r.actif
    setRegles(rs => rs.map(x => x.id === r.id ? { ...x, actif: nouveauActif } : x))
    try {
      const res = await fetch(`/api/business/reductions-lot/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actif: nouveauActif }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erreur ?? 'Erreur')
    } catch (err) {
      setRegles(rs => rs.map(x => x.id === r.id ? { ...x, actif: r.actif } : x))
      alert(err instanceof Error ? err.message : "Impossible d'activer cette règle")
    }
  }

  async function supprimer(r: ReductionLotRow) {
    if (!confirm(`Supprimer la règle "${r.nom}" ?`)) return
    const ancien = regles
    setRegles(rs => rs.filter(x => x.id !== r.id))
    try {
      const res = await fetch(`/api/business/reductions-lot/${r.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erreur ?? 'Erreur')
    } catch {
      setRegles(ancien)
    }
  }

  const formulaireOuvert = creating || editId !== null
  const regleEnEdition = editId ? regles.find(r => r.id === editId) ?? null : null

  return (
    <div className="px-8 py-8 max-w-2xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Réductions par lot</h1>
          <p className="text-sm text-gray-400 mt-1">
            &quot;Achète X, obtiens Y offert(s)&quot; — automatique dans le panier, une règle par licence.
          </p>
        </div>
        {!formulaireOuvert && licences.length > 0 && (
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors whitespace-nowrap"
          >
            + Nouvelle règle
          </button>
        )}
      </div>

      {licences.length === 0 && (
        <p className="text-sm text-gray-500 mb-6">
          Crée d&apos;abord une licence active dans <span className="text-gray-300">Commerce → Licences</span> pour pouvoir configurer une réduction par lot.
        </p>
      )}

      {creating && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 mb-4">
          <FormulaireRegle form={form} setForm={setForm} licences={licences} erreur={erreur} />
          <div className="flex gap-3 mt-4">
            <button
              onClick={creer}
              disabled={saving || !form.nom.trim() || !form.licence_id}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? 'Création...' : 'Créer'}
            </button>
            <button onClick={fermer} className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {regles.length === 0 && !creating && (
          <p className="text-sm text-gray-500">Aucune règle configurée pour l&apos;instant.</p>
        )}

        {regles.map(r => (
          <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4">
              <div
                onClick={() => toggleActif(r)}
                className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 relative ${r.actif ? 'bg-indigo-600' : 'bg-gray-700'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${r.actif ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white">{r.nom}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">{licenceNom(r.licence_id)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Achète {r.nb_a_acheter}, obtiens {r.nb_offerts} offert{r.nb_offerts > 1 ? 's' : ''}
                  {!r.actif && ' — désactivée'}
                </p>
              </div>

              <button
                onClick={() => editId === r.id ? fermer() : openEdit(r)}
                className="text-sm text-gray-400 hover:text-white transition-colors flex-shrink-0"
              >
                {editId === r.id ? 'Fermer' : 'Modifier'}
              </button>
              <button
                onClick={() => supprimer(r)}
                className="text-sm text-red-400/70 hover:text-red-400 transition-colors flex-shrink-0"
              >
                Supprimer
              </button>
            </div>

            {editId === r.id && (
              <div className="border-t border-gray-800 px-5 py-4">
                <FormulaireRegle form={form} setForm={setForm} licences={licences} erreur={erreur} />
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => regleEnEdition && enregistrerEdit(regleEnEdition)}
                    disabled={saving || !form.nom.trim() || !form.licence_id}
                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                  <button onClick={fermer} className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors">
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function FormulaireRegle({
  form,
  setForm,
  licences,
  erreur,
}: {
  form: FormData
  setForm: (updater: (f: FormData) => FormData) => void
  licences: LicenceOption[]
  erreur: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Nom interne</label>
        <input
          type="text"
          value={form.nom}
          onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
          placeholder="ex : Promo été MP3"
          className="w-full px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Licence concernée</label>
        <select
          value={form.licence_id}
          onChange={e => setForm(f => ({ ...f, licence_id: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm"
        >
          {licences.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Nombre à acheter</label>
          <input
            type="number"
            min={1}
            value={form.nb_a_acheter}
            onChange={e => setForm(f => ({ ...f, nb_a_acheter: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Nombre offert</label>
          <input
            type="number"
            min={1}
            value={form.nb_offerts}
            onChange={e => setForm(f => ({ ...f, nb_offerts: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm"
          />
        </div>
      </div>

      {Number(form.nb_a_acheter) >= 1 && Number(form.nb_offerts) >= 1 && (
        <p className="text-xs text-indigo-400">
          Aperçu : achète {form.nb_a_acheter}, obtiens {form.nb_offerts} offert{Number(form.nb_offerts) > 1 ? 's' : ''} — le moins cher des {Number(form.nb_a_acheter) + Number(form.nb_offerts)} articles en {licences.find(l => l.id === form.licence_id)?.nom ?? '...'} est offert.
        </p>
      )}

      {erreur && <p className="text-red-400 text-sm">{erreur}</p>}
    </div>
  )
}
