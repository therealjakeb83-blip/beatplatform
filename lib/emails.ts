import { createAdminClient } from '@/utils/supabase/admin'
import { envoyerEmailUnique } from './email-logger'
import { NOM_PLATEFORME } from './constantes'
import { libelleMotifLitige } from './litiges-libelles'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-producer.com'
const COULEUR_DEFAUT = '#4f46e5'

// envoyerInvitationCollab a été migrée vers le système "Mails My Producer"
// (branding fixe, titre/intro éditables par l'admin) — voir plus bas,
// section "Emails My Producer → beatmaker".

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
  | 'remboursement_commande'
  | 'annulation_commande'

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
  remboursement_commande: 'Ta commande a été remboursée',
  annulation_commande: 'Ta commande a été annulée',
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
    case 'remboursement_commande':
      return `Ta commande sur la boutique ${nomArtiste} a été remboursée. L'accès aux fichiers est fermé et la licence n'est plus valable.`
    case 'annulation_commande':
      return `Ta commande sur la boutique ${nomArtiste} a été annulée. L'accès aux fichiers est fermé et la licence n'est plus valable.`
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
  | 'collab_acceptation'
  | 'collab_refus'
  | 'collab_retrait'
  | 'collab_depart'
  | 'collab_eviction'
  | 'collab_beat_supprime'
  | 'collab_pause'
  | 'conditions_mise_a_jour'
  | 'suspension'
  | 'nouvelle_vente'
  | 'remboursement_vente'
  | 'remboursement_incomplet'
  | 'litige_ouvert'
  | 'litige_rappel'
  | 'litige_collaborateur'

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
  collab_acceptation: 'Ta collaboration a été acceptée',
  collab_refus: 'Ta demande de collaboration a été refusée',
  collab_retrait: 'Une invitation à collaborer a été retirée',
  collab_depart: 'Un collaborateur a quitté ton beat',
  collab_eviction: 'Ta collaboration a pris fin',
  collab_beat_supprime: 'Un beat en collaboration a été supprimé',
  collab_pause: 'Action requise sur un beat en collaboration',
  conditions_mise_a_jour: `Mise à jour des conditions ${NOM_PLATEFORME}`,
  suspension: 'Ton compte a été suspendu',
  nouvelle_vente: 'Nouvelle vente !',
  remboursement_vente: 'Une vente a été remboursée',
  remboursement_incomplet: 'Remboursement incomplet',
  litige_ouvert: 'Un litige a été ouvert sur une vente',
  litige_rappel: 'Litige : plus que 3 jours pour répondre',
  litige_collaborateur: 'Un litige a été ouvert sur une vente en collaboration',
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
      return `Un beatmaker t'invite à collaborer sur un de ses beats. Connecte-toi à ${NOM_PLATEFORME} (ou crée ton compte) puis accepte l'invitation depuis ton espace Collaborations. Le beat ne sera pas mis en vente tant que tu n'auras pas accepté.`
    case 'collab_acceptation':
      return "Bonne nouvelle : ton collaborateur a accepté la collaboration sur ton beat. Retrouve le détail dans ta liste de beats."
    case 'collab_refus':
      return "Ton collaborateur a refusé la collaboration sur ton beat. Le beat reste hors vente : tu peux le publier quand même depuis ta liste de beats, ou inviter quelqu'un d'autre."
    case 'collab_retrait':
      return "Le propriétaire du beat a retiré son invitation à collaborer. Tu n'as plus aucune action à faire."
    case 'collab_depart':
      return "Ton collaborateur a quitté la collaboration. Tu repasses à 100 % sur ce beat ; les ventes déjà réalisées ne changent pas."
    case 'collab_eviction':
      return "Le propriétaire du beat a mis fin à ta collaboration. Les ventes déjà réalisées ne changent pas, et ton nom n'apparaîtra plus sur ce beat à partir de maintenant."
    case 'collab_beat_supprime':
      return "Le propriétaire a supprimé un beat sur lequel tu collabores. Ton historique (ventes, factures) reste consultable. Si tu avais une invitation en attente sur ce beat, elle n'est plus valable."
    case 'collab_pause':
      return "Un des vendeurs de ce beat n'est plus éligible aux paiements : sa configuration (compte de paiement, mandats, TVA, adresse…) n'est plus complète. Le beat est retiré de la vente jusqu'à ce que ce soit réglé, puis il revient automatiquement."
    case 'conditions_mise_a_jour':
      return `Nous mettons à jour un des textes de ${NOM_PLATEFORME}. Tu n'as rien à faire : les nouvelles conditions s'appliqueront automatiquement à la date indiquée ci-dessous, et les ventes faites avant restent sous l'ancienne version. Si tu n'es pas d'accord, tu peux quitter la plateforme ou te retirer d'une collaboration avant cette date. La répartition convenue entre collaborateurs ne change jamais.`
    case 'suspension':
      return `Ton compte ${NOM_PLATEFORME} a été suspendu par notre équipe. Ton dashboard et ta boutique publique ne sont plus accessibles tant que la situation n'est pas résolue.`
    case 'nouvelle_vente':
      return 'Bonne nouvelle : tu viens de réaliser une vente. Voici le détail.'
    case 'remboursement_vente':
      return "Une vente en collaboration a été remboursée par le propriétaire du beat. Ta part a été rendue au client depuis ton compte Stripe et une facture d'avoir a été émise automatiquement. Les frais Stripe de la vente ne sont pas rendus par Stripe."
    case 'remboursement_incomplet':
      return "Le remboursement d'une vente n'a pas pu être fait en entier : une part n'a pas pu être rendue au client. Les autres parts restent remboursées. Le propriétaire peut réessayer depuis la fiche de la commande."
    case 'litige_ouvert':
      return "Un client a contesté un paiement auprès de sa banque. Stripe bloque le montant contesté le temps du litige. Tu peux répondre depuis la fiche de la commande avant la date limite : les preuves (contrat, facture, historique de téléchargement, coordonnées de l'acheteur) sont déjà prêtes, tu peux ajouter un texte et un fichier. Si tu ne fais rien, aucune réponse n'est envoyée à ta place."
    case 'litige_rappel':
      return "Tu n'as pas encore répondu à un litige et la date limite approche. Passé cette date, la banque tranche sans ta réponse, ce qui revient en général à perdre le litige. Tu peux envoyer ta réponse (ou accepter le litige) depuis la fiche de la commande."
    case 'litige_collaborateur':
      return "Un client a contesté son paiement sur une vente en collaboration. Stripe bloque ta part le temps du litige. C'est le propriétaire du beat qui gère le litige : il envoie la réponse, preuves à l'appui, et la plateforme la transmet sur ton compte. Tu suis l'état du litige et l'historique de téléchargement sur la fiche de la vente. Ton espace Stripe te permet aussi de répondre, mais c'est déconseillé : une réponse est définitive, et le propriétaire ne pourrait plus répondre pour ta part."
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

