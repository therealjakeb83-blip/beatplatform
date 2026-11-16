import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { estAdmin } from '@/lib/admin'
import { journaliserDecision } from '@/lib/decisions-log'
import { chargerFichesBoutique, adresseAffichee } from '@/app/dashboard/business/_lib/fiche-boutique'
import ClientDetailClient from './_components/ClientDetailClient'
import { supprimerCompteAdminAction } from './_lib/actions'

// Fiche Admin d'une personne (9d lot 4, option C1) : son compte Sonoo + la
// fiche de chaque boutique en LECTURE SEULE, pour le support. Une fiche de
// boutique ne s'affiche qu'après un clic sur « Consulter la fiche », et
// chaque consultation est tracée au journal des décisions de la boutique.
export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ boutique?: string }>
}) {
  const { id } = await params
  const { boutique: boutiqueConsultee } = await searchParams
  if (!(await estAdmin())) notFound()
  const supabase = await createClient()
  const { data: { user: adminUser } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const { data: client } = await admin
    .from('clients')
    .select('id, email, nom, prenom, created_at, supprime_le')
    .eq('id', id)
    .maybeSingle()
  if (!client) notFound()

  const [{ data: auth }, { data: leads }, { data: commandes }, { data: abosEnCours }] = await Promise.all([
    admin.auth.admin.getUserById(id),
    admin.from('leads').select('beatmaker_id, source, efface_le, newsletter_statut, premier_contact_le, beatmakers(nom_artiste, slug)').eq('client_id', id),
    admin.from('commandes').select('id, beatmaker_id, prix_paye, statut, created_at, beatmakers(nom_artiste)').eq('client_id', id).order('created_at', { ascending: false }).limit(20),
    admin.from('abonnements_boutique').select('beatmakers(nom_artiste)').eq('client_id', id).neq('statut', 'annule'),
  ])

  type Bm = { nom_artiste: string; slug?: string } | null
  const un = (b: unknown): Bm => (Array.isArray(b) ? b[0] : b) as Bm
  const boutiques = (leads ?? []).map(l => ({
    beatmakerId: l.beatmaker_id as string,
    nom: un(l.beatmakers)?.nom_artiste ?? '—',
    source: l.source as string | null,
    effaceLe: l.efface_le as string | null,
    newsletter: l.newsletter_statut as string,
    premierContact: l.premier_contact_le as string | null,
  }))

  // Consultation d'UNE fiche de boutique : tracée, puis affichée en lecture seule
  let ficheConsultee: null | { beatmakerId: string; nom: string; lignes: [string, string][] } = null
  const cible = boutiques.find(b => b.beatmakerId === boutiqueConsultee)
  if (cible && adminUser) {
    const fiche = (await chargerFichesBoutique(admin, cible.beatmakerId, [id])).get(id)
    await journaliserDecision({
      beatmakerId: cible.beatmakerId,
      actorType: 'admin',
      actorId: adminUser.id,
      entityType: 'client',
      entityId: id,
      action: 'consultation_fiche_admin',
      motif: 'support',
    })
    const t = (v: unknown) => v === null || v === undefined || (Array.isArray(v) && v.length === 0) ? '—' : Array.isArray(v) ? v.join(', ') : String(v)
    ficheConsultee = {
      beatmakerId: cible.beatmakerId,
      nom: cible.nom,
      lignes: fiche ? [
        ['Effacé le', fiche.efface_le ? new Date(fiche.efface_le).toLocaleString('fr-FR') : '—'],
        ['Emails', t(fiche.emails)],
        ['Téléphones', t(fiche.telephones)],
        ['Adresses', fiche.adresses.length ? fiche.adresses.map(adresseAffichee).join(' | ') : '—'],
        ['Prénom', t(fiche.prenom)], ['Nom', t(fiche.nom)], ["Nom d'artiste", t(fiche.nom_artiste)], ['Surnom', t(fiche.surnom)],
        ['Pays', t(fiche.pays)], ['Langue', t(fiche.langue)],
        ['Réseaux', [fiche.instagram, fiche.spotify, fiche.youtube, fiche.tiktok].filter(Boolean).join(' · ') || '—'],
        ['Source', t(fiche.source)], ['Premier contact', fiche.premier_contact_le ? new Date(fiche.premier_contact_le).toLocaleString('fr-FR') : '—'],
        ['Newsletter', t(fiche.newsletter_statut)],
        ['Notes', t(fiche.notes)], ['Tags', t(fiche.tags)],
        ['Modifiés à la main', t(fiche.champs_manuels)],
      ] : [['Fiche', 'aucune fiche dans cette boutique']],
    }
  }

  return (
    <ClientDetailClient
      compte={{
        id: client.id,
        email: client.supprime_le ? null : (auth?.user?.email ?? client.email),
        prenom: client.prenom,
        nom: client.nom,
        creeLe: client.created_at,
        supprimeLe: client.supprime_le,
        connexion: auth?.user ? {
          creeLe: auth.user.created_at,
          derniereConnexion: auth.user.last_sign_in_at ?? null,
          fournisseurs: (auth.user.app_metadata?.providers as string[] | undefined) ?? [],
        } : null,
      }}
      boutiques={boutiques}
      ficheConsultee={ficheConsultee}
      commandes={(commandes ?? []).map(c => ({
        id: c.id as string, prix_paye: c.prix_paye as number, statut: c.statut as string, created_at: c.created_at as string,
        boutique: un(c.beatmakers)?.nom_artiste ?? '—',
      }))}
      abonnementsEnCours={[...new Set((abosEnCours ?? []).map(a => un(a.beatmakers)?.nom_artiste ?? 'une boutique'))]}
      supprimerCompteAdminAction={supprimerCompteAdminAction}
    />
  )
}
