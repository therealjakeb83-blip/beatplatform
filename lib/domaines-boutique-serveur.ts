// Vie d'un domaine personnalisé côté serveur : branchement, vérification,
// retrait, libération. La base est écrite en premier pour réserver le domaine :
// deux boutiques ne peuvent pas le prendre en même temps.

import { createAdminClient } from '@/utils/supabase/admin'
import { EMAIL_CONTACT } from '@/lib/constantes'
import { CHEMIN_SONDE, SIGNATURE_SONDE } from '@/lib/domaine-boutique'
import {
  ajouterVerification,
  causeCourte,
  construireLignesDns,
  deciderStatut,
  JOURS_AVANT_LIBERATION,
  type ConstatDomaine,
  type DomaineBoutique,
} from '@/lib/domaine-regles'
import {
  ajouterAuProjet,
  lireConfiguration,
  lireDomaine,
  retirerDuProjet,
  validerDomaine,
  VercelIndisponible,
  type ConfigurationVercel,
  type DomaineVercel,
} from '@/lib/vercel-domaines'
import { envoyerDomaineActif, envoyerDomaineLibere, envoyerDomaineProbleme } from '@/lib/emails'
import { assurerDomainePaiement } from '@/lib/stripe-domaines-paiement'

export const COLONNES_DOMAINE =
  'id, beatmaker_id, domaine, statut, domaine_entier, lignes_dns, explication, echecs_consecutifs, derniere_verification_le, premiere_activation_le, premier_echec_le, dernieres_verifications, created_at'

export type ResultatDomaine =
  | { ok: true; domaine: DomaineBoutique | null; verificationImpossible?: boolean }
  | { ok: false; erreur: string; status: number; detail?: string }

const MESSAGE_INDISPONIBLE = 'Le service est momentanément indisponible. Réessaie dans quelques minutes.'

async function emailDuBeatmaker(beatmakerId: string): Promise<string | null> {
  const { data } = await createAdminClient().from('beatmakers').select('email').eq('id', beatmakerId).maybeSingle()
  return (data?.email as string | null | undefined) ?? null
}

async function sonder(domaine: string): Promise<boolean> {
  try {
    const reponse = await fetch(`https://${domaine}${CHEMIN_SONDE}`, {
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    })
    if (!reponse.ok) return false
    const corps = (await reponse.json().catch(() => null)) as { sonoo?: string } | null
    return corps?.sonoo === SIGNATURE_SONDE
  } catch {
    return false
  }
}

function premierCname(config: ConfigurationVercel): string | null {
  return [...(config.recommendedCNAME ?? [])].sort((a, b) => a.rank - b.rank)[0]?.value ?? null
}

function premiereIp(config: ConfigurationVercel): string | null {
  return [...(config.recommendedIPv4 ?? [])].sort((a, b) => a.rank - b.rank)[0]?.value?.[0] ?? null
}

async function assurerVersionWww(domaine: string): Promise<void> {
  const www = `www.${domaine}`
  if (await lireDomaine(www)) return
  const resultat = await ajouterAuProjet(www, domaine)
  if (!resultat.ok) console.error(`[domaines] Version www refusée pour ${domaine} : ${resultat.raison}`)
}

async function calculerLignes(domaine: string, vercel: DomaineVercel, config: ConfigurationVercel) {
  const entier = vercel.apexName === domaine
  const configWww = entier ? await lireConfiguration(`www.${domaine}`) : null
  return construireLignesDns({
    domaine,
    apex: vercel.apexName,
    ipv4: premiereIp(config),
    cname: premierCname(config),
    cnameWww: configWww ? premierCname(configWww) : null,
    verification: vercel.verified ? [] : vercel.verification ?? [],
  })
}

// Apple Pay / Google Pay prêts dès l'activation, sans attendre le premier
// client : compte Stripe du vendeur (paiement habituel) et compte Sonoo
// (panier collab). Rattrapé au paiement par contexte-paiement en cas d'échec.
async function declarerDomainePaiement(ligne: DomaineBoutique) {
  const { data } = await createAdminClient().from('beatmakers').select('stripe_account_id').eq('id', ligne.beatmaker_id).maybeSingle()
  const comptes = [undefined, (data?.stripe_account_id as string | null) ?? undefined]
  await Promise.all([...new Set(comptes)].map(compte =>
    assurerDomainePaiement(ligne.domaine, compte).catch(err =>
      console.error('[domaines] Déclaration Apple Pay / Google Pay :', err instanceof Error ? err.message : err)),
  ))
}

async function notifierChangement(ligne: DomaineBoutique, nouveauStatut: string, explication: string | null) {
  if (nouveauStatut === 'actif') await declarerDomainePaiement(ligne)
  try {
    const to = await emailDuBeatmaker(ligne.beatmaker_id)
    if (!to) return
    if (nouveauStatut === 'actif') {
      await envoyerDomaineActif({ to, beatmakerId: ligne.beatmaker_id, domaine: ligne.domaine })
    } else if (nouveauStatut === 'probleme' && ligne.statut === 'actif') {
      await envoyerDomaineProbleme({
        to,
        beatmakerId: ligne.beatmaker_id,
        domaine: ligne.domaine,
        explication: explication ?? '',
      })
    }
  } catch (err) {
    console.error('[domaines] Email de statut :', err instanceof Error ? err.message : err)
  }
}

