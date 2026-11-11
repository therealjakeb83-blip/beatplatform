// Branchement d'un domaine (rang 9c, lot 2) : règles pures, sans accès réseau,
// partagées par le serveur et la page du dashboard.

import { DOMAINE_PLATEFORME } from '@/lib/constantes'

export type StatutDomaine = 'en_attente' | 'actif' | 'probleme'

export type LigneDns = {
  type: 'A' | 'CNAME' | 'TXT'
  hote: string
  valeur: string
}

export type DomaineBoutique = {
  id: string
  beatmaker_id: string
  domaine: string
  statut: StatutDomaine
  domaine_entier: boolean
  lignes_dns: LigneDns[]
  explication: string | null
  echecs_consecutifs: number
  derniere_verification_le: string | null
  premiere_activation_le: string | null
  created_at: string
}

export const ECHECS_AVANT_PROBLEME = 3
export const JOURS_AVANT_LIBERATION = 30

export type ResultatSaisie = { ok: true; domaine: string } | { ok: false; erreur: string }

const ADRESSE_INVALIDE = "Cette adresse n'est pas valide. Exemple attendu : monsite.com ou beats.monsite.com."
const LABEL_VALIDE = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/
const EXTENSION_VALIDE = /^(?:xn--[a-z0-9-]+|[a-z]{2,63})$/

// Jamais une adresse de la plateforme : le retrait d'un domaine débrancherait Sonoo.
export function domaineInterdit(domaine: string): boolean {
  const reservees = [DOMAINE_PLATEFORME, 'vercel.app', 'vercel.com', 'localhost']
  return reservees.some(r => domaine === r || domaine.endsWith(`.${r}`))
}

// « www » est retiré : la version www d'un domaine redirige toujours vers le domaine entier.
export function normaliserDomaine(saisie: string): ResultatSaisie {
  const texte = saisie.trim().toLowerCase().replace(/^[a-z]+:\/\//, '')
  if (!texte) return { ok: false, erreur: 'Indique ton adresse.' }
  if (texte.includes('@')) return { ok: false, erreur: "Indique l'adresse de ton site, pas une adresse email." }

  let hote: string
  try {
    hote = new URL(`https://${texte}`).hostname
  } catch {
    return { ok: false, erreur: ADRESSE_INVALIDE }
  }
  const domaine = hote.replace(/\.$/, '').replace(/^www\./, '')

  const morceaux = domaine.split('.')
  const valide =
    domaine.length <= 253 &&
    morceaux.length >= 2 &&
    morceaux.every(m => LABEL_VALIDE.test(m)) &&
    EXTENSION_VALIDE.test(morceaux[morceaux.length - 1])
  if (!valide) return { ok: false, erreur: ADRESSE_INVALIDE }
  if (domaineInterdit(domaine)) return { ok: false, erreur: 'Cette adresse ne peut pas être utilisée.' }

  return { ok: true, domaine }
}

function hoteRelatif(nom: string, apex: string): string {
  return nom === apex ? '@' : nom.slice(0, -(apex.length + 1))
}

function sansPointFinal(valeur: string): string {
  return valeur.replace(/\.$/, '')
}

export function construireLignesDns(params: {
  domaine: string
  apex: string
  ipv4: string | null
  cname: string | null
  cnameWww: string | null
  verification: { type: string; domain: string; value: string }[]
}): LigneDns[] {
  const { domaine, apex, ipv4, cname, cnameWww, verification } = params
  const lignes: LigneDns[] = []

  if (domaine === apex) {
    if (ipv4) lignes.push({ type: 'A', hote: '@', valeur: ipv4 })
    if (cnameWww) lignes.push({ type: 'CNAME', hote: 'www', valeur: sansPointFinal(cnameWww) })
  } else if (cname) {
    lignes.push({ type: 'CNAME', hote: hoteRelatif(domaine, apex), valeur: sansPointFinal(cname) })
  }

  for (const v of verification) {
    if (v.type === 'TXT') lignes.push({ type: 'TXT', hote: hoteRelatif(v.domain, apex), valeur: v.value })
  }
  return lignes
}

export type ConstatDomaine = {
  present: boolean
  verifie: boolean
  configurationOk: boolean
  sondeOk: boolean
}

function causeDuConstat(c: ConstatDomaine, aDejaMarche: boolean): string {
  if (!c.present) return "Ce domaine n'est plus enregistré de notre côté. Retire-le puis branche-le à nouveau."
  if (!c.verifie) return 'Ajoute la ligne TXT ci-dessous : elle prouve que ce domaine est bien à toi.'
  if (!c.configurationOk && aDejaMarche) {
    return "Les lignes ci-dessous ne sont plus visibles chez le site où tu as acheté ton domaine. Vérifie qu'elles n'ont pas été modifiées ou supprimées."
  }
  if (!c.configurationOk) return "Les lignes ci-dessous ne sont pas encore visibles. Après un ajout, cela peut prendre jusqu'à 48 h."
  return 'Les lignes sont bonnes. La connexion sécurisée est en cours de création, encore quelques minutes.'
}

// Un domaine qui a déjà marché ne bascule en « Problème » qu'après plusieurs
// échecs de suite : une coupure de quelques minutes ne doit alerter personne.
export function deciderStatut(
  ancien: StatutDomaine,
  echecs: number,
  constat: ConstatDomaine,
): { statut: StatutDomaine; echecs: number; explication: string | null } {
  if (constat.present && constat.verifie && constat.configurationOk && constat.sondeOk) {
    return { statut: 'actif', echecs: 0, explication: null }
  }
  const explication = causeDuConstat(constat, ancien !== 'en_attente')
  if (ancien === 'en_attente') {
    return { statut: constat.present ? 'en_attente' : 'probleme', echecs: 0, explication }
  }
  const total = echecs + 1
  if (ancien === 'actif' && total < ECHECS_AVANT_PROBLEME) {
    return { statut: 'actif', echecs: total, explication: null }
  }
  return { statut: 'probleme', echecs: total, explication }
}

export function promptAssistantDns(domaine: string, lignes: LigneDns[]): string {
  const detail = lignes
    .map(l => `- Type : ${l.type} | Nom (hôte) : ${l.hote} | Valeur : ${l.valeur}`)
    .join('\n')
  return `Je veux relier mon nom de domaine ${domaine} à ma boutique en ligne. Je débute : guide-moi étape par étape, avec les menus exacts où cliquer.

Voici les lignes DNS à ajouter :
${detail}

Consignes importantes :
- Demande-moi d'abord chez quel fournisseur mon domaine est géré (GoDaddy, OVH, Namecheap, Cloudflare...).
- Si une ligne existe déjà avec le même type et le même nom, elle doit être remplacée par la mienne. Une ligne AAAA sur le même nom doit être supprimée.
- Ne touche jamais aux lignes MX ni aux autres lignes TXT : elles servent à mes emails.
- Si mon fournisseur est Cloudflare, les lignes doivent être en mode « DNS only » (nuage gris).
- Si le nom "@" n'est pas accepté, dis-moi quoi mettre à la place chez ce fournisseur.
- À la fin, rappelle-moi que la prise en compte peut prendre jusqu'à 48 h.`
}
