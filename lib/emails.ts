import { createAdminClient } from '@/utils/supabase/admin'
import { envoyerEmailUnique } from './email-logger'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-producer.com'
const COULEUR_DEFAUT = '#4f46e5'

export async function envoyerInvitationCollab({
  to,
  nomProprietaire,
  titreBeat,
  pourcentage,
  beatmakerId,
}: {
  to: string
  nomProprietaire: string
  titreBeat: string
  pourcentage: number
  beatmakerId: string
}) {
  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'invitation_collab',
    to,
    subject: `${nomProprietaire} vous invite à collaborer sur "${titreBeat}"`,
    text: [
      `Bonjour,`,
      ``,
      `${nomProprietaire} vous invite à collaborer sur le beat "${titreBeat}".`,
      `Votre part : ${pourcentage}%.`,
      ``,
      `Créez votre compte My Producer pour visualiser votre split et recevoir vos revenus :`,
      `${APP_URL}/inscription`,
      ``,
      `— L'équipe My Producer`,
    ].join('\n'),
  })
}

export async function envoyerFondsEnAttente({
  to,
  titreBeat,
  montantEuros,
  beatmakerId,
}: {
  to: string
  titreBeat: string
  montantEuros: string
  beatmakerId: string
}) {
  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'fonds_en_attente',
    to,
    subject: `${montantEuros}€ vous attendent sur My Producer`,
    text: [
      `Bonjour,`,
      ``,
      `Le beat "${titreBeat}" vient d'être vendu et vous avez ${montantEuros}€ qui vous attendent.`,
      ``,
      `Configurez votre compte Stripe sur My Producer pour recevoir votre part :`,
      `${APP_URL}/inscription`,
      ``,
      `Ces fonds seront disponibles dès que votre compte sera configuré.`,
      ``,
      `— L'équipe My Producer`,
    ].join('\n'),
  })
}

export async function envoyerRappelFonds({
  to,
  titreBeat,
  montantEuros,
  joursRestants,
  beatmakerId,
}: {
  to: string
  titreBeat: string
  montantEuros: string
  joursRestants: number
  beatmakerId: string
}) {
  const urgence = joursRestants <= 10
  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'rappel_fonds',
    to,
    subject: urgence
      ? `⚠️ Dernier rappel — ${montantEuros}€ expirent dans ${joursRestants} jours`
      : `Rappel — ${montantEuros}€ vous attendent sur My Producer`,
    text: [
      `Bonjour,`,
      ``,
      urgence
        ? `ATTENTION : Dans ${joursRestants} jours, votre part de ${montantEuros}€ sur le beat "${titreBeat}" sera définitivement reversée à l'autre beatmaker.`
        : `Vous avez toujours ${montantEuros}€ en attente sur le beat "${titreBeat}".`,
      ``,
      `Configurez votre compte Stripe maintenant pour récupérer vos fonds :`,
      `${APP_URL}/inscription`,
      ``,
      `— L'équipe My Producer`,
    ].join('\n'),
  })
}

export async function envoyerConfirmationExpiration({
  to,
  titreBeat,
  montantEuros,
  beatmakerId,
}: {
  to: string
  titreBeat: string
  montantEuros: string
  beatmakerId: string
}) {
  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'confirmation_expiration',
    to,
    subject: `Votre part sur "${titreBeat}" a expiré`,
    text: [
      `Bonjour,`,
      ``,
      `Votre part de ${montantEuros}€ sur le beat "${titreBeat}" n'a pas été réclamée dans les 60 jours.`,
      `Elle a été reversée à l'autre beatmaker conformément à notre politique de rétention.`,
      ``,
      `Pour les prochaines collaborations, pensez à configurer votre compte My Producer dès l'invitation :`,
      `${APP_URL}/inscription`,
      ``,
      `— L'équipe My Producer`,
    ].join('\n'),
  })
}

// ── Transactionnels (Phase 6) — confirmation d'achat, d'abonnement, d'annulation ──
//
// Personnalisation volontairement limitée (pas d'éditeur HTML libre) : le
// branding (logo, couleur, signature) vit sur `beatmakers` et est partagé par
// les 3 emails pour rester cohérent avec le reste de la plateforme (Campagnes,
// Automatisations) ; seule l'intro est personnalisable par type, dans
// `templates_transactionnels`. Absence de ligne = texte par défaut.

