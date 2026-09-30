import type { Stripe } from '@stripe/stripe-js'
import { chargerStripePourCompte } from '@/lib/stripe-client'
import { effacerPaiementEnCours, noterPaiementEnCours } from './paiement-en-cours'

// Paiement réparti entre vendeurs (Phase 13) côté navigateur — partagé par
// la page de paiement et le panier. Le moyen de paiement est enregistré sur
// la plateforme (aucun débit), puis le serveur réserve et encaisse la part de
// chaque vendeur. Si la banque exige une validation pour une part, la fenêtre
// de validation s'affiche ici (Stripe.js chargé sur le compte de ce vendeur),
// puis le serveur reprend là où il s'était arrêté.

export type ResultatPaiementMultiClient =
  | { etat: 'ok'; commandeId: string }
  // Argent encaissé mais commande pas encore créée (le balayage la terminera).
  | { etat: 'recu'; message: string }
  | { etat: 'erreur'; erreur: string }

type Validation = { client_secret: string; stripe_account_id: string; payment_method_id: string; numero?: number; total?: number }

/** Affiché quand la banque exige une validation par artiste (banque stricte),
 *  seul moment où on le sait avec certitude — texte validé par Jake. */
export type SurValidation = (message: string | null) => void

export function messageValidationParArtiste(numero?: number, total?: number): string {
  const position = numero && total ? ` (artiste ${numero} sur ${total})` : ''
  return `Ta banque demande une validation pour chaque artiste de ce beat en collaboration${position}. Rien n’est débité tant que tout n’est pas validé.`
}

// Laisse le temps de lire le message avant que la fenêtre de la banque ne le recouvre.
const DELAI_LECTURE_MS = 2000

const MESSAGE_VALIDATION_ECHOUEE = 'La validation demandée par ta banque n’a pas abouti. Aucun montant n’a été débité.'

async function annuler(setupIntentId: string) {
  await fetch('/api/stripe/paiement-multi/annuler', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ setup_intent_id: setupIntentId }),
  }).catch(() => {})
}

async function preparer(corps: Record<string, unknown>) {
  const res = await fetch('/api/stripe/paiement-multi/preparer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  })
  const data = await res.json() as { clientSecret?: string; setupIntentId?: string; statut?: string; erreur?: string }
  if (!res.ok || !data.clientSecret || !data.setupIntentId) return { erreur: data.erreur ?? 'Erreur serveur, réessaie' }
  return { clientSecret: data.clientSecret, setupIntentId: data.setupIntentId, statut: data.statut }
}

async function validerPart(validation: Validation): Promise<boolean> {
  const stripeVendeur = await chargerStripePourCompte(validation.stripe_account_id)
  if (!stripeVendeur) return false
  const { error, paymentIntent } = await stripeVendeur.confirmPayment({
    clientSecret: validation.client_secret,
    confirmParams: { payment_method: validation.payment_method_id, return_url: window.location.href },
    redirect: 'if_required',
  })
  return !error && paymentIntent?.status === 'requires_capture'
}

async function finaliser(slug: string, setupIntentId: string, surValidation?: SurValidation): Promise<ResultatPaiementMultiClient> {
  try {
    return await finaliserParts(slug, setupIntentId, surValidation)
  } finally {
    surValidation?.(null)
  }
}

async function finaliserParts(slug: string, setupIntentId: string, surValidation?: SurValidation): Promise<ResultatPaiementMultiClient> {
  // Une validation par vendeur au maximum, plus une marge.
  for (let etape = 0; etape < 12; etape++) {
    let res: Response
    let data: { commande_id?: string; erreur?: string; validation?: Validation }
    try {
      res = await fetch('/api/stripe/paiement-multi/payer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setup_intent_id: setupIntentId }),
      })
      data = await res.json()
    } catch {
      // Réponse perdue : l'encaissement a pu continuer côté serveur. La note
      // « paiement en cours » reste, le panier vérifiera au prochain affichage.
      return { etat: 'erreur', erreur: 'Connexion perdue pendant le paiement. Recharge la page pour voir où il en est.' }
    }

    if (res.ok && data.commande_id) {
      effacerPaiementEnCours(slug)
      return { etat: 'ok', commandeId: data.commande_id }
    }
    if (res.ok && data.validation) {
      if (surValidation) {
        surValidation(messageValidationParArtiste(data.validation.numero, data.validation.total))
        await new Promise(r => setTimeout(r, DELAI_LECTURE_MS))
      }
      if (!(await validerPart(data.validation))) {
        await annuler(setupIntentId)
        effacerPaiementEnCours(slug)
        return { etat: 'erreur', erreur: MESSAGE_VALIDATION_ECHOUEE }
      }
      continue
    }
    if (res.status === 202) return { etat: 'recu', message: data.erreur ?? 'Paiement reçu — tu recevras un email de confirmation.' }
    if (res.status === 409) return { etat: 'erreur', erreur: data.erreur ?? 'Ton paiement est déjà en cours de traitement.' }
    effacerPaiementEnCours(slug)
    return { etat: 'erreur', erreur: data.erreur ?? 'Le paiement n’a pas pu aboutir. Aucun montant n’a été débité.' }
  }
  await annuler(setupIntentId)
  effacerPaiementEnCours(slug)
  return { etat: 'erreur', erreur: 'Le paiement n’a pas pu aboutir. Aucun montant n’a été débité.' }
}

/** Carte saisie dans le formulaire : `confirmerCarte` enregistre la carte (confirmCardSetup). */
export async function payerMultiParCarte(
  slug: string,
  corps: Record<string, unknown>,
  confirmerCarte: (clientSecret: string) => Promise<{ error?: { message?: string } }>,
  surValidation?: SurValidation,
): Promise<ResultatPaiementMultiClient> {
  const prep = await preparer(corps)
  if ('erreur' in prep) return { etat: 'erreur', erreur: prep.erreur! }
  noterPaiementEnCours(slug, 'multi', prep.setupIntentId)

  const { error } = await confirmerCarte(prep.clientSecret)
  if (error) {
    await annuler(prep.setupIntentId)
    effacerPaiementEnCours(slug)
    return { etat: 'erreur', erreur: error.message ?? 'Carte refusée' }
  }
  return finaliser(slug, prep.setupIntentId, surValidation)
}

/** Apple Pay / Google Pay / Link : moyen déjà créé par le navigateur (stripe.createPaymentMethod). */
export async function payerMultiAvecMoyen(
  stripe: Stripe,
  slug: string,
  corps: Record<string, unknown>,
  paymentMethodId: string,
  surValidation?: SurValidation,
): Promise<ResultatPaiementMultiClient> {
  const prep = await preparer({ ...corps, payment_method_id: paymentMethodId })
  if ('erreur' in prep) return { etat: 'erreur', erreur: prep.erreur! }
  noterPaiementEnCours(slug, 'multi', prep.setupIntentId)

  if (prep.statut === 'requires_action') {
    const { error, setupIntent } = await stripe.handleNextAction({ clientSecret: prep.clientSecret })
    if (error || setupIntent?.status !== 'succeeded') {
      await annuler(prep.setupIntentId)
      effacerPaiementEnCours(slug)
      return { etat: 'erreur', erreur: MESSAGE_VALIDATION_ECHOUEE }
    }
  } else if (prep.statut !== 'succeeded') {
    await annuler(prep.setupIntentId)
    effacerPaiementEnCours(slug)
    return { etat: 'erreur', erreur: 'Ton moyen de paiement a été refusé. Aucun montant n’a été débité.' }
  }
  return finaliser(slug, prep.setupIntentId, surValidation)
}