// Tableau libellé/valeur réutilisé par les emails de collaboration (lot 4).
function corpsLignes(lignes: [string, string][]): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      ${lignes.map(([libelle, valeur], i) => {
        const bordure = i < lignes.length - 1 ? 'border-bottom:1px solid #f3f4f6;' : ''
        return `<tr>
        <td style="padding:8px 0;${bordure}font-size:13px;color:#111827;vertical-align:top;">${echapper(libelle)}</td>
        <td style="padding:8px 0;${bordure}font-size:13px;color:#111827;text-align:right;">${echapper(valeur).replace(/\n/g, '<br>')}</td>
      </tr>`
      }).join('')}
    </table>`
}

function corpsSuspension(motifLabel: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#111827;">Motif</td>
        <td style="padding:8px 0;font-size:13px;color:#111827;text-align:right;">${echapper(motifLabel)}</td>
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

// Chantier 9 bis, Phase 10 (2026-09-18) — envoyé quand l'admin suspend une
// boutique (lib/admin-boutiques.ts, suspendreBoutique()), en plus du
// message déjà affiché sur /dashboard/suspendu quand le beatmaker tente de
// se reconnecter (proxy.ts). motifLabel vient de lib/suspension.ts
// (libelleMotifSuspension) — déjà en langage naturel, inclut la précision
// écrite si le motif choisi est "autre".
export async function envoyerSuspensionPlateforme({
  to,
  beatmakerId,
  motifLabel,
}: {
  to: string
  beatmakerId: string
  motifLabel: string
}) {
  const { titre, intro } = await chargerTemplatePlateforme('suspension')
  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'plateforme_suspension',
    to,
    subject: titre || TITRE_DEFAUT_PLATEFORME.suspension,
    html: rendreEmailTransactionnel({
      branding: BRANDING_PLATEFORME,
      titre: titre || TITRE_DEFAUT_PLATEFORME.suspension,
      intro: intro || introDefautPlateforme('suspension'),
      corpsHtml: corpsSuspension(motifLabel),
      cta: { texte: 'Nous contacter', lien: 'mailto:contact@jakebmusic.com' },
    }),
  })
}

// Invitation à collaborer (la suite de la collaboration est plus bas) —
// migrée depuis un simple email texte vers le système "Mails My
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
  aDejaUnCompte = false,
}: {
  to: string
  nomProprietaire: string
  titreBeat: string
  pourcentage: number
  beatmakerId: string
  aDejaUnCompte?: boolean
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
      // Lien personnel : jamais d'acceptation depuis l'email — le collaborateur
      // se connecte (ou crée son compte) puis accepte depuis son dashboard.
      cta: aDejaUnCompte
        ? { texte: 'Voir l’invitation', lien: `${APP_URL}/connexion?redirect=/dashboard/business/collabs` }
        : { texte: 'Créer mon compte', lien: `${APP_URL}/inscription?email=${encodeURIComponent(to)}` },
    }),
  })
}


// ── Aperçu (page réglages admin) — mêmes titre/intro par défaut que
// l'envoi réel, données d'exemple à la place des vraies dates/prix. Ne
// passe jamais par envoyerEmailUnique (pas d'envoi, pas de log).
const CORPS_EXEMPLE_PLATEFORME = corpsAbonnementPlateforme('mensuel', 49.99, new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString())
// Emails de la vie d'une collaboration (Phase 12) — migrés vers "Mails My
// Producer" au lot 4 (titre/intro éditables par l'admin, logs admin).
// `beatmakerId` est toujours celui du PROPRIÉTAIRE du beat (comme pour
// envoyerInvitationCollab), même quand le destinataire `to` est le
// collaborateur, pour que l'envoi apparaisse dans les logs mailing du
// propriétaire.

async function envoyerEmailCollab(p: {
  type: TypeTemplatePlateforme
  to: string
  beatmakerId: string
  corpsHtml: string
  cta?: { texte: string; lien: string }
}) {
  const { titre, intro } = await chargerTemplatePlateforme(p.type)
  await envoyerEmailUnique({
    beatmakerId: p.beatmakerId,
    type: 'transactionnel',
    evenement: `plateforme_${p.type}`,
    to: p.to,
    subject: titre || TITRE_DEFAUT_PLATEFORME[p.type],
    html: rendreEmailTransactionnel({
      branding: BRANDING_PLATEFORME,
      titre: titre || TITRE_DEFAUT_PLATEFORME[p.type],
      intro: intro || introDefautPlateforme(p.type),
      corpsHtml: p.corpsHtml,
      cta: p.cta,
    }),
  })
}

const CTA_MES_BEATS = { texte: 'Voir mes beats', lien: `${APP_URL}/dashboard/business/beats` }
const CTA_COLLABS = { texte: 'Voir mes collaborations', lien: `${APP_URL}/dashboard/business/collabs` }

export async function envoyerCollabAcceptee({
  to, beatmakerId, nomCollaborateur, titreBeat, pourcentage,
}: {
  to: string; beatmakerId: string; nomCollaborateur: string; titreBeat: string; pourcentage: number
}) {
  await envoyerEmailCollab({
    type: 'collab_acceptation', to, beatmakerId, cta: CTA_MES_BEATS,
    corpsHtml: corpsLignes([['Beat', titreBeat], ['Collaborateur', nomCollaborateur], ['Sa part', `${pourcentage}%`]]),
  })
}

export async function envoyerCollabRefusee({
  to, beatmakerId, nomCollaborateur, titreBeat,
}: {
  to: string; beatmakerId: string; nomCollaborateur: string; titreBeat: string
}) {
  await envoyerEmailCollab({
    type: 'collab_refus', to, beatmakerId, cta: CTA_MES_BEATS,
    corpsHtml: corpsLignes([['Beat', titreBeat], ['Collaborateur', nomCollaborateur]]),
  })
}

export async function envoyerCollabRetrait({
  to, beatmakerId, nomProprietaire, titreBeat,
}: {
  to: string; beatmakerId: string; nomProprietaire: string; titreBeat: string
}) {
  await envoyerEmailCollab({
    type: 'collab_retrait', to, beatmakerId,
    corpsHtml: corpsLignes([['Beat', titreBeat], ['Propriétaire', nomProprietaire]]),
  })
}

export async function envoyerCollabDepart({
  to, beatmakerId, nomCollaborateur, titreBeat,
}: {
  to: string; beatmakerId: string; nomCollaborateur: string; titreBeat: string
}) {
  await envoyerEmailCollab({
    type: 'collab_depart', to, beatmakerId, cta: CTA_MES_BEATS,
    corpsHtml: corpsLignes([['Beat', titreBeat], ['Collaborateur', nomCollaborateur]]),
  })
}

export async function envoyerCollabEviction({
  to, beatmakerId, nomProprietaire, titreBeat, motif,
}: {
  to: string; beatmakerId: string; nomProprietaire: string; titreBeat: string; motif: string
}) {
  await envoyerEmailCollab({
    type: 'collab_eviction', to, beatmakerId, cta: CTA_COLLABS,
    corpsHtml: corpsLignes([['Beat', titreBeat], ['Propriétaire', nomProprietaire], ['Motif', motif]]),
  })
}

export async function envoyerCollabBeatSupprime({
  to, beatmakerId, nomProprietaire, titreBeat,
}: {
  to: string; beatmakerId: string; nomProprietaire: string; titreBeat: string
}) {
  await envoyerEmailCollab({
    type: 'collab_beat_supprime', to, beatmakerId, cta: CTA_COLLABS,
    corpsHtml: corpsLignes([['Beat', titreBeat], ['Propriétaire', nomProprietaire]]),
  })
}

export async function envoyerCollabPause({
  to, beatmakerId, titreBeat, nomVendeurConcerne, estLeVendeurConcerne, estProprietaire,
}: {
  to: string; beatmakerId: string; titreBeat: string; nomVendeurConcerne: string; estLeVendeurConcerne: boolean; estProprietaire: boolean
}) {
  // Le vendeur concerné est renvoyé là où s'affiche la liste de ce qui lui
  // manque : Vue d'ensemble pour A, page Collaborations pour B.
  const lienConfiguration = estProprietaire ? `${APP_URL}/dashboard/business` : `${APP_URL}/dashboard/business/collabs`
  await envoyerEmailCollab({
    type: 'collab_pause', to, beatmakerId,
    cta: estLeVendeurConcerne
      ? { texte: 'Terminer ma configuration', lien: lienConfiguration }
      : estProprietaire ? CTA_MES_BEATS : CTA_COLLABS,
    corpsHtml: corpsLignes([['Beat', titreBeat], ['Compte concerné', estLeVendeurConcerne ? 'Le tien' : nomVendeurConcerne]]),
  })
}

// Mise à jour d'un texte de la plateforme (clause d'évolution, Q10/Q10b du
// grill-me Phase 12) : purement informatif, préavis de 30 jours.
// `beatmakerId` = le destinataire lui-même (pas de propriétaire ici).
export async function envoyerConditionsMiseAJour({
  to, beatmakerId, texteConcerne, resumeChangements, dateEffet,
}: {
  to: string; beatmakerId: string; texteConcerne: string; resumeChangements: string; dateEffet: string
}) {
  await envoyerEmailCollab({
    type: 'conditions_mise_a_jour', to, beatmakerId,
    corpsHtml: corpsLignes([
      ['Texte concerné', texteConcerne],
      ['Ce qui change', resumeChangements],
      ['Entrée en vigueur', fmtDateEssai(dateEffet)],
    ]),
  })
}

const CORPS_EXEMPLE_INVITATION = corpsInvitationCollab('Jake B', 'Midnight Drive', 30)
const CORPS_EXEMPLE_SUSPENSION = corpsSuspension('Fraude')

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
    collab_acceptation: { corpsHtml: corpsLignes([['Beat', 'Midnight Drive'], ['Collaborateur', 'Nafaz'], ['Sa part', '30%']]), cta: { texte: CTA_MES_BEATS.texte, lien: '#' } },
    collab_refus: { corpsHtml: corpsLignes([['Beat', 'Midnight Drive'], ['Collaborateur', 'Nafaz']]), cta: { texte: CTA_MES_BEATS.texte, lien: '#' } },
    collab_retrait: { corpsHtml: corpsLignes([['Beat', 'Midnight Drive'], ['Propriétaire', 'Jake B']]) },
    collab_depart: { corpsHtml: corpsLignes([['Beat', 'Midnight Drive'], ['Collaborateur', 'Nafaz']]), cta: { texte: CTA_MES_BEATS.texte, lien: '#' } },
    collab_eviction: { corpsHtml: corpsLignes([['Beat', 'Midnight Drive'], ['Propriétaire', 'Jake B'], ['Motif', 'Exemple de motif']]), cta: { texte: CTA_COLLABS.texte, lien: '#' } },
    collab_beat_supprime: { corpsHtml: corpsLignes([['Beat', 'Midnight Drive'], ['Propriétaire', 'Jake B']]), cta: { texte: CTA_COLLABS.texte, lien: '#' } },
    collab_pause: { corpsHtml: corpsLignes([['Beat', 'Midnight Drive'], ['Compte concerné', 'Nafaz']]), cta: { texte: CTA_COLLABS.texte, lien: '#' } },
    conditions_mise_a_jour: {
      corpsHtml: corpsLignes([
        ['Texte concerné', 'Conditions de collaboration'],
        ['Ce qui change', 'Exemple de résumé des changements'],
        ['Entrée en vigueur', fmtDateEssai(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())],
      ]),
    },
    suspension: { corpsHtml: CORPS_EXEMPLE_SUSPENSION, cta: { texte: 'Nous contacter', lien: '#' } },
    nouvelle_vente: {
      corpsHtml: corpsLignes([
        ['Boutique', 'Jake B (vente en collaboration)'],
        ['Beat', 'Midnight Drive — Licence MP3'],
        ['Montant payé', '49.00€'],
        ['Ta part', '24.50€ (50 %)'],
      ]),
      cta: { texte: 'Voir la commande', lien: '#' },
    },
    remboursement_vente: {
      corpsHtml: corpsLignes([
        ['Boutique', 'Jake B (vente en collaboration)'],
        ['Beat', 'Midnight Drive — Licence MP3'],
        ['Ta part remboursée', '24.50€'],
        ['Frais Stripe non rendus', '0.62€'],
        ["Facture d'avoir", 'n° NAFAZ-00121026'],
      ]),
      cta: { texte: 'Voir la commande', lien: '#' },
    },
    remboursement_incomplet: {
      corpsHtml: corpsLignes([
        ['Commande', 'Midnight Drive — Licence MP3'],
        ['Part non remboursée', 'Nafaz — 24.50€'],
        ['Raison', 'Compte Stripe fermé'],
      ]),
      cta: { texte: 'Voir la commande', lien: '#' },
    },
    litige_ouvert: {
      corpsHtml: corpsLignes([
        ['Commande', 'Midnight Drive — Licence MP3'],
        ['Montant contesté', 'Jake B — 24.50€\nNafaz — 24.50€'],
        ['Motif', libelleMotifLitige('fraudulent')],
        ['Date limite pour répondre', fmtDateEssai(new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString())],
      ]),
      cta: { texte: 'Répondre au litige', lien: '#' },
    },
    litige_rappel: {
      corpsHtml: corpsLignes([
        ['Commande', 'Midnight Drive — Licence MP3'],
        ['Montant contesté', '49.00€'],
        ['Motif', libelleMotifLitige('fraudulent')],
        ['Date limite pour répondre', fmtDateEssai(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString())],
      ]),
      cta: { texte: 'Répondre au litige', lien: '#' },
    },
    litige_collaborateur: {
      corpsHtml: corpsLignes([
        ['Boutique', 'Jake B (vente en collaboration)'],
        ['Beat', 'Midnight Drive — Licence MP3'],
        ['Ta part contestée', '24.50€'],
        ['Motif', libelleMotifLitige('fraudulent')],
        ['Date limite', fmtDateEssai(new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString())],
      ]),
      cta: { texte: 'Voir la vente', lien: '#' },
    },
  }

  return rendreEmailTransactionnel({ branding: BRANDING_PLATEFORME, titre, intro, ...parType[type] })
}

// « Nouvelle vente » (Phase 13, lot 3 — Mails My Producer) : au propriétaire
// de la boutique et à chaque collaborateur vendeur, à chaque vente de licence
// (payée ou offerte : même email, seule la facture manque) et à chaque NOUVEL
// abonnement boutique. Jamais pour un renouvellement ni un free download.
// Un collaborateur ne voit jamais l'email ni le téléphone du client.
const fmtEuros = (cents: number) => `${(cents / 100).toFixed(2)}€`

export async function envoyerNouvelleVente({ commandeId }: { commandeId: string }) {
  const admin = createAdminClient()
  const { data: commande } = await admin
    .from('commandes')
    .select('id, beatmaker_id, prix_paye')
    .eq('id', commandeId)
    .maybeSingle()
  if (!commande) return

  const [{ data: lignes }, { data: tranches }] = await Promise.all([
    admin.from('commande_lignes').select('beat_id, licence_id, licence_nom, beats(titre)').eq('commande_id', commandeId),
    admin.from('commande_tranches').select('vendeur_id, montant_ttc_cents, detail_lignes, est_proprietaire').eq('commande_id', commandeId),
  ])

  type LigneRow = { beat_id: string; licence_id: string; licence_nom: string | null; beats: { titre: string } | null }
  const libelle = new Map(((lignes ?? []) as unknown as LigneRow[]).map(l => [
    `${l.beat_id}:${l.licence_id}`,
    `${l.beats?.titre ?? 'Beat'} — Licence ${l.licence_nom ?? ''}`.trim(),
  ]))
  const toutesLesLignes = [...libelle.values()].join('\n')
  const totalCents = Math.round(Number(commande.prix_paye) * 100)

  type Detail = { beat_id: string; licence_id: string; pourcentage: number; montant_cents: number }
  const destinataires = (tranches ?? []).length
    ? (tranches ?? []).map(t => ({ vendeurId: t.vendeur_id as string, proprietaire: t.est_proprietaire as boolean, partCents: t.montant_ttc_cents as number, details: (t.detail_lignes ?? []) as Detail[] }))
    : [{ vendeurId: commande.beatmaker_id as string, proprietaire: true, partCents: totalCents, details: [] as Detail[] }]
  const collab = (tranches ?? []).length > 1

  const { data: vendeurs } = await admin
    .from('beatmakers')
    .select('id, nom_artiste, email')
    .in('id', [...new Set([commande.beatmaker_id as string, ...destinataires.map(d => d.vendeurId)])])
  const vendeurMap = new Map((vendeurs ?? []).map(v => [v.id as string, v]))
  const boutique = vendeurMap.get(commande.beatmaker_id as string)?.nom_artiste ?? ''

  for (const d of destinataires) {
    const email = vendeurMap.get(d.vendeurId)?.email
    if (!email) continue
    const pcts = [...new Set(d.details.map(x => x.pourcentage))]
    const partLibelle = `${fmtEuros(d.partCents)}${pcts.length === 1 && pcts[0] < 100 ? ` (${pcts[0]} %)` : ''}`
    const corps: [string, string][] = d.proprietaire
      ? [
          ['Beats', toutesLesLignes],
          ['Montant payé', fmtEuros(totalCents)],
          ...(collab ? [['Ta part', partLibelle] as [string, string]] : []),
        ]
      : [
          ['Boutique', `${boutique} (vente en collaboration)`],
          ['Beat', d.details.map(x => libelle.get(`${x.beat_id}:${x.licence_id}`) ?? 'Beat').join('\n')],
          ['Ta part', partLibelle],
        ]
    await envoyerEmailCollab({
      type: 'nouvelle_vente',
      to: email,
      beatmakerId: commande.beatmaker_id as string,
      corpsHtml: corpsLignes(corps),
      cta: { texte: 'Voir la commande', lien: `${APP_URL}/dashboard/business/commandes/${commandeId}` },
    }).catch(err => console.error('[emails] Erreur envoi nouvelle vente à', d.vendeurId, ':', err))
  }
}

export async function envoyerNouvelAbonnement({ beatmakerId, periode, prixCents }: { beatmakerId: string; periode: string; prixCents: number }) {
  const { data: beatmaker } = await createAdminClient().from('beatmakers').select('email').eq('id', beatmakerId).maybeSingle()
  if (!beatmaker?.email) return
  await envoyerEmailCollab({
    type: 'nouvelle_vente',
    to: beatmaker.email,
    beatmakerId,
    corpsHtml: corpsLignes([['Nouvel abonnement', `Abonnement ${periode}`], ['Montant', fmtEuros(prixCents)]]),
    cta: { texte: 'Voir mes abonnés', lien: `${APP_URL}/dashboard/business/abonnements` },
  })
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
  const [{ branding, titre, intro }, { data: lignes }, { data: commande }, { data: tranches }] = await Promise.all([
    chargerBrandingEtTemplate(beatmakerId, 'confirmation_commande'),
    createAdminClient()
      .from('commande_lignes')
      .select('prix_paye, beats(titre), licences(nom)')
      .eq('commande_id', commandeId),
    createAdminClient()
      .from('commandes')
      .select('numero_facture, facture_pdf_url')
      .eq('id', commandeId)
      .maybeSingle(),
    // Vente à plusieurs vendeurs (Phase 13) : le client paie chaque vendeur
    // séparément (une ligne par vendeur sur son relevé) et reçoit une facture
    // de chacun — l'email le dit explicitement.
    createAdminClient()
      .from('commande_tranches')
      .select('vendeur_nom, montant_ttc_cents, facture_numero, facture_pdf_url, est_proprietaire')
      .eq('commande_id', commandeId)
      .order('est_proprietaire', { ascending: false }),
  ])
  if (!branding) return

  const tranchesPayees = (tranches ?? []).filter(t => t.montant_ttc_cents > 0)
  const blocVendeurs = tranchesPayees.length > 1
    ? `<p style="margin:16px 0 6px;font-size:13px;color:#374151;">Cette commande est vendue conjointement par ${tranchesPayees.length} artistes : tu es débité une fois par artiste et chacun t'envoie sa facture.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        ${tranchesPayees.map(t => `
          <tr>
            <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">${echapper(t.vendeur_nom)}</td>
            <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;text-align:right;white-space:nowrap;">${(t.montant_ttc_cents / 100).toFixed(2)}€</td>
          </tr>`).join('')}
      </table>`
    : ''
  const liensFacturesTranches = (tranches ?? []).filter(t => t.facture_pdf_url).map(t => `
        <p style="margin:8px 0 0;font-size:13px;">
          <a href="${t.facture_pdf_url}" style="color:#4f46e5;text-decoration:underline;">
            Télécharger la facture de ${echapper(t.vendeur_nom)}${t.facture_numero ? ` (n° ${echapper(t.facture_numero)})` : ''}
          </a>
        </p>`).join('')

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
      </table>
      ${blocVendeurs}
      ${commande?.facture_pdf_url ? `
        <p style="margin:12px 0 0;font-size:13px;">
          <a href="${commande.facture_pdf_url}" style="color:#4f46e5;text-decoration:underline;">
            Télécharger ta facture${commande.numero_facture ? ` (n° ${echapper(commande.numero_facture)})` : ''}
          </a>
        </p>` : ''}${liensFacturesTranches}`
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
    createAdminClient().from('abonnements_boutique').select('prix, devise, periode, client_id').eq('id', abonnementId).maybeSingle(),
  ])
  if (!branding) return

  // Facture de la commande de création d'abonnement — générée par
  // traiterPaiementAbonnement (app/api/stripe/webhook/route.ts), qui
  // s'exécute avant ce point (invoice.payment_succeeded arrive avant
  // checkout.session.completed pour une nouvelle souscription). Pas de
  // commandeId direct disponible ici : recherche par client+beatmaker,
  // la plus récente commande de création d'abonnement.
  const { data: commandeAbo } = abo?.client_id
    ? await createAdminClient()
        .from('commandes')
        .select('facture_pdf_url, numero_facture')
        .eq('beatmaker_id', beatmakerId)
        .eq('client_id', abo.client_id)
        .eq('type_commande', 'CREATION_ABONNEMENT')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const corpsHtml = abo
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">Abonnement ${echapper(abo.periode)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;text-align:right;white-space:nowrap;">${(Number(abo.prix) / 100).toFixed(2)}€</td>
        </tr>
      </table>
      ${commandeAbo?.facture_pdf_url ? `
        <p style="margin:12px 0 0;font-size:13px;">
          <a href="${commandeAbo.facture_pdf_url}" style="color:#4f46e5;text-decoration:underline;">
            Télécharger ta facture${commandeAbo.numero_facture ? ` (n° ${echapper(commandeAbo.numero_facture)})` : ''}
          </a>
        </p>` : ''}`
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
    remboursement_commande: { corpsHtml: corpsLignes([['Commande', 'Midnight Drive — Licence MP3'], ['Montant remboursé', '29.99€']]) },
    annulation_commande: { corpsHtml: corpsLignes([['Commande', 'Midnight Drive — Licence MP3']]) },
  }

  return rendreEmailTransactionnel({
    branding,
    titre,
    intro,
    ...parType[type],
  })
}