export type TypeTemplateTransactionnel =
  | 'confirmation_commande'
  | 'confirmation_abonnement'
  | 'demande_annulation_abonnement'
  | 'annulation_abonnement'
  | 'beat_cadeau_fidelite'

type BrandingTransactionnel = {
  nom_artiste: string
  slug: string
  logo_url: string | null
  signature_transactionnels: string | null
  couleur_marque: string | null
  instagram_url: string | null
  youtube_url: string | null
  tiktok_url: string | null
  footer_message_reseaux: string | null
  titre_footer_reseaux: string | null
}

// signature_emails (Automatisations/Campagnes) reste séparée : Jake signe
// différemment selon le canal ("Jake" en automatisation, plus personnel,
// "Jake B" en transactionnel, plus officiel) — voir demande du 2026-07-17.
const SELECT_BRANDING = 'nom_artiste, slug, logo_url, signature_transactionnels, couleur_marque, instagram_url, youtube_url, tiktok_url, footer_message_reseaux, titre_footer_reseaux'

async function chargerBrandingEtTemplate(beatmakerId: string, type: TypeTemplateTransactionnel) {
  const admin = createAdminClient()
  const [{ data: branding }, { data: template }] = await Promise.all([
    admin.from('beatmakers').select(SELECT_BRANDING).eq('id', beatmakerId).single(),
    admin.from('templates_transactionnels').select('titre, intro').eq('beatmaker_id', beatmakerId).eq('type', type).maybeSingle(),
  ])
  return {
    branding: branding as BrandingTransactionnel | null,
    titre: template?.titre ?? null,
    intro: template?.intro ?? null,
  }
}

