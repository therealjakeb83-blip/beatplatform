import { createAdminClient } from '@/utils/supabase/admin'
import { envoyerEmailUnique } from './email-logger'
import { NOM_PLATEFORME } from './constantes'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-producer.com'
const COULEUR_DEFAUT = '#4f46e5'

// envoyerInvitationCollab / envoyerFondsEnAttente / envoyerRappelFonds /
// envoyerConfirmationExpiration ont été migrées vers le système "Mails My
// Producer" (branding fixe, titre/intro éditables par l'admin) — voir plus
// bas, section "Emails My Producer → beatmaker". Corrige au passage le bug
// fire-and-forget des appelants (audit 2026-07-29, F3) : envoyerEmailUnique
// n'a jamais levé d'exception (toujours loggé dans email_logs même en cas
// d'échec), donc rien n'empêchait d'attendre ces appels — seuls les
// appelants (webhook Stripe, cron splits-expiration) oubliaient le `await`.

export async function envoyerCategorieCertifiee({
  to,
  nomCategorie,
  beatmakerId,
}: {
  to: string
  nomCategorie: string
  beatmakerId: string
}) {
  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'categorie_certifiee',
    to,
    subject: `Votre catégorie "${nomCategorie}" est maintenant officielle`,
    text: [
      `Bonjour,`,
      ``,
      `Votre catégorie "${nomCategorie}" est maintenant officielle sur ${NOM_PLATEFORME}.`,
      `Elle est désormais disponible pour tous les beatmakers de la plateforme.`,
      ``,
      `— L'équipe ${NOM_PLATEFORME}`,
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
  | 'confirmation_compte_artiste'
  | 'telechargement_gratuit'
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
  confirmation_compte_artiste: 'Ton compte est prêt !',
  telechargement_gratuit: 'Ton free download est prêt !',
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
    case 'confirmation_compte_artiste':
      return `Bienvenue ! Ton compte est activé, tu peux dès maintenant accéder à tes achats, favoris et abonnements sur ${nomArtiste}.`
    case 'telechargement_gratuit':
      return 'Voici ton téléchargement gratuit. Le lien expire dans 1 heure, télécharge-le rapidement !'
    case 'beat_cadeau_fidelite':
      return 'Merci pour ta fidélité ! Voici un code pour un beat gratuit.'
  }
}

