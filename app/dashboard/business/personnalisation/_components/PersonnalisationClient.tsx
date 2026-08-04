'use client'

import { useState } from 'react'
import Link from 'next/link'

const STYLES_NOM_MARQUE: { valeur: string; label: string }[] = [
  { valeur: 'hero', label: 'Hero' },
  { valeur: 'grotesque', label: 'Grotesque' },
  { valeur: 'condense', label: 'Condensé' },
  { valeur: 'massif', label: 'Massif' },
  { valeur: 'moderne', label: 'Moderne' },
  { valeur: 'espace', label: 'Espacé' },
]

const PRESETS: { valeur: string; label: string }[] = [
  { valeur: '#2E4CF0', label: 'Bleu' },
  { valeur: '#F2F2F2', label: 'Noir & blanc' },
  { valeur: '#E11D48', label: 'Rouge' },
  { valeur: '#10B981', label: 'Vert' },
  { valeur: '#7C3AED', label: 'Violet' },
  { valeur: '#F97316', label: 'Orange' },
  { valeur: '#FACC15', label: 'Jaune' },
  { valeur: '#00F6FB', label: 'Cyan' },
  { valeur: '#0A0C13', label: 'Blanc & noir' },
]

export default function PersonnalisationClient({
  slug,
  nomArtiste,
  heroTitreInitial,
  heroSousTitreInitial,
  accentInitial,
  marqueAffichageInitial,
  styleNomMarqueInitial,
}: {
  slug: string
  nomArtiste: string
  heroTitreInitial: string
  heroSousTitreInitial: string
  accentInitial: string
  marqueAffichageInitial: string
  styleNomMarqueInitial: string
}) {
  const [heroTitre, setHeroTitre] = useState(heroTitreInitial)
  const [heroSousTitre, setHeroSousTitre] = useState(heroSousTitreInitial)
  const [savingHero, setSavingHero] = useState(false)
  const [succesHero, setSuccesHero] = useState(false)

  const [accentApercu, setAccentApercu] = useState(accentInitial)
  const [accentSauvegarde, setAccentSauvegarde] = useState(accentInitial)
  const [savingTheme, setSavingTheme] = useState(false)

  const [marqueApercu, setMarqueApercu] = useState(marqueAffichageInitial)
  const [marqueSauvegardee, setMarqueSauvegardee] = useState(marqueAffichageInitial)
  const [styleApercu, setStyleApercu] = useState(styleNomMarqueInitial)
  const [styleSauvegarde, setStyleSauvegarde] = useState(styleNomMarqueInitial)
  const [savingMarque, setSavingMarque] = useState(false)

  const themeModifie = accentApercu !== accentSauvegarde
  const marqueModifiee = marqueApercu !== marqueSauvegardee || styleApercu !== styleSauvegarde

  async function enregistrerMarque() {
    setSavingMarque(true)
    await fetch('/api/business/personnalisation', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marque_affichage: marqueApercu, style_nom_marque: styleApercu }),
    })
    setSavingMarque(false)
    setMarqueSauvegardee(marqueApercu)
    setStyleSauvegarde(styleApercu)
  }

  async function enregistrerHero(e: React.FormEvent) {
    e.preventDefault()
    setSavingHero(true)
    setSuccesHero(false)
    await fetch('/api/business/personnalisation', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hero_titre: heroTitre, hero_sous_titre: heroSousTitre }),
    })
    setSavingHero(false)
    setSuccesHero(true)
  }

  async function enregistrerTheme() {
    setSavingTheme(true)
    await fetch('/api/business/personnalisation', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme_couleur: accentApercu }),
    })
    setSavingTheme(false)
    setAccentSauvegarde(accentApercu)
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Personnalisation</h1>
        <p className="text-sm text-gray-500 mt-1">L&apos;apparence de ta boutique publique</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Message d'accueil */}
          <form onSubmit={enregistrerHero} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wide">Message d&apos;accueil</h2>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Titre</label>
              <input
                type="text"
                value={heroTitre}
                onChange={e => { setHeroTitre(e.target.value); setSuccesHero(false) }}
                placeholder="Trouve une instru composée par..., pour ton projet"
                className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Sous-titre</label>
              <textarea
                value={heroSousTitre}
                onChange={e => { setHeroSousTitre(e.target.value); setSuccesHero(false) }}
                placeholder="Des beats de qualité pour donner vie à tes projets."
                rows={2}
                className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <p className="text-xs text-gray-600">
              Laisse vide pour garder le texte par défaut généré automatiquement.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={savingHero}
                className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {savingHero ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              {succesHero && <span className="text-sm text-green-400">Enregistré ✓</span>}
            </div>
          </form>

          {/* Couleur d'accent */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wide">Couleur de la boutique</h2>

            <div className="flex gap-3 flex-wrap">
              {PRESETS.map(preset => (
                <button
                  key={preset.valeur}
                  onClick={() => setAccentApercu(preset.valeur)}
                  className={`flex flex-col items-center gap-2 px-3 py-3 rounded-lg border-2 transition-colors ${
                    accentApercu.toUpperCase() === preset.valeur ? 'border-indigo-500 bg-gray-800' : 'border-transparent hover:bg-gray-800/50'
                  }`}
                >
                  <span
                    className="w-8 h-8 rounded-full border border-white/10"
                    style={{ backgroundColor: preset.valeur, boxShadow: accentApercu.toUpperCase() === preset.valeur ? `0 0 0 3px ${preset.valeur}55` : undefined }}
                  />
                  <span className="text-xs text-gray-300 font-medium">{preset.label}</span>
                </button>
              ))}
            </div>

            <p className="text-xs text-gray-600">
              L&apos;aperçu à droite se met à jour instantanément. Rien n&apos;est sauvegardé tant que tu n&apos;as pas cliqué sur Enregistrer.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={enregistrerTheme}
                disabled={savingTheme || !themeModifie}
                className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {savingTheme ? 'Enregistrement...' : 'Enregistrer le thème'}
              </button>
              {!themeModifie && (
                <span className="text-sm text-gray-500">Thème actuel de la boutique</span>
              )}
            </div>
          </div>

          {/* Marque de la boutique : logo ou nom écrit */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wide">Marque de la boutique</h2>
            <p className="text-xs text-gray-600">
              Affiche ton logo (par défaut) ou ton pseudonyme écrit en toutes lettres, dans le header et le footer.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setMarqueApercu('logo')}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  marqueApercu === 'logo' ? 'bg-white text-gray-900 border-white' : 'bg-transparent text-gray-300 border-gray-700 hover:bg-gray-800'
                }`}
              >
                Logo
              </button>
              <button
                onClick={() => setMarqueApercu('nom')}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  marqueApercu === 'nom' ? 'bg-white text-gray-900 border-white' : 'bg-transparent text-gray-300 border-gray-700 hover:bg-gray-800'
                }`}
              >
                Nom écrit
              </button>
            </div>

            {marqueApercu === 'nom' && (
              <>
                <div className="flex gap-2 flex-wrap">
                  {STYLES_NOM_MARQUE.map(s => (
                    <button
                      key={s.valeur}
                      onClick={() => setStyleApercu(s.valeur)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                        styleApercu === s.valeur ? 'bg-white text-gray-900 border-white' : 'bg-transparent text-gray-300 border-gray-700 hover:bg-gray-800'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-gray-500">
                  Nom affiché : <span className="text-gray-300 font-medium">{nomArtiste}</span>
                  {' — '}
                  <Link href="/dashboard/profil" className="text-indigo-400 hover:text-indigo-300 underline">
                    modifier dans Mon profil
                  </Link>
                </p>
              </>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={enregistrerMarque}
                disabled={savingMarque || !marqueModifiee}
                className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {savingMarque ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              {!marqueModifiee && (
                <span className="text-sm text-gray-500">Réglage actuel de la boutique</span>
              )}
            </div>
          </div>
        </div>

        {/* Aperçu live */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-800 text-xs text-gray-500 font-medium">
            Aperçu en direct — {slug}
          </div>
          <iframe
            key={slug}
            src={`/${slug}?theme_apercu=${encodeURIComponent(accentApercu)}&marque_apercu=${encodeURIComponent(marqueApercu)}&style_apercu=${encodeURIComponent(styleApercu)}`}
            className="w-full flex-1 min-h-[600px] bg-black"
            title="Aperçu de la boutique"
          />
        </div>
      </div>
    </div>
  )
}
