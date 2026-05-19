import { getResend } from './resend'

const FROM = 'My Producer <noreply@jakebmusic.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-producer.com'

export async function envoyerInvitationCollab({
  to,
  nomProprietaire,
  titreBeat,
  pourcentage,
}: {
  to: string
  nomProprietaire: string
  titreBeat: string
  pourcentage: number
}) {
  await getResend().emails.send({
    from: FROM,
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
}: {
  to: string
  titreBeat: string
  montantEuros: string
}) {
  await getResend().emails.send({
    from: FROM,
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
}: {
  to: string
  titreBeat: string
  montantEuros: string
  joursRestants: number
}) {
  const urgence = joursRestants <= 10
  await getResend().emails.send({
    from: FROM,
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
}: {
  to: string
  titreBeat: string
  montantEuros: string
}) {
  await getResend().emails.send({
    from: FROM,
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
