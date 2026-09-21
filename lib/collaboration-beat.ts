import type { SupabaseClient } from '@supabase/supabase-js'
import { normaliserEmail } from '@/lib/email'
import { validerRepartition, type Participant } from '@/lib/collaboration-parts'
import { STATUTS_OUVERTS, verifierPlancherLicences, journaliserCollaboration } from '@/lib/collaboration'
import { envoyerInvitationCollab } from '@/lib/emails'

// Traitement des collaborateurs à l'enregistrement d'un beat (création ou
// modification) — Phase 12. Règles :
//   - A ne peut JAMAIS modifier ni supprimer une collaboration existante par
//     cette voie (la part est verrouillée ; retirer une invitation, quitter ou
//     évincer passent par leurs propres routes, avec journal et notification)
//   - toute nouvelle personne est ajoutée à l'état « invitée »
//   - la répartition complète (A + collaborateurs) doit respecter les règles
//     (10 % minimum chacun, 3 collaborateurs maximum, prix plancher)

export type CollaborateurEntrant = {
  id?: string
  type?: 'compte' | 'email'
  beatmaker_id?: string
  email_invite?: string
  pourcentage: number
}

export type NouvelleInvitation = {
  id: string
  beatmaker_id: string | null
  email_invite: string | null
  pourcentage: number
  nom_collaborateur: string
}

type Resultat = { ok: true; nouvelles: NouvelleInvitation[] } | { ok: false; erreur: string; status: number }

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Message volontairement neutre : il ne dit jamais POURQUOI l'adresse est
// refusée (sinon A pourrait deviner quelles adresses appartiennent à des
// artistes/clients).
export const MESSAGE_ADRESSE_REFUSEE =
  'Cette adresse ne peut pas recevoir d’invitation. Invite la personne par son @slug si elle a un compte beatmaker, ou utilise une autre adresse.'

/**
 * Vrai si l'adresse appartient à un compte artiste/client existant qui n'est
 * pas aussi un compte beatmaker : les espaces artiste et beatmaker restent
 * séparés, une invitation envoyée à cette adresse serait une invitation morte.
 */
export async function emailBloquePourInvitation(admin: SupabaseClient, email: string): Promise<boolean> {
  const { data: client } = await admin.from('clients').select('id').eq('email', email).limit(1).maybeSingle()
  if (!client) return false
  const { data: beatmaker } = await admin.from('beatmakers').select('id').eq('email', email).limit(1).maybeSingle()
  return !beatmaker
}

