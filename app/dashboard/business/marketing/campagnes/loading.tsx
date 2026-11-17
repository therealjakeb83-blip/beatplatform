import { SqueletteTableau } from '@/app/dashboard/_navigation/Squelettes'

// Rang 9e : squelette affiché dès le clic, en attendant la page.
export default function Chargement() {
  return <SqueletteTableau cartes={4} lignes={6} />
}