export async function verifierDomaine(
  ligne: DomaineBoutique,
): Promise<{ domaine: DomaineBoutique; verificationImpossible: boolean }> {
  const admin = createAdminClient()
  const instant = new Date()
  const maintenant = instant.toISOString()

  let constat: ConstatDomaine = { present: false, verifie: false, configurationOk: false, sondeOk: false }
  let lignes = ligne.lignes_dns
  let entier = ligne.domaine_entier

  try {
    let vercel = await lireDomaine(ligne.domaine)
    if (vercel && !vercel.verified) {
      const valide = await validerDomaine(ligne.domaine)
      if (valide?.verified) vercel = { ...vercel, verified: true }
    }
    if (vercel) {
      const config = await lireConfiguration(ligne.domaine)
      entier = vercel.apexName === ligne.domaine
      if (ligne.statut !== 'actif' || lignes.length === 0) {
        lignes = await calculerLignes(ligne.domaine, vercel, config)
        if (entier) await assurerVersionWww(ligne.domaine)
      }
      const configurationOk = vercel.verified && !config.misconfigured
      constat = {
        present: true,
        verifie: vercel.verified,
        configurationOk,
        sondeOk: configurationOk ? await sonder(ligne.domaine) : false,
      }
    }
  } catch (err) {
    if (!(err instanceof VercelIndisponible)) throw err
    console.error(`[domaines] Vérification impossible pour ${ligne.domaine} :`, err.message)
    await admin
      .from('domaines_boutique')
      .update({ derniere_verification_le: maintenant })
      .eq('id', ligne.id)
    return { domaine: ligne, verificationImpossible: true }
  }

  const decision = deciderStatut(ligne.statut, ligne.echecs_consecutifs, ligne.premier_echec_le, constat, instant)
  const cause = causeCourte(constat)
  const { data } = await admin
    .from('domaines_boutique')
    .update({
      statut: decision.statut,
      echecs_consecutifs: decision.echecs,
      premier_echec_le: decision.premierEchecLe,
      dernieres_verifications: ajouterVerification(ligne.dernieres_verifications, { le: maintenant, ok: cause === null, cause }),
      explication: decision.explication,
      lignes_dns: lignes,
      domaine_entier: entier,
      derniere_verification_le: maintenant,
      premiere_activation_le: decision.statut === 'actif' ? ligne.premiere_activation_le ?? maintenant : ligne.premiere_activation_le,
      updated_at: maintenant,
    })
    .eq('id', ligne.id)
    .eq('domaine', ligne.domaine)
    .eq('statut', ligne.statut)
    .select(COLONNES_DOMAINE)
    .maybeSingle()

  if (!data) return { domaine: ligne, verificationImpossible: false }
  if (decision.statut !== ligne.statut) await notifierChangement(ligne, decision.statut, decision.explication)
  return { domaine: data as unknown as DomaineBoutique, verificationImpossible: false }
}

function nouvellesValeurs(domaine: string) {
  const maintenant = new Date().toISOString()
  return {
    domaine,
    statut: 'en_attente',
    domaine_entier: false,
    lignes_dns: [],
    explication: null,
    echecs_consecutifs: 0,
    derniere_verification_le: null,
    premiere_activation_le: null,
    premier_echec_le: null,
    dernieres_verifications: [],
    created_at: maintenant,
    updated_at: maintenant,
  }
}

async function remettreEnEtat(id: string, avant: DomaineBoutique | null) {
  const admin = createAdminClient()
  if (!avant) {
    await admin.from('domaines_boutique').delete().eq('id', id)
    return
  }
  await admin
    .from('domaines_boutique')
    .update({
      domaine: avant.domaine,
      statut: avant.statut,
      domaine_entier: avant.domaine_entier,
      lignes_dns: avant.lignes_dns,
      explication: avant.explication,
      echecs_consecutifs: avant.echecs_consecutifs,
      derniere_verification_le: avant.derniere_verification_le,
      premiere_activation_le: avant.premiere_activation_le,
      premier_echec_le: avant.premier_echec_le,
      dernieres_verifications: avant.dernieres_verifications,
      created_at: avant.created_at,
    })
    .eq('id', id)
}