export async function traiterCollaborateursBeat(params: {
  admin: SupabaseClient
  beatId: string
  proprietaireId: string
  collaborateurs: CollaborateurEntrant[] | undefined
  licencesActivesIds: string[] | undefined
  exclusifPrixOverride?: number | string | null
  exclusifSurDemande?: boolean
}): Promise<Resultat> {
  const { admin, beatId, proprietaireId } = params
  const entrants = params.collaborateurs ?? []

  const { data: existantsRaw } = await admin
    .from('beat_splits')
    .select('id, beatmaker_id, email_invite, pourcentage, statut')
    .eq('beat_id', beatId)
    .in('statut', STATUTS_OUVERTS)
  const existants = (existantsRaw ?? []) as { id: string; beatmaker_id: string | null; email_invite: string | null; pourcentage: number; statut: string }[]
  const idsExistants = new Set(existants.map(e => e.id))

  const aAjouter = entrants.filter(c => !c.id || !idsExistants.has(c.id))

  // Beat sans aucune collaboration et personne à ajouter : rien à valider.
  // (Si des collaborations existent déjà, on re-contrôle quand même le prix
  // plancher plus bas : les licences actives ont pu changer.)
  if (aAjouter.length === 0 && existants.length === 0) return { ok: true, nouvelles: [] }

  const candidats: (Omit<NouvelleInvitation, 'id'> & { cle: string })[] = []
  for (const c of aAjouter) {
    if (!Number.isInteger(c.pourcentage)) return { ok: false, erreur: 'Chaque part doit être un nombre entier de pourcents.', status: 400 }

    if (c.beatmaker_id) {
      if (c.beatmaker_id === proprietaireId) return { ok: false, erreur: 'Tu ne peux pas t’inviter toi-même.', status: 400 }
      if (existants.some(e => e.beatmaker_id === c.beatmaker_id)) return { ok: false, erreur: 'Ce beatmaker collabore déjà sur ce beat.', status: 400 }
      const { data: bm } = await admin.from('beatmakers').select('id, nom_artiste').eq('id', c.beatmaker_id).maybeSingle()
      if (!bm) return { ok: false, erreur: 'Beatmaker introuvable.', status: 400 }
      candidats.push({ cle: `compte:${bm.id}`, beatmaker_id: bm.id, email_invite: null, pourcentage: c.pourcentage, nom_collaborateur: bm.nom_artiste })
    } else {
      const email = normaliserEmail(c.email_invite)
      if (!EMAIL_VALIDE.test(email)) return { ok: false, erreur: 'Adresse email invalide.', status: 400 }
      if (existants.some(e => e.email_invite === email)) return { ok: false, erreur: 'Cette adresse est déjà invitée sur ce beat.', status: 400 }
      if (await emailBloquePourInvitation(admin, email)) return { ok: false, erreur: MESSAGE_ADRESSE_REFUSEE, status: 400 }
      candidats.push({ cle: `email:${email}`, beatmaker_id: null, email_invite: email, pourcentage: c.pourcentage, nom_collaborateur: email })
    }
  }

  if (new Set(candidats.map(c => c.cle)).size !== candidats.length) {
    return { ok: false, erreur: 'La même personne est ajoutée deux fois.', status: 400 }
  }

  const parts = [...existants.map(e => e.pourcentage), ...candidats.map(c => c.pourcentage)]
  const somme = parts.reduce((s, p) => s + p, 0)
  const participants: Participant[] = [
    { id: 'proprietaire', pourcentage: 100 - somme },
    ...parts.map((pourcentage, i) => ({ id: `collab-${i}`, pourcentage })),
  ]
  const validation = validerRepartition(participants)
  if (!validation.ok) {
    return { ok: false, erreur: somme > 90 ? 'Tu dois garder au moins 10 % du beat pour toi.' : validation.erreur, status: 400 }
  }

  const plancher = await verifierPlancherLicences(admin, {
    beatmakerId: proprietaireId,
    participants,
    licencesActivesIds: params.licencesActivesIds ?? [],
    exclusifPrixOverride: params.exclusifPrixOverride,
    exclusifSurDemande: params.exclusifSurDemande,
  })
  if (!plancher.ok) return { ok: false, erreur: plancher.erreur, status: 400 }

  if (candidats.length === 0) return { ok: true, nouvelles: [] }

  const lignes = candidats.map(c => ({
    beat_id: beatId,
    beatmaker_id: c.beatmaker_id,
    email_invite: c.email_invite,
    pourcentage: c.pourcentage,
    statut: 'invitee',
  }))
  const { data: inserees, error } = await admin.from('beat_splits').insert(lignes).select('id, beatmaker_id, email_invite, pourcentage')
  if (error) return { ok: false, erreur: error.message, status: 500 }

  const nouvelles: NouvelleInvitation[] = (inserees ?? []).map(l => {
    const source = candidats.find(c => c.beatmaker_id === l.beatmaker_id && c.email_invite === l.email_invite)
    return {
      id: l.id as string,
      beatmaker_id: l.beatmaker_id as string | null,
      email_invite: l.email_invite as string | null,
      pourcentage: l.pourcentage as number,
      nom_collaborateur: source?.nom_collaborateur ?? (l.email_invite as string) ?? 'Collaborateur',
    }
  })
  return { ok: true, nouvelles }
}

/**
 * Journalise et notifie chaque nouvelle invitation (email + journal). Toujours
 * appelée avec await : un envoi non attendu en fin de route peut être tué par
 * l'environnement serverless avant d'avoir fini.
 */
export async function notifierNouvellesInvitations(params: {
  admin: SupabaseClient
  beatId: string
  proprietaireId: string
  titreBeat: string
  nouvelles: NouvelleInvitation[]
}): Promise<void> {
  if (params.nouvelles.length === 0) return
  const { data: proprietaire } = await params.admin.from('beatmakers').select('nom_artiste').eq('id', params.proprietaireId).maybeSingle()
  const nomProprietaire = (proprietaire?.nom_artiste as string | undefined) ?? 'Un beatmaker'

  for (const n of params.nouvelles) {
    await journaliserCollaboration({
      action: 'invitation',
      collaborationId: n.id,
      proprietaireId: params.proprietaireId,
      acteurId: params.proprietaireId,
      details: { beat_id: params.beatId, titre_beat: params.titreBeat, nom_collaborateur: n.nom_collaborateur, pourcentage: n.pourcentage },
    })

    let destinataire = n.email_invite
    if (!destinataire && n.beatmaker_id) {
      const { data: bm } = await params.admin.from('beatmakers').select('email').eq('id', n.beatmaker_id).maybeSingle()
      destinataire = (bm?.email as string | undefined) ?? null
    }
    if (!destinataire) continue

    await envoyerInvitationCollab({
      to: destinataire,
      nomProprietaire,
      titreBeat: params.titreBeat,
      pourcentage: n.pourcentage,
      beatmakerId: params.proprietaireId,
      aDejaUnCompte: !!n.beatmaker_id,
    })
  }
}
