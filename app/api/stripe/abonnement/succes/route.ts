import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { lierCompteClient } from '@/lib/lier-compte-client'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Cette route ne sert qu'à l'expérience utilisateur (poser le cookie de session
// membre + rediriger, et depuis 2026-07-15 tenter une connexion automatique
// réelle) — jamais à créer l'abonnement en base. Cette redirection dépend du
// navigateur du client (peut être lente, interrompue, ou ne jamais arriver si
// l'onglet est fermé), donc pas fiable pour une action critique. La création
// réelle de la ligne abonnements_boutique se fait dans le webhook Stripe
// (checkout.session.completed → traiterAbonnementCree), qui est garanti
// serveur à serveur, indépendamment de ce que fait le navigateur.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  const slug = searchParams.get('slug')

  if (!sessionId || !slug) {
    return NextResponse.redirect(`${origin}/`)
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const email = session.customer_details?.email
    const nom = session.customer_details?.name ?? null

    if (email) {
      const cookieStore = await cookies()
      cookieStore.set(`abo_${slug}`, email, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
        sameSite: 'lax',
      })

      await connecterAutomatiquementApresAbonnement(email, nom, slug)
    }
  } catch (err) {
    console.error('[abo/succes]', err)
  }

  return NextResponse.redirect(`${origin}/${slug}/mon-abonnement`)
}

// Un client qui s'abonne doit repartir connecté, pas "invité" (retour Jake,
// 2026-07-15) — jusqu'ici seul le cookie abo_{slug} débloquait les avantages
// abonné, sans jamais créer ni connecter de vrai compte.
//
// Ne s'applique QUE si l'email n'a encore aucun compte Supabase Auth : si un
// vrai compte existe déjà, on NE connecte PAS automatiquement — sinon payer
// un abonnement avec l'email de quelqu'un d'autre le connecterait sur SON
// compte à lui (faille de sécurité). Dans ce cas il garde juste le cookie
// (avantages abonné) et doit se connecter lui-même avec son mot de passe.
async function connecterAutomatiquementApresAbonnement(email: string, nom: string | null, slug: string): Promise<void> {
  const admin = createAdminClient()

  const parts = (nom ?? '').trim().split(' ')
  const prenom = parts[0] || undefined
  const nomFamille = parts.slice(1).join(' ') || undefined

  // Mot de passe aléatoire jamais communiqué : le client n'en a pas besoin
  // tant qu'il reste sur ce navigateur, et peut en définir un plus tard via
  // "mot de passe oublié" pour se reconnecter ailleurs. email_confirm: true
  // car le paiement Stripe vaut déjà preuve de possession de l'email.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { prenom, nom: nomFamille },
  })

  if (createError || !created.user) {
    // Compte déjà existant (cas le plus probable) ou erreur ponctuelle —
    // dans les deux cas, pas de connexion automatique.
    return
  }

  // Fusionne avec la fiche "invitée" créée par le webhook Stripe si elle
  // existe déjà (résiste aussi à l'ordre inverse : si le webhook n'est pas
  // encore passé, lierCompteClient crée directement la bonne fiche, que le
  // webhook réutilisera ensuite par email — voir traiterAbonnementCree).
  await lierCompteClient(created.user.id, email, nomFamille, prenom, undefined, slug)

  // Connexion réelle sans mot de passe : génère un lien magique côté admin,
  // puis le vérifie immédiatement côté serveur pour poser une vraie session
  // (cookies Supabase Auth) sur ce navigateur.
  const { data: lien, error: lienError } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (lienError || !lien) {
    console.error('[abo/succes] Erreur génération lien de connexion auto:', JSON.stringify(lienError))
    return
  }

  const supabase = await createClient()
  const { error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token: lien.properties.hashed_token,
    type: 'email',
  })
  if (verifyError) {
    console.error('[abo/succes] Erreur connexion automatique:', JSON.stringify(verifyError))
  }
}
