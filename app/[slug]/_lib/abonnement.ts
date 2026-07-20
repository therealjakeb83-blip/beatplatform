// Seul point de vérité pour la visibilité des CTA "Devenir membre" (header,
// hero, pill). Pour l'instant se limite à abo_actif — quand les plans
// plateforme (gratuit/intermédiaire/max) existeront, le gate "plan max"
// s'ajoutera uniquement ici, sans toucher aux composants qui l'appellent.
export function peutAfficherCtaAbonnement(beatmaker: { abo_actif: boolean }): boolean {
  return beatmaker.abo_actif
}