// Icônes hébergées en fichiers statiques (public/icons/) — Gmail (et la
// plupart des clients email) strippe à la fois les <svg> inline ET les
// images en data URI dans les emails REÇUS par sécurité, contrairement à
// l'aperçu qui passe par un vrai navigateur (constaté le 2026-07-17, les
// deux approches ont échoué avant celle-ci). Seule une vraie URL http(s)
// fonctionne de façon fiable.
const ICONE_TIKTOK = `${APP_URL}/icons/tiktok.png`
const ICONE_INSTAGRAM = `${APP_URL}/icons/instagram.png`
const ICONE_YOUTUBE = `${APP_URL}/icons/youtube.png`

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

  const reseaux: { lien: string; label: string; icone: string }[] = [
    branding.tiktok_url ? { lien: branding.tiktok_url, label: 'TikTok', icone: ICONE_TIKTOK } : null,
    branding.instagram_url ? { lien: branding.instagram_url, label: 'Instagram', icone: ICONE_INSTAGRAM } : null,
    branding.youtube_url ? { lien: branding.youtube_url, label: 'YouTube', icone: ICONE_YOUTUBE } : null,
  ].filter((r): r is { lien: string; label: string; icone: string } => r !== null)

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
                <a href="${r.lien}" aria-label="${r.label}" style="display:inline-block;width:32px;height:32px;line-height:32px;margin-right:8px;border-radius:50%;background:#f3f4f6;text-align:center;vertical-align:middle;"><img src="${r.icone}" width="16" height="16" alt="${r.label}" style="vertical-align:middle;" /></a>`).join('')}
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

// ============================================================
// Emails My Producer → beatmaker (Étape 8b, abonnement plateforme)
// ============================================================
// Contrairement aux transactionnels boutique→client ci-dessous (brandés
// par boutique via templates_transactionnels), ces emails viennent de
// Jake/My Producer directement — branding fixe (BRANDING_PLATEFORME),
// jamais personnalisable par le beatmaker. Seuls le titre et l'intro de
// chaque email sont éditables par l'admin, dans `templates_plateforme`
// (page /dashboard/admin/mails-plateforme) — même mécanisme "titre+intro,
// fallback par défaut sinon" que templates_transactionnels, réutilise le
// même moteur de rendu HTML (rendreEmailTransactionnel) pour un aperçu et
// un rendu identiques à ce que les beatmakers ont déjà. Décision Jake
// 2026-07-27, voir memory/project_mails_my_producer.md.

export type TypeTemplatePlateforme =
  | 'confirmation_email'
  | 'bienvenue'
  | 'confirmation_essai'
  | 'rappel_fin_essai'
  | 'paiement_echoue'
  | 'annulation'
  | 'collab_invitation'
  | 'collab_fonds_attente'
  | 'collab_rappel_fonds'
  | 'collab_expiration'

const BRANDING_PLATEFORME: BrandingTransactionnel = {
  nom_artiste: NOM_PLATEFORME,
  slug: '',
  logo_url: null,
  signature_transactionnels: `L'équipe ${NOM_PLATEFORME}`,
  couleur_marque: COULEUR_DEFAUT,
  instagram_url: null,
  youtube_url: null,
  tiktok_url: null,
  footer_message_reseaux: null,
  titre_footer_reseaux: null,
}

const TITRE_DEFAUT_PLATEFORME: Record<TypeTemplatePlateforme, string> = {
  confirmation_email: 'Confirme ton adresse email',
  bienvenue: `Bienvenue sur ${NOM_PLATEFORME} !`,
  confirmation_essai: 'Ton essai gratuit a démarré',
  rappel_fin_essai: 'Ton essai se termine dans 3 jours',
  paiement_echoue: "Le paiement de ton abonnement a échoué",
  annulation: 'Ton abonnement a été annulé',
  collab_invitation: 'Tu es invité à collaborer sur un beat',
  collab_fonds_attente: "Des fonds t'attendent",
  collab_rappel_fonds: "Rappel — des fonds arrivent à expiration",
  collab_expiration: 'Tes fonds en attente ont expiré',
}

function introDefautPlateforme(type: TypeTemplatePlateforme): string {
  switch (type) {
    case 'confirmation_email':
      return "Plus qu'une étape avant de lancer ta boutique : confirme ton adresse email en cliquant sur le bouton ci-dessous."
    case 'bienvenue':
      return `Ton compte ${NOM_PLATEFORME} est créé — bienvenue ! Configure ta boutique et abonne-toi pour la rendre visible (essai gratuit de 14 jours, sans engagement).`
    case 'confirmation_essai':
      return `Ton essai gratuit de 14 jours a démarré. Tu as un accès complet à ${NOM_PLATEFORME}. Aucun prélèvement ne sera effectué avant la fin de l'essai.`
    case 'rappel_fin_essai':
      return "Ton essai gratuit se termine bientôt. Passé cette date, ton abonnement démarrera automatiquement — aucune action nécessaire si tu souhaites continuer."
    case 'paiement_echoue':
      return `Le dernier prélèvement de ton abonnement ${NOM_PLATEFORME} n'a pas pu être effectué. Merci de mettre à jour ton moyen de paiement pour éviter une interruption d'accès à ta boutique.`
    case 'annulation':
      return `Ton abonnement ${NOM_PLATEFORME} est maintenant annulé. Ta boutique et ton dashboard ne seront plus accessibles.`
    case 'collab_invitation':
      return `Un beatmaker t'invite à collaborer sur un de ses beats. Crée ton compte ${NOM_PLATEFORME} pour visualiser ta part et recevoir tes revenus.`
    case 'collab_fonds_attente':
      return 'Un beat sur lequel tu collabores vient d\'être vendu. Configure ton compte Stripe pour recevoir ta part.'
    case 'collab_rappel_fonds':
      return "Tu as des fonds en attente sur une collaboration — configure ton compte Stripe avant qu'ils ne soient définitivement reversés à l'autre beatmaker."
    case 'collab_expiration':
      return "Ta part sur une collaboration n'a pas été réclamée dans les 60 jours et a été reversée à l'autre beatmaker, conformément à notre politique de rétention."
  }
}

