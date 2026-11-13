import type { ReactNode, SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement> & { taille?: number }

function Icone({ taille = 20, children, ...rest }: Props & { children: ReactNode }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const Etincelle = (p: Props) => (
  <Icone {...p} stroke="none" fill="currentColor">
    <path d="M12 2.5c.5 4.7 2.3 7 9.5 9.5-7.2 2.5-9 4.8-9.5 9.5-.5-4.7-2.3-7-9.5-9.5 7.2-2.5 9-4.8 9.5-9.5Z" />
  </Icone>
)
export const Fleche = (p: Props) => (
  <Icone {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icone>
)
export const FlecheBas = (p: Props) => (
  <Icone {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icone>
)
export const Chevron = (p: Props) => (
  <Icone {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icone>
)
export const Lecture = (p: Props) => (
  <Icone {...p}>
    <path d="M7 4.5v15l12-7.5-12-7.5Z" />
  </Icone>
)
export const Coche = (p: Props) => (
  <Icone {...p} strokeWidth={2.2}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icone>
)
export const Menu = (p: Props) => (
  <Icone {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icone>
)
export const Croix = (p: Props) => (
  <Icone {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icone>
)
export const Plus = (p: Props) => (
  <Icone {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icone>
)
export const Moins = (p: Props) => (
  <Icone {...p}>
    <path d="M5 12h14" />
  </Icone>
)
export const Globe = (p: Props) => (
  <Icone {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
  </Icone>
)
export const Palette = (p: Props) => (
  <Icone {...p}>
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.8-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z" />
    <circle cx="7.5" cy="11" r="1" fill="currentColor" />
    <circle cx="10" cy="7" r="1" fill="currentColor" />
    <circle cx="14.5" cy="7" r="1" fill="currentColor" />
    <circle cx="17" cy="11" r="1" fill="currentColor" />
  </Icone>
)
export const Telephone = (p: Props) => (
  <Icone {...p}>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M11 18h2" />
  </Icone>
)
export const Cadenas = (p: Props) => (
  <Icone {...p}>
    <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Icone>
)
export const Eclair = (p: Props) => (
  <Icone {...p}>
    <path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12l1-8Z" />
  </Icone>
)
export const Horloge = (p: Props) => (
  <Icone {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icone>
)
export const Enveloppe = (p: Props) => (
  <Icone {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </Icone>
)
export const EnveloppeOuverte = (p: Props) => (
  <Icone {...p}>
    <path d="M3 10v9a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 19v-9l-9-6.5L3 10Z" />
    <path d="m3.5 10.5 8.5 6 8.5-6" />
  </Icone>
)
export const Ticket = (p: Props) => (
  <Icone {...p}>
    <path d="M3 8.5V6h18v2.5a2.5 2.5 0 0 0 0 5V18H3v-4.5a2.5 2.5 0 0 0 0-5Z" />
    <path d="m9 15 6-6M9.5 9.5h.01M14.5 14.5h.01" />
  </Icone>
)
export const Envoi = (p: Props) => (
  <Icone {...p}>
    <path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z" />
  </Icone>
)
export const Couronne = (p: Props) => (
  <Icone {...p}>
    <path d="m3 7 4.5 4L12 5l4.5 6L21 7l-2 11H5L3 7Z" />
  </Icone>
)
export const Telechargement = (p: Props) => (
  <Icone {...p}>
    <path d="M12 4v11M7 10.5l5 5 5-5M4.5 20h15" />
  </Icone>
)
export const Envoyer = (p: Props) => (
  <Icone {...p}>
    <path d="M12 15V4M7 8.5l5-5 5 5M4.5 14v4.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V14" />
  </Icone>
)
export const CercleCoche = (p: Props) => (
  <Icone {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.5 2.8 2.7L16.5 9.5" />
  </Icone>
)
export const Boutique = (p: Props) => (
  <Icone {...p}>
    <path d="M4 9.5 5.5 4h13L20 9.5M4 9.5h16M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5.5 12v8h13v-8M10 20v-4.5h4V20" />
  </Icone>
)
export const Document = (p: Props) => (
  <Icone {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </Icone>
)
export const DocumentTelechargement = (p: Props) => (
  <Icone {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5M12 11v6M9.5 14.5 12 17l2.5-2.5" />
  </Icone>
)
export const Personnes = (p: Props) => (
  <Icone {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
  </Icone>
)
export const Personne = (p: Props) => (
  <Icone {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </Icone>
)
export const PersonneCourbe = (p: Props) => (
  <Icone {...p}>
    <circle cx="13" cy="7" r="3.5" />
    <path d="M4 20c1-4.5 4.5-7 9-7s8 2.5 9 7M3 12.5c1.5-.5 2.5-.4 3.5.3" />
  </Icone>
)
export const Megaphone = (p: Props) => (
  <Icone {...p}>
    <path d="M3 10v4a1 1 0 0 0 1 1h2l8 5V4L6 9H4a1 1 0 0 0-1 1ZM6 15l1.5 5M18 9a4 4 0 0 1 0 6" />
  </Icone>
)
export const Barres = (p: Props) => (
  <Icone {...p}>
    <path d="M4 3v17h17M8.5 16v-5M13 16V7M17.5 16v-8" />
  </Icone>
)
export const Courbe = (p: Props) => (
  <Icone {...p}>
    <path d="M4 3v17h17M7 15l4-5 3 3 6-7" />
  </Icone>
)
export const FactureDollar = (p: Props) => (
  <Icone {...p}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M14.5 8.5h-3.2a1.6 1.6 0 0 0 0 3.2h1.4a1.6 1.6 0 0 1 0 3.2H9.5M12 7v1.5M12 15v1.5" />
  </Icone>
)
export const PoigneeMains = (p: Props) => (
  <Icone {...p}>
    <path d="m11 17 2 2a1.4 1.4 0 0 0 2-2M13 15l2.5 2.5a1.4 1.4 0 0 0 2-2l-3-3M14.5 12.5l1 1a1.4 1.4 0 0 0 2-2L13.6 7.6a2 2 0 0 0-2.8 0l-.9.9a1.4 1.4 0 0 1-2-2l2.8-2.8a3.5 3.5 0 0 1 4.1-.6l.4.2a3 3 0 0 0 1.9.3L21 3M21 3l1 9-2.5 2.5M3 3 2 12l6.5 6.5a1.4 1.4 0 0 0 2-2M3 3h7" />
  </Icone>
)
export const Cible = (p: Props) => (
  <Icone {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  </Icone>
)
export const Photo = (p: Props) => (
  <Icone {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <circle cx="9" cy="9" r="1.8" />
    <path d="m21 15.5-4.5-4.5L6 21" />
  </Icone>
)
export const Copier = (p: Props) => (
  <Icone {...p}>
    <rect x="8" y="8" width="13" height="13" rx="2.5" />
    <path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16H8" />
  </Icone>
)
export const Oeil = (p: Props) => (
  <Icone {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icone>
)
export const OeilBarre = (p: Props) => (
  <Icone {...p}>
    <path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.6 3.5M6.6 6.6C3.6 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Icone>
)
export const Info = (p: Props) => (
  <Icone {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Icone>
)
export const Poignee = (p: Props) => (
  <Icone {...p} stroke="none" fill="currentColor">
    <circle cx="9" cy="6" r="1.4" />
    <circle cx="15" cy="6" r="1.4" />
    <circle cx="9" cy="12" r="1.4" />
    <circle cx="15" cy="12" r="1.4" />
    <circle cx="9" cy="18" r="1.4" />
    <circle cx="15" cy="18" r="1.4" />
  </Icone>
)
export const YouTube = (p: Props) => (
  <Icone {...p}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="3.5" />
    <path d="m10 9.5 4.5 2.5-4.5 2.5v-5Z" />
  </Icone>
)
export const Instagram = (p: Props) => (
  <Icone {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <circle cx="12" cy="12" r="3.8" />
    <path d="M17 7h.01" />
  </Icone>
)
export const TikTok = (p: Props) => (
  <Icone {...p}>
    <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.4 2.6 2 4.3 5 4.5" />
  </Icone>
)
