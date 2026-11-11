// Lien de sonoo.app/mon-compte vers une page d'une boutique. Formulaire et non
// simple lien : si la boutique a son domaine, le serveur fabrique au clic un
// laissez-passer pour y arriver déjà connecté (/api/artiste/passage-boutique).
export default function LienVersBoutique({
  slug,
  chemin = '',
  className,
  children,
}: {
  slug: string
  chemin?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <form action="/api/artiste/passage-boutique" method="POST" className="contents">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="chemin" value={chemin} />
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  )
}