async function chargerTemplatePlateforme(type: TypeTemplatePlateforme) {
  const admin = createAdminClient()
  const { data: template } = await admin.from('templates_plateforme').select('titre, intro').eq('type', type).maybeSingle()
  return { titre: template?.titre ?? null, intro: template?.intro ?? null }
}

function fmtDateEssai(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function corpsAbonnementPlateforme(periode: 'mensuel' | 'annuel', prixEuros: number, essaiFinLe: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">Abonnement ${echapper(periode)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;text-align:right;white-space:nowrap;">${prixEuros.toFixed(2)}€ après l'essai</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#111827;">Fin de l'essai</td>
        <td style="padding:8px 0;font-size:13px;color:#111827;text-align:right;white-space:nowrap;">${echapper(fmtDateEssai(essaiFinLe))}</td>
      </tr>
    </table>`
}

function corpsInvitationCollab(nomProprietaire: string, titreBeat: string, pourcentage: number): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">Beat</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;text-align:right;">${echapper(titreBeat)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">Invité par</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;text-align:right;">${echapper(nomProprietaire)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#111827;">Ta part</td>
        <td style="padding:8px 0;font-size:13px;color:#111827;text-align:right;white-space:nowrap;">${pourcentage}%</td>
      </tr>
    </table>`
}

function corpsFondsCollab(titreBeat: string, montantEuros: string, labelMontant = 'Montant en attente'): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">Beat</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;text-align:right;">${echapper(titreBeat)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#111827;">${echapper(labelMontant)}</td>
        <td style="padding:8px 0;font-size:13px;color:#111827;text-align:right;white-space:nowrap;">${echapper(montantEuros)}€</td>
      </tr>
    </table>`
}

function corpsRappelFondsCollab(titreBeat: string, montantEuros: string, joursRestants: number): string {
  const urgence = joursRestants <= 10
  const couleur = urgence ? '#dc2626' : '#111827'
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">Beat</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;text-align:right;">${echapper(titreBeat)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">Montant en attente</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;text-align:right;white-space:nowrap;">${echapper(montantEuros)}€</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:13px;color:${couleur};font-weight:${urgence ? 700 : 400};">Jours restants avant reversement</td>
        <td style="padding:8px 0;font-size:13px;color:${couleur};font-weight:${urgence ? 700 : 400};text-align:right;white-space:nowrap;">${joursRestants} jour${joursRestants > 1 ? 's' : ''}</td>
      </tr>
    </table>`
}

// Contrairement aux 5 autres, cet email est déclenché depuis l'inscription
// elle-même (app/api/inscription/beatmaker) plutôt qu'un webhook/cron — le
// compte n'est pas encore confirmé au moment de l'envoi, donc `beatmakerId`
// existe déjà (créé par le trigger Postgres synchrone) mais l'utilisateur
// n'a pas de session. Voir ROADMAP.md (2026-07-28) pour le diagnostic du
// bug que ce chantier corrige (bienvenue jamais envoyée).
export async function envoyerConfirmationEmailPlateforme({
  to,
  beatmakerId,
  lienConfirmation,
}: {
  to: string
  beatmakerId: string
  lienConfirmation: string
}) {
  const { titre, intro } = await chargerTemplatePlateforme('confirmation_email')
  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'plateforme_confirmation_email',
    to,
    subject: titre || TITRE_DEFAUT_PLATEFORME.confirmation_email,
    html: rendreEmailTransactionnel({
      branding: BRANDING_PLATEFORME,
      titre: titre || TITRE_DEFAUT_PLATEFORME.confirmation_email,
      intro: intro || introDefautPlateforme('confirmation_email'),
      corpsHtml: '',
      cta: { texte: 'Confirmer mon adresse email', lien: lienConfirmation },
    }),
  })
}