// Alerte « commande incomplète » (Phase 13 lot 5) — la réparation est
// automatique (lib/completion-commande.ts, chaque nuit) : on ne prévient
// qu'après 3 nuits sans succès, une seule fois, le vendeur et l'admin. Le
// détail de ce qui manque vit sur la fiche commande, pas dans l'email.
export async function alerteCommandeIncomplete({
  to,
  beatmakerId,
  commandeId,
  pourAdmin,
}: {
  to: string
  beatmakerId: string
  commandeId: string
  pourAdmin: boolean
}) {
  const lienCommande = pourAdmin
    ? `${APP_URL}/dashboard/admin/commandes/${commandeId}`
    : `${APP_URL}/dashboard/business/commandes/${commandeId}`
  await envoyerEmailUnique({
    beatmakerId,
    type: 'transactionnel',
    evenement: 'alerte_probleme_livraison',
    commandeId,
    to,
    subject: pourAdmin ? 'Commande incomplète après 3 nuits de réparation' : "Une commande n'a pas pu être complétée",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111;background:#fff;padding:32px;border-radius:12px;">
        <h2 style="color:#dc2626;margin-top:0;">Une commande reste incomplète</h2>
        <p>
          Il manque encore un document ou une information à une commande (contrat,
          facture, avoir ou frais Stripe). ${NOM_PLATEFORME} essaie de la compléter
          automatiquement chaque nuit, sans succès depuis 3 nuits.
        </p>
        <p>
          ${pourAdmin
            ? 'Probablement un vrai bug : la réparation automatique continue, mais elle ne suffira sans doute pas.'
            : `Tu n'as rien à faire : l'équipe ${NOM_PLATEFORME} est prévenue en même temps que toi. Le détail est visible sur la fiche de la commande.`}
        </p>
        <p style="margin:28px 0;">
          <a href="${lienCommande}"
             style="background:#dc2626;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;font-size:15px;">
            Voir la commande
          </a>
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#888;font-size:11px;margin:0;">
          Envoyé par ${NOM_PLATEFORME} suite à un problème détecté automatiquement.
        </p>
      </div>
    `,
  })
}

// ============================================================
// Remboursement / annulation (Phase 13, lot 4a)
// ============================================================

async function destinataireClient(commandeId: string) {
  const admin = createAdminClient()
  const { data: commande } = await admin
    .from('commandes')
    .select('id, beatmaker_id, client_id, acheteur_email, clients(email)')
    .eq('id', commandeId)
    .maybeSingle()
  if (!commande) return null
  const client = commande.clients as unknown as { email: string | null } | null
  const email = commande.acheteur_email ?? client?.email ?? null
  const { data: lignes } = await admin
    .from('commande_lignes')
    .select('licence_nom, beats(titre)')
    .eq('commande_id', commandeId)
  type LigneRow = { licence_nom: string | null; beats: { titre: string } | null }
  const libelle = ((lignes ?? []) as unknown as LigneRow[])
    .map(l => `${l.beats?.titre ?? 'Beat'} — Licence ${l.licence_nom ?? ''}`.trim())
    .join('\n')
  return { email, beatmakerId: commande.beatmaker_id as string, clientId: commande.client_id as string | null, libelle }
}

// Au client, quand de l'argent lui est rendu (bouton de A, ou part rendue
// par un vendeur depuis Stripe). Une part qui n'a pas pu être rendue est
// expliquée : elle relève du vendeur concerné (décision L4-Q3).
export async function envoyerRemboursementClient({ commandeId, montantCents, nonRembourses }: {
  commandeId: string
  montantCents: number
  nonRembourses: { vendeurNom: string; montantCents: number }[]
}) {
  const dest = await destinataireClient(commandeId)
  if (!dest?.email) return
  const { branding, titre, intro } = await chargerBrandingEtTemplate(dest.beatmakerId, 'remboursement_commande')
  if (!branding) return
  const lignes: [string, string][] = [
    ['Commande', dest.libelle],
    ['Montant remboursé', fmtEuros(montantCents)],
    ...nonRembourses.map(n => [`Part non remboursée (${n.vendeurNom})`, fmtEuros(n.montantCents)] as [string, string]),
  ]
  const blocNonRembourse = nonRembourses.length
    ? `<p style="font-size:13px;color:#374151;margin:12px 0 0;">${nonRembourses.map(n => `La part de ${echapper(n.vendeurNom)} n'a pas pu t'être remboursée : elle relève de ${echapper(n.vendeurNom)}, dont les coordonnées figurent sur sa facture.`).join('<br>')}</p>`
    : ''
  await envoyerEmailUnique({
    beatmakerId: dest.beatmakerId,
    from: `${branding.nom_artiste} <campagnes@jakebmusic.com>`,
    type: 'transactionnel',
    evenement: 'remboursement_commande',
    to: dest.email,
    clientId: dest.clientId,
    commandeId,
    subject: titre || TITRE_DEFAUT.remboursement_commande,
    html: rendreEmailTransactionnel({
      branding,
      titre: titre || TITRE_DEFAUT.remboursement_commande,
      intro: intro || introDefaut('remboursement_commande', branding.nom_artiste),
      corpsHtml: corpsLignes(lignes) + blocNonRembourse,
    }),
  })
}

export async function envoyerAnnulationClient({ commandeId }: { commandeId: string }) {
  const dest = await destinataireClient(commandeId)
  if (!dest?.email) return
  const { branding, titre, intro } = await chargerBrandingEtTemplate(dest.beatmakerId, 'annulation_commande')
  if (!branding) return
  await envoyerEmailUnique({
    beatmakerId: dest.beatmakerId,
    from: `${branding.nom_artiste} <campagnes@jakebmusic.com>`,
    type: 'transactionnel',
    evenement: 'annulation_commande',
    to: dest.email,
    clientId: dest.clientId,
    commandeId,
    subject: titre || TITRE_DEFAUT.annulation_commande,
    html: rendreEmailTransactionnel({
      branding,
      titre: titre || TITRE_DEFAUT.annulation_commande,
      intro: intro || introDefaut('annulation_commande', branding.nom_artiste),
      corpsHtml: corpsLignes([['Commande', dest.libelle]]),
    }),
  })
}

// À un collaborateur dont la part vient d'être rendue au client par le
// bouton de A : montant, frais Stripe non rendus, numéro de son avoir.
export async function envoyerRemboursementVente({ commandeId, trancheId }: { commandeId: string; trancheId: string }) {
  const admin = createAdminClient()
  const [{ data: tranche }, { data: commande }, { data: avoir }] = await Promise.all([
    admin.from('commande_tranches').select('vendeur_id, montant_ttc_cents, frais_stripe_cents').eq('id', trancheId).maybeSingle(),
    admin.from('commandes').select('beatmaker_id').eq('id', commandeId).maybeSingle(),
    admin.from('avoirs').select('numero').eq('tranche_id', trancheId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (!tranche?.vendeur_id || !commande) return
  const [{ data: vendeur }, { data: boutique }, dest] = await Promise.all([
    admin.from('beatmakers').select('email').eq('id', tranche.vendeur_id).maybeSingle(),
    admin.from('beatmakers').select('nom_artiste').eq('id', commande.beatmaker_id).maybeSingle(),
    destinataireClient(commandeId),
  ])
  if (!vendeur?.email) return
  await envoyerEmailCollab({
    type: 'remboursement_vente',
    to: vendeur.email,
    beatmakerId: commande.beatmaker_id,
    corpsHtml: corpsLignes([
      ['Boutique', `${boutique?.nom_artiste ?? ''} (vente en collaboration)`],
      ['Beat', dest?.libelle ?? ''],
      ['Ta part remboursée', fmtEuros(tranche.montant_ttc_cents)],
      ...(tranche.frais_stripe_cents != null ? [['Frais Stripe non rendus', fmtEuros(tranche.frais_stripe_cents)] as [string, string]] : []),
      ...(avoir?.numero && !avoir.numero.startsWith('reserve-') ? [["Facture d'avoir", `n° ${avoir.numero}`] as [string, string]] : []),
    ]),
    cta: { texte: 'Voir la commande', lien: `${APP_URL}/dashboard/business/commandes/${commandeId}` },
  })
}

// À A et à chaque vendeur dont la part n'a pas pu être rendue.
export async function envoyerRemboursementIncomplet({ commandeId }: { commandeId: string }) {
  const admin = createAdminClient()
  const [{ data: commande }, { data: tranches }, dest] = await Promise.all([
    admin.from('commandes').select('beatmaker_id').eq('id', commandeId).maybeSingle(),
    admin.from('commande_tranches').select('vendeur_id, vendeur_nom, montant_ttc_cents, montant_rembourse_cents, remboursement_erreur, statut').eq('commande_id', commandeId),
    destinataireClient(commandeId),
  ])
  if (!commande) return
  const enEchec = (tranches ?? []).filter(t => t.statut === 'remboursement_echoue')
  if (!enEchec.length) return
  const ids = [...new Set([commande.beatmaker_id as string, ...enEchec.map(t => t.vendeur_id).filter((v): v is string => !!v)])]
  const { data: vendeurs } = await admin.from('beatmakers').select('id, email').in('id', ids)
  const corps = corpsLignes([
    ['Commande', dest?.libelle ?? ''],
    ...enEchec.map(t => ['Part non remboursée', `${t.vendeur_nom} — ${fmtEuros(t.montant_ttc_cents - t.montant_rembourse_cents)}`] as [string, string]),
    ...enEchec.filter(t => t.remboursement_erreur).map(t => [`Raison (${t.vendeur_nom})`, t.remboursement_erreur as string] as [string, string]),
  ])
  for (const v of vendeurs ?? []) {
    if (!v.email) continue
    await envoyerEmailCollab({
      type: 'remboursement_incomplet',
      to: v.email,
      beatmakerId: commande.beatmaker_id,
      corpsHtml: corps,
      cta: { texte: 'Voir la commande', lien: `${APP_URL}/dashboard/business/commandes/${commandeId}` },
    }).catch(err => console.error('[emails] Erreur envoi remboursement incomplet à', v.id, ':', err))
  }
}

// ─── Litiges (Phase 13, lot 4b — décision L4-Q5) ────────────────────────────
// À A : à l'ouverture (un seul email pour toutes les parts contestées en même
// temps) et en rappel 3 jours avant la date limite s'il n'a pas répondu. À B :
// un email d'information pour SA part. Le client n'est jamais prévenu par la
// plateforme (c'est lui qui a ouvert le litige auprès de sa banque).
export type PartLitigeEmail = { vendeurNom: string; montant: number; motif: string | null; dateLimite: string | null }

function lignesPartsLitige(parts: PartLitigeEmail[]): [string, string][] {
  const montant = parts.length > 1
    ? parts.map(p => `${p.vendeurNom} — ${Number(p.montant).toFixed(2)}€`).join('\n')
    : `${Number(parts[0]?.montant ?? 0).toFixed(2)}€`
  const motifs = [...new Set(parts.map(p => libelleMotifLitige(p.motif)))]
  const limites = parts.map(p => p.dateLimite).filter((d): d is string => !!d).sort()
  return [
    ['Montant contesté', montant],
    ['Motif', motifs.join('\n')],
    ...(limites.length ? [['Date limite pour répondre', fmtDateEssai(limites[0])] as [string, string]] : []),
  ]
}

async function emailProprietaire(commandeId: string) {
  const admin = createAdminClient()
  const { data: commande } = await admin.from('commandes').select('beatmaker_id').eq('id', commandeId).maybeSingle()
  if (!commande) return null
  const { data: bm } = await admin.from('beatmakers').select('email').eq('id', commande.beatmaker_id).maybeSingle()
  return bm?.email ? { email: bm.email as string, beatmakerId: commande.beatmaker_id as string } : null
}

async function envoyerLitigeProprietaire(type: 'litige_ouvert' | 'litige_rappel', commandeId: string, parts: PartLitigeEmail[]) {
  const [proprio, dest] = await Promise.all([emailProprietaire(commandeId), destinataireClient(commandeId)])
  if (!proprio || !parts.length) return
  await envoyerEmailCollab({
    type,
    to: proprio.email,
    beatmakerId: proprio.beatmakerId,
    corpsHtml: corpsLignes([['Commande', dest?.libelle ?? ''], ...lignesPartsLitige(parts)]),
    cta: { texte: 'Répondre au litige', lien: `${APP_URL}/dashboard/business/commandes/${commandeId}` },
  })
}

export async function envoyerLitigeOuvert({ commandeId, parts }: { commandeId: string; parts: PartLitigeEmail[] }) {
  await envoyerLitigeProprietaire('litige_ouvert', commandeId, parts)
}

export async function envoyerLitigeRappel({ commandeId, parts }: { commandeId: string; parts: PartLitigeEmail[] }) {
  await envoyerLitigeProprietaire('litige_rappel', commandeId, parts)
}

export async function envoyerLitigeCollaborateur({ commandeId, vendeurId, part }: { commandeId: string; vendeurId: string; part: PartLitigeEmail }) {
  const admin = createAdminClient()
  const [{ data: commande }, { data: vendeur }, dest] = await Promise.all([
    admin.from('commandes').select('beatmaker_id').eq('id', commandeId).maybeSingle(),
    admin.from('beatmakers').select('email').eq('id', vendeurId).maybeSingle(),
    destinataireClient(commandeId),
  ])
  if (!commande || !vendeur?.email) return
  const { data: boutique } = await admin.from('beatmakers').select('nom_artiste').eq('id', commande.beatmaker_id).maybeSingle()
  await envoyerEmailCollab({
    type: 'litige_collaborateur',
    to: vendeur.email,
    beatmakerId: commande.beatmaker_id,
    corpsHtml: corpsLignes([
      ['Boutique', `${boutique?.nom_artiste ?? ''} (vente en collaboration)`],
      ['Beat', dest?.libelle ?? ''],
      ['Ta part contestée', `${Number(part.montant).toFixed(2)}€`],
      ['Motif', libelleMotifLitige(part.motif)],
      ...(part.dateLimite ? [['Date limite', fmtDateEssai(part.dateLimite)] as [string, string]] : []),
    ]),
    cta: { texte: 'Voir la vente', lien: `${APP_URL}/dashboard/business/commandes/${commandeId}` },
  })
}
