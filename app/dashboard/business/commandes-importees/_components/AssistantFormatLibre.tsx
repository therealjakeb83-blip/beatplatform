'use client'

import { useMemo, useState } from 'react'
import type { Tableau } from '@/lib/import-externe/libre/tableau'
import {
  AIDES_ROLES, LIBELLES_ROLES, LIBELLES_SEPARATEURS, ROLES, SEPARATEURS_ARTICLES, cleLicence, cleStatut,
  type Association, type ChoixLicence, type FormeLicence, type Role, type SeparateurArticles,
} from '@/lib/import-externe/libre/association'
import {
  LIBELLES_FORMES, decouperCase, decoupageSuspect, detecterFormeLicence, detecterSeparateur, extraireLicence,
  titresAvecQuantite, valeursLicence, type ValeurLicence,
} from '@/lib/import-externe/libre/articles'
import { deviseEcrite, formeDate, lireMontant, ordreDateImpose, type Devise, type OrdreDate } from '@/lib/import-externe/libre/valeurs'
import type { BesoinAssistant } from '@/lib/import-externe/entree'

// Assistant « format libre » (lot 4) : le beatmaker valide CHAQUE colonne de
// son fichier, une à la fois, puis les questions qui en découlent (statuts
// réglés, sens des dates, articles multiples, licences, devise, plateforme).
// Rien n'est deviné en silence : chaque proposition est confirmée à l'écran.

type Etape =
  | { type: 'recap' }
  | { type: 'colonne'; i: number }
  | { type: 'debut' }
  | { type: 'statuts' }
  | { type: 'dates' }
  | { type: 'decoupage' }
  | { type: 'licences' }
  | { type: 'final' }

const STATUT_REGLE = /termin|complet|pay|paid|regl|succe|valid|livr|confirm/
const STATUT_NON_REGLE = /attente|pending|cancel|annul|rembours|refund|echou|fail|brouillon|draft|on-hold|hold/

const sansAccents = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const court = (s: string, n = 48) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const nb = (n: number) => n.toLocaleString('fr-FR')

function exemples(valeurs: string[], max = 4): string[] {
  const vus: string[] = []
  for (const v of valeurs) {
    if (v && !vus.includes(v)) vus.push(v)
    if (vus.length >= max) break
  }
  return vus
}

function Progression({ actuel, total, libelle }: { actuel: number; total: number; libelle: string }) {
  return (
    <div className="mb-5">
      <div className="flex justify-between text-[11px] text-gray-500 mb-1.5">
        <span>{libelle}</span>
        <span>{actuel}/{total}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.round((actuel / total) * 100)}%` }} />
      </div>
    </div>
  )
}

function Choix({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${actif ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-gray-800 bg-gray-950/40 text-gray-300 hover:border-gray-700'}`}
    >
      <span className={`inline-block w-3.5 h-3.5 rounded-full border mr-2.5 align-[-2px] ${actif ? 'border-indigo-400 bg-indigo-400 shadow-[inset_0_0_0_2px_rgb(17,24,39)]' : 'border-gray-600'}`} />
      {children}
    </button>
  )
}

function Pied({ onPrecedent, onSuivant, suivant = 'Valider →', desactive, aide }: { onPrecedent?: () => void; onSuivant: () => void; suivant?: string; desactive?: boolean; aide?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 pt-5">
      {onPrecedent ? <button onClick={onPrecedent} className="text-sm text-gray-400 hover:text-white">← Précédent</button> : <span />}
      <div className="flex items-center gap-3">
        {aide && desactive && <span className="text-xs text-gray-500">{aide}</span>}
        <button
          onClick={onSuivant}
          disabled={desactive}
          className="text-sm font-semibold px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
        >
          {suivant}
        </button>
      </div>
    </div>
  )
}