export async function envoyerBienvenuePlateforme({
  to,
  beatmakerId,
}: {
  to: string
  beatmakerId: string
}) {
  const { titre, intro } = await chargerTemplatePlateforme('bienvenue')
  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'plateforme_bienvenue',
    to,
    subject: titre || TITRE_DEFAUT_PLATEFORME.bienvenue,
    html: rendreEmailTransactionnel({
      branding: BRANDING_PLATEFORME,
      titre: titre || TITRE_DEFAUT_PLATEFORME.bienvenue,
      intro: intro || introDefautPlateforme('bienvenue'),
      corpsHtml: '',
      cta: { texte: 'Accéder à mon dashboard', lien: `${APP_URL}/dashboard` },
    }),
  })
}

export async function envoyerConfirmationEssaiPlateforme({
  to,
  beatmakerId,
  periode,
  prixEuros,
  essaiFinLe,
}: {
  to: string
  beatmakerId: string
  periode: 'mensuel' | 'annuel'
  prixEuros: number
  essaiFinLe: string
}) {
  const { titre, intro } = await chargerTemplatePlateforme('confirmation_essai')
  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'plateforme_confirmation_essai',
    to,
    subject: titre || TITRE_DEFAUT_PLATEFORME.confirmation_essai,
    html: rendreEmailTransactionnel({
      branding: BRANDING_PLATEFORME,
      titre: titre || TITRE_DEFAUT_PLATEFORME.confirmation_essai,
      intro: intro || introDefautPlateforme('confirmation_essai'),
      corpsHtml: corpsAbonnementPlateforme(periode, prixEuros, essaiFinLe),
      cta: { texte: 'Gérer mon abonnement', lien: `${APP_URL}/dashboard/abonnement` },
    }),
  })
}

export async function envoyerRappelFinEssaiPlateforme({
  to,
  beatmakerId,
  periode,
  prixEuros,
  essaiFinLe,
}: {
  to: string
  beatmakerId: string
  periode: 'mensuel' | 'annuel'
  prixEuros: number
  essaiFinLe: string
}) {
  const { titre, intro } = await chargerTemplatePlateforme('rappel_fin_essai')
  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'plateforme_rappel_fin_essai',
    to,
    subject: titre || TITRE_DEFAUT_PLATEFORME.rappel_fin_essai,
    html: rendreEmailTransactionnel({
      branding: BRANDING_PLATEFORME,
      titre: titre || TITRE_DEFAUT_PLATEFORME.rappel_fin_essai,
      intro: intro || introDefautPlateforme('rappel_fin_essai'),
      corpsHtml: corpsAbonnementPlateforme(periode, prixEuros, essaiFinLe),
      cta: { texte: 'Gérer mon abonnement', lien: `${APP_URL}/dashboard/abonnement` },
    }),
  })
}

export async function envoyerPaiementEchouePlateforme({
  to,
  beatmakerId,
}: {
  to: string
  beatmakerId: string
}) {
  const { titre, intro } = await chargerTemplatePlateforme('paiement_echoue')
  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'plateforme_paiement_echoue',
    to,
    subject: titre || TITRE_DEFAUT_PLATEFORME.paiement_echoue,
    html: rendreEmailTransactionnel({
      branding: BRANDING_PLATEFORME,
      titre: titre || TITRE_DEFAUT_PLATEFORME.paiement_echoue,
      intro: intro || introDefautPlateforme('paiement_echoue'),
      corpsHtml: '',
      cta: { texte: 'Mettre à jour ma carte', lien: `${APP_URL}/dashboard/abonnement` },
    }),
  })
}

