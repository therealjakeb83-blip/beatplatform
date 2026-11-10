// Appels à l'API Domains de Vercel. Une panne de Vercel ou une clé invalide
// lève VercelIndisponible : cela ne dit rien de l'état du domaine du beatmaker.

import { domaineInterdit } from '@/lib/domaine-regles'

const API_VERCEL = 'https://api.vercel.com'
const DELAI_MS = 10_000

export class VercelIndisponible extends Error {}

export type DomaineVercel = {
  name: string
  apexName: string
  verified: boolean
  verification?: { type: string; domain: string; value: string; reason: string }[]
}

export type ConfigurationVercel = {
  misconfigured: boolean
  recommendedIPv4?: { rank: number; value: string[] }[]
  recommendedCNAME?: { rank: number; value: string }[]
}

type ReponseVercel = { status: number; corps: Record<string, unknown> | null }

function cheminProjet(suite: string): string {
  const projet = process.env.VERCEL_PROJET
  if (!projet) throw new VercelIndisponible('VERCEL_PROJET manquante')
  return `/projects/${encodeURIComponent(projet)}/domains${suite}`
}

async function appelVercel(chemin: string, init?: { method: string; body?: unknown }): Promise<ReponseVercel> {
  const token = process.env.VERCEL_TOKEN_DOMAINES
  if (!token) throw new VercelIndisponible('VERCEL_TOKEN_DOMAINES manquante')

  let reponse: Response
  try {
    reponse = await fetch(`${API_VERCEL}${chemin}`, {
      method: init?.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(DELAI_MS),
    })
  } catch (err) {
    throw new VercelIndisponible(err instanceof Error ? err.message : 'Vercel injoignable')
  }
  const corps = (await reponse.json().catch(() => null)) as Record<string, unknown> | null
  return { status: reponse.status, corps }
}

function panne(chemin: string, r: ReponseVercel): VercelIndisponible {
  const erreur = r.corps?.error as { code?: string; message?: string } | undefined
  return new VercelIndisponible(`${chemin} : ${r.status} ${erreur?.code ?? ''} ${erreur?.message ?? ''}`.trim())
}

function jetonRefuse(r: ReponseVercel): boolean {
  const erreur = r.corps?.error as { invalidToken?: boolean; missingToken?: boolean } | undefined
  return !!(erreur?.invalidToken || erreur?.missingToken)
}

export async function lireDomaine(nom: string): Promise<DomaineVercel | null> {
  const chemin = `/v9${cheminProjet(`/${encodeURIComponent(nom)}`)}`
  const r = await appelVercel(chemin)
  if (r.status === 404) return null
  if (r.status !== 200) throw panne(chemin, r)
  return r.corps as unknown as DomaineVercel
}

export type ResultatAjout =
  | { ok: true; domaine: DomaineVercel }
  | { ok: false; raison: 'invalide' | 'pris_ailleurs' }

export async function ajouterAuProjet(nom: string, redirigeVers?: string): Promise<ResultatAjout> {
  const chemin = `/v10${cheminProjet('')}`
  const body = redirigeVers ? { name: nom, redirect: redirigeVers, redirectStatusCode: 308 } : { name: nom }
  const r = await appelVercel(chemin, { method: 'POST', body })
  if (r.status === 200) return { ok: true, domaine: r.corps as unknown as DomaineVercel }

  const refusDuDomaine = r.status === 400 || r.status === 409 || (r.status === 403 && !jetonRefuse(r))
  if (!refusDuDomaine) throw panne(chemin, r)

  const existant = await lireDomaine(nom)
  if (existant) return { ok: true, domaine: existant }
  return { ok: false, raison: r.status === 400 ? 'invalide' : 'pris_ailleurs' }
}

export async function validerDomaine(nom: string): Promise<DomaineVercel | null> {
  const chemin = `/v9${cheminProjet(`/${encodeURIComponent(nom)}/verify`)}`
  const r = await appelVercel(chemin, { method: 'POST' })
  if (r.status === 400 || r.status === 404) return null
  if (r.status !== 200) throw panne(chemin, r)
  return r.corps as unknown as DomaineVercel
}

export async function lireConfiguration(nom: string): Promise<ConfigurationVercel> {
  const projet = process.env.VERCEL_PROJET
  if (!projet) throw new VercelIndisponible('VERCEL_PROJET manquante')
  const chemin = `/v6/domains/${encodeURIComponent(nom)}/config?projectIdOrName=${encodeURIComponent(projet)}`
  const r = await appelVercel(chemin)
  if (r.status !== 200) throw panne(chemin, r)
  return r.corps as unknown as ConfigurationVercel
}

// Retire aussi la version www, qui redirige vers ce domaine.
export async function retirerDuProjet(nom: string): Promise<void> {
  if (domaineInterdit(nom)) throw new Error(`Retrait refusé pour ${nom}`)
  const chemin = `/v9${cheminProjet(`/${encodeURIComponent(nom)}`)}`
  const r = await appelVercel(chemin, { method: 'DELETE', body: { removeRedirects: true } })
  if (r.status !== 200 && r.status !== 404) throw panne(chemin, r)
  if (await lireDomaine(nom)) {
    throw new VercelIndisponible(`${chemin} : DELETE ${r.status} ${JSON.stringify(r.corps).slice(0, 300)}, domaine toujours présent`)
  }
}
