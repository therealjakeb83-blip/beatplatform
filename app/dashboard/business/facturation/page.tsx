import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getZonedParts, fuseauSur } from '@/lib/fuseau-horaire'
import FacturationClient from './FacturationClient'

export default async function FacturationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('slug, mandat_facturation_version, mandat_facturation_accepte_at, facturation_format, facturation_offset, facturation_annee_courante, facturation_compteur, facturation_offset_mode, facturation_offset_manuel, fuseau_horaire')
    .eq('id', user.id)
    .single()

  // Série "démarrée" pour l'année en cours = au moins une facture déjà
  // émise cette année (comparé dans le fuseau du beatmaker, pas celui du
  // serveur) — au-delà de ce point, l'offset est verrouillé côté serveur
  // et le format déclenche un avertissement avant modification.
  const anneeCourante = getZonedParts(new Date(), fuseauSur(beatmaker?.fuseau_horaire)).year
  const serieDemarree = beatmaker?.facturation_annee_courante === anneeCourante

  return (
    <FacturationClient
      slug={beatmaker?.slug ?? ''}
      mandatVersion={beatmaker?.mandat_facturation_version ?? null}
      mandatAccepteLe={beatmaker?.mandat_facturation_accepte_at ?? null}
      formatPersonnalise={beatmaker?.facturation_format ?? null}
      offset={beatmaker?.facturation_offset ?? null}
      anneeCourante={anneeCourante}
      dernierNumero={beatmaker?.facturation_compteur ?? null}
      serieDemarree={serieDemarree}
      offsetMode={(beatmaker?.facturation_offset_mode as 'aleatoire' | 'manuel') ?? 'aleatoire'}
      offsetManuel={beatmaker?.facturation_offset_manuel ?? null}
    />
  )
}