export async function envoyerConfirmationAnnulationPlateforme({
  to,
  beatmakerId,
}: {
  to: string
  beatmakerId: string
}) {
  const { titre, intro } = await chargerTemplatePlateforme('annulation')
  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'plateforme_annulation',
    to,
    subject: titre || TITRE_DEFAUT_PLATEFORME.annulation,
    html: rendreEmailTransactionnel({
      branding: BRANDING_PLATEFORME,
      titre: titre || TITRE_DEFAUT_PLATEFORME.annulation,
      intro: intro || introDefautPlateforme('annulation'),
      corpsHtml: '',
      cta: { texte: 'Me réabonner', lien: `${APP_URL}/dashboard/abonnement` },
    }),
  })
}

// Ces 4 emails concernent les collaborations (splits) entre beatmakers —
// migrés depuis de simples emails texte vers le système "Mails My
// Producer" (audit 2026-07-29, F3) : branding cohérent, titre/intro
// éditables par l'admin, et visibilité dans l'onglet Logs admin (tout
// evenement préfixé `plateforme_` y apparaît automatiquement). `beatmakerId`
// désigne ici le beatmaker propriétaire du beat (pas le destinataire `to`,
// qui peut être un collaborateur externe pas encore inscrit) — comme avant
// la migration, ça permet de retrouver ces envois aussi dans les logs de ce
// beatmaker (`/dashboard/business/mailing/logs`).
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
  const { titre, intro } = await chargerTemplatePlateforme('collab_invitation')
  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'plateforme_collab_invitation',
    to,
    subject: titre || TITRE_DEFAUT_PLATEFORME.collab_invitation,
    html: rendreEmailTransactionnel({
      branding: BRANDING_PLATEFORME,
      titre: titre || TITRE_DEFAUT_PLATEFORME.collab_invitation,
      intro: intro || introDefautPlateforme('collab_invitation'),
      corpsHtml: corpsInvitationCollab(nomProprietaire, titreBeat, pourcentage),
      cta: { texte: 'Créer mon compte', lien: `${APP_URL}/inscription` },
    }),
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
  const { titre, intro } = await chargerTemplatePlateforme('collab_fonds_attente')
  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'plateforme_collab_fonds_attente',
    to,
    subject: titre || TITRE_DEFAUT_PLATEFORME.collab_fonds_attente,
    html: rendreEmailTransactionnel({
      branding: BRANDING_PLATEFORME,
      titre: titre || TITRE_DEFAUT_PLATEFORME.collab_fonds_attente,
      intro: intro || introDefautPlateforme('collab_fonds_attente'),
      corpsHtml: corpsFondsCollab(titreBeat, montantEuros),
      cta: { texte: 'Configurer mon compte Stripe', lien: `${APP_URL}/inscription` },
    }),
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
  const { titre, intro } = await chargerTemplatePlateforme('collab_rappel_fonds')
  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'plateforme_collab_rappel_fonds',
    to,
    subject: titre || TITRE_DEFAUT_PLATEFORME.collab_rappel_fonds,
    html: rendreEmailTransactionnel({
      branding: BRANDING_PLATEFORME,
      titre: titre || TITRE_DEFAUT_PLATEFORME.collab_rappel_fonds,
      intro: intro || introDefautPlateforme('collab_rappel_fonds'),
      corpsHtml: corpsRappelFondsCollab(titreBeat, montantEuros, joursRestants),
      cta: { texte: 'Configurer mon compte Stripe', lien: `${APP_URL}/inscription` },
    }),
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
  const { titre, intro } = await chargerTemplatePlateforme('collab_expiration')
  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'plateforme_collab_expiration',
    to,
    subject: titre || TITRE_DEFAUT_PLATEFORME.collab_expiration,
    html: rendreEmailTransactionnel({
      branding: BRANDING_PLATEFORME,
      titre: titre || TITRE_DEFAUT_PLATEFORME.collab_expiration,
      intro: intro || introDefautPlateforme('collab_expiration'),
      corpsHtml: corpsFondsCollab(titreBeat, montantEuros, 'Montant reversé'),
    }),
  })
}

