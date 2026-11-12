'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { DOMAINE_PLATEFORME, SOUS_DOMAINES_OUVERTS } from '@/lib/constantes'
import { hoteSousDomaine } from '@/lib/domaine-boutique'
import { sousDomainePossible } from '@/lib/slug-regles'
import { promptAssistantDns, type DomaineBoutique, type StatutDomaine, type VerificationDomaine } from '@/lib/domaine-regles'

const RAFRAICHISSEMENT_MS = 30_000

const BADGES: Record<StatutDomaine, { libelle: string; classes: string }> = {
  en_attente: { libelle: 'En attente', classes: 'bg-amber-500/15 text-amber-300' },
  actif: { libelle: 'Actif', classes: 'bg-emerald-500/15 text-emerald-300' },
  probleme: { libelle: 'Problème', classes: 'bg-red-500/15 text-red-300' },
}

function heure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function Historique({ verifications }: { verifications: VerificationDomaine[] }) {
  if (verifications.length === 0) return null
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6 space-y-3">
      <h2 className="font-semibold">Dernières vérifications</h2>
      <ul className="space-y-2 text-sm">
        {verifications.map(v => (
          <li key={v.le} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-gray-400 tabular-nums">{heure(v.le)}</span>
            {v.ok ? (
              <span className="text-emerald-300">Réussie</span>
            ) : (
              <span className="text-red-300">Échouée{v.cause ? ` — ${v.cause}` : ''}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">
        Une vérification échouée ne veut pas dire que ton domaine est en panne : ton hébergeur peut avoir une coupure de quelques minutes. Une panne n&apos;est confirmée qu&apos;après plus de 30 minutes sans réponse. Dans ce cas, tu reçois un email et ta boutique se réaffiche sur {DOMAINE_PLATEFORME} en attendant.
      </p>
    </section>
  )
}

function Roue() {
  return <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden />
}

function BoutonCopier({ texte, libelle = 'Copier' }: { texte: string; libelle?: string }) {
  const [copie, setCopie] = useState(false)

  async function copier() {
    await navigator.clipboard.writeText(texte)
    setCopie(true)
    setTimeout(() => setCopie(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={copier}
      className="shrink-0 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-white transition-colors"
    >
      {copie ? 'Copié ✓' : libelle}
    </button>
  )
}

function Lignes({ domaine }: { domaine: DomaineBoutique }) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {domaine.lignes_dns.map(ligne => (
          <div key={`${ligne.type}-${ligne.hote}`} className="grid gap-2 sm:grid-cols-[80px_140px_1fr] rounded-xl border border-gray-800 bg-gray-950 p-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Type</p>
              <p className="text-sm font-semibold">{ligne.type}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Nom</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-mono break-all">{ligne.hote}</p>
                <BoutonCopier texte={ligne.hote} />
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Valeur</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-mono break-all">{ligne.valeur}</p>
                <BoutonCopier texte={ligne.valeur} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Ces lignes s&apos;ajoutent chez le site où tu as acheté ton domaine. Ne modifie pas les lignes MX : elles servent à tes emails.
      </p>
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-gray-300">
          Besoin d&apos;aide ? Colle ce message dans ChatGPT, Claude ou Gemini, il te guidera pas à pas.
        </p>
        <BoutonCopier texte={promptAssistantDns(domaine.domaine, domaine.lignes_dns)} libelle="Copier le prompt" />
      </div>
    </div>
  )
}

export default function DomaineClient({
  domaineInitial,
  avertissementIndisponible,
  planPayant,
  slug,
}: {
  domaineInitial: DomaineBoutique | null
  avertissementIndisponible: string | null
  planPayant: boolean
  slug: string
}) {
  const [domaine, setDomaine] = useState(domaineInitial)
  const [saisie, setSaisie] = useState('')
  const [enCours, setEnCours] = useState<'brancher' | 'verifier' | 'retirer' | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [verificationImpossible, setVerificationImpossible] = useState(false)
  const [modeChangement, setModeChangement] = useState(false)
  const [confirmeRetrait, setConfirmeRetrait] = useState(false)

  const adresseSonoo = SOUS_DOMAINES_OUVERTS && sousDomainePossible(slug) ? hoteSousDomaine(slug) : `${DOMAINE_PLATEFORME}/${slug}`

  const appeler = useCallback(async (action: 'brancher' | 'verifier' | 'retirer', corps?: object) => {
    const reponse = await fetch(`/api/domaine/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: corps ? JSON.stringify(corps) : undefined,
    })
    const donnees = await reponse.json().catch(() => null)
    if (!reponse.ok) throw new Error(donnees?.erreur ?? 'Une erreur est survenue. Réessaie.')
    return donnees as { domaine: DomaineBoutique | null; verificationImpossible: boolean }
  }, [])

  async function executer(action: 'brancher' | 'verifier' | 'retirer', corps?: object) {
    setEnCours(action)
    setErreur(null)
    try {
      const resultat = await appeler(action, corps)
      setDomaine(resultat.domaine)
      setVerificationImpossible(resultat.verificationImpossible)
      setModeChangement(false)
      setConfirmeRetrait(false)
      setSaisie('')
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Une erreur est survenue. Réessaie.')
    } finally {
      setEnCours(null)
    }
  }

  const aSurveiller = planPayant && !!domaine && (domaine.statut !== 'actif' || !!domaine.premier_echec_le)
  useEffect(() => {
    if (!aSurveiller) return
    const minuteur = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const resultat = await appeler('verifier')
        setDomaine(resultat.domaine)
        setVerificationImpossible(resultat.verificationImpossible)
      } catch {
        // Le prochain passage réessaiera.
      }
    }, RAFRAICHISSEMENT_MS)
    return () => clearInterval(minuteur)
  }, [aSurveiller, appeler])

  const formulaire = (
    <form
      onSubmit={e => {
        e.preventDefault()
        executer('brancher', { domaine: saisie })
      }}
      className="space-y-3"
    >
      <label className="block text-sm font-medium text-gray-300" htmlFor="domaine">
        {modeChangement ? 'Nouvelle adresse' : 'Ton adresse'}
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          id="domaine"
          value={saisie}
          onChange={e => setSaisie(e.target.value)}
          placeholder="monsite.com ou beats.monsite.com"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 rounded-lg bg-gray-950 border border-gray-700 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={enCours !== null || !saisie.trim()}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-semibold text-white transition-colors"
        >
          {enCours === 'brancher' && <Roue />}
          {enCours === 'brancher' ? 'Branchement en cours…' : modeChangement ? 'Changer de domaine' : 'Brancher ce domaine'}
        </button>
      </div>
      <p className="text-xs text-gray-500">
        Si un site existe déjà à cette adresse, ta boutique le remplacera une fois les lignes modifiées. Pour garder ton site, choisis un sous-domaine, comme beats.monsite.com.
      </p>
      {modeChangement && domaine?.statut === 'actif' && (
        <p className="text-xs text-amber-300">
          {domaine.domaine} cessera d&apos;afficher ta boutique dès la validation. Elle restera sur {adresseSonoo}{' '}jusqu&apos;à ce que le nouveau domaine soit actif.
        </p>
      )}
    </form>
  )

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-300">← Retour</Link>
          <h1 className="text-2xl font-bold mt-3">Domaine personnalisé</h1>
          <p className="text-sm text-gray-400 mt-1">
            Affiche ta boutique sur ta propre adresse au lieu de {adresseSonoo}.
          </p>
        </div>

        {erreur && (
          <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erreur}</p>
        )}
        {verificationImpossible && (
          <p className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-300">
            La vérification est momentanément impossible. Le statut n&apos;a pas changé, on réessaiera automatiquement.
          </p>
        )}

        {!planPayant && !domaine && (
          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center">
            <p className="text-3xl mb-3" aria-hidden>🔒</p>
            <h2 className="font-semibold">Réservé au plan payant</h2>
            <p className="text-sm text-gray-400 mt-1 mb-5">Le domaine personnalisé est inclus dans l&apos;abonnement, essai gratuit compris.</p>
            <Link href="/dashboard/abonnement" className="inline-block px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold">
              Voir l&apos;abonnement
            </Link>
          </section>
        )}

        {planPayant && !domaine && (
          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">{formulaire}</section>
        )}

        {domaine && (
          <>
            <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold break-all">{domaine.domaine}</p>
                  {domaine.statut === 'actif' && (
                    <a href={`https://${domaine.domaine}`} target="_blank" rel="noreferrer" className="text-sm text-indigo-400 hover:text-indigo-300">
                      Voir ma boutique {'↗︎'}
                    </a>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${BADGES[domaine.statut].classes}`}>
                  {BADGES[domaine.statut].libelle}
                </span>
              </div>

              {domaine.statut === 'actif' && !domaine.premier_echec_le && (
                <p className="text-sm text-gray-300">Ta boutique s&apos;affiche sur ce domaine.</p>
              )}
              {domaine.statut === 'actif' && domaine.explication && (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">{domaine.explication}</p>
              )}
              {domaine.statut === 'actif' && domaine.premier_echec_le && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                  Ton domaine n&apos;a pas répondu à la dernière vérification
                  {domaine.derniere_verification_le ? ` (${heure(domaine.derniere_verification_le)})` : ''}. La panne n&apos;est pas
                  confirmée : on revérifie toutes les 10 minutes, et on te prévient par email s&apos;il ne répond toujours pas après 30
                  minutes.
                </div>
              )}
              {domaine.statut === 'en_attente' && (
                <div className="space-y-2 text-sm text-gray-300">
                  {domaine.explication && <p>{domaine.explication}</p>}
                  <p className="text-gray-400">
                    Tu peux fermer cette page : on vérifie automatiquement et tu recevras un email dès que le domaine sera actif. En attendant, ta boutique reste sur {adresseSonoo}.
                  </p>
                </div>
              )}
              {domaine.statut === 'probleme' && (
                <div className="space-y-2 text-sm">
                  {domaine.explication && <p className="text-red-300">{domaine.explication}</p>}
                  <p className="text-gray-400">Ta boutique reste accessible sur {adresseSonoo} le temps de régler ça.</p>
                </div>
              )}

              {avertissementIndisponible && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3 text-sm text-amber-200">
                  <p>{avertissementIndisponible}</p>
                  <Link href="/dashboard/abonnement" className="inline-block px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white">
                    Me réabonner
                  </Link>
                </div>
              )}
              {!planPayant && (
                <p className="text-sm text-amber-300">🔒 Ton abonnement n&apos;est plus actif : tu peux retirer ce domaine, mais plus le modifier.</p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => executer('verifier')}
                  disabled={enCours !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-sm font-semibold transition-colors"
                >
                  {enCours === 'verifier' && <Roue />}
                  {enCours === 'verifier' ? 'Vérification…' : 'Vérifier maintenant'}
                </button>
                {planPayant && (
                  <button
                    type="button"
                    onClick={() => { setModeChangement(v => !v); setConfirmeRetrait(false) }}
                    className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition-colors"
                  >
                    {modeChangement ? 'Annuler le changement' : 'Changer de domaine'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setConfirmeRetrait(v => !v); setModeChangement(false) }}
                  className="px-4 py-2 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 text-sm font-semibold transition-colors"
                >
                  Retirer ce domaine
                </button>
              </div>

              {modeChangement && <div className="pt-2">{formulaire}</div>}

              {confirmeRetrait && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-3">
                  <p className="text-sm text-gray-200">
                    {domaine.domaine} n&apos;affichera plus ta boutique, qui restera disponible sur {adresseSonoo}. Tes lignes DNS ne sont pas modifiées.
                  </p>
                  <button
                    type="button"
                    onClick={() => executer('retirer')}
                    disabled={enCours !== null}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-sm font-semibold transition-colors"
                  >
                    {enCours === 'retirer' && <Roue />}
                    {enCours === 'retirer' ? 'Retrait en cours…' : 'Confirmer le retrait'}
                  </button>
                </div>
              )}
            </section>

            <Historique verifications={domaine.dernieres_verifications ?? []} />

            {domaine.lignes_dns.length > 0 && (
              domaine.statut === 'actif' ? (
                <details className="group rounded-2xl border border-gray-800 bg-gray-900 p-6">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-90">
                      <path fillRule="evenodd" d="M7.2 14.8a1 1 0 0 1 0-1.4L10.6 10 7.2 6.6a1 1 0 1 1 1.4-1.4l4.1 4.1a1 1 0 0 1 0 1.4l-4.1 4.1a1 1 0 0 1-1.4 0Z" clipRule="evenodd" />
                    </svg>
                    Voir les lignes DNS
                  </summary>
                  <div className="mt-4"><Lignes domaine={domaine} /></div>
                </details>
              ) : (
                <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6 space-y-4">
                  <h2 className="font-semibold">Lignes à ajouter</h2>
                  <Lignes domaine={domaine} />
                </section>
              )
            )}
          </>
        )}
      </div>
    </main>
  )
}
