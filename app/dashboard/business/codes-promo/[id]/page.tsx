import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import type { CodePromoRow, LicenceOption, BeatOption } from '../page'
import CodePromoDetailClient from './_components/CodePromoDetailClient'

type CommandeDetail = {
  id: string
  created_at: string
  prix_paye: number
  reduction_montant: number | null
  statut: 'en_attente' | 'payee' | 'remboursee' | 'litige'
  clients: { id: string; prenom: string | null; nom: string; nom_artiste: string | null } | null
  beats: { titre: string } | null
  licences: { nom: string } | null
  nbArticles: number
}

type LigneJointe = {
  beats: { titre: string } | null
  licences: { nom: string } | null
}

export default async function CodePromoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const admin = createAdminClient()

  const { data: rawCode } = await admin
    .from('codes_promo')
    .select('*')
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .single()

  if (!rawCode) notFound()
  const code = rawCode as CodePromoRow

  const [{ data: rawCommandes }, { data: bm }, { data: rawLicences }, { data: rawBeats }] = await Promise.all([
    admin
      .from('commandes')
      .select('id, created_at, prix_paye, reduction_montant, statut, clients(id, prenom, nom, nom_artiste), commande_lignes(beats(titre), licences(nom))')
      .eq('beatmaker_id', user.id)
      .eq('code_promo', code.code)
      .order('created_at', { ascending: false })
      .limit(100),
    admin.from('beatmakers').select('slug').eq('id', user.id).single(),
    admin.from('licences').select('id, nom, modele').eq('beatmaker_id', user.id).eq('actif', true).order('ordre'),
    admin.from('beats').select('id, titre, couleur, statut').eq('beatmaker_id', user.id).is('supprime_le', null).in('statut', ['public', 'prive']).order('created_at', { ascending: false }).limit(200),
  ])

  type RawCommande = Omit<CommandeDetail, 'beats' | 'licences' | 'nbArticles'> & { commande_lignes: LigneJointe[] }
  const commandes: CommandeDetail[] = ((rawCommandes ?? []) as unknown as RawCommande[]).map(c => {
    const { commande_lignes, ...rest } = c
    return {
      ...rest,
      beats: commande_lignes?.[0]?.beats ?? null,
      licences: commande_lignes?.[0]?.licences ?? null,
      nbArticles: commande_lignes?.length ?? 0,
    }
  })
  const slug = bm?.slug ?? ''

  const caGenere       = commandes.filter(c => c.statut === 'payee').reduce((s, c) => s + c.prix_paye, 0)
  const remiseAccordee = commandes.filter(c => c.statut === 'payee').reduce((s, c) => s + (c.reduction_montant ?? 0), 0)

  return (
    <CodePromoDetailClient
      code={code}
      commandes={commandes}
      slug={slug}
      caGenere={caGenere}
      remiseAccordee={remiseAccordee}
      licences={(rawLicences ?? []) as LicenceOption[]}
      beats={(rawBeats ?? []) as BeatOption[]}
    />
  )
}
