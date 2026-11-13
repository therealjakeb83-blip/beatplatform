import { getImageProps } from 'next/image'

type Source = { src: string; largeur: number; hauteur: number }

// Une découpe de maquette par taille d'écran (mêmes seuils que vitrine.css).
export function ImageAdaptative({
  ordinateur,
  tablette,
  mobile,
  alt,
  prioritaire = false,
  className,
}: {
  ordinateur: Source
  tablette: Source
  mobile: Source
  alt: string
  prioritaire?: boolean
  className?: string
}) {
  const commun = { alt, priority: prioritaire, sizes: '(min-width: 1200px) 1280px, 100vw' }
  const srcSet = (s: Source) => getImageProps({ ...commun, src: s.src, width: s.largeur, height: s.hauteur }).props.srcSet
  const { props: base } = getImageProps({ ...commun, src: mobile.src, width: mobile.largeur, height: mobile.hauteur })

  return (
    <picture className={className}>
      <source media="(min-width: 1200px)" srcSet={srcSet(ordinateur)} width={ordinateur.largeur} height={ordinateur.hauteur} />
      <source media="(min-width: 768px)" srcSet={srcSet(tablette)} width={tablette.largeur} height={tablette.hauteur} />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- alt fourni par getImageProps */}
      <img {...base} />
    </picture>
  )
}