// ── Aperçu (page réglages admin) — mêmes titre/intro par défaut que
// l'envoi réel, données d'exemple à la place des vraies dates/prix. Ne
// passe jamais par envoyerEmailUnique (pas d'envoi, pas de log).
const CORPS_EXEMPLE_PLATEFORME = corpsAbonnementPlateforme('mensuel', 49.99, new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString())
const CORPS_EXEMPLE_INVITATION = corpsInvitationCollab('Jake B', 'Midnight Drive', 30)
const CORPS_EXEMPLE_FONDS = corpsFondsCollab('Midnight Drive', '45.00')
const CORPS_EXEMPLE_RAPPEL = corpsRappelFondsCollab('Midnight Drive', '45.00', 10)
const CORPS_EXEMPLE_EXPIRATION = corpsFondsCollab('Midnight Drive', '45.00', 'Montant reversé')

export async function genererApercuTransactionnelPlateforme(
  type: TypeTemplatePlateforme,
  titreDraft: string,
  introDraft: string,
): Promise<string> {
  const titre = titreDraft.trim() || TITRE_DEFAUT_PLATEFORME[type]
  const intro = introDraft.trim() || introDefautPlateforme(type)

  const parType: Record<TypeTemplatePlateforme, { corpsHtml: string; cta?: { texte: string; lien: string } }> = {
    confirmation_email: { corpsHtml: '', cta: { texte: 'Confirmer mon adresse email', lien: '#' } },
    bienvenue: { corpsHtml: '', cta: { texte: 'Accéder à mon dashboard', lien: '#' } },
    confirmation_essai: { corpsHtml: CORPS_EXEMPLE_PLATEFORME, cta: { texte: 'Gérer mon abonnement', lien: '#' } },
    rappel_fin_essai: { corpsHtml: CORPS_EXEMPLE_PLATEFORME, cta: { texte: 'Gérer mon abonnement', lien: '#' } },
    paiement_echoue: { corpsHtml: '', cta: { texte: 'Mettre à jour ma carte', lien: '#' } },
    annulation: { corpsHtml: '', cta: { texte: 'Me réabonner', lien: '#' } },
    collab_invitation: { corpsHtml: CORPS_EXEMPLE_INVITATION, cta: { texte: 'Créer mon compte', lien: '#' } },
    collab_fonds_attente: { corpsHtml: CORPS_EXEMPLE_FONDS, cta: { texte: 'Configurer mon compte Stripe', lien: '#' } },
    collab_rappel_fonds: { corpsHtml: CORPS_EXEMPLE_RAPPEL, cta: { texte: 'Configurer mon compte Stripe', lien: '#' } },
    collab_expiration: { corpsHtml: CORPS_EXEMPLE_EXPIRATION },
  }

  return rendreEmailTransactionnel({ branding: BRANDING_PLATEFORME, titre, intro, ...parType[type] })
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
    from: `${branding.nom_artiste} <campagnes@jakebmusic.com>`,
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
    from: `${branding.nom_artiste} <campagnes@jakebmusic.com>`,
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
    from: `${branding.nom_artiste} <campagnes@jakebmusic.com>`,
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
    from: `${branding.nom_artiste} <campagnes@jakebmusic.com>`,
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

// Compte artiste (acheteur) — global à la plateforme, pas propre à une
// boutique, contrairement aux autres emails transactionnels. Brandé quand
// même à la boutique de départ (celle depuis laquelle l'inscription a eu
// lieu, via /artiste/inscription?redirect=/{slug}) plutôt qu'un générique
// "My Producer" : envoyer les deux aurait fait doublon pour une seule
// action (décision Jake, 2026-07-17). Si aucune boutique de départ n'est
// identifiable, aucun email n'est envoyé (voir /auth/callback).
export async function confirmationCompteArtiste({
  to,
  beatmakerId,
  clientId,
  lienCompte,
}: {
  to: string
  beatmakerId: string
  clientId?: string | null
  lienCompte: string
}) {
  const { branding, titre, intro } = await chargerBrandingEtTemplate(beatmakerId, 'confirmation_compte_artiste')
  if (!branding) return

  // Ligne fixe, non personnalisable : le compte est un compte My Producer
  // global (pas propre à cette boutique) — doit rester claire quel que soit
  // le texte d'intro choisi par le beatmaker (décision Jake, 2026-07-17).
  const corpsHtml = `<p style="font-size:12px;color:#9ca3af;margin:0 0 20px;border-top:1px solid #f3f4f6;padding-top:16px;">
      Ceci est un compte ${NOM_PLATEFORME} artiste : il te permettra de te connecter sur toutes les boutiques ${NOM_PLATEFORME}, pas seulement celle-ci.
    </p>`

  await envoyerEmailUnique({
    beatmakerId,
    from: `${branding.nom_artiste} <campagnes@jakebmusic.com>`,
    type: 'transactionnel',
    evenement: 'confirmation_compte_artiste',
    to,
    clientId,
    subject: `Bienvenue sur ${branding.nom_artiste} !`,
    html: rendreEmailTransactionnel({
      branding,
      titre: titre || TITRE_DEFAUT.confirmation_compte_artiste,
      intro: intro || introDefaut('confirmation_compte_artiste', branding.nom_artiste),
      corpsHtml,
      cta: { texte: 'Accéder à mon compte', lien: lienCompte },
    }),
  })
}

export async function telechargementGratuit({
  to,
  beatmakerId,
  clientId,
  titreBeat,
  downloadUrl,
}: {
  to: string
  beatmakerId: string
  clientId?: string | null
  titreBeat: string
  downloadUrl: string
}) {
  const { branding, titre, intro } = await chargerBrandingEtTemplate(beatmakerId, 'telechargement_gratuit')
  if (!branding) return

  const corpsHtml = `<p style="font-size:13px;color:#6b7280;margin:0 0 20px;">
      Usage personnel uniquement — maquettes et réseaux sociaux OK. Diffusion sur plateformes de streaming interdite sans achat de licence.
    </p>`

  await envoyerEmailUnique({
    beatmakerId,
    from: `${branding.nom_artiste} <campagnes@jakebmusic.com>`,
    type: 'transactionnel',
    evenement: 'telechargement_gratuit',
    to,
    clientId,
    subject: `Ton free download — ${titreBeat}`,
    html: rendreEmailTransactionnel({
      branding,
      titre: titre || TITRE_DEFAUT.telechargement_gratuit,
      intro: intro || `${introDefaut('telechargement_gratuit', branding.nom_artiste)} Beat : ${titreBeat}.`,
      corpsHtml,
      cta: { texte: `Télécharger ${titreBeat}`, lien: downloadUrl },
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
    confirmation_compte_artiste: {
      corpsHtml: `<p style="font-size:12px;color:#9ca3af;margin:0 0 20px;border-top:1px solid #f3f4f6;padding-top:16px;">Ceci est un compte ${NOM_PLATEFORME} artiste : il te permettra de te connecter sur toutes les boutiques ${NOM_PLATEFORME}, pas seulement celle-ci.</p>`,
      cta: { texte: 'Accéder à mon compte', lien: '#' },
    },
    telechargement_gratuit: {
      corpsHtml: `<p style="font-size:13px;color:#6b7280;margin:0 0 20px;">Usage personnel uniquement — maquettes et réseaux sociaux OK. Diffusion sur plateformes de streaming interdite sans achat de licence.</p>`,
      cta: { texte: 'Télécharger Midnight Drive', lien: '#' },
    },
    beat_cadeau_fidelite: { corpsHtml: '' },
  }

  return rendreEmailTransactionnel({
    branding,
    titre,
    intro,
    ...parType[type],
  })
}
