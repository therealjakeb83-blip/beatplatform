import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { envoyerCompteSupprime } from '@/lib/emails'
import { NOM_PLATEFORME, EMAIL_CONTACT } from '@/lib/constantes'

// « Supprimer mon compte » (9d lot 4) : compte Sonoo de la personne (Sonoo
// responsable). Session obligatoire, jamais le cookie d'abonné. La ligne
// `clients` est anonymisée (jamais supprimée : les données des boutiques y
// sont rattachées), les fiches des boutiques restent, la connexion est
// supprimée. Newsletter désinscrite seulement chez les boutiques cochées.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connecte-toi pour supprimer ton compte.' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  if (body?.confirmation !== 'SUPPRIMER') {
    return NextResponse.json({ error: 'Tape SUPPRIMER pour confirmer.' }, { status: 400 })
  }
  const desinscrire = Array.isArray(body?.desinscrire)
    ? (body.desinscrire as unknown[]).filter((v): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)).slice(0, 500)
    : []

  const admin = createAdminClient()
  const { data: boutique } = await admin.from('beatmakers').select('id').eq('id', user.id).maybeSingle()
  if (boutique) {
    return NextResponse.json({ error: `Cette connexion est aussi celle d’une boutique : écris à ${NOM_PLATEFORME} (${EMAIL_CONTACT}) pour fermer la boutique.` }, { status: 409 })
  }

  const email = user.email ?? null
  const { error } = await admin.rpc('supprimer_compte_client', { p_client_id: user.id, p_desinscrire: desinscrire })
  if (error) {
    if (error.message?.includes('abonnement_actif')) {
      return NextResponse.json({ error: "Tu as encore un abonnement en cours : annule-le d'abord (« Mon compte » de la boutique), puis reviens ici." }, { status: 409 })
    }
    if (error.message?.includes('compte_boutique')) {
      return NextResponse.json({ error: `Cette connexion est aussi celle d’une boutique : écris à ${NOM_PLATEFORME} (${EMAIL_CONTACT}) pour fermer la boutique.` }, { status: 409 })
    }
    if (!error.message?.includes('compte_introuvable')) {
      console.error('[supprimer-compte] rpc:', JSON.stringify(error))
      return NextResponse.json({ error: 'La suppression a échoué, rien n’a été modifié. Réessaie.' }, { status: 500 })
    }
    // compte_introuvable = connexion sans fiche `clients` (ou déjà anonymisée) :
    // on supprime quand même la connexion ci-dessous.
  }

  const { error: eAuth } = await admin.auth.admin.deleteUser(user.id)
  if (eAuth) {
    console.error('[supprimer-compte] suppression de la connexion:', JSON.stringify(eAuth))
    return NextResponse.json({ error: `Ton compte est presque supprimé : la connexion n’a pas pu être fermée. Réessaie, ou écris à ${EMAIL_CONTACT}.` }, { status: 500 })
  }

  if (email) await envoyerCompteSupprime({ to: email, le: new Date() }).catch(e => console.error('[supprimer-compte] email:', e))

  await supabase.auth.signOut().catch(() => {})
  const reponse = NextResponse.json({ ok: true })
  const cookieStore = await cookies()
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith('abo_')) reponse.cookies.set(c.name, '', { maxAge: 0, path: '/' })
  }
  return reponse
}
