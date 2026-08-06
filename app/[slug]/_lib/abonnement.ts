// Seul point de vérité pour la visibilité des CTA "Devenir membre" (header,
// hero, pill). Pour l'instant se limite à abo_actif — quand les plans
// plateforme (gratuit/intermédiaire/max) existeront, le gate "plan max"
// s'ajoutera uniquement ici, sans toucher aux composants qui l'appellent.
export function peutAfficherCtaAbonnement(beatmaker: { abo_actif: boolean }): boolean {
  return beatmaker.abo_actif
}

// Point de vérité pour "ce visiteur est-il abonné à cette boutique" — session
// Supabase en priorité, cookie `abo_{slug}` en repli (posé après connexion
// par email seul sans compte, voir mon-abonnement/page.tsx). Utilisé par le
// layout (remise membre dans la pop-up licence, partout dans la boutique) et
// par les pages qui en ont besoin séparément.
export async function estClientAbonne({
  admin,
  beatmakerId,
  aboActif,
  slug,
  user,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any
  beatmakerId: string
  aboActif: boolean
  slug: string
  user: { id: string; email?: string | null } | null
}): Promise<boolean> {
  if (!aboActif) return false

  if (user) {
    const { data: abo } = await admin
      .from('abonnements_boutique')
      .select('id')
      .eq('beatmaker_id', beatmakerId)
      .or(`client_id.eq.${user.id},acheteur_email.eq.${user.email}`)
      .eq('statut', 'actif')
      .maybeSingle()
    if (abo) return true
  }

  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const emailCookie = cookieStore.get(`abo_${slug}`)?.value
  if (emailCookie) {
    const { data: abo } = await admin
      .from('abonnements_boutique')
      .select('id')
      .eq('beatmaker_id', beatmakerId)
      .eq('acheteur_email', emailCookie)
      .eq('statut', 'actif')
      .maybeSingle()
    if (abo) return true
  }

  return false
}
