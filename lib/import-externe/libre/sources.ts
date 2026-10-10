import { SOURCES_MARKETING } from '@/lib/sources-marketing'
import { cleLicence } from './association'

// Colonne « source / origine » d'un fichier : chaque valeur (youtube, YT,
// insta, IG, mail…) est reliée par le beatmaker à l'une des 9 sources marketing
// du CRM. Les correspondances évidentes sont pré-remplies (décision de Jake,
// 2026-10-10), toujours modifiables ; « mail » et les valeurs inconnues restent
// à choisir à la main.

export type SourceMarketing = (typeof SOURCES_MARKETING)[number]
export type ChoixSource = SourceMarketing | 'aucune'

export const cleSource = cleLicence

export type ValeurSource = { cle: string; libelle: string; nb: number }

export function valeursSource(brutes: string[]): ValeurSource[] {
  const parCle = new Map<string, { libelles: Map<string, number>; nb: number }>()
  for (const b of brutes) {
    const libelle = b.trim()
    const cle = cleSource(libelle)
    if (!cle) continue
    const v = parCle.get(cle) ?? { libelles: new Map(), nb: 0 }
    v.nb++
    v.libelles.set(libelle, (v.libelles.get(libelle) ?? 0) + 1)
    parCle.set(cle, v)
  }
  return [...parCle].map(([cle, v]) => ({ cle, libelle: [...v.libelles].sort((a, b) => b[1] - a[1])[0][0], nb: v.nb }))
    .sort((a, b) => b.nb - a.nb || a.libelle.localeCompare(b.libelle, 'fr'))
}

// Correspondance évidente, ou null (à choisir à la main)
export function suggererSource(cle: string): SourceMarketing | null {
  const c = cle.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  // clic depuis un outil d'emailing = newsletter ; depuis une messagerie (Gmail,
  // « mail ») = ambigu → au beatmaker de choisir
  if (/(newsletter|sendinblue|sendib|brevo|mailchimp|klaviyo|mailerlite)/.test(c)) return 'newsletter'
  if (/(mail|\bgm\b|outlook|yahoo)/.test(c)) return null
  if (/\b(youtube|yt) ?ads?\b/.test(c)) return 'youtube_ads'
  if (/\bgoogle ?ads?\b|\badwords\b/.test(c)) return 'google_ads'
  if (/\b(youtube|yt|youtu be)\b/.test(c)) return 'youtube'
  if (/\b(instagram|insta|ig)\b/.test(c)) return 'instagram'
  if (/\b(tiktok|tik tok|tt)\b/.test(c)) return 'tiktok'
  if (/\b(google|seo|organique|organic)\b/.test(c)) return 'google'
  if (/\b(direct|directe)\b/.test(c)) return 'direct'
  return null
}