export async function brancherDomaine(beatmakerId: string, domaine: string): Promise<ResultatDomaine> {
  const admin = createAdminClient()
  const { data: existante } = await admin
    .from('domaines_boutique')
    .select(COLONNES_DOMAINE)
    .eq('beatmaker_id', beatmakerId)
    .maybeSingle()
  const avant = existante as unknown as DomaineBoutique | null
  if (avant?.domaine === domaine) return { ok: true, domaine: avant }

  const valeurs = nouvellesValeurs(domaine)
  const { data: reservee, error } = avant
    ? await admin.from('domaines_boutique').update(valeurs).eq('id', avant.id).select(COLONNES_DOMAINE).single()
    : await admin.from('domaines_boutique').insert({ ...valeurs, beatmaker_id: beatmakerId }).select(COLONNES_DOMAINE).single()

  if (error || !reservee) {
    if (error?.code === '23505') {
      return { ok: false, erreur: `Ce domaine est déjà utilisé par une autre boutique. S'il est bien à toi, écris-nous à ${EMAIL_CONTACT}.`, status: 409 }
    }
    console.error('[domaines] Réservation :', error?.message)
    return { ok: false, erreur: "Impossible d'enregistrer ce domaine pour le moment.", status: 500 }
  }
  const ligne = reservee as unknown as DomaineBoutique

  try {
    const ajout = await ajouterAuProjet(domaine)
    if (!ajout.ok) {
      await remettreEnEtat(ligne.id, avant)
      return ajout.raison === 'invalide'
        ? { ok: false, erreur: "Cette adresse n'est pas acceptée. Vérifie qu'elle est bien écrite.", status: 400 }
        : { ok: false, erreur: 'Ce domaine est déjà utilisé sur un autre site. Il doit y être retiré avant de pouvoir être branché ici.', status: 409 }
    }
    if (ajout.domaine.apexName === domaine) {
      await assurerVersionWww(domaine).catch(err => console.error('[domaines] Version www :', err))
    }
  } catch (err) {
    if (!(err instanceof VercelIndisponible)) throw err
    console.error('[domaines] Ajout impossible :', err.message)
    await remettreEnEtat(ligne.id, avant)
    return { ok: false, erreur: MESSAGE_INDISPONIBLE, status: 503 }
  }

  if (avant) {
    await retirerDuProjet(avant.domaine).catch(err =>
      console.error(`[domaines] Ancien domaine ${avant.domaine} non retiré :`, err instanceof Error ? err.message : err),
    )
  }

  const verification = await verifierDomaine(ligne)
  return { ok: true, domaine: verification.domaine, verificationImpossible: verification.verificationImpossible }
}

export async function retirerDomaine(beatmakerId: string): Promise<ResultatDomaine> {
  const admin = createAdminClient()
  const { data: existante } = await admin
    .from('domaines_boutique')
    .select('id, domaine')
    .eq('beatmaker_id', beatmakerId)
    .maybeSingle()
  if (!existante) return { ok: true, domaine: null }

  try {
    await retirerDuProjet(existante.domaine as string)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('[domaines] Retrait impossible :', detail)
    return { ok: false, erreur: MESSAGE_INDISPONIBLE, status: 503, detail }
  }
  await admin.from('domaines_boutique').delete().eq('id', existante.id)
  return { ok: true, domaine: null }
}

const UNE_HEURE_MS = 60 * 60 * 1000

// Chaque passage pendant les 48 h que peut prendre un réglage DNS, puis toutes
// les heures. Un domaine actif qui vient d'échouer est revérifié à chaque passage
// (toutes les 10 min) jusqu'à confirmer ou écarter la panne.
export async function domainesAVerifier(limite: number): Promise<DomaineBoutique[]> {
  const ilYAUneHeure = new Date(Date.now() - UNE_HEURE_MS).toISOString()
  const ilYA48Heures = new Date(Date.now() - 48 * UNE_HEURE_MS).toISOString()
  const { data, error } = await createAdminClient()
    .from('domaines_boutique')
    .select(COLONNES_DOMAINE)
    .or(
      `statut.eq.probleme,echecs_consecutifs.gt.0,derniere_verification_le.is.null,derniere_verification_le.lt."${ilYAUneHeure}",and(statut.eq.en_attente,created_at.gt."${ilYA48Heures}")`,
    )
    .order('derniere_verification_le', { ascending: true, nullsFirst: true })
    .limit(limite)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as DomaineBoutique[]
}

export async function libererDomainesOublies(limite: number): Promise<number> {
  const admin = createAdminClient()
  const dateLimite = new Date(Date.now() - JOURS_AVANT_LIBERATION * 24 * UNE_HEURE_MS).toISOString()
  const { data } = await admin
    .from('domaines_boutique')
    .select('id, beatmaker_id, domaine')
    .eq('statut', 'en_attente')
    .is('premiere_activation_le', null)
    .lt('created_at', dateLimite)
    .limit(limite)

  let liberes = 0
  for (const ligne of data ?? []) {
    try {
      await retirerDuProjet(ligne.domaine as string)
    } catch (err) {
      console.error(`[domaines] Libération de ${ligne.domaine} reportée :`, err instanceof Error ? err.message : err)
      continue
    }
    const { data: supprimee } = await admin
      .from('domaines_boutique')
      .delete()
      .eq('id', ligne.id)
      .eq('statut', 'en_attente')
      .select('id')
      .maybeSingle()
    if (!supprimee) continue
    liberes++
    const to = await emailDuBeatmaker(ligne.beatmaker_id as string)
    if (to) {
      await envoyerDomaineLibere({ to, beatmakerId: ligne.beatmaker_id as string, domaine: ligne.domaine as string }).catch(err =>
        console.error('[domaines] Email de libération :', err instanceof Error ? err.message : err),
      )
    }
  }
  return liberes
}
