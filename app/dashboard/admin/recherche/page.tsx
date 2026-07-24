import RechercheClient from './_components/RechercheClient'
import { rechercher } from './_lib/actions'

export default function RecherchePage() {
  return <RechercheClient rechercher={rechercher} />
}
