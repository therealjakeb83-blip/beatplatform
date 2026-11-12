import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { URL_APP } from '@/lib/constantes'
import { cheminInterne } from '@/lib/redirection'
import { slugBoutiqueDuChemin, hoteSansPort } from '@/lib/domaine-boutique'
import { slugDuSiteBoutique } from '@/lib/boutique-du-domaine'
import { lierCompteClient } from '@/lib/lier-compte-client'
import { beatmakerIdDuSlug } from '@/lib/compte-artiste'
import { confirmationCompteArtiste } from '@/lib/emails'
import { normaliserEmail } from '@/lib/email'

export const runtime = 'nodejs'

// Retour de Google, toujours sur sonoo.app (rang 9c, lot 4). Le compte est relié à
// la boutique de départ seulement, puis le client repart vers cette boutique :
// sur son domaine par un laissez-passer à usage unique (même mécanisme que
// /api/artiste/passage-boutique), sinon directement sur sonoo.app.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const redirect = cheminInterne(params.get('redirect'), '/mon-compte')

  // Domaine revérifié en base : un domaine inventé ou non actif ne reçoit rien.
  const domaineDemande = hoteSansPort(params.get('domaine'))
  const slugDomaine = domaineDemande ? await slugDuSiteBoutique(domaineDemande).catch(() => null) : null
  const origine = slugDomaine ? `https://${domaineDemande}` : URL_APP
  const redirectFinal = domaineDemande && !slugDomaine ? '/mon-compte' : redirect

  const echec = () => NextResponse.redirect(
    new URL(`/artiste/connexion?erreur=google&redirect=${encodeURIComponent(redirectFinal)}`, origine), 303,
  )

  const code = params.get('code')
  if (!code) return echec()
  const { data, error } = await (await createClient()).auth.exchangeCodeForSession(code)
  const user = data?.user
  if (error || !user?.email) {
    console.error('[artiste/google/retour] exchangeCodeForSession:', JSON.stringify(error))
    return echec()
  }

  const admin = createAdminClient()
  const email = normaliserEmail(user.email)
  const slug = slugDomaine ?? slugBoutiqueDuChemin(redirectFinal)

  // Nouveau compte = pas encore de fiche client à son nom (un compte mot de passe
  // existant relié à Google en a déjà une) → email de bienvenue, une seule fois.
  const { data: ficheExistante } = await admin.from('clients').select('id, prenom, nom').eq('id', user.id).maybeSingle()

  const meta = (user.user_metadata ?? {}) as { given_name?: string; family_name?: string; full_name?: string; name?: string }
  const nomComplet = (meta.full_name ?? meta.name ?? '').trim()
  const prenomGoogle = meta.given_name ?? (nomComplet.split(' ')[0] || null)
  const nomGoogle = meta.family_name ?? (nomComplet.split(' ').slice(1).join(' ') || null)
  // Le nom Google ne remplace jamais celui que le client a déjà sur sa fiche.
  const prenom = ficheExistante?.prenom?.trim() ? null : prenomGoogle
  const nom = ficheExistante?.nom?.trim() ? null : nomGoogle
  await lierCompteClient(user.id, email, nom, prenom, undefined, slug).catch(err =>
    console.error('[artiste/google/retour] lierCompteClient:', err),
  )

  if (!ficheExistante) {
    const beatmakerId = await beatmakerIdDuSlug(slug)
    if (beatmakerId) {
      await confirmationCompteArtiste({ to: email, beatmakerId, clientId: user.id, lienCompte: `${origine}${redirectFinal}` })
        .catch(err => console.error('[artiste/google/retour] Email de bienvenue:', err))
    }
  }

  if (!slugDomaine) return NextResponse.redirect(new URL(redirectFinal, URL_APP), 303)

  const { data: lien, error: erreurLien } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (erreurLien || !lien?.properties?.hashed_token) {
    console.error('[artiste/google/retour] generateLink:', JSON.stringify(erreurLien))
    return NextResponse.redirect(new URL(`/artiste/connexion?redirect=${encodeURIComponent(redirectFinal)}`, origine), 303)
  }
  const destination = new URL('/artiste/passage', origine)
  destination.searchParams.set('token_hash', lien.properties.hashed_token)
  destination.searchParams.set('redirect', redirectFinal)
  return NextResponse.redirect(destination, 303)
}
