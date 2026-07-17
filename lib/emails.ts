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
  signature_emails: string | null
  couleur_marque: string | null
  instagram_url: string | null
  youtube_url: string | null
  tiktok_url: string | null
}

const SELECT_BRANDING = 'nom_artiste, slug, logo_url, signature_emails, couleur_marque, instagram_url, youtube_url, tiktok_url'

async function chargerBrandingEtIntro(beatmakerId: string, type: TypeTemplateTransactionnel) {
  const admin = createAdminClient()
  const [{ data: branding }, { data: template }] = await Promise.all([
    admin.from('beatmakers').select(SELECT_BRANDING).eq('id', beatmakerId).single(),
    admin.from('templates_transactionnels').select('intro').eq('beatmaker_id', beatmakerId).eq('type', type).maybeSingle(),
  ])
  return { branding: branding as BrandingTransactionnel | null, intro: template?.intro ?? null }
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
  const signature = branding.signature_emails || branding.nom_artiste

  const reseaux: { lien: string; label: string; initiales: string }[] = [
    branding.instagram_url ? { lien: branding.instagram_url, label: 'Instagram', initiales: 'IG' } : null,
    branding.youtube_url ? { lien: branding.youtube_url, label: 'YouTube', initiales: 'YT' } : null,
    branding.tiktok_url ? { lien: branding.tiktok_url, label: 'TikTok', initiales: 'TK' } : null,
  ].filter((r): r is { lien: string; label: string; initiales: string } => r !== null)

  const blocReseaux = reseaux.length ? `
      <tr><td style="padding:16px 24px 0;text-align:center;">
        ${reseaux.map(r => `
          <a href="${r.lien}" aria-label="${r.label}" style="display:inline-block;width:32px;height:32px;line-height:32px;margin:0 4px;border-radius:50%;background:#f3f4f6;color:#374151;text-decoration:none;font-size:11px;font-weight:700;text-align:center;">${r.initiales}</a>`).join('')}
      </td></tr>` : ''

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
      </td></tr>${blocReseaux}
      <tr><td style="padding:16px 24px;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="font-size:12px;color:#9ca3af;margin:0;">${echapper(signature)}</p>
      </td></tr>
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
  const [{ branding, intro }, { data: lignes }] = await Promise.all([
    chargerBrandingEtIntro(beatmakerId, 'confirmation_commande'),
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
      titre: TITRE_DEFAUT.confirmation_commande,
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
  const [{ branding, intro }, { data: abo }] = await Promise.all([
    chargerBrandingEtIntro(beatmakerId, 'confirmation_abonnement'),
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
      titre: TITRE_DEFAUT.confirmation_abonnement,
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
  const { branding, intro } = await chargerBrandingEtIntro(beatmakerId, 'demande_annulation_abonnement')
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
      titre: TITRE_DEFAUT.demande_annulation_abonnement,
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
  const { branding, intro } = await chargerBrandingEtIntro(beatmakerId, 'annulation_abonnement')
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
      titre: TITRE_DEFAUT.annulation_abonnement,
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
): Promise<string> {
  const admin = createAdminClient()
  const { data: brandingDb } = await admin
    .from('beatmakers')
    .select(SELECT_BRANDING)
    .eq('id', beatmakerId)
    .single()
  if (!brandingDb) return ''

  // Aperçu interactif : reflète la couleur en cours de saisie, pas seulement
  // celle déjà enregistrée — sinon le beatmaker ne voit jamais l'effet de son
  // changement avant d'avoir cliqué "Enregistrer".
  const couleurValide = couleurDraft && /^#[0-9a-fA-F]{6}$/.test(couleurDraft) ? couleurDraft : null
  const branding = couleurValide ? { ...brandingDb, couleur_marque: couleurValide } : brandingDb

  const intro = introDraft.trim() || introDefaut(type, branding.nom_artiste)

  const parType: Record<TypeTemplateTransactionnel, { corpsHtml: string; cta?: { texte: string; lien: string } }> = {
    confirmation_commande: { corpsHtml: CORPS_EXEMPLE_COMMANDE, cta: { texte: 'Télécharger mes fichiers', lien: '#' } },
    confirmation_abonnement: { corpsHtml: CORPS_EXEMPLE_ABONNEMENT, cta: { texte: 'Accéder à mon espace membre', lien: '#' } },
    demande_annulation_abonnement: { corpsHtml: CORPS_EXEMPLE_DEMANDE_ANNULATION },
    annulation_abonnement: { corpsHtml: '' },
    beat_cadeau_fidelite: { corpsHtml: '' },
  }

  return rendreEmailTransactionnel({
    branding,
    titre: TITRE_DEFAUT[type],
    intro,
    ...parType[type],
  })
}