export default function AssistantFormatLibre({
  tableau, besoin, rolesDevines, nomFichier, reprise, onValide, onAnnuler,
}: {
  tableau: Tableau
  besoin: BesoinAssistant
  rolesDevines: Role[]
  nomFichier: string
  // réponses déjà données (retour depuis l'aperçu) : on reprend à la fin
  reprise: Association | null
  onValide: (a: Association) => void
  onAnnuler: () => void
}) {
  const memorise = besoin.formatMemorise && besoin.formatMemorise.colonnes.length === tableau.enTetes.length ? besoin.formatMemorise : null
  const memo = reprise ?? memorise
  const nbCol = tableau.enTetes.length
  const valeursCol = useMemo(
    () => tableau.enTetes.map((_, i) => tableau.lignes.map(l => l.cellules[i] ?? '')),
    [tableau],
  )

  const [etape, setEtape] = useState<Etape>(reprise ? { type: 'final' } : memo ? { type: 'recap' } : { type: 'colonne', i: 0 })
  const [roles, setRoles] = useState<Role[]>(memo?.colonnes ?? rolesDevines)
  // réponse en cours sur la colonne affichée
  const [mode, setMode] = useState<'oui' | 'autre' | 'ignorer'>('oui')
  const [autreRole, setAutreRole] = useState<Role>('ignorer')
  const [statuts, setStatuts] = useState<Set<string> | null>(memo?.statutsRegles ? new Set(memo.statutsRegles) : null)
  const [ordreDate, setOrdreDate] = useState<OrdreDate | null>(memo?.ordreDate ?? null)
  const [separateur, setSeparateur] = useState<SeparateurArticles | null | undefined>(memo ? memo.separateurArticles : undefined)
  const [modeDecoupage, setModeDecoupage] = useState<'propose' | 'autre' | 'non' | null>(null)
  const [formeLicence, setFormeLicence] = useState<FormeLicence | null | undefined>(memo ? memo.formeLicence : undefined)
  const [licences, setLicences] = useState<Record<string, ChoixLicence>>(memo?.licences ?? {})
  const [devise, setDevise] = useState<Devise | null>(memo?.devise ?? null)
  const [plateforme, setPlateforme] = useState(memo?.plateforme ?? '')

  const col = (r: Role) => roles.indexOf(r)
  const vals = (r: Role) => (col(r) >= 0 ? valeursCol[col(r)] : [])

  // ── Données qui dépendent des colonnes choisies ─────────────────────────
  const statutsFichier = useMemo(() => {
    const m = new Map<string, { libelle: string; nb: number }>()
    for (const v of vals('statut')) {
      const cle = cleStatut(v)
      const x = m.get(cle) ?? { libelle: v.trim() || '(vide)', nb: 0 }
      x.nb++
      m.set(cle, x)
    }
    return [...m].sort((a, b) => b[1].nb - a[1].nb)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, valeursCol])

  const datesNumeriques = useMemo(() => vals('date').filter(v => formeDate(v) === 'numerique'), [roles, valeursCol]) // eslint-disable-line react-hooks/exhaustive-deps
  const ordreImpose = useMemo(() => ordreDateImpose(datesNumeriques), [datesNumeriques])
  const questionDates = datesNumeriques.length > 0 && ordreImpose === null

  const titres = useMemo(() => vals('titre'), [roles, valeursCol]) // eslint-disable-line react-hooks/exhaustive-deps
  const avecQuantite = useMemo(() => titresAvecQuantite(titres), [titres])
  const detectionSep = useMemo(() => {
    if (!titres.length) return null
    const iQ = col('quantite')
    const comptes = iQ >= 0 ? valeursCol[iQ].map(v => { const n = lireMontant(v); return typeof n === 'number' ? n : null }) : null
    return detecterSeparateur(titres, comptes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titres, roles, valeursCol])
  const sepEffectif: SeparateurArticles | null = separateur === undefined
    ? (modeDecoupage === 'non' ? null : detectionSep?.separateur ?? null)
    : separateur

  const titresArticles = useMemo(
    () => titres.flatMap(t => (t ? decouperCase(t, sepEffectif, avecQuantite).map(a => a.titre) : [])),
    [titres, sepEffectif, avecQuantite],
  )
  const colonneLicence = col('licence') >= 0
  const detectionLicence = useMemo(() => (colonneLicence ? null : detecterFormeLicence(titresArticles)), [colonneLicence, titresArticles])
  const valeursLic: ValeurLicence[] = useMemo(() => {
    if (colonneLicence) return valeursLicence(vals('licence').filter(Boolean))
    const forme = formeLicence === undefined ? detectionLicence?.forme ?? null : formeLicence
    if (!forme) return []
    return valeursLicence(titresArticles.map(t => extraireLicence(t, forme)?.licence ?? '').filter(Boolean))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colonneLicence, detectionLicence, formeLicence, titresArticles, roles, valeursCol])
  const questionLicences = colonneLicence || !!detectionLicence

  const deviseDevinee = useMemo<Devise | null>(() => {
    const echant = [...vals('devise'), ...vals('montant_commande'), ...vals('montant_ligne')].slice(0, 2000)
    const compte = { EUR: 0, USD: 0 }
    for (const v of echant) { const d = deviseEcrite(v); if (d) compte[d]++ }
    if (compte.EUR === 0 && compte.USD === 0) return null
    return compte.EUR >= compte.USD ? 'EUR' : 'USD'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, valeursCol])
  const autresDevises = useMemo(() => [...new Set(vals('devise').map(v => v.trim().toUpperCase()).filter(v => v && !deviseEcrite(v)))], [roles, valeursCol]) // eslint-disable-line react-hooks/exhaustive-deps

  const statutsDefaut = useMemo(
    () => new Set(statutsFichier.filter(([cle]) => STATUT_REGLE.test(sansAccents(cle)) && !STATUT_NON_REGLE.test(sansAccents(cle))).map(([cle]) => cle)),
    [statutsFichier],
  )
  const statutsChoisis = statuts ?? statutsDefaut
  const deviseChoisie = devise ?? deviseDevinee

  type Question = 'statuts' | 'dates' | 'decoupage' | 'licences' | 'final'
  const questions = useMemo(() => {
    const q: Question[] = []
    if (col('statut') >= 0) q.push('statuts')
    if (questionDates) q.push('dates')
    if (detectionSep) q.push('decoupage')
    if (questionLicences) q.push('licences')
    q.push('final')
    return q
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, questionDates, detectionSep, questionLicences])

  // ── Navigation ─────────────────────────────────────────────────────────
  const modePour = (r: Role, i: number) => (r === 'ignorer' ? 'ignorer' : r === rolesDevines[i] ? 'oui' : 'autre')

  function ouvrirColonne(i: number, rolesActuels: Role[] = roles) {
    setMode(modePour(rolesActuels[i], i))
    setAutreRole(rolesActuels[i])
    setEtape({ type: 'colonne', i })
  }

  function allerQuestion(type: Question) {
    setEtape({ type })
  }

  function suivantDepuisQuestion(type: Question) {
    allerQuestion(questions[questions.indexOf(type) + 1])
  }

  function precedentDepuisQuestion(type: Question) {
    const i = questions.indexOf(type)
    if (i <= 0) ouvrirColonne(nbCol - 1)
    else allerQuestion(questions[i - 1])
  }

  function validerColonne(i: number) {
    const role: Role = mode === 'oui' ? rolesDevines[i] : mode === 'ignorer' ? 'ignorer' : autreRole
    const nouveaux = [...roles]
    if (role !== 'ignorer') {
      const ailleurs = nouveaux.findIndex((r, j) => r === role && j !== i)
      if (ailleurs >= 0) nouveaux[ailleurs] = 'ignorer'
    }
    nouveaux[i] = role
    setRoles(nouveaux)
    // après la dernière colonne : 1re question applicable (calculée avec les nouveaux rôles)
    if (i + 1 < nbCol) ouvrirColonne(i + 1, nouveaux)
    else setEtape({ type: 'debut' })
  }

  function association(): Association {
    return {
      version: 1,
      colonnes: roles,
      ordreDate: ordreImpose ?? ordreDate,
      statutsRegles: col('statut') >= 0 ? [...statutsChoisis] : null,
      separateurArticles: sepEffectif,
      formeLicence: colonneLicence ? null : formeLicence === undefined ? detectionLicence?.forme ?? null : formeLicence,
      licences,
      devise: deviseChoisie ?? 'EUR',
      plateforme: plateforme.trim(),
    }
  }

  const licencesNonTranchees = valeursLic.filter(v => !licences[v.cle])
  const emailManquant = col('email') < 0

  // ── Rendu ──────────────────────────────────────────────────────────────
  if (etape.type === 'recap' && memo) {
    const nouveauxStatuts = statutsFichier.filter(([cle]) => !(memo.statutsRegles ?? []).includes(cle))
    const lignesRecap = roles.map((r, i) => ({ r, i })).filter(x => x.r !== 'ignorer')
    return (
      <div className="space-y-4">
        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
          <p className="text-sm text-white font-semibold">On a reconnu ton format « {memo.plateforme} »</p>
          <p className="text-xs text-gray-400 mt-1">
            Voici ce que tu avais validé la dernière fois, avec des exemples tirés de ce nouveau fichier. C’est une proposition :
            vérifie-la, ou revalide tout colonne par colonne si quelque chose ne va pas (par exemple une erreur à l’import précédent).
          </p>
        </div>
        <div className="bg-gray-950/60 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {lignesRecap.map(({ r, i }) => (
                <tr key={i} className="border-b border-gray-800 last:border-0 align-top">
                  <td className="px-4 py-2 text-xs text-gray-400 w-1/3">{tableau.enTetes[i]}</td>
                  <td className="px-4 py-2 text-xs text-white w-1/3">{LIBELLES_ROLES[r]}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{exemples(valeursCol[i], 2).map(v => court(v, 30)).join(' · ') || <em>vide</em>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="text-xs text-gray-400 space-y-1">
          <li><span className="text-gray-500">Devise :</span> {memo.devise === 'EUR' ? 'euros (€)' : 'dollars ($)'}</li>
          {memo.statutsRegles && <li><span className="text-gray-500">Commandes réglées :</span> {statutsFichier.filter(([c]) => memo.statutsRegles!.includes(c)).map(([, v]) => v.libelle).join(', ') || '–'}</li>}
          {nouveauxStatuts.length > 0 && memo.statutsRegles && (
            <li className="text-amber-300/90">Statut(s) jamais vu(s) dans ce fichier, écarté(s) : {nouveauxStatuts.map(([, v]) => `${v.libelle} (${nb(v.nb)})`).join(', ')}</li>
          )}
          {memo.separateurArticles && <li><span className="text-gray-500">Plusieurs articles dans une case séparés par</span> {LIBELLES_SEPARATEURS[memo.separateurArticles]}</li>}
          {valeursLic.length > 0 && <li><span className="text-gray-500">Licences :</span> {valeursLic.map(v => {
            const c = licences[v.cle]
            const cible = !c ? 'à choisir' : c.choix === 'licence' ? besoin.licences.find(l => l.id === c.licence_id)?.nom ?? 'licence supprimée' : c.choix === 'sans_equivalent' ? 'sans équivalent' : 'pas une licence'
            return `${v.libelle} → ${cible}`
          }).join(' · ')}</li>}
          {licencesNonTranchees.length > 0 && <li className="text-amber-300/90">Nouvelle(s) licence(s) dans ce fichier : {licencesNonTranchees.map(v => v.libelle).join(', ')}. Tu vas pouvoir les relier.</li>}
        </ul>
        <div className="flex items-center justify-between gap-4 pt-2">
          <button onClick={() => ouvrirColonne(0)} className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-gray-700 text-gray-200 hover:border-gray-500">
            Tout revalider colonne par colonne
          </button>
          <button
            onClick={() => (licencesNonTranchees.length > 0 ? allerQuestion('licences') : onValide(association()))}
            className="text-sm font-semibold px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            C’est bon, continuer →
          </button>
        </div>
      </div>
    )
  }

  if (etape.type === 'colonne') {
    const i = etape.i
    const devine = rolesDevines[i]
    const valeurs = valeursCol[i]
    const remplies = valeurs.filter(Boolean).length
    const ex = exemples(valeurs)
    const roleChoisi: Role = mode === 'oui' ? devine : mode === 'ignorer' ? 'ignorer' : autreRole
    const ailleurs = roleChoisi !== 'ignorer' ? roles.findIndex((r, j) => r === roleChoisi && j !== i) : -1
    const alerteEmail = roleChoisi === 'email' && remplies > 0 && !valeurs.some(v => v.includes('@'))
    return (
      <div>
        <Progression actuel={i + 1} total={nbCol} libelle={`Colonne ${i + 1} sur ${nbCol}`} />
        <h3 className="text-white font-semibold text-base mb-1">« {tableau.enTetes[i]} »</h3>
        <p className="text-xs text-gray-500 mb-3">{remplies === 0 ? 'Cette colonne est vide dans tout le fichier.' : `Remplie sur ${nb(remplies)} ligne${remplies > 1 ? 's' : ''} sur ${nb(valeurs.length)}.`}</p>
        {ex.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {ex.map(v => <span key={v} className="text-xs px-2 py-1 rounded-md bg-gray-800 text-gray-200 font-mono whitespace-pre-wrap">{court(v)}</span>)}
          </div>
        )}
        <div className="space-y-2">
          {devine !== 'ignorer' && (
            <Choix actif={mode === 'oui'} onClick={() => setMode('oui')}>
              Oui, c’est : <strong>{LIBELLES_ROLES[devine]}</strong>
            </Choix>
          )}
          <Choix actif={mode === 'autre'} onClick={() => setMode('autre')}>
            {devine === 'ignorer' ? 'C’est une information utile :' : 'Non, c’est autre chose :'}
          </Choix>
          {mode === 'autre' && (
            <select
              value={autreRole}
              onChange={e => setAutreRole(e.target.value as Role)}
              className="w-full text-sm bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500"
            >
              {ROLES.filter(r => r !== 'ignorer').map(r => <option key={r} value={r}>{LIBELLES_ROLES[r]}</option>)}
              <option value="ignorer">— choisir —</option>
            </select>
          )}
          <Choix actif={mode === 'ignorer'} onClick={() => setMode('ignorer')}>
            {devine === 'ignorer' ? <>Je pense que tu peux <strong>ignorer cette colonne</strong></> : 'Ignorer cette colonne'}
          </Choix>
        </div>
        {AIDES_ROLES[roleChoisi] && <p className="text-xs text-gray-500 mt-3">{AIDES_ROLES[roleChoisi]}</p>}
        {ailleurs >= 0 && (
          <p className="text-xs text-amber-300/90 mt-3">
            « {LIBELLES_ROLES[roleChoisi]} » était choisi pour la colonne « {tableau.enTetes[ailleurs]} » : elle passera sur « Ignorer ».
          </p>
        )}
        {alerteEmail && <p className="text-xs text-amber-300/90 mt-3">Aucune valeur de cette colonne ne ressemble à un email.</p>}
        <Pied
          onPrecedent={i > 0 ? () => ouvrirColonne(i - 1) : memo ? () => setEtape({ type: 'recap' }) : onAnnuler}
          onSuivant={() => validerColonne(i)}
          desactive={mode === 'autre' && autreRole === 'ignorer'}
          aide="Choisis ce que contient la colonne"
        />
      </div>
    )
  }

  const t: Question = etape.type === 'debut' || etape.type === 'recap' ? questions[0] : etape.type
  const numQuestion = questions.indexOf(t) + 1
  const enteteQuestions = <Progression actuel={Math.max(1, numQuestion)} total={questions.length} libelle="Dernières questions" />

  if (emailManquant) {
    return (
      <div>
        <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          Aucune colonne n’est indiquée comme « {LIBELLES_ROLES.email} ». C’est la seule information obligatoire : sans elle,
          impossible de rattacher une vente à un client.
        </p>
        <Pied onPrecedent={() => ouvrirColonne(0)} onSuivant={() => ouvrirColonne(0)} suivant="Revoir les colonnes" />
      </div>
    )
  }

  if (t === 'statuts') {
    const choisis = statutsChoisis
    return (
      <div>
        {enteteQuestions}
        <h3 className="text-white font-semibold text-base mb-1">Quelles commandes sont réglées ?</h3>
        <p className="text-xs text-gray-500 mb-4">
          Seules les commandes réglées sont importées. Coche les valeurs de la colonne « {tableau.enTetes[col('statut')]} » qui veulent dire « payée ».
          Les autres lignes seront écartées (et comptées à part dans l’aperçu).
        </p>
        <div className="space-y-2">
          {statutsFichier.map(([cle, v]) => (
            <label key={cle} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-800 bg-gray-950/40 cursor-pointer hover:border-gray-700">
              <input
                type="checkbox"
                checked={choisis.has(cle)}
                onChange={e => { const s = new Set(choisis); if (e.target.checked) s.add(cle); else s.delete(cle); setStatuts(s) }}
                className="accent-indigo-500"
              />
              <span className="text-sm text-white flex-1">{v.libelle}</span>
              <span className="text-xs text-gray-500">{nb(v.nb)} ligne{v.nb > 1 ? 's' : ''}</span>
            </label>
          ))}
        </div>
        <Pied onPrecedent={() => precedentDepuisQuestion('statuts')} onSuivant={() => suivantDepuisQuestion('statuts')} desactive={choisis.size === 0} aide="Coche au moins une valeur" />
      </div>
    )
  }

  if (t === 'dates') {
    const ex = datesNumeriques.find(v => { const m = v.match(/^(\d{1,2})[/.-](\d{1,2})/); return m && m[1] !== m[2] }) ?? datesNumeriques[0]
    const [p1, p2] = (ex.match(/^(\d{1,2})[/.-](\d{1,2})/) ?? ['', '1', '2']).slice(1).map(Number)
    const mois = (n: number) => new Date(2000, n - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })
    return (
      <div>
        {enteteQuestions}
        <h3 className="text-white font-semibold text-base mb-1">Dans quel sens sont écrites tes dates ?</h3>
        <p className="text-xs text-gray-500 mb-4">Toutes les dates de ton fichier peuvent se lire dans les deux sens. Exemple tiré du fichier : <span className="font-mono text-gray-300">{ex}</span></p>
        <div className="space-y-2">
          <Choix actif={ordreDate === 'jm'} onClick={() => setOrdreDate('jm')}>Jour / mois (le {p1} {p2 <= 12 ? mois(p2) : `${p2}e mois`}) — format français</Choix>
          <Choix actif={ordreDate === 'mj'} onClick={() => setOrdreDate('mj')}>Mois / jour (le {p2} {p1 <= 12 ? mois(p1) : `${p1}e mois`}) — format américain</Choix>
        </div>
        <Pied onPrecedent={() => precedentDepuisQuestion('dates')} onSuivant={() => suivantDepuisQuestion('dates')} desactive={!ordreDate} aide="Choisis un sens" />
      </div>
    )
  }

  if (t === 'decoupage' && detectionSep) {
    const choixMode = modeDecoupage ?? (separateur === null ? 'non' : separateur && separateur !== detectionSep.separateur ? 'autre' : 'propose')
    const sepApercu: SeparateurArticles | null = choixMode === 'non' ? null : choixMode === 'autre' ? (separateur ?? detectionSep.separateur) : detectionSep.separateur
    const cases = titres.filter(Boolean).map(t => ({ t, articles: decouperCase(t, sepApercu, avecQuantite) })).filter(x => x.articles.length > 1)
    const suspects = cases.filter(x => decoupageSuspect(x.articles))
    const montres = [...suspects.slice(0, 2), ...cases.filter(x => !suspects.includes(x)).slice(0, 3)].slice(0, 4)
    return (
      <div>
        {enteteQuestions}
        <h3 className="text-white font-semibold text-base mb-1">Certaines cases contiennent plusieurs articles ?</h3>
        <p className="text-xs text-gray-500 mb-4">
          Dans la colonne « {tableau.enTetes[col('titre')]} », {nb(detectionSep.nbCases)} cases semblent contenir plusieurs articles séparés par {LIBELLES_SEPARATEURS[detectionSep.separateur]}.
          {detectionSep.prouve
            ? ' ✓ Confirmé par le fichier (le nombre d’articles correspond).'
            : ' Le fichier ne permet pas de le confirmer : vérifie bien les exemples.'}
        </p>
        <div className="space-y-2 mb-4">
          <Choix actif={choixMode === 'propose'} onClick={() => { setModeDecoupage('propose'); setSeparateur(detectionSep.separateur) }}>
            Oui, séparer les articles ({LIBELLES_SEPARATEURS[detectionSep.separateur]})
          </Choix>
          <Choix actif={choixMode === 'autre'} onClick={() => { setModeDecoupage('autre'); setSeparateur(SEPARATEURS_ARTICLES.find(s => s !== detectionSep.separateur) ?? null) }}>
            Oui, mais avec un autre séparateur
          </Choix>
          {choixMode === 'autre' && (
            <select
              value={separateur ?? ''}
              onChange={e => setSeparateur(e.target.value as SeparateurArticles)}
              className="w-full text-sm bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500"
            >
              {SEPARATEURS_ARTICLES.map(s => <option key={s} value={s}>{LIBELLES_SEPARATEURS[s]}</option>)}
            </select>
          )}
          <Choix actif={choixMode === 'non'} onClick={() => { setModeDecoupage('non'); setSeparateur(null) }}>
            Non, ne pas découper (chaque case reste un seul titre)
          </Choix>
        </div>
        {sepApercu && (
          <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-4 space-y-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Exemples de ton fichier, découpés</p>
            {montres.length === 0 && <p className="text-xs text-gray-500">Aucune case découpée avec ce séparateur.</p>}
            {montres.map(x => (
              <div key={x.t} className={`text-xs ${suspects.includes(x) ? 'border-l-2 border-amber-400/70 pl-3' : 'pl-3'}`}>
                <p className="text-gray-500 font-mono mb-1">{court(x.t, 90)}</p>
                {suspects.includes(x) && <p className="text-amber-300/90 mb-1">Ce découpage semble bizarre, vérifie-le :</p>}
                <ul className="text-gray-200 space-y-0.5">{x.articles.map((a, k) => <li key={k}>• {a.titre}{a.quantite > 1 ? ` (× ${a.quantite})` : ''}</li>)}</ul>
              </div>
            ))}
            <p className="text-[11px] text-gray-600">Le total payé de la commande reste celui du fichier ; chaque article d’une case découpée n’a pas de prix à lui.</p>
          </div>
        )}
        <Pied onPrecedent={() => precedentDepuisQuestion('decoupage')} onSuivant={() => { setModeDecoupage(choixMode); if (choixMode === 'propose') setSeparateur(detectionSep.separateur); suivantDepuisQuestion('decoupage') }} />
      </div>
    )
  }

  if (t === 'licences') {
    const forme = colonneLicence ? null : formeLicence === undefined ? detectionLicence?.forme ?? null : formeLicence
    const exemple = !colonneLicence && detectionLicence ? titresArticles.find(t => extraireLicence(t, detectionLicence.forme)) : null
    const exLic = exemple && detectionLicence ? extraireLicence(exemple, detectionLicence.forme) : null
    const ressemble = (v: ValeurLicence) => besoin.licences.find(l => { const n = cleLicence(l.nom); return n.includes(v.cle) || v.cle.includes(n) })
    const valeurChoix = (c: ChoixLicence | undefined) => (!c ? '' : c.choix === 'licence' ? `l:${c.licence_id}` : c.choix)
    return (
      <div>
        {enteteQuestions}
        <h3 className="text-white font-semibold text-base mb-1">
          {colonneLicence ? 'À quelles licences correspondent celles de ton fichier ?' : 'Ta colonne de titres contient aussi la licence ?'}
        </h3>
        {!colonneLicence && detectionLicence && exLic && (
          <>
            <p className="text-xs text-gray-500 mb-3">
              Forme repérée : {LIBELLES_FORMES[detectionLicence.forme]}. Exemple : <span className="font-mono text-gray-300">{exemple}</span> → <strong className="text-white">Beat :</strong> {exLic.titre} · <strong className="text-white">Licence :</strong> {exLic.licence}
            </p>
            <div className="space-y-2 mb-4">
              <Choix actif={forme !== null} onClick={() => setFormeLicence(detectionLicence.forme)}>Oui, séparer le titre et la licence</Choix>
              <Choix actif={forme === null} onClick={() => setFormeLicence(null)}>Non, garder le titre entier</Choix>
            </div>
          </>
        )}
        {(colonneLicence || forme) && (
          <>
            <p className="text-xs text-gray-500 mb-3">
              Pour chaque valeur trouvée, choisis la licence de ta boutique qui correspond. Rien n’est relié tout seul. Une valeur qui n’est pas une
              licence (par exemple « Pro » dans « Abonnements - Pro ») garde son titre entier.
            </p>
            <div className="bg-gray-950/60 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {valeursLic.map(v => {
                    const indice = ressemble(v)
                    return (
                      <tr key={v.cle} className="border-b border-gray-800 last:border-0">
                        <td className="px-4 py-2.5">
                          <span className="text-white">{v.libelle}</span>
                          <span className="text-xs text-gray-500"> · {nb(v.nb)} vente{v.nb > 1 ? 's' : ''}</span>
                          {indice && !licences[v.cle] && <p className="text-[11px] text-indigo-300/80">ressemble à : {indice.nom}</p>}
                        </td>
                        <td className="px-4 py-2.5 w-1/2">
                          <select
                            value={valeurChoix(licences[v.cle])}
                            onChange={e => {
                              const x = e.target.value
                              const c: ChoixLicence | null = x.startsWith('l:') ? { choix: 'licence', licence_id: x.slice(2) } : x === 'sans_equivalent' || x === 'pas_licence' ? { choix: x } : null
                              setLicences(prev => { const n = { ...prev }; if (c) n[v.cle] = c; else delete n[v.cle]; return n })
                            }}
                            className={`w-full text-sm bg-gray-950 border rounded-lg px-2.5 py-2 focus:outline-none focus:border-indigo-500 ${licences[v.cle] ? 'border-gray-700 text-white' : 'border-amber-500/40 text-gray-400'}`}
                          >
                            <option value="">Choisir…</option>
                            {besoin.licences.length > 0 && (
                              <optgroup label="Mes licences My Producer">
                                {besoin.licences.map(l => <option key={l.id} value={`l:${l.id}`}>{l.nom}</option>)}
                              </optgroup>
                            )}
                            <option value="sans_equivalent">Licence sans équivalent chez moi</option>
                            <option value="pas_licence">Ce n’est pas une licence</option>
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        <Pied
          onPrecedent={() => precedentDepuisQuestion('licences')}
          onSuivant={() => suivantDepuisQuestion('licences')}
          desactive={(colonneLicence || forme !== null) && licencesNonTranchees.length > 0}
          aide={`${licencesNonTranchees.length} valeur(s) à choisir`}
        />
      </div>
    )
  }

  // ── Dernière question : devise + plateforme ──
  const nomPropose = /^(orders|wc-|woocommerce)/i.test(nomFichier) ? 'WooCommerce' : ''
  return (
    <div>
      {enteteQuestions}
      <h3 className="text-white font-semibold text-base mb-4">Dernières précisions</h3>
      <p className="text-sm text-gray-300 mb-2">Dans quelle devise sont tes montants ?</p>
      {autresDevises.length > 0 && (
        <p className="text-xs text-red-300 mb-2">Ton fichier contient d’autres devises ({autresDevises.slice(0, 5).join(', ')}) : seuls les euros et les dollars sont acceptés pour l’instant. Ces lignes seront refusées par l’aperçu si leurs montants ne sont pas en € ou $.</p>
      )}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <Choix actif={deviseChoisie === 'EUR'} onClick={() => setDevise('EUR')}>Euros (€)</Choix>
        <Choix actif={deviseChoisie === 'USD'} onClick={() => setDevise('USD')}>Dollars ($)</Choix>
      </div>
      {deviseChoisie === 'USD' && <p className="text-xs text-gray-500 -mt-3 mb-5">Convertis en euros au taux officiel de la BCE du jour de chaque vente, figé à l’import.</p>}
      <p className="text-sm text-gray-300 mb-2">D’où viennent ces ventes ?</p>
      <input
        value={plateforme}
        onChange={e => setPlateforme(e.target.value)}
        placeholder={nomPropose || 'Airbit, Instrurap, Mon site…'}
        maxLength={40}
        className="w-full text-sm bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
      />
      <p className="text-xs text-gray-500 mt-1.5">Affiché sur chaque commande importée (« WooCommerce », « Airbit »…). Garde le même nom à chaque import : c’est avec lui que les doublons sont reconnus.</p>
      {nomPropose && !plateforme && (
        <button onClick={() => setPlateforme(nomPropose)} className="text-xs text-indigo-400 hover:text-indigo-300 mt-1">Utiliser « {nomPropose} »</button>
      )}
      <Pied
        onPrecedent={() => precedentDepuisQuestion('final')}
        onSuivant={() => onValide(association())}
        suivant="Voir l’aperçu →"
        desactive={!deviseChoisie || !plateforme.trim() || emailManquant}
        aide={emailManquant ? 'Il manque la colonne email' : !deviseChoisie ? 'Choisis la devise' : 'Indique la plateforme'}
      />
    </div>
  )
}