function echapper(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Titre + intro par défaut — source unique utilisée à la fois par l'envoi
// réel et par l'aperçu (page réglages), pour que l'aperçu ne mente jamais
// sur ce qui sera vraiment envoyé sans personnalisation.
const TITRE_DEFAUT: Record<TypeTemplateTransactionnel, string> = {
  confirmation_commande: 'Merci pour ton achat !',
  confirmation_abonnement: 'Ton abonnement est actif !',
  demande_annulation_abonnement: "Ta demande d'annulation est prise en compte",
  annulation_abonnement: 'Abonnement annulé',
  beat_cadeau_fidelite: 'Un cadeau pour toi 🎁',
}

function introDefaut(type: TypeTemplateTransactionnel, nomArtiste: string): string {
  switch (type) {
    case 'confirmation_commande':
      return 'Voici le récapitulatif de ta commande. Tes fichiers sont prêts à télécharger.'
    case 'confirmation_abonnement':
      return 'Ton abonnement vient d\'être activé. Tu as désormais accès au catalogue privé et à tous les avantages membres.'
    case 'demande_annulation_abonnement':
      return 'On confirme que ta demande d\'annulation a bien été prise en compte. Tu gardes accès à tous les avantages membres jusqu\'à la date ci-dessous.'
    case 'annulation_abonnement':
      return `Nous te confirmons l'annulation de ton abonnement à ${nomArtiste}. Tu n'as plus accès au catalogue privé à partir de maintenant.`
    case 'beat_cadeau_fidelite':
      return 'Merci pour ta fidélité ! Voici un code pour un beat gratuit.'
  }
}

// Icônes SVG inline (pas de dépendance à un hébergement d'images externe) —
// glyphes standards des 3 réseaux, 18x18, une seule couleur de marque par
// icône pour rester lisible sur le fond blanc de la pastille.
const SVG_TIKTOK = '<svg width="16" height="16" viewBox="0 0 24 24" style="vertical-align:middle;"><path fill="#000000" d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>'
const SVG_INSTAGRAM = '<svg width="16" height="16" viewBox="0 0 24 24" style="vertical-align:middle;"><path fill="#E4405F" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>'
const SVG_YOUTUBE = '<svg width="16" height="16" viewBox="0 0 24 24" style="vertical-align:middle;"><path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>'

const FOOTER_MESSAGE_DEFAUT = 'Rejoins-moi sur mes réseaux pour rester à jour et me contacter facilement !'
const FOOTER_TITRE_DEFAUT = 'Suis-moi sur les réseaux sociaux'

function rendreEmailTransactionnel({
  branding,
  titre,
  intro,
  corpsHtml,
  cta,
}: {
  branding: BrandingTransactionnel
  titre: string
  intro: string
  corpsHtml: string
  cta?: { texte: string; lien: string }
}): string {
  const couleur = branding.couleur_marque || COULEUR_DEFAUT
  const signature = branding.signature_transactionnels || branding.nom_artiste

  const reseaux: { lien: string; label: string; svg: string }[] = [
    branding.tiktok_url ? { lien: branding.tiktok_url, label: 'TikTok', svg: SVG_TIKTOK } : null,
    branding.instagram_url ? { lien: branding.instagram_url, label: 'Instagram', svg: SVG_INSTAGRAM } : null,
    branding.youtube_url ? { lien: branding.youtube_url, label: 'YouTube', svg: SVG_YOUTUBE } : null,
  ].filter((r): r is { lien: string; label: string; svg: string } => r !== null)

  const footerMessage = branding.footer_message_reseaux || FOOTER_MESSAGE_DEFAUT
  const footerTitre = branding.titre_footer_reseaux || FOOTER_TITRE_DEFAUT

  const blocFooter = `
      <tr><td style="background:#ffffff;padding:24px;border-top:1px solid #e5e7eb;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="width:64px;vertical-align:middle;">
            ${branding.logo_url
              ? `<img src="${branding.logo_url}" alt="${echapper(branding.nom_artiste)}" width="48" height="48" style="border-radius:10px;display:block;" />`
              : `<div style="width:48px;height:48px;border-radius:10px;background:${couleur};color:#ffffff;font-weight:700;font-size:16px;text-align:center;line-height:48px;">${echapper(branding.nom_artiste.slice(0, 2).toUpperCase())}</div>`}
          </td>
          <td style="vertical-align:middle;padding-left:16px;">
            ${reseaux.length ? `
            <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 4px;">${echapper(footerTitre)}</p>
            <p style="font-size:12px;color:#6b7280;margin:0 0 12px;">${echapper(footerMessage)}</p>
            <div>
              ${reseaux.map(r => `
                <a href="${r.lien}" aria-label="${r.label}" style="display:inline-block;width:32px;height:32px;line-height:32px;margin-right:8px;border-radius:50%;background:#f3f4f6;text-align:center;vertical-align:middle;">${r.svg}</a>`).join('')}
            </div>` : `<p style="font-size:15px;font-weight:700;color:#111827;margin:0;">${echapper(branding.nom_artiste)}</p>`}
          </td>
        </tr></table>
        <p style="font-size:12px;color:#9ca3af;margin:20px 0 0;">${echapper(signature)}</p>
      </td></tr>`

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;font-family:Arial,sans-serif;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:${couleur};padding:24px;text-align:center;">
        ${branding.logo_url
          ? `<img src="${branding.logo_url}" alt="${echapper(branding.nom_artiste)}" height="40" style="display:inline-block;" />`
          : `<span style="color:#ffffff;font-weight:700;font-size:18px;">${echapper(branding.nom_artiste)}</span>`}
      </td></tr>
      <tr><td style="padding:32px 24px;">
        <h1 style="font-size:18px;color:#111827;margin:0 0 16px;">${echapper(titre)}</h1>
        <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 20px;white-space:pre-line;">${echapper(intro)}</p>
        ${corpsHtml}
        ${cta ? `<div style="text-align:center;margin-top:24px;">
          <a href="${cta.lien}" style="display:inline-block;background:${couleur};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">${echapper(cta.texte)}</a>
        </div>` : ''}
      </td></tr>${blocFooter}
    </table>
  </td></tr>
</table>`
}

export async function confirmationCommande({
  to,
  beatmakerId,
  commandeId,
  clientId,
}: {
  to: string
  beatmakerId: string
  commandeId: string
  clientId?: string | null
}) {
  const [{ branding, titre, intro }, { data: lignes }] = await Promise.all([
    chargerBrandingEtTemplate(beatmakerId, 'confirmation_commande'),
    createAdminClient()
      .from('commande_lignes')
      .select('prix_paye, beats(titre), licences(nom)')
      .eq('commande_id', commandeId),
  ])
  if (!branding) return

  type LigneRow = { prix_paye: number; beats: { titre: string } | null; licences: { nom: string } | null }
  const items = (lignes ?? []) as unknown as LigneRow[]

  const corpsHtml = items.length
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        ${items.map(l => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">
              ${echapper(l.beats?.titre ?? 'Beat')} <span style="color:#9ca3af;">— ${echapper(l.licences?.nom ?? '')}</span>
            </td>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;text-align:right;white-space:nowrap;">
              ${Number(l.prix_paye).toFixed(2)}€
            </td>
          </tr>`).join('')}
      </table>`
    : ''

  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'confirmation_commande',
    to,
    clientId,
    commandeId,
    subject: `Confirmation de ta commande — ${branding.nom_artiste}`,
    html: rendreEmailTransactionnel({
      branding,
      titre: titre || TITRE_DEFAUT.confirmation_commande,
      intro: intro || introDefaut('confirmation_commande', branding.nom_artiste),
      corpsHtml,
      cta: { texte: 'Télécharger mes fichiers', lien: `${APP_URL}/telechargement/${commandeId}` },
    }),
  })
}

export async function confirmationAbonnement({
  to,
  beatmakerId,
  abonnementId,
  clientId,
}: {
  to: string
  beatmakerId: string
  abonnementId: string
  clientId?: string | null
}) {
  const [{ branding, titre, intro }, { data: abo }] = await Promise.all([
    chargerBrandingEtTemplate(beatmakerId, 'confirmation_abonnement'),
    createAdminClient().from('abonnements_boutique').select('prix, devise, periode').eq('id', abonnementId).maybeSingle(),
  ])
  if (!branding) return

  const corpsHtml = abo
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">Abonnement ${echapper(abo.periode)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;text-align:right;white-space:nowrap;">${(Number(abo.prix) / 100).toFixed(2)}€</td>
        </tr>
      </table>`
    : ''

  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'confirmation_abonnement',
    to,
    clientId,
    subject: `Bienvenue dans l'abonnement ${branding.nom_artiste} !`,
    html: rendreEmailTransactionnel({
      branding,
      titre: titre || TITRE_DEFAUT.confirmation_abonnement,
      intro: intro || introDefaut('confirmation_abonnement', branding.nom_artiste),
      corpsHtml,
      cta: { texte: 'Accéder à mon espace membre', lien: `${APP_URL}/${branding.slug}/mon-compte` },
    }),
  })
}

