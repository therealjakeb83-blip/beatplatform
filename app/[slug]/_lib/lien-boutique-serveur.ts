import { headers } from 'next/headers'
import { estHotePlateforme, lienBoutique } from '@/lib/domaine-boutique'

export async function surDomaineBoutique(): Promise<boolean> {
  return !estHotePlateforme((await headers()).get('host'))
}

export async function lienBoutiqueServeur(slug: string): Promise<(chemin?: string) => string> {
  const surDomaine = await surDomaineBoutique()
  return (chemin = '') => lienBoutique(slug, chemin, surDomaine)
}
