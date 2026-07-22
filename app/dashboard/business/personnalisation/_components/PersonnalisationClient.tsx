'use client'

import { useState } from 'react'

const PRESETS: { valeur: string; label: string }[] = [
  { valeur: '#2E4CF0', label: 'Bleu' },
  { valeur: '#F2F2F2', label: 'Noir & blanc' },
  { valeur: '#E11D48', label: 'Rouge' },
  { valeur: '#10B981', label: 'Vert' },
  { valeur: '#7C3AED', label: 'Violet' },
  { valeur: '#F97316', label: 'Orange' },
  { valeur: '#FACC15', label: 'Jaune' },
  { valeur: '#00F6FB', label: 'Cyan' },
]

export default function PersonnalisationClient({
  slug,
  heroTitreInitial,
  heroSousTitreInitial,
  accentInitial,
}: {
  slug: string
  heroTitreInitial: string
  heroSousTitreInitial: string
  accentInitial: string
}) {
  const [heroTitre, setHeroTitre] = useState(heroTitreInitial)
  const [heroSousTitre, setHeroSousTitre] = useState(heroSousTitreInitial)
  const [savingHero, setSavingHero] = useState(false)
  const [succesHero, setSuccesHero] = useState(false)

  const [accentApercu, setAccentApercu] = useState(accentInitial)
  const [accentSauvegarde, setAccentSauvegarde] = useState(accentInitial)
  const [savingTheme, setSavingTheme] = useState(false)

  const themeModifie = accentApercu !== accentSauvegarde

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
        </div>

        {/* Aperçu live */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-800 text-xs text-gray-500 font-medium">
            Aperçu en direct — {slug}
          </div>
          <iframe
            key={slug}
            src={`/${slug}?theme_apercu=${encodeURIComponent(accentApercu)}`}
            className="w-full flex-1 min-h-[600px] bg-black"
            title="Aperçu de la boutique"
          />
        </div>
      </div>
    </div>
  )
}