// Envoyé au moment de la DÉCISION d'annuler (cancel_at_period_end passe à
// true), pas à la fin réelle de la période — le client garde son accès
// jusqu'à dateFin et doit le savoir immédiatement, pas seulement des jours
// plus tard quand l'abonnement se termine vraiment (voir annulationAbonnement
// ci-dessous, réservée au cas rare où aucune demande n'a précédé la
// suppression, ex. abo impayé résilié directement).
export async function confirmationDemandeAnnulation({
  to,
  beatmakerId,
  clientId,
  dateFin,
}: {
  to: string
  beatmakerId: string
  clientId?: string | null
  dateFin: Date
}) {
  const { branding, titre, intro } = await chargerBrandingEtTemplate(beatmakerId, 'demande_annulation_abonnement')
  if (!branding) return

  const dateFinFormatee = dateFin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const corpsHtml = `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">Accès jusqu'au</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;text-align:right;white-space:nowrap;">${echapper(dateFinFormatee)}</td>
      </tr>
    </table>`

  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'demande_annulation_abonnement',
    to,
    clientId,
    subject: `Ta demande d'annulation — ${branding.nom_artiste}`,
    html: rendreEmailTransactionnel({
      branding,
      titre: titre || TITRE_DEFAUT.demande_annulation_abonnement,
      intro: intro || introDefaut('demande_annulation_abonnement', branding.nom_artiste),
      corpsHtml,
    }),
  })
}

export async function annulationAbonnement({
  to,
  beatmakerId,
  clientId,
}: {
  to: string
  beatmakerId: string
  clientId?: string | null
}) {
  const { branding, titre, intro } = await chargerBrandingEtTemplate(beatmakerId, 'annulation_abonnement')
  if (!branding) return

  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'annulation_abonnement',
    to,
    clientId,
    subject: `Ton abonnement ${branding.nom_artiste} a été annulé`,
    html: rendreEmailTransactionnel({
      branding,
      titre: titre || TITRE_DEFAUT.annulation_abonnement,
      intro: intro || introDefaut('annulation_abonnement', branding.nom_artiste),
      corpsHtml: '',
    }),
  })
}

// ── Aperçu (page réglages) — mêmes titre/intro par défaut que l'envoi réel,
// données d'exemple à la place des vraies commandes/abonnements. Ne passe
// jamais par envoyerEmailUnique (pas d'envoi, pas de log).
const CORPS_EXEMPLE_COMMANDE = `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
  <tr>
    <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">Midnight Drive <span style="color:#9ca3af;">— Licence MP3</span></td>
    <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;text-align:right;white-space:nowrap;">29.99€</td>
  </tr>
</table>`

const CORPS_EXEMPLE_ABONNEMENT = `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
  <tr>
    <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">Abonnement mensuel</td>
    <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;text-align:right;white-space:nowrap;">9.99€</td>
  </tr>
</table>`

const CORPS_EXEMPLE_DEMANDE_ANNULATION = `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
  <tr>
    <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">Accès jusqu'au</td>
    <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;text-align:right;white-space:nowrap;">15 août 2026</td>
  </tr>
</table>`

export async function genererApercuTransactionnel(
  beatmakerId: string,
  type: TypeTemplateTransactionnel,
  introDraft: string,
  couleurDraft?: string,
  signatureDraft?: string,
  footerMessageDraft?: string,
  titreDraft?: string,
  footerTitreDraft?: string,
): Promise<string> {
  const admin = createAdminClient()
  const { data: brandingDb } = await admin
    .from('beatmakers')
    .select(SELECT_BRANDING)
    .eq('id', beatmakerId)
    .single()
  if (!brandingDb) return ''

  // Aperçu interactif : reflète la couleur, la signature et les titres en
  // cours de saisie, pas seulement ce qui est déjà enregistré — sinon le
  // beatmaker ne voit jamais l'effet de son changement avant d'avoir cliqué
  // "Enregistrer".
  const couleurValide = couleurDraft && /^#[0-9a-fA-F]{6}$/.test(couleurDraft) ? couleurDraft : null
  const branding = {
    ...brandingDb,
    ...(couleurValide ? { couleur_marque: couleurValide } : {}),
    ...(signatureDraft !== undefined ? { signature_transactionnels: signatureDraft.trim() || null } : {}),
    ...(footerMessageDraft !== undefined ? { footer_message_reseaux: footerMessageDraft.trim() || null } : {}),
    ...(footerTitreDraft !== undefined ? { titre_footer_reseaux: footerTitreDraft.trim() || null } : {}),
  }

  const intro = introDraft.trim() || introDefaut(type, branding.nom_artiste)
  const titre = titreDraft?.trim() || TITRE_DEFAUT[type]

  const parType: Record<TypeTemplateTransactionnel, { corpsHtml: string; cta?: { texte: string; lien: string } }> = {
    confirmation_commande: { corpsHtml: CORPS_EXEMPLE_COMMANDE, cta: { texte: 'Télécharger mes fichiers', lien: '#' } },
    confirmation_abonnement: { corpsHtml: CORPS_EXEMPLE_ABONNEMENT, cta: { texte: 'Accéder à mon espace membre', lien: '#' } },
    demande_annulation_abonnement: { corpsHtml: CORPS_EXEMPLE_DEMANDE_ANNULATION },
    annulation_abonnement: { corpsHtml: '' },
    beat_cadeau_fidelite: { corpsHtml: '' },
  }

  return rendreEmailTransactionnel({
    branding,
    titre,
    intro,
    ...parType[type],
  })
}
